# Stage Image Upload — Frontend Flow

Uploads images attached to an order stage using the backend's S3 presigned PUT
workflow. Every stage (`DESIGN_PREPARATION`, `SHEET_PROCESSING`, `FABRICATION`,
`DISPATCH_VALIDATION`) uses the same pipeline.

## Modules

| File | Responsibility |
| --- | --- |
| `client/src/lib/stage-uploads.ts` | Low-level API helpers + `uploadAndCompleteStage` orchestration. |
| `client/src/hooks/use-stage-uploads.ts` | React hook with per-file state, retry, remove, derived uploader status. |
| `client/src/components/stage-image-uploader.tsx` | Drop-in UI: picker, preview grid, status badges, retry/remove buttons. |
| `client/src/components/stage-detail-modal.tsx` | Consumes the hook + component; includes `attachments` in its save payload. |
| `client/src/pages/order-details.tsx` | Threads `attachments` into every stage `PATCH` and hydrates them from `GET`. |

## Flow

1. **User picks one or more files** in the stage modal (`<StageImageUploader />`).
2. **Client-side validation** (`validateImageFile`) — only `image/jpeg`, `image/png`,
   `image/webp`, `image/gif`; max 5 MB per file (see `MAX_FILE_SIZE_BYTES`).
   Invalid files never reach the network.
3. For each valid file, **in parallel** via `Promise.all`:
   - `POST /api/uploads/presign` → `{ uploadUrl, publicUrl, key, contentType, method: "PUT" }`.
   - `PUT <uploadUrl>` with the raw file bytes; the `Content-Type` header
     matches the value used when presigning (S3 requirement).
4. The hook records each file's status (`queued` → `uploading` → `success` | `failed`).
5. **Save** (`PATCH /api/orders/:orderId/stage/:stageName`) is blocked while
   any file is still uploading or has failed. Successful files are already in
   S3, so retry-on-PATCH does **not** re-upload them.
6. On save, the modal attaches `uploader.attachments` (existing + newly
   uploaded) to the stage payload, so the PATCH body looks like:

   ```json
   {
     "remarks": "Stage completed with images",
     "attachments": [
       {
         "url": "https://.../orders/<oid>/FABRICATION/<key>.jpg",
         "key": "orders/<oid>/FABRICATION/<key>.jpg",
         "name": "photo.jpg",
         "contentType": "image/jpeg",
         "size": 12345,
         "uploadedAt": "2026-04-20T10:00:00.000Z"
       }
     ]
   }
   ```
7. React Query invalidates the order cache; `normalizeOrderDetail` reads
   `stages[].data.attachments` back and the modal reopens with the saved tiles.

## Error Handling Rules (from spec)

- **Validation fails** → file is skipped and an inline error is shown; no API call made.
- **Presign fails** → per-file failure surfaced on the tile with retry/remove; PATCH is blocked until resolved.
- **S3 PUT fails with `403 SignatureDoesNotMatch` / `AccessDenied` / `RequestExpired`**
  → `uploadFileWithRetry` automatically re-presigns once and retries before
  marking the file as failed. (See `S3UploadError.expiredOrSignature`.)
- **S3 PUT fails for any other reason** → per-file failure surfaced on the tile
  with a Retry button; PATCH is blocked.
- **PATCH fails after successful uploads** → successful attachments stay in
  memory (`uploader.attachments` still contains them, the S3 objects still
  exist), so the user can press Save again without re-uploading.

## Required S3 bucket CORS configuration

The browser will always **preflight** the PUT because `Content-Type: image/*`
is a non-simple header. That preflight must succeed or you'll see:

```
Access to fetch at 'https://<bucket>.s3.<region>.amazonaws.com/…' from
origin 'http://localhost:5173' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check…
```

This cannot be fixed from the frontend — you must add a CORSRule to the S3
bucket. Minimum rule that works with this client:

```json
[
  {
    "AllowedMethods":  ["PUT"],
    "AllowedOrigins":  ["http://localhost:5173", "https://your-app.domain"],
    "AllowedHeaders":  ["Content-Type"],
    "ExposeHeaders":   ["ETag"],
    "MaxAgeSeconds":   3000
  }
]
```

Notes:
- `AllowedOrigins` must match the scheme + host + port of your frontend
  **exactly** — no trailing slash, no wildcard when `AllowedHeaders` is `*`
  and credentials are used. Use separate entries for dev and prod.
- `AllowedHeaders` must include `Content-Type`. If you ever add
  `x-amz-*` headers from the client you must list them here too.
- Apply via console → Bucket → Permissions → Cross-origin resource sharing
  (CORS), or via AWS CLI:

  ```bash
  aws s3api put-bucket-cors --bucket nk-tech-craft-ahm --cors-configuration file://cors.json
  ```

