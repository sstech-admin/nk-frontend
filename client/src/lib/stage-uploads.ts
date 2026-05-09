/**
 * Stage image upload pipeline — S3 presigned PUT + stage PATCH.
 *
 * Flow (per file):
 *   1. POST /api/uploads/presign   → { uploadUrl, key, publicUrl, contentType, method: "PUT" }
 *   2. PUT <uploadUrl>             → raw file bytes, Content-Type must match presign
 *   3. PATCH /api/orders/:orderId/stage/:stageName with attachments[] + stage fields
 *
 * Validation is performed client-side BEFORE any network call so invalid files
 * never reach the presign endpoint.
 *
 * CORS note (read this if you see "preflight" / "Access-Control-Allow-Origin"
 * failures in the console): the browser WILL preflight the PUT to S3 because
 * `Content-Type: image/*` is a non-simple header. No amount of frontend code
 * can avoid that OPTIONS call. The S3 bucket itself must expose a CORSRule:
 *
 *   [{
 *     "AllowedMethods": ["PUT"],
 *     "AllowedOrigins": ["http://localhost:5173", "https://your-app.domain"],
 *     "AllowedHeaders": ["Content-Type"],
 *     "ExposeHeaders":  ["ETag"],
 *     "MaxAgeSeconds":  3000
 *   }]
 *
 * Until that rule is on the bucket, every browser PUT will be blocked with
 * "CORS request did not succeed" / net::ERR_FAILED.
 */
import { apiRequest } from "./queryClient";

/**
 * Verbose debug mode for upload flow. On in dev by default; flip to `false`
 * to silence. Logs use `console.log` (always visible) while inside a
 * `console.group` per file so the whole pipeline for one upload stays
 * together.
 */
const DEBUG =
  typeof import.meta !== "undefined" &&
  !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

function log(...args: unknown[]): void {
  if (DEBUG) console.log("%c[stage-upload]", "color:#0ea5e9;font-weight:bold", ...args);
}

function logError(...args: unknown[]): void {
  console.error("%c[stage-upload]", "color:#ef4444;font-weight:bold", ...args);
}

function logGroup(label: string): void {
  if (DEBUG) console.group(`%c[stage-upload] ${label}`, "color:#0ea5e9;font-weight:bold");
}

function logGroupEnd(): void {
  if (DEBUG) console.groupEnd();
}

/**
 * Attachment shape persisted on the backend under `stages[].data.attachments`.
 *
 * Persisted fields (the ones we PATCH back): `url`, `key`, `name`,
 * `contentType`, `size`, `uploadedAt`.
 *
 * Transient field (added by backend on GET, not stored, not PATCHed back):
 *   - `viewUrl` — a short-lived presigned GET URL so the browser can render
 *     the image even when the bucket is private. The backend regenerates it
 *     on every GET /api/orders/:id. Typical expiry: 1 hour. The frontend
 *     prefers `viewUrl` over `url` when showing previews.
 */
export type StageAttachment = {
  url: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  /** Presigned GET URL (1h). Filled by the backend on read; do NOT rely on it being present after a local upload. */
  viewUrl?: string;
};

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** 5 MB — kept configurable via the exported constant; bump here if backend cap changes. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Stage names the backend accepts (must match ORDER_STAGES exactly). */
export const API_STAGE_NAMES = [
  "DESIGN_PREPARATION",
  "SHEET_PROCESSING",
  "FABRICATION",
  "DISPATCH_VALIDATION",
] as const;
export type ApiStageName = (typeof API_STAGE_NAMES)[number];

/**
 * Map the timeline stage key used on the client (lowercase) to the backend
 * stage name. Combined fabrication + powder coating both map to FABRICATION.
 */
export function getApiStageName(stageKey: string): ApiStageName {
  const k = String(stageKey ?? "").toUpperCase().replace(/-/g, "_");
  if (k === "POWDER_COATING") return "FABRICATION";
  if ((API_STAGE_NAMES as readonly string[]).includes(k)) return k as ApiStageName;
  return "FABRICATION";
}

