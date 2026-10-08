# Cloudflare Workers — Examku & R2

## Arsitektur (2026-10-08)

Ada **2 worker**, jangan tertukar:

| Worker | URL | Bucket | Dipakai oleh |
|---|---|---|---|
| `examku-worker` | `https://examku-worker.faruq-blogger.workers.dev` | `examku` | **Aplikasi Examku** (upload + delete + serve file) |
| `r2-delete-worker` | `https://r2-delete-worker.faruq-blogger.workers.dev` | `tu-mosa` | **Aplikasi lain** — ⚠️ JANGAN DIUBAH |

- Aplikasi Examku **wajib** pakai `examku-worker`:
  ```env
  VITE_R2_WORKER_URL=https://examku-worker.faruq-blogger.workers.dev
  VITE_R2_PUBLIC_BASE_URL=https://assets.examku.my.id
  ```
  Custom domain `assets.examku.my.id` terpasang di bucket `examku`
  (terverifikasi 2026-10-08: file di bucket lain 404 di domain ini).
- `examku-worker` menjalankan `examku-worker.js` (upload + delete + serve + proxy),
  binding `EXAMKU_BUCKET` → bucket `examku`. Deploy via dashboard / wrangler.
- `r2-delete-worker` menjalankan `r2-delete.js` (khusus delete),
  binding `INVENTORY_BUCKET` → bucket `tu-mosa`.
  **Dipakai aplikasi lain juga — jangan ubah script, binding, atau bucket-nya.**

## Riwayat insiden (2026-10-08)

`VITE_R2_WORKER_URL` sempat menunjuk ke `r2-delete-worker` (khusus delete),
sehingga upload gagal dengan error
`No number after minus sign in JSON at position 1`
(worker delete me-`request.json()` body multipart).
Solusi: kembalikan Examku ke `examku-worker`, jangan utak-atik `r2-delete-worker`.

## Setup

1. Install Cloudflare Workers CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Configure your Cloudflare account in wrangler.toml (already configured with your R2 settings)

## Environment Variables

The worker uses the following environment variables (already configured in wrangler.toml):

- `R2_ACCOUNT_ID`: Your Cloudflare account ID
- `R2_ACCESS_KEY_ID`: Your R2 API token (Access Key ID)
- `R2_SECRET_ACCESS_KEY`: Your R2 API token (Secret Access Key)
- `R2_BUCKET`: Your R2 bucket name

## Deployment

Deploy the worker to Cloudflare:

```bash
cd cloudflare-worker
wrangler deploy
```

✅ **DEPLOYED**: `examku-worker` (menjalankan `examku-worker.js`: upload + delete + serve)
`https://examku-worker.faruq-blogger.workers.dev`

## Update Environment Variable

The `VITE_R2_WORKER_URL` in your `.env` file should be set to:

```env
VITE_R2_WORKER_URL=https://examku-worker.faruq-blogger.workers.dev
VITE_R2_PUBLIC_BASE_URL=https://assets.examku.my.id
```

## Worker Status

- ✅ **Worker Deployed**: examku-worker (menjalankan `examku-worker.js`)
- ✅ **R2 Binding**: EXAMKU_BUCKET → examku
- ✅ **CORS Enabled**: Allows cross-origin requests
- ✅ **Routes**: `POST /upload` (multipart FormData: `key`, `file`, `contentType`), `POST /` (JSON `{key}` untuk delete), `GET /<key>` (serve file), `GET /proxy?url=` (proxy gambar eksternal)
- ✅ **Error Handling**: Proper error responses and logging

## Usage

The worker accepts POST requests with the following JSON payload:

```json
{
  "key": "path/to/your/file.jpg",
  "url": "https://your-domain.com/path/to/your/file.jpg"
}
```

### Response

Success response:
```json
{
  "success": true,
  "message": "File deleted successfully",
  "key": "path/to/your/file.jpg"
}
```

Error response:
```json
{
  "success": false,
  "error": "Failed to delete file",
  "details": "Error message"
}
```

## Development

To test locally:

```bash
wrangler dev
```

## Security Note

Make sure to:
1. Use API tokens instead of global API keys for better security
2. Restrict the API token to only R2 operations
3. Use environment variables for sensitive configuration
4. Consider adding rate limiting for production use
