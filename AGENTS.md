<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, load the antislop skill for the task:
- Core filter, always on: `antislop`
- UI / visual: `antislop-ui`
- Copy & text: `antislop-copywriting`
- People: `antislop-human`
- Mobile / responsive: `antislop-layoutmobile`
- Code comments: `antislop-code`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->

## Deployment & Operations Guidelines
When deploying or syncing changes, always follow these rules and refer to [COMMANDS.md](file:///d:/PROJECT/ujian/COMMANDS.md):

### 0. All-in-One Master Release
- Run `npm run release:all` to build and deploy everything in 1 single command:
  - Compiles frontend web (`dist/`)
  - Deploys web dist to Master VPS (`64.235.41.108`)
  - Pushes `pb_hooks/` to Master & Worker template directories
  - 1-Click Syncs all active school tenants
  - Packages and publishes `offline-update.zip` & `version.json` to VPS CDN
  - Builds and uploads Mobile Exambro APK
  - Purges Cloudflare CDN cache
- For rapid releases without rebuilding the mobile APK, run `npm run release:quick` (or `npm run release:offline`).

### 1. Web Frontend Deployment
- Always run `npm run deploy:vps` to build and deploy web updates to the Master VPS (`64.235.41.108`).
- If web changes do not appear immediately in the browser, purge Cloudflare cache via `ssh root@64.235.41.108 "/root/purge_cache.sh"`.

### 2. Backend Hooks & Template Synchronization
- When editing PocketBase hooks (`pb_hooks/`) or database template (`vps/template_school/`):
  1. Push changes to VPS templates: `npm run push:template`
  2. Sync changes across all active tenants on Master and Worker VPS: `npm run sync:tenants` (or trigger 1-Click Sync in SuperAdmin dashboard).
- Never modify tenant database files directly on VPS without updating the template if the change is intended for all tenants.

### 3. Mobile Exambro APK
- Switch app configuration before build: `npm run switch:examaa` (for official exam app) or `npm run switch:browser`.
- Build and upload APK to server: `npm run deploy:apk`.

### 4. Offline Server 1-Click Update
- Schools running offline servers can update directly from their dashboard under Settings -> "Pembaruan 1-Click" or by running `perbarui-server.bat`.
- The database `pb_data/data.db` is strictly preserved and never overwritten.
