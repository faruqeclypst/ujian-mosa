# scripts/push-master-hooks.ps1 - Push master hooks ke Master VPS
# Master hooks = hook untuk PocketBase superadmin/master (bukan template sekolah)
# Lokasi di VPS: /opt/pocketbase/master/pb_hooks/

$VPS_USER = "root"
$VPS_IP = "64.235.41.108"
$REMOTE_HOOKS = "/opt/pocketbase/master/pb_hooks"

Write-Host "==> Mengirim master hooks ke Master VPS ($VPS_IP)..." -ForegroundColor Cyan

if (-not (Test-Path "vps/master_hooks")) {
    Write-Host "Folder vps/master_hooks tidak ditemukan!" -ForegroundColor Red
    exit 1
}

scp vps/master_hooks/*.js "$VPS_USER@${VPS_IP}:$REMOTE_HOOKS/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal mengirim hooks!" -ForegroundColor Red
    exit 1
}

Write-Host "==> Restart PocketBase master..." -ForegroundColor Cyan
ssh "$VPS_USER@$VPS_IP" "systemctl restart pb-master"

Write-Host ""
Write-Host "==> SUKSES: Master hooks sudah diperbarui!" -ForegroundColor Green
