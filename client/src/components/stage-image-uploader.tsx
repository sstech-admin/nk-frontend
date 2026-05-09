/**
 * StageImageUploader — multi-image picker bound to `useStageUploads`.
 *
 * Renders:
 *  - A dropzone-style file input (hidden, multiple).
 *  - A tile grid with per-file preview + status badge (uploading / success / failed).
 *  - Inline retry + remove buttons per tile; existing persisted attachments can be
 *    removed independently.
 *  - Validation / uploader error messages.
 *  - A click-to-view lightbox that opens the full-size image in a Dialog.
 *
 * Read-only mode: renders larger previews with contained (not cropped) images
 * and no controls — just click-to-view. Useful for completed-stage views or
 * for users without edit rights.
 */
import * as React from "react";
import {
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ImageOff,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/stage-uploads";
import type { UseStageUploadsResult, UploadItemStatus } from "@/hooks/use-stage-uploads";

interface Props {
  uploader: UseStageUploadsResult;
  readOnly?: boolean;
  label?: string;
  className?: string;
}

export function StageImageUploader({
  uploader,
  readOnly = false,
  label = "Upload Images",
  className,
}: Props) {
  const {
    items,
    attachments,
    status,
    validationError,
    addFiles,
    retry,
    remove,
    removeAttachment,
  } = uploader;

  const acceptAttr = ALLOWED_CONTENT_TYPES.join(",");
  const maxMb = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);

  // In-progress items' keys so we don't render the same attachment twice
  // (the item's `attachment.key` will already be in `attachments`).
  const liveKeys = React.useMemo(
    () => new Set(items.map((i) => i.attachment?.key).filter(Boolean) as string[]),
    [items]
  );
  const persistedOnly = React.useMemo(
    () => attachments.filter((a) => !liveKeys.has(a.key)),
    [attachments, liveKeys]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(files);
    e.target.value = "";
  };

  const hasAnyTile = items.length > 0 || persistedOnly.length > 0;

  // Lightbox: when a tile is clicked, open the full image in a Dialog.
  const [lightbox, setLightbox] = React.useState<{ url: string; name: string } | null>(null);

  // Tighter grid in edit mode (many small tiles), roomier grid in view mode
  // (images readable without opening the lightbox).
  // const gridClass = readOnly
  //   ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
  //   : "grid grid-cols-3 sm:grid-cols-4 gap-2";

  const gridClass = '';

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>

      {!readOnly && (
        <label
          className={cn(
            "flex flex-col items-center justify-center w-full min-h-[110px] rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
            status === "uploading" && "opacity-70"
          )}
        >
          <input
            type="file"
            accept={acceptAttr}
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
          <Upload className="h-7 w-7 text-muted-foreground mb-1.5" />
          <span className="text-sm text-muted-foreground">
            Click to select images
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            JPEG / PNG / WEBP / GIF &bull; max {maxMb} MB each
          </span>
        </label>
      )}

      {validationError && (
        <p className="text-xs font-medium text-destructive break-words">
          {validationError}
        </p>
      )}

      {hasAnyTile && (
        <div className={gridClass}>
          {persistedOnly.map((a) => (
            <AttachmentTile
              key={a.key}
              previewUrl={a.viewUrl ?? a.url}
              name={a.name}
              status="success"
              readOnly={readOnly}
              onRemove={() => removeAttachment(a.key)}
              onOpen={() => setLightbox({ url: a.viewUrl ?? a.url, name: a.name })}
            />
          ))}
          {items.map((it) => {
            // Prefer the backend-issued presigned GET URL (`viewUrl`) when
            // present. Until it arrives, fall back to the local blob preview
            // — NEVER to `attachment.url`, because on a private bucket that
            // returns XML AccessDenied which Chrome's ORB blocks
            // (ERR_BLOCKED_BY_ORB) when used as an <img src>.
            const tileUrl =
              it.attachment?.viewUrl ?? it.previewUrl ?? it.attachment?.url ?? "";
            return (
              <AttachmentTile
                key={it.id}
                previewUrl={tileUrl}
                name={it.file.name}
                status={it.status}
                errorMessage={it.error}
                readOnly={readOnly}
                onRemove={() => remove(it.id)}
                onRetry={() => retry(it.id)}
                onOpen={
                  it.status === "success" && tileUrl
                    ? () => setLightbox({ url: tileUrl, name: it.file.name })
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      <ImageLightbox
        image={lightbox}
        onClose={() => setLightbox(null)}
      />

      {!hasAnyTile && readOnly && (
        <div className="flex flex-col items-center justify-center min-h-[80px] rounded-lg border border-border bg-muted/30 p-3">
          <ImageOff className="h-5 w-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">No images attached</span>
        </div>
      )}

      {status === "uploading" && !readOnly && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
        </p>
      )}
      {status === "has_errors" && !readOnly && (
        <p className="text-xs font-medium text-destructive">
          One or more uploads failed. Retry or remove them before saving.
        </p>
      )}
    </div>
  );
}

function AttachmentTile({
  previewUrl,
  name,
  status,
  errorMessage,
  readOnly,
  onRemove,
  onRetry,
  onOpen,
}: {
  previewUrl: string;
  name: string;
  status: UploadItemStatus;
  errorMessage?: string;
  readOnly?: boolean;
  onRemove?: () => void;
  onRetry?: () => void;
  onOpen?: () => void;
}) {
  const showOverlaySpinner = status === "uploading" || status === "queued";
  const showFailedOverlay = status === "failed";
  // Empty previewUrl ⇒ treat as broken so we render the placeholder instead of
  // letting the browser try to load <img src="">.
  const [imgBroken, setImgBroken] = React.useState(!previewUrl);
  React.useEffect(() => { setImgBroken(!previewUrl); }, [previewUrl]);

  const clickable = !!onOpen && !imgBroken && status === "success";

  const handleImgClick = () => {
    if (clickable && onOpen) onOpen();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && clickable && onOpen) {
      e.preventDefault();
      onOpen();
    }
  };

  // In read-only mode, show the full image (contain, centered on a light
  // background). In edit mode, keep the tighter cover crop for a clean grid.
  const imgFit = readOnly ? "object-contain p-1" : "object-cover";

  return (
    <div className="relative group rounded-md border border-border overflow-hidden bg-muted/30">
      <div className="w-full bg-muted flex items-center justify-center">
        {imgBroken ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground px-1 text-center">
            <ImageOff className="h-5 w-5 mb-1" />
            <span className="text-[10px] leading-tight">Preview unavailable</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleImgClick}
            onKeyDown={handleKeyDown}
            disabled={!clickable}
            className={cn(
              "h-full w-full p-0 m-0 border-0 bg-transparent",
              clickable && "cursor-zoom-in"
            )}
            title={clickable ? `Open ${name}` : undefined}
          >
            <img
              src={previewUrl}
              alt={name}
              className={cn("h-full w-full", imgFit)}
              loading="lazy"
              onError={() => setImgBroken(true)}
            />
          </button>
        )}
      </div>

      {clickable && (
        <div className="absolute bottom-7 right-1 rounded-full bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Maximize2 className="h-3 w-3" />
        </div>
      )}

      {showOverlaySpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </div>
      )}

      {status === "success" && (
        <div className="absolute top-1 left-1 rounded-full bg-emerald-500 text-white p-0.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
      )}

      {showFailedOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/80 text-destructive-foreground text-[10px] px-1 text-center">
          <AlertCircle className="h-4 w-4 mb-0.5" />
          <span className="line-clamp-2 leading-tight">
            {errorMessage ?? "Upload failed"}
          </span>
        </div>
      )}

      {!readOnly && (
        <div className="absolute top-1 right-1 flex gap-1">
          {status === "failed" && onRetry && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full"
              onClick={onRetry}
              title="Retry upload"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full"
              onClick={onRemove}
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <div
        className="px-1.5 py-1 text-[10px] truncate border-t border-border bg-card"
        title={name}
      >
        {name}
      </div>
    </div>
  );
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: { url: string; name: string } | null;
  onClose: () => void;
}) {
  const open = !!image;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[92vw] sm:max-w-3xl p-0 overflow-hidden bg-black border-0 [&>button]:text-white [&>button]:hover:bg-white/10">
        <DialogTitle className="sr-only">{image?.name ?? "Image preview"}</DialogTitle>
        {image && (
          <div className="relative">
            <img
              src={image.url}
              alt={image.name}
              className="w-full max-h-[85vh] object-contain bg-black"
            />
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between gap-2">
              <span className="text-xs text-white truncate">{image.name}</span>
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs text-white/90 hover:text-white underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
