# PocketBase Native - Fast Login Go

Binary PocketBase kustom dengan endpoint `/api/fast-login` yang diimplementasikan
langsung di Go (bukan JS hook), untuk performa paralel tinggi.

## Kenapa Go Native?

Hook JS (`fast_login.pb.js`) berjalan di Goja (single-threaded):
- ~20 request/detik (serial)
- Login 1000 siswa: p50 ~60 detik

Go native:
- ~612 request/detik (paralel)
- Login 1000 siswa: p50 ~103ms

## Build

### Linux (untuk VPS)
```bash
cd pb-native
go build -o pocketbase -ldflags="-s -w" .
```

### Windows (untuk server offline sekolah)
```bash
cd pb-native
GOOS=windows GOARCH=amd64 go build -o pocketbase.exe -ldflags="-s -w" .
```

### Persyaratan
- Go 1.25+
- Koneksi internet (untuk download dependencies pertama kali)

## Deploy

Binary TIDAK di-commit ke git (45MB). Setelah build:

1. Upload ke Worker VPS template:
   ```bash
   scp pocketbase root@43.134.175.87:/opt/pocketbase/schools/template/pocketbase
   scp pocketbase.exe root@43.134.175.87:/opt/pocketbase/schools/template/pocketbase.exe
   ```

2. Dari laptop, jalankan:
   ```
   npm run push:template
   ```
   Script akan otomatis mengambil binary dari Worker VPS ke Master VPS,
   lalu sync ke semua tenant.

## Implementasi

`main.go` mereplikasi logika `fast_login.pb.js`:
- SHA-256(pepper + username + password) untuk fast path
- Fallback ke bcrypt jika hash belum ada
- Auto-migrasi ke fastHash saat login sukses
- Rate limit: 20/menit per username, 2000/menit per IP
- Pepper dari `FAST_LOGIN_PEPPER` env, atau file persisten, atau crypto/rand

PENTING: Jangan taruh `fast_login.pb.js` di `pb_hooks/` jika binary ini dipakai.
Route ganda akan menyebabkan PocketBase panic saat startup.
