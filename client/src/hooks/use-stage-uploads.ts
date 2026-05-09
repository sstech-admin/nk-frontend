/**
 * `useStageUploads` — per-file upload state + presign/S3 orchestration
 * for a single stage's image picker.
 *
 * Responsibilities:
 *  - Validate selected files (type + size) before anything is sent.
 *  - Start presign + S3 PUT for every valid file in parallel as soon as
 *    they're added (matches the spec's Promise.all requirement).
 *  - Track per-file status so the UI can render spinners, check marks and
 *    inline error + retry affordances.
 *  - Expose a derived uploader `status` + `canSubmit` flag so the hosting
 *    form can disable its Save button while anything is in-flight or failed.
 *  - Merge already-persisted attachments (from a prior save) with newly
 *    uploaded ones so re-submitting doesn't drop earlier images.
 */
import * as React from "react";
import {
  uploadFileWithRetry,
  validateImageFile,
  getApiStageName,
  type StageAttachment,
  type ApiStageName,
} from "@/lib/stage-uploads";

export type UploadItemStatus = "queued" | "uploading" | "success" | "failed";

export interface UploadItem {
  id: string;
  file: File;
  /** Local object URL used for preview while the upload is in-flight. */
  previewUrl: string;
  status: UploadItemStatus;
  error?: string;
  attachment?: StageAttachment;
}

export type UploaderStatus = "idle" | "uploading" | "has_errors" | "ready";

export interface UseStageUploadsResult {
  items: UploadItem[];
  /** Existing (server-persisted) + successfully uploaded attachments — ready for PATCH. */
  attachments: StageAttachment[];
  status: UploaderStatus;
  /** True when nothing is uploading and nothing is in `failed` state. */
  canSubmit: boolean;
  /** Human-readable error for the most recent invalid file pick. Cleared on next add. */
  validationError: string | null;
  addFiles: (files: FileList | File[]) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  removeAttachment: (key: string) => void;
  reset: (initial?: StageAttachment[]) => void;
}

let _uid = 0;
function nextId(): string {
  _uid += 1;
  return `up-${Date.now()}-${_uid}`;
}

export interface UseStageUploadsInput {
  orderId: string | undefined;
  /** Timeline stage key (lowercase) — will be mapped to the backend stage name. */
  stageKey: string;
  /** Already-uploaded attachments for this stage (hydrated from GET /orders/:id). */
  initialAttachments?: StageAttachment[];
}

export function useStageUploads({
  orderId,
  stageKey,
  initialAttachments = [],
}: UseStageUploadsInput): UseStageUploadsResult {
  const apiStageName: ApiStageName = React.useMemo(
    () => getApiStageName(stageKey),
    [stageKey]
  );

  const [existing, setExisting] = React.useState<StageAttachment[]>(initialAttachments);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Re-hydrate "existing" whenever the upstream list changes identity. We use a
  // stable fingerprint of keys so a parent re-render with the same data doesn't
  // thrash state.
  const initialKey = React.useMemo(
    () => initialAttachments.map((a) => a.key).sort().join("|"),
    [initialAttachments]
  );
  React.useEffect(() => {
    setExisting(initialAttachments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const runUpload = React.useCallback(
    async (id: string, file: File) => {
      if (!orderId) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "failed", error: "Order id missing" } : it
          )
        );
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "uploading", error: undefined } : it
        )
      );
      try {
        // Internally: presign → PUT to S3 → retries once with a fresh presign
        // on signature/expired errors. Anything else bubbles up as an error.
        const attachment = await uploadFileWithRetry(orderId, apiStageName, file);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "success", attachment } : it
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "failed", error: msg } : it
          )
        );
      }
    },
    [orderId, apiStageName]
  );

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      setValidationError(null);
      const arr = Array.from(files);
      const valid: UploadItem[] = [];
      const errors: string[] = [];
      for (const f of arr) {
        const err = validateImageFile(f);
        if (err) {
          errors.push(err);
          continue;
        }
        valid.push({
          id: nextId(),
          file: f,
          previewUrl: URL.createObjectURL(f),
          status: "queued",
        });
      }
      if (errors.length > 0) setValidationError(errors.join(" "));
      if (valid.length === 0) return;
      setItems((prev) => [...prev, ...valid]);
      for (const it of valid) runUpload(it.id, it.file);
    },
    [runUpload]
  );

  const retry = React.useCallback(
    (id: string) => {
      setItems((prev) => {
        const target = prev.find((x) => x.id === id);
        if (target) {
          // Fire async upload outside the updater to avoid double-start.
          queueMicrotask(() => runUpload(id, target.file));
        }
        return prev;
      });
    },
    [runUpload]
  );

  const remove = React.useCallback((id: string) => {
    setItems((prev) => {
      const gone = prev.find((it) => it.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const removeAttachment = React.useCallback((key: string) => {
    setExisting((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const reset = React.useCallback(
    (next?: StageAttachment[]) => {
      setItems((prev) => {
        for (const it of prev) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        return [];
      });
      setValidationError(null);
      if (next !== undefined) setExisting(next);
    },
    []
  );

  // Revoke any remaining object URLs on unmount.
  React.useEffect(() => {
    return () => {
      // Snapshot whatever items were most recently in state.
      setItems((prev) => {
        for (const it of prev) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        return prev;
      });
    };
  }, []);

  const status: UploaderStatus = React.useMemo(() => {
    if (items.some((it) => it.status === "uploading" || it.status === "queued"))
      return "uploading";
    if (items.some((it) => it.status === "failed")) return "has_errors";
    if (items.length > 0 && items.every((it) => it.status === "success"))
      return "ready";
    return "idle";
  }, [items]);

  const canSubmit = status !== "uploading" && status !== "has_errors";

  const attachments = React.useMemo(() => {
    const fresh = items
      .map((i) => i.attachment)
      .filter((x): x is StageAttachment => !!x);
    return [...existing, ...fresh];
  }, [existing, items]);

  return {
    items,
    attachments,
    status,
    canSubmit,
    validationError,
    addFiles,
    retry,
    remove,
    removeAttachment,
    reset,
  };
}
