# Cloudflare Worker for R2 File Deletion

This Cloudflare Worker handles file deletion operations for Cloudflare R2 storage.

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

✅ **DEPLOYED**: The unified worker (`examku-worker.js`: upload + delete + file serve)
is now deployed at:
`https://r2-delete-worker.faruq-blogger.workers.dev`
(nama worker dipertahankan agar `VITE_R2_WORKER_URL` tidak perlu diubah)

## Update Environment Variable

The `VITE_R2_WORKER_URL` in your `.env` file should be set to:

```env
VITE_R2_WORKER_URL=https://r2-delete-worker.faruq-blogger.workers.dev
```

## Worker Status

- ✅ **Worker Deployed**: r2-delete-worker (menjalankan `examku-worker.js`)
- ✅ **R2 Binding**: EXAMKU_BUCKET → tu-mosa
- ✅ **CORS Enabled**: Allows cross-origin requests
- ✅ **Routes**: `POST /upload` (multipart FormData: `key`, `file`, `contentType`), `POST /` (JSON `{key}` untuk delete), `GET /<key>` (serve file)
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
