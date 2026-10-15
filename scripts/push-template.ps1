# scripts/push-template.ps1 — Push template sekolah (pb_hooks & db) dari repo lokal ke VPS
param (
    [switch]$AutoSync = $false
)

$VPS_USER = "root"
$VPS_IP = "64.235.41.108"
$REMOTE_TEMPLATE = "/opt/pocketbase/schools/template"

Write-Host "==> 1. Memeriksa file template lokal di repo..." -ForegroundColor Cyan
if (-not (Test-Path "vps/template_school")) {
    Write-Host "Folder vps/template_school tidak ditemukan!" -ForegroundColor Red
    exit 1
}

# Selaraskan folder pb_hooks root dengan vps/template_school/pb_hooks jika ada perubahan
# (kecuali _removed_go_native — arsip hook yang diganti Go native)
if (Test-Path "pb_hooks") {
    Get-ChildItem "pb_hooks/*" -Exclude "_removed_go_native" | Copy-Item -Destination "vps/template_school/pb_hooks/" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> 2. Mengirim pb_hooks, binary Go-native & template ke Master VPS ($VPS_IP)..." -ForegroundColor Cyan
scp -r vps/template_school/pb_hooks/* "$VPS_USER@$VPS_IP`:$REMOTE_TEMPLATE/pb_hooks/"
scp vps/template_school/pb_data/data.db "$VPS_USER@$VPS_IP`:$REMOTE_TEMPLATE/pb_data/data.db"
# Binary PocketBase custom (Go-native fast-login) — 45MB
# Prioritas: dari repo lokal, fallback: ambil dari Worker VPS (sudah terpasang)
if (Test-Path "vps/template_school/pocketbase") {
    Write-Host "    Mengirim binary pocketbase Go-native dari repo..." -ForegroundColor Cyan
    scp vps/template_school/pocketbase "$VPS_USER@$VPS_IP`:$REMOTE_TEMPLATE/pocketbase"
    ssh "$VPS_USER@$VPS_IP" "chmod +x $REMOTE_TEMPLATE/pocketbase"
} else {
    Write-Host "    Binary tidak di repo — mengambil dari Worker VPS..." -ForegroundColor Cyan
    ssh "$VPS_USER@$VPS_IP" "scp -o StrictHostKeyChecking=no root@43.134.175.87:/opt/pocketbase/schools/template/pocketbase $REMOTE_TEMPLATE/pocketbase; chmod +x $REMOTE_TEMPLATE/pocketbase"
}
# Hapus fast_login.pb.js dari template (diganti Go native - hindari route conflict)
ssh "$VPS_USER@$VPS_IP" "rm -f $REMOTE_TEMPLATE/pb_hooks/fast_login.pb.js"
# Update sync-all-tenants.sh di Master VPS (versi baru: sync binary + hapus JS hook)
if (Test-Path "vps/sync-all-tenants.sh") {
    Write-Host "    Mengupdate sync-all-tenants.sh di Master VPS..." -ForegroundColor Cyan
    scp vps/sync-all-tenants.sh "$VPS_USER@$VPS_IP`:/usr/local/bin/sync-all-tenants.sh"
    ssh "$VPS_USER@$VPS_IP" "chmod +x /usr/local/bin/sync-all-tenants.sh"
}

Write-Host "==> 3. Mengatur permission & sinkronisasi ke Worker Node (43.134.175.87)..." -ForegroundColor Cyan
ssh "$VPS_USER@$VPS_IP" "chown -R ubuntu:ubuntu $REMOTE_TEMPLATE; rsync -avz --delete $REMOTE_TEMPLATE/ root@43.134.175.87:$REMOTE_TEMPLATE/; ssh root@43.134.175.87 'chown -R ubuntu:ubuntu $REMOTE_TEMPLATE'"

Write-Host ""
Write-Host "==> SUKSES: Template di Master VPS dan Worker VPS sudah 100% mutakhir!" -ForegroundColor Green

if ($AutoSync) {
    Write-Host "==> Menjalankan sinkronisasi langsung ke seluruh tenant sekolah..." -ForegroundColor Cyan
    ssh "$VPS_USER@$VPS_IP" "/usr/local/bin/sync-all-tenants.sh"
    Write-Host "==> Selesai! Seluruh tenant telah diperbarui." -ForegroundColor Green
} else {
    Write-Host "==> Langkah Selanjutnya: Buka Super Admin Dashboard (https://examku.my.id/superadmin/infra) lalu klik tombol '1-Click Sync Seluruh Tenant' untuk menerapkan ke semua sekolah aktif." -ForegroundColor Yellow
}