/** Returns a user-facing error message, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(mime as AllowedContentType)) {
    return `"${file.name}" has an unsupported type${file.type ? ` (${file.type})` : ""}. Allowed: JPEG, PNG, WEBP, GIF.`;
  }
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const cap = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return `"${file.name}" is ${mb} MB; max allowed is ${cap} MB.`;
  }
  return null;
}

export interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
  method: "PUT";
}

/**
 * Typed S3 error so callers can distinguish CORS/network failures from
 * signature-expired responses (which are worth retrying with a fresh presign).
 */
export class S3UploadError extends Error {
  readonly status: number;
  readonly responseText: string;
  /** True when the response looks like a SignatureDoesNotMatch / AccessDenied / expired-token error. */
  readonly expiredOrSignature: boolean;

  constructor(status: number, responseText: string) {
    const brief = responseText ? ` — ${responseText.slice(0, 200)}` : "";
    super(`S3 upload failed (${status})${brief}`);
    this.name = "S3UploadError";
    this.status = status;
    this.responseText = responseText;
    this.expiredOrSignature = isSignatureOrExpiryError(status, responseText);
  }
}

function isSignatureOrExpiryError(status: number, text: string): boolean {
  if (status !== 403) return false;
  const t = String(text ?? "").toLowerCase();
  return (
    t.includes("signaturedoesnotmatch") ||
    t.includes("requestexpired") ||
    t.includes("accessdenied") ||
    t.includes("expired") ||
    t.includes("signature")
  );
}

/** Step 1 — ask the backend for a presigned PUT URL for this file. */
export async function presignUpload(
  orderId: string,
  stageName: ApiStageName,
  file: File
): Promise<PresignResponse> {
  const body = {
    orderId,
    stageName,
    fileName: file.name,
    contentType: file.type,
  };
  logGroup(`presign → ${file.name}`);
  log("endpoint:", "POST /api/uploads/presign");
  log("payload:", body);
  log("file:", { name: file.name, type: file.type, size: file.size });

  let res: Response;
  try {
    res = await apiRequest("POST", "/api/uploads/presign", body);
  } catch (e) {
    logError("presign fetch threw:", e);
    logGroupEnd();
    throw e;
  }
  log("presign HTTP status:", res.status, res.statusText);

  const json = await res.json().catch((e) => {
    logError("presign response was not JSON:", e);
    return {};
  });
  log("presign full response:", json);

  // Accept either { success, data: {...} } envelope OR a raw presign object
  // at the top level. Also tolerate `url` vs `uploadUrl` field naming.
  const payload = (json?.data ?? json) as Record<string, unknown> | null;
  const uploadUrl =
    (payload?.uploadUrl as string | undefined) ??
    (payload?.url as string | undefined);
  const key = payload?.key as string | undefined;
  const publicUrl = payload?.publicUrl as string | undefined;

  if (!uploadUrl || !key || !publicUrl) {
    logError("presign response missing required fields:", json);
    logGroupEnd();
    throw new Error(json?.message ?? "Failed to create upload URL");
  }

  const normalized: PresignResponse = {
    uploadUrl,
    key,
    publicUrl,
    expiresIn: (payload?.expiresIn as number | undefined) ?? 0,
    method: "PUT",
  };
  log("presign OK:", {
    uploadUrl: normalized.uploadUrl,
    uploadUrlHost: safeHost(normalized.uploadUrl),
    key: normalized.key,
    publicUrl: normalized.publicUrl,
    expiresIn: normalized.expiresIn,
    method: normalized.method,
  });
  logGroupEnd();
  return normalized;
}

