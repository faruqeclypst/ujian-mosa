# Panduan Migrasi Docker: E-Ujian SaaS

Panduan ini menjelaskan cara memindahkan setup VPS Anda saat ini ke arsitektur Docker yang ter-kontainerisasi. Sistem baru ini memastikan setiap sekolah memiliki kontainer dan volume data yang terisolasi, namun tetap menggunakan satu Docker Image aplikasi yang konsisten.

## 🏗️ Ikhtisar Arsitektur

- **Base Image**: Satu Docker Image berisi binary PocketBase, file frontend yang sudah di-build (`dist`), dan `pb_hooks` bersama.
- **Kontainer**: Setiap sekolah berjalan sebagai kontainer independen berbasis image yang sama.
- **Volume**: Data (`pb_data`) disimpan dalam Docker Volume bernama (`pb_data_{school_id}`) untuk persistensi dan kemudahan backup.
- **Caddy**: Berfungsi sebagai reverse proxy yang menangani SSL (HTTPS) secara otomatis dan mengarahkan lalu lintas ke kontainer sekolah yang tepat.
- **Master Admin**: Instance PocketBase pusat untuk mengelola platform secara keseluruhan.

---

## 🚀 Instruksi Persiapan

### 0. Persiapan di VPS Baru
Sebelum memulai, pastikan Docker dan Git sudah terinstal di VPS. Kemudian clone repository Anda:

```bash
mkdir -p /opt/ujian-docker
cd /opt/ujian-docker
git clone https://github.com/faruqeclypst/ujian-mosa.git .
git checkout feature/saas-docker
```

### 1. Build Base Image
Pastikan Anda sudah menjalankan `npm run build` di lokal dan mem-push folder `dist` (atau jalankan build di VPS jika environment mendukung). Image ini adalah "sumber kebenaran" untuk versi aplikasi Anda.

```bash
# Di terminal Linux/VPS:
chmod +x docker/scripts/*.sh
./docker/scripts/build-base.sh

# Di Windows (lewati chmod):
./docker/scripts/build-base.sh
```

### 2. Jalankan Infrastruktur
Jalankan proxy Caddy dan instance Master PocketBase.

```bash
cd docker/infrastructure
docker-compose up -d
```

### 3. Deploy Sekolah Baru
Gunakan skrip deployment untuk membuat kontainer dan mengatur routing Caddy.

```bash
./docker/scripts/deploy-school.sh
# Ikuti instruksi untuk memasukkan ID Sekolah dan Domain
```

---

## 💾 Backup & Portabilitas

### Backup Malam Hari
Skrip `backup.sh` akan memproses semua volume sekolah, membuat arsip tarball yang dikompresi, dan menyimpannya di `/opt/backups/schools`.

```bash
# Menjalankan backup secara manual:
./docker/scripts/backup.sh

# Rekomendasi: Tambahkan ke Crontab (Setiap jam 2 pagi)
# 0 2 * * * /path/to/project/docker/scripts/backup.sh
```

### Pindah ke VPS Baru
1. **Clone Repo**: `git clone <repo-url>` di VPS baru.
2. **Install Docker**: Pastikan Docker dan Docker Compose sudah terpasang.
3. **Restore Volume**:
   - Salin file backup `.tar.gz` Anda ke `/opt/backups/schools`.
   - Jalankan skrip restore untuk setiap sekolah:
     ```bash
     ./docker/scripts/restore-school.sh pb_data_namasekolah_tanggal.tar.gz
     ```
4. **Jalankan Sistem**:
   ```bash
   cd docker/infrastructure
   docker-compose up -d
   ```
5. **Deploy Ulang Kontainer**: Jalankan `deploy-school.sh` dengan ID sekolah yang sama untuk membuat ulang kontainer yang mengarah ke volume hasil restore.

---

## 🛠️ Perintah Manajemen

| Tindakan | Perintah |
| :--- | :--- |
| **Lihat Logs** | `docker logs -f pb-<school_id>` |
| **Restart Sekolah** | `docker restart pb-<school_id>` |
| **Update Aplikasi** | Jalankan `./docker/scripts/build-base.sh` lalu restart kontainer. |
| **Reload Caddy** | `docker exec -it caddy-proxy caddy reload` |

---

> [!IMPORTANT]
> **Wildcard DNS**: Pastikan domain utama Anda (misal: `*.alfaruqasri.my.id`) sudah diarahkan ke IP VPS Anda agar Caddy dapat menerbitkan sertifikat SSL secara dinamis untuk sekolah baru.

> [!TIP]
> **Cloud Backup**: Edit file `docker/scripts/backup.sh` dan tambahkan perintah `rclone copy` untuk mengunggah backup secara otomatis ke Cloudflare R2 atau S3.
