---
name: deploy-ops
description: "Standard operating procedures for building, deploying, pushing templates, and syncing tenants across Master VPS and Worker VPS in Examku."
---

# Deploy & Operations SOP for Examku

Use this skill whenever you need to deploy web updates, update PocketBase backend hooks, synchronize tenant databases, or release mobile APKs.

## 0. Single-Gate Version Management (WAJIB DIIKUTI)
- **Aturan**: Jangan pernah mengedit versi secara manual di file terpisah.
- **Kapan AI Agent Harus Menaikkan Versi**:
  1. Pengguna meminta rilis atau update versi baru ("rilis versi baru", "update aplikasi", "build ulang semua").
  2. Terdapat penambahan fitur baru, perbaikan bug krusial, atau patch keamanan yang dipublikasikan ke produksi.
  3. Sebelum menjalankan rilis master `release:all` atau `release:quick` jika rilis ditujukan untuk versi baru.
- **Perintah 1 Gerbang**:
  ```bash
  npm run version:set <versi_baru> [--notes "Catatan Rilis"]
  ```
  Contoh: `npm run version:set 1.1.2` atau `npm run version:set 1.2.0 --notes "Stabilitas kiosk & perbaikan sync"`
- **Komponen yang Otomatis Disinkronkan**:
  1. `package.json` (`"version"`)
  2. `src/utils/version.ts` (`APP_VERSION` & `APP_DISPLAY_VERSION` pada UI Web)
  3. `android/app/build.gradle` (`versionName` & auto-increment `versionCode`)
  4. `public/version.json` & `offline_package/version.json` (metadata CDN & paket offline)
  5. `pb_hooks/offline_update.pb.js` & template hooks
  6. `scripts/release-all.js` (konstanta fallback rilis)

---

## 1. All-in-One Master Release (Recommended)
- **Full Release (Web + VPS + Hooks + Tenants + Offline + Mobile APK + CDN Purge)**:
  ```bash
  npm run release:all
  ```
- **Quick / Offline Release (Skips Mobile APK Rebuild)**:
  ```bash
  npm run release:quick
  # or
  npm run release:offline
  ```
- **Workflow executed automatically**:
  1. `npm run build` (tsc & vite build)
  2. Deploy web bundle to Master VPS (`64.235.41.108:/opt/frontend/ujian/dist`)
  3. Push `pb_hooks/` to Master & Worker template directories
  4. 1-Click Sync all active school tenants
  5. Package `offline-update.zip` & `version.json` and upload to `/opt/frontend/ujian/dist/downloads/`
  6. Build & deploy Android APK Exambro (if not skipped)
  7. Purge Cloudflare CDN cache completely

---

## 2. Web Frontend Deployment
- **Command**:
  ```bash
  npm run deploy:vps
  ```
- **What it does**:
  1. Runs `npm run build` (`tsc && vite build`).
  2. Compresses `dist` into `dist.tar.gz`.
  3. Transfers `dist.tar.gz` via SCP to Master VPS `root@64.235.41.108:/opt/frontend/ujian/`.
  4. Extracts to `/opt/frontend/ujian/dist` and ensures permissions (`chmod -R 755`).
- **CDN Purge**:
  If updates are not reflected in browser due to Cloudflare cache:
  ```bash
  ssh root@64.235.41.108 "/root/purge_cache.sh"
  ```

---

## 3. PocketBase Hooks & Template Sync
- **Locations**:
  - Local source: `pb_hooks/` and `vps/template_school/`
  - Master VPS: `/opt/pocketbase/schools/template/`
  - Worker VPS: `/opt/pocketbase/schools/template/`
- **Step 1 - Push Template to VPS**:
  ```bash
  npm run push:template
  ```
  Copies `pb_hooks` and `data.db` to Master VPS, then rsyncs to Worker Node (`43.134.175.87`).
- **Step 2 - Apply to All Active Schools**:
  ```bash
  npm run sync:tenants
  ```
  Or invoke `/usr/local/bin/sync-all-tenants.sh` on Master VPS.
  This copies hooks to all active schools and restarts their systemd services (`pb-<slug>`).

---

## 4. Mobile Exambro APK Deployment
- **Switch Profile**:
  - Official Exam AA client: `npm run switch:examaa`
  - Standard Browser client: `npm run switch:browser`
- **Build & Deploy**:
  ```bash
  npm run deploy:apk
  ```
  Builds the Android debug APK with Gradle, uploads it to `/opt/frontend/ujian/dist/`, updates `app-debug.apk` fallback link, and purges Cloudflare cache.

---

## 5. Key Server IPs and Paths
- **Master VPS**: `64.235.41.108`
- **Worker VPS**: `43.134.175.87`
- **Web Dist**: `/opt/frontend/ujian/dist`
- **Schools Base**: `/opt/pocketbase/schools/`
- **Tenant Services**: `systemctl status/restart pb-<slug>`
- **Caddy Configs**: `/etc/caddy/Caddyfile` and `/etc/caddy/conf.d/<slug>.caddy`
- Reference manual: [COMMANDS.md](file:///d:/PROJECT/ujian/COMMANDS.md)