/**
 * Step 2 — PUT the raw file bytes to S3.
 *
 * Contract (do NOT break this or the signature check will fail):
 *   - Method: PUT
 *   - Body: the raw `File` object (NOT FormData, NOT base64)
 *   - Headers: ONLY `Content-Type`, and it must match the value sent to
 *     `/api/uploads/presign` byte-for-byte (so always `file.type`).
 *   - No Authorization header, no x-amz-* headers, no custom headers —
 *     anything extra will either break the signature or force a preflight
 *     the bucket's CORS policy probably doesn't allow.
 *   - No `credentials: "include"` — we rely on the default (`same-origin`),
 *     which sends no cookies for the cross-origin S3 request.
 */
export async function uploadToS3(
  uploadUrl: string,
  file: File,
  contentType: string,
  signal?: AbortSignal
): Promise<void> {
  logGroup(`S3 PUT → ${file.name}`);
  console.log("Uploading file:", file);
  console.log("File type:", file.type);
  console.log("Signed URL:", uploadUrl);

  // Sanity assertions — if any of these ever fire, the call is wrong, not the bucket.
  if (file.type !== contentType) {
    logError(
      `Content-Type mismatch! file.type="${file.type}" but presign used "${contentType}". ` +
        "S3 will reject the signature. Re-presign with the file's real type."
    );
  }
  const requestHeaders: Record<string, string> = { "Content-Type": contentType };
  log("request headers (should be Content-Type ONLY):", requestHeaders);
  log("request method: PUT");
  log("request body: raw File (not FormData, not base64)");
  log("request credentials: omit (no cookies, no Authorization)");
  log("url host:", safeHost(uploadUrl));

  const startedAt = performance.now();
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: requestHeaders,
      body: file,
      signal,
    });
  } catch (e) {
    // `fetch` only rejects here when the browser itself blocked the request
    // before it got a response — network-level failure or a CORS preflight
    // that didn't return the expected Access-Control-* headers. There is NO
    // HTTP status to read; `res.status` would be 0.
    const elapsed = Math.round(performance.now() - startedAt);
    const msg = e instanceof Error ? e.message : String(e);
    logError(`fetch() rejected after ${elapsed}ms — status 0 (no HTTP response).`);
    logError("error:", e);
    logError(
      "This is almost always a CORS preflight failure. The browser sent an\n" +
        "OPTIONS preflight to S3 automatically; S3 answered without the\n" +
        "required Access-Control-* headers (or with 403), so the browser\n" +
        "refused to send the PUT.\n" +
        "Fix: add a CORS rule to the S3 bucket allowing PUT from this origin.\n" +
        "Verify with:\n" +
        `  curl -i -X OPTIONS "${uploadUrl.split("?")[0]}?..." \\\n` +
        `    -H "Origin: ${typeof location !== "undefined" ? location.origin : "<origin>"}" \\\n` +
        `    -H "Access-Control-Request-Method: PUT" \\\n` +
        `    -H "Access-Control-Request-Headers: content-type"`
    );
    logGroupEnd();
    throw new S3UploadError(0, `Network or CORS error: ${msg}`);
  }

  const elapsed = Math.round(performance.now() - startedAt);
  log(`S3 PUT response: status=${res.status} ${res.statusText} (${elapsed}ms)`);
  log("response headers:", Object.fromEntries(res.headers.entries()));
  const etag = res.headers.get("etag");
  if (etag) log("ETag:", etag);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("S3 PUT failed. Response body:", text || "<empty>");
    if (res.status === 403) {
      logError(
        "403 from S3 usually means the signed URL doesn't match this request.\n" +
          "Check:\n" +
          "  (a) Content-Type on PUT exactly equals the one sent to /presign\n" +
          "  (b) No extra headers on PUT (no Authorization, no x-amz-*)\n" +
          "  (c) URL hasn't expired (default 15 min)\n" +
          "  (d) Backend didn't include ACL/Metadata/SSE in PutObjectCommand"
      );
    }
    logGroupEnd();
    throw new S3UploadError(res.status, text);
  }
  log("S3 PUT OK");
  logGroupEnd();
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "<invalid-url>";
  }
}