If you see a `0` status in the error message ("Network or CORS error…") —
that's the browser swallowing the response. Preflight failed. Fix the bucket
CORS and try again.

## Stage Name Mapping

Backend stage names are uppercase. The client's timeline uses lowercase keys;
`getApiStageName()` maps them. Both `fabrication` and `powder_coating` map to
`FABRICATION` because the client merges the two into a single stage modal.

## Auth & Headers

- Backend requests (`/api/uploads/presign`, `/api/orders/:id/stage/:name`) use
  the shared `apiRequest` helper which attaches `Authorization: Bearer <token>`
  from `getAuthToken()`.
- The S3 `PUT` intentionally uses plain `fetch` (no auth header) and sets
  `Content-Type` to the exact value sent during presign — adding any extra
  header would break the signature.

## Assumptions

1. Presign response is either `{ success, data: { uploadUrl, key, publicUrl, expiresIn, method } }` **or** the raw object at top-level with either `uploadUrl` or `url` — the client normalizes both.
2. `data.stages[].data.attachments` is an array of `StageAttachment` objects —
   the client re-sends the full array on every PATCH, so the backend treats
   `attachments` as a replace-set, not an append-set.
3. The backend enforces the same MIME whitelist; the client mirrors it so bad
   uploads are caught before burning a presign round-trip.
4. 5 MB is a client-side cap only; adjust `MAX_FILE_SIZE_BYTES` if the bucket
   policy changes.

## Viewing images from a private bucket

The bucket stays private, which means the raw `url` on each attachment
returns `403 AccessDenied` when a browser `<img src="…">` tries to load it.
To render previews, the backend must add a short-lived **presigned GET URL**
(`viewUrl`) to each attachment in the `GET /api/orders/:id` response.

The frontend prefers `viewUrl` over `url` automatically — see
`stage-image-uploader.tsx`:

```tsx
<AttachmentTile previewUrl={a.viewUrl ?? a.url} … />
```

### Required backend change (one place)

In the `GET /api/orders/:id` handler, after you pull the order out of the DB,
enrich each stage's `attachments` with a fresh presigned GET URL:

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function enrichAttachments(atts: StageAttachment[]) {
  return Promise.all(
    atts.map(async (a) => ({
      ...a,
      viewUrl: await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: a.key,
          // Optional: force the browser to open inline instead of download
          // ResponseContentDisposition: `inline; filename="${a.name}"`,
        }),
        { expiresIn: 60 * 60 } // 1 hour is plenty for a page view
      ),
    }))
  );
}

// in the handler:
for (const stage of order.stages ?? []) {
  if (Array.isArray(stage.data?.attachments)) {
    stage.data.attachments = await enrichAttachments(stage.data.attachments);
  }
}
```

### Rules / gotchas

1. **Do NOT persist `viewUrl`.** Regenerate on every GET — otherwise expired URLs stay in the DB forever.
2. **Don't require it in the PATCH schema.** The frontend may echo `viewUrl` back when re-sending an unchanged attachment; have the backend strip/ignore it on write.
3. **Image `<img>` loads do NOT trigger CORS preflight** — they're plain GETs that load bytes into a pixel buffer. So even with a private bucket, you do **not** need a bucket CORS rule for viewing. (CORS is only needed for `fetch()` that reads the response body.)
4. **Long-lived pages should refresh the URL.** If a user leaves a modal open for > 1 hour, the URL will expire. Either refetch the order, or bump `expiresIn` to match your session length.

## Using the helpers directly

### `uploadFilesForStage` — pure upload (no PATCH)

Returns the successfully uploaded attachments + per-file failure reasons.
Use this when you want to drive the PATCH yourself.

```ts
import { uploadFilesForStage } from "@/lib/stage-uploads";

const { uploaded, failed } = await uploadFilesForStage({
  orderId,
  stageName: "FABRICATION",
  files: selectedFiles,
});

if (failed.length > 0) {
  // Show `failed[i].name` + `failed[i].reason`; let the user retry those.
}
// Then PATCH yourself with `{ attachments: uploaded, remarks: "…" }`.
```

### `uploadAndCompleteStage` — upload + PATCH in one call

```ts
import { uploadAndCompleteStage } from "@/lib/stage-uploads";

const result = await uploadAndCompleteStage({
  orderId,
  stageName: "FABRICATION",
  files: selectedFiles,
  existingAttachments: alreadyUploaded,
  stageFormData: { remarks: "Stage completed with images" },
});

if (!result.completed) {
  // Some uploads failed; inspect result.failed and let the user retry.
}
```

## Debug logs

All helpers emit `console.debug("[stage-upload]", …)` lines in dev builds:
presign request body, presign response summary, S3 PUT target host + status,
retry-on-expiry, and the final uploaded/failed counts. They're gated on
`import.meta.env.DEV` so production builds are silent.
