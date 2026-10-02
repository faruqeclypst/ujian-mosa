# Panduan Build & Deploy Frontend ke VPS

Dokumentasi ini berisi panduan lengkap untuk melakukan kompilasi (*build*) dan pengiriman bundle frontend ke server VPS.

---

## Informasi Server VPS

| Parameter | Nilai |
| :--- | :--- |
| **IP VPS** | `64.235.41.108` |
| **User** | `root` |
| **Path Tujuan** | `/opt/frontend/ujian/dist/` |
| **Web Server** | Caddy (`/opt/frontend/ujian/dist` disajikan langsung oleh Caddy) |

---

## Metode 1: Tar + SCP (Paling Cepat & Direkomendasikan di Windows)

Folder `dist` memiliki ratusan aset file kecil (seperti font KaTeX dan potongan file JS/CSS). Mengirim satu per satu menggunakan SCP biasa akan lambat. Dengan mengompres folder menjadi arsip tar sebelum dikirim, proses transfer hanya memakan waktu 2–5 detik.

Jalankan perintah ini di **PowerShell** (di direktori proyek `d:\PROJECT\ujian`):

```powershell
# 1. Build aplikasi frontend
npm run build

# 2. Kompres folder dist menjadi satu file arsip
tar -czf dist.tar.gz -C dist .

# 3. Kirim file arsip ke VPS
scp dist.tar.gz root@64.235.41.108:/opt/frontend/ujian/

# 4. Ekstrak di VPS, atur permission, dan bersihkan arsip di server
ssh root@64.235.41.108 "tar -xzf /opt/frontend/ujian/dist.tar.gz -C /opt/frontend/ujian/dist/ && rm /opt/frontend/ujian/dist.tar.gz && chmod -R 755 /opt/frontend/ujian/dist"

# 5. Hapus arsip sementara di komputer lokal
Remove-Item dist.tar.gz
```

---

## Metode 2: Menggunakan SCP Langsung

Jika ingin menyalin langsung seluruh isi folder tanpa membuat arsip:

```powershell
# Jalankan setelah 'npm run build'
scp -r dist/* root@64.235.41.108:/opt/frontend/ujian/dist/
```

> **Catatan:** Metode ini membutuhkan waktu lebih lama karena membuka koneksi SSH untuk setiap file secara berurutan.

---

## Metode 3: Menggunakan Rsync (Git Bash / Linux / WSL)

Jika Anda bekerja dari terminal **Git Bash** atau **WSL**:

```bash
# Build
npm run build

# Sinkronisasi folder dist (hanya mengirim file yang berubah)
rsync -avz --delete dist/ root@64.235.41.108:/opt/frontend/ujian/dist/
```

---

## Metode 4: Menggunakan Aplikasi GUI (WinSCP / FileZilla)

Jika lebih menyukai tampilan visual (drag & drop):

1. Buka aplikasi **WinSCP** atau **FileZilla**.
2. Hubungkan ke server:
   - **Host / IP**: `64.235.41.108`
   - **Port**: `22`
   - **Username**: `root`
   - **Autentikasi**: SSH Key atau Password root.
3. Di panel kanan (Remote / VPS), buka direktori: `/opt/frontend/ujian/dist/`.
4. Di panel kiri (Lokal), buka folder: `d:\PROJECT\ujian\dist\`.
5. Seret (*drag & drop*) seluruh file dan folder di dalam `dist` lokal ke folder `dist` di server (pilih timpa / *overwrite* semua).

---

## Verifikasi Setelah Deploy

Untuk memastikan file berhasil diperbarui di VPS, Anda dapat mengeceknya dengan SSH:

```bash
# Cek timestamp file index.html terbaru
ssh root@64.235.41.108 "ls -la /opt/frontend/ujian/dist/index.html"

# Cek apakah aset terbaru sudah ada di server
ssh root@64.235.41.108 "ls -la /opt/frontend/ujian/dist/assets | head -n 10"
```