/** Step 3 — PATCH the stage with attachments + any other form fields. */
export async function completeStage(
  orderId: string,
  stageName: ApiStageName,
  payload: Record<string, unknown>
): Promise<unknown> {
  const path = `/api/orders/${orderId}/stage/${encodeURIComponent(stageName)}`;
  log("PATCH stage", { stageName, attachmentCount: Array.isArray(payload.attachments) ? payload.attachments.length : 0 });
  const res = await apiRequest("PATCH", path, payload);
  return res.json().catch(() => null);
}

/** Build a `StageAttachment` from a file + presign response. */
function buildAttachment(file: File, p: PresignResponse): StageAttachment {
  return {
    url: p.publicUrl,
    key: p.key,
    name: file.name,
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Drop the transient `viewUrl` field before sending an attachment back to the
 * backend. `viewUrl` is a short-lived presigned GET URL the backend adds on
 * read for rendering only — persisting it would leave expired URLs in the DB
 * forever. Use this on every PATCH that includes `attachments[]`.
 */
export function stripAttachmentForWrite(a: StageAttachment): StageAttachment {
  const { viewUrl: _viewUrl, ...rest } = a;
  return rest;
}

/**
 * Upload a single file with a one-time retry: if S3 returns a signature /
 * expiry error, request a fresh presigned URL and try again.
 *
 * Exported for reuse from `useStageUploads` so both entry points share the
 * same retry policy.
 */
export async function uploadFileWithRetry(
  orderId: string,
  stageName: ApiStageName,
  file: File
): Promise<StageAttachment> {
  const presigned = await presignUpload(orderId, stageName, file);
  try {
    await uploadToS3(presigned.uploadUrl, file, file.type);
    return buildAttachment(file, presigned);
  } catch (e) {
    if (e instanceof S3UploadError && e.expiredOrSignature) {
      log("retrying with fresh presign after signature/expiry error", {
        file: file.name,
        status: e.status,
      });
      const fresh = await presignUpload(orderId, stageName, file);
      await uploadToS3(fresh.uploadUrl, file, file.type);
      return buildAttachment(file, fresh);
    }
    throw e;
  }
}

export interface UploadAttempt {
  file: File;
  attachment?: StageAttachment;
  error?: string;
}

export interface UploadFilesForStageInput {
  orderId: string;
  /** Accepts either a client timeline key (e.g. "fabrication") or the backend name ("FABRICATION"). */
  stageName: string;
  files: File[];
  /**
   * Optional auth token. The shared `apiRequest` helper already pulls the
   * bearer token out of localStorage (`auth_token`), so callers inside the app
   * normally leave this undefined. The param is here so external callers can
   * pass a fresh token explicitly if needed. (Currently ignored when undefined.)
   */
  token?: string;
}

export interface UploadFilesForStageResult {
  uploaded: StageAttachment[];
  failed: Array<{ name: string; reason: string }>;
}

/**
 * Reusable helper: validates files, presigns + PUTs each one to S3 in
 * parallel, retries once on signature/expiry failures, and returns the
 * successful attachments + the failed ones with their reason.
 *
 * This is the "pure upload" step — it does NOT call the stage PATCH. Compose
 * it with `completeStage()` or `uploadAndCompleteStage()` when you want the
 * full end-to-end flow.
 */
export async function uploadFilesForStage(
  input: UploadFilesForStageInput
): Promise<UploadFilesForStageResult> {
  const orderId = input.orderId;
  const apiStage = getApiStageName(input.stageName);
  const files = input.files ?? [];

  log("uploadFilesForStage start", {
    orderId,
    stageName: apiStage,
    fileCount: files.length,
  });

  const attempts = await Promise.all(
    files.map(async (file): Promise<UploadAttempt> => {
      const validationErr = validateImageFile(file);
      if (validationErr) return { file, error: validationErr };
      try {
        const attachment = await uploadFileWithRetry(orderId, apiStage, file);
        return { file, attachment };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("file upload failed", { name: file.name, reason: msg });
        return { file, error: msg };
      }
    })
  );

  const uploaded: StageAttachment[] = [];
  const failed: Array<{ name: string; reason: string }> = [];
  for (const a of attempts) {
    if (a.attachment) uploaded.push(a.attachment);
    else failed.push({ name: a.file.name, reason: a.error ?? "Unknown error" });
  }

  log("uploadFilesForStage done", {
    uploaded: uploaded.length,
    failed: failed.length,
  });
  return { uploaded, failed };
}

/**
 * Minimal, self-contained file uploader — useful for diagnosing CORS / signature
 * issues in isolation from the rest of the app.
 *
 * Call it from the browser console:
 *   const f = document.querySelector('input[type=file]').files[0];
 *   await window.__handleFileUpload(f, '<ORDER_ID>', 'FABRICATION');
 *
 * If this fails with "Failed to fetch" / "Network or CORS error", the bucket's
 * CORS policy is missing — see stage-uploads.README.md.
 */
export async function handleFileUpload(
  file: File,
  orderId: string,
  stageName: string
): Promise<StageAttachment> {
  const validationErr = validateImageFile(file);
  if (validationErr) throw new Error(validationErr);

  const apiStage = getApiStageName(stageName);
  const presigned = await presignUpload(orderId, apiStage, file);
  await uploadToS3(presigned.uploadUrl, file, file.type);
  return buildAttachment(file, presigned);
}

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { __handleFileUpload?: typeof handleFileUpload }).__handleFileUpload =
    handleFileUpload;
}

