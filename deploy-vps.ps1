# Skrip Build & Deploy Frontend ke VPS
# Penggunaan: .\deploy-vps.ps1

$VPS_USER = "root"
$VPS_IP = "64.235.41.108"
$REMOTE_PATH = "/opt/frontend/ujian"

Write-Host "==> 1. Memulai build frontend (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build gagal. Proses deploy dibatalkan." -ForegroundColor Red
    exit 1
}

Write-Host "==> 2. Mengompres folder dist..." -ForegroundColor Cyan
tar -czf dist.tar.gz -C dist .

Write-Host "==> 3. Mengirim dist.tar.gz ke VPS ($VPS_IP)..." -ForegroundColor Cyan
scp dist.tar.gz "$VPS_USER@$VPS_IP`:$REMOTE_PATH/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal mengirim file ke VPS." -ForegroundColor Red
    Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "==> 4. Mengekstrak file dan mengatur permission di VPS..." -ForegroundColor Cyan
ssh "$VPS_USER@$VPS_IP" "tar -xzf $REMOTE_PATH/dist.tar.gz -C $REMOTE_PATH/dist/ && rm $REMOTE_PATH/dist.tar.gz && chmod -R 755 $REMOTE_PATH/dist"

Write-Host "==> 5. Membersihkan file arsip lokal..." -ForegroundColor Cyan
Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue

Write-Host "==> Selesai! Deploy ke VPS berhasil." -ForegroundColor Green