export interface UploadAndCompleteInput {
  orderId: string;
  stageName: ApiStageName;
  files: File[];
  /** Already-uploaded attachments to re-send in the PATCH so nothing gets lost. */
  existingAttachments?: StageAttachment[];
  /** Other stage fields (remarks, dc_no, etc.). Passed through to PATCH body. */
  stageFormData?: Record<string, unknown>;
}

export interface UploadAndCompleteResult {
  attachments: StageAttachment[];
  attempts: UploadAttempt[];
  failed: UploadAttempt[];
  /** False when presign/S3 failed for any file — caller must retry/remove and call again. */
  completed: boolean;
}

/**
 * Orchestration: validate → presign+PUT every file in parallel (with one
 * retry on signature/expired) → PATCH stage.
 *
 * If ANY file still fails after the retry, the PATCH is skipped (per spec)
 * and the caller receives the list of successful + failed attempts so it can
 * surface errors and offer retry/remove.
 */
export async function uploadAndCompleteStage(
  input: UploadAndCompleteInput
): Promise<UploadAndCompleteResult> {
  const {
    orderId,
    stageName,
    files,
    existingAttachments = [],
    stageFormData = {},
  } = input;

  for (const f of files) {
    const err = validateImageFile(f);
    if (err) throw new Error(err);
  }

  const attempts = await Promise.all(
    files.map(async (file): Promise<UploadAttempt> => {
      try {
        const attachment = await uploadFileWithRetry(orderId, stageName, file);
        return { file, attachment };
      } catch (e) {
        return { file, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  const succeeded = attempts
    .map((a) => a.attachment)
    .filter((x): x is StageAttachment => !!x);
  const failed = attempts.filter((a) => !a.attachment);

  if (failed.length > 0) {
    return {
      attachments: [...existingAttachments, ...succeeded],
      attempts,
      failed,
      completed: false,
    };
  }

  const merged = [...existingAttachments, ...succeeded];
  await completeStage(orderId, stageName, {
    ...stageFormData,
    attachments: merged.map(stripAttachmentForWrite),
  });

  return {
    attachments: merged,
    attempts,
    failed: [],
    completed: true,
  };
}
