# Panduan Arsitektur & Setup Multi-VPS (Worker Node) — EXAM AA

Dokumen ini berisi panduan lengkap untuk menjalankan institusi/tenant di VPS terpisah (**Worker Node**) sementara Master Control Plane tetap berada di VPS Utama (`64.235.41.108`).

---

## 1. Konsep & Arsitektur

```
                               ┌─────────────────────────────────────────┐
                               │           VPS 1 (MASTER CONTROL)        │
                               │              64.235.41.108              │
                               │  - Master Registry PB (examku.my.id)    │
                               │  - Super Admin Dashboard                │
                               │  - Tenant Standar (Starter/Reguler)     │
                               └──────────────────┬──────────────────────┘
                                                  │ (SSH / API)
                          ┌───────────────────────┴───────────────────────┐
                          ▼                                               ▼
             ┌─────────────────────────┐                     ┌─────────────────────────┐
             │   VPS 2 (WORKER NODE)   │                     │   VPS 3 (WORKER NODE)   │
             │      IP: 103.xxx.xxx.1  │                     │      IP: 103.xxx.xxx.2  │
             │  - Sekolah A (1000 Siswa│                     │  - Sekolah B (800 Siswa)│
             │  - Caddy Auto SSL       │                     │  - Caddy Auto SSL       │
             │  - Port 8090/8095       │                     │  - Port 8090/8095       │
             └─────────────────────────┘                     └─────────────────────────┘
```

### Mengapa Perlu Multi-VPS?
* **Isolasi Beban Ujian**: Saat sekolah dengan 500–1.000 siswa ujian serentak, proses baca-tulis soal, timer, dan websocket realtime akan mengonsumsi CPU & RAM tinggi. Dengan memindahkannya ke VPS tersendiri, sekolah lain dan VPS Master tidak akan pernah lag atau tumbang.
* **Skalabilitas Fleksibel**: Anda cukup menyewa VPS terjangkau (misal 2 vCPU 4GB RAM) khusus untuk sekolah tersebut.
* **Frontend Bebas**: Frontend React kita (`TenantContext.tsx`) secara dinamis menghubungkan database siswa ke URL yang tertera di `record.pb_url`.

---

## 2. Persiapan Awal di VPS Baru (Cukup 1x Saja)

Saat Anda baru menyewa VPS baru (Ubuntu 22.04 / 24.04 LTS), lakukan langkah berikut sekali saja:

### A. Install Caddy & PocketBase di VPS Baru
Login via SSH ke VPS Baru (`root`), lalu jalankan:

```bash
# 1. Update sistem & install dependencies
apt update && apt upgrade -y
apt install -y curl wget unzip debian-keyring debian-archive-keyring apt-transport-https ufw

# 2. Install Caddy Web Server
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y

# 3. Buat direktori kerja
mkdir -p /opt/pocketbase/schools/template/pb_hooks
mkdir -p /opt/pocketbase/schools/template/pb_data
mkdir -p /opt/frontend/ujian/dist
mkdir -p /etc/caddy/conf.d

# 4. Download PocketBase binary (sesuai versi yang dipakai)
PB_VERSION="0.22.20"
wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -o /tmp/pb.zip -d /opt/pocketbase/schools/template/
chmod +x /opt/pocketbase/schools/template/pocketbase
rm /tmp/pb.zip

# 5. Konfigurasi Caddy agar membaca folder conf.d
cat << 'EOF' > /etc/caddy/Caddyfile
import /etc/caddy/conf.d/*.caddy
EOF

systemctl restart caddy
```

### B. Hubungkan SSH Key dari VPS Master ke VPS Baru (Untuk Otomasi)
Agar VPS Master (`64.235.41.108`) bisa mengeksekusi pembuatan tenant secara otomatis tanpa password:

1. Di **VPS Master (`64.235.41.108`)**, lihat public key root:
   ```bash
   cat /root/.ssh/id_ed25519.pub
   # Jika belum ada key, buat dengan: ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519
   ```
2. Di **VPS Baru**, buka file `authorized_keys` dan tempelkan public key tadi:
   ```bash
   mkdir -p /root/.ssh
   nano /root/.ssh/authorized_keys
   chmod 600 /root/.ssh/authorized_keys
   ```
3. Tes dari VPS Master:
   ```bash
   ssh root@IP_VPS_BARU "echo 'Koneksi Berhasil!'"
   ```

### C. Pasang Script Otomasi di VPS Baru (`/usr/local/bin/add-school.sh`)
Buat script pembuat tenant di VPS Baru:

```bash
cat << 'EOF' > /usr/local/bin/add-school.sh
#!/bin/bash
set -e

SLUG="$1"
PORT="$2"
CUSTOM_DOMAIN="$3"

if [ -z "$SLUG" ] || [ -z "$PORT" ]; then
    echo "Usage: $0 <slug> <port> [custom_domain]"
    exit 1
fi

SCHOOL_DIR="/opt/pocketbase/schools/${SLUG}"
TEMPLATE_DIR="/opt/pocketbase/schools/template"
CADDY_FILE="/etc/caddy/conf.d/${SLUG}.caddy"
SERVICE_NAME="pb-${SLUG}"

# 1. Buat folder jika belum ada
mkdir -p "${SCHOOL_DIR}"
if [ ! -f "${SCHOOL_DIR}/pocketbase" ]; then
    cp -r "${TEMPLATE_DIR}/"* "${SCHOOL_DIR}/"
fi
chown -R root:root "${SCHOOL_DIR}"

# 2. Buat systemd service
cat > /etc/systemd/system/${SERVICE_NAME}.service << SVCEOF
[Unit]
Description=PocketBase - ${SLUG}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${SCHOOL_DIR}
ExecStart=${SCHOOL_DIR}/pocketbase serve --http="127.0.0.1:${PORT}"
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}

# 3. Buat Caddy routing & Auto SSL
DOMAINS="${SLUG}.examku.my.id"
if [ -n "$CUSTOM_DOMAIN" ]; then
    DOMAINS="${DOMAINS}, ${CUSTOM_DOMAIN}"
fi

cat > "${CADDY_FILE}" << CADEOF
${DOMAINS} {
    root * /opt/frontend/ujian/dist
    file_server

    handle /api/* {
        reverse_proxy localhost:${PORT}
    }
    handle /_* {
        reverse_proxy localhost:${PORT}
    }
    handle {
        try_files {path} /index.html
    }
}
CADEOF

systemctl reload caddy
echo "Tenant ${SLUG} berhasil dibuat di port ${PORT}!"
EOF

chmod +x /usr/local/bin/add-school.sh
```

---

## 3. Cara Mengaktifkan Tenant di VPS Baru

### Opsi A: Cara Otomatis (Saat Fitur Multi-Node Master Diaktifkan)
1. Buka dashboard Super Admin: `https://examku.my.id/superadmin`.
2. Klik **Tambah Institusi**.
3. Di pilihan **Server Node**, pilih **VPS 2 (Dedicated)**.
4. Masukkan Nama Sekolah, Slug, dan Custom Domain (misal `cbt.sman1mosa.sch.id`).
5. Klik **Simpan**.
6. Master PB di latar belakang mengeksekusi:
   `ssh root@IP_VPS_2 "/usr/local/bin/add-school.sh modalbangsa 8095 cbt.sman1mosa.sch.id"`
7. Tenant dan SSL di VPS 2 langsung aktif otomatis dalam 3 detik!

---

### Opsi B: Cara Cepat (Manual 1 Perintah dari Master)
Jika Anda belum mengupdate kode dashboard Super Admin, Anda cukup jalankan 1 baris perintah ini dari VPS Master:

```bash
# Jalankan langsung dari VPS Master:
ssh root@IP_VPS_BARU "/usr/local/bin/add-school.sh modalbangsa 8095 cbt.sman1mosa.sch.id"
```

Lalu di database Master (`examku.my.id/superadmin`), ubah kolom **PocketBase URL** sekolah tersebut menjadi:
`https://cbt.sman1mosa.sch.id`

---

## 4. Konfigurasi DNS di Cloudflare
Minta tim IT sekolah (atau atur di panel Cloudflare Anda):
* **Type**: `A`
* **Name**: Subdomain sekolah (contoh: `cbt`)
* **IPv4 Address**: Masukkan **IP VPS Baru**
* **Proxy Status**: `DNS Only` (awan abu-abu agar Caddy bisa menerbitkan SSL Let's Encrypt secara otomatis)

---

## 5. Cara Memindahkan Tenant yang Sudah Ada (Migrasi Data)
Jika sekolah tersebut sebelumnya sudah aktif di VPS 1 (Master) dan ingin dipindahkan ke VPS Baru:

1. **Stop service di VPS 1**:
   ```bash
   systemctl stop pb-modalbangsa
   ```
2. **Kirim database SQLite ke VPS Baru**:
   ```bash
   rsync -avz /opt/pocketbase/schools/modalbangsa/pb_data/* root@IP_VPS_BARU:/opt/pocketbase/schools/modalbangsa/pb_data/
   ```
3. **Restart service di VPS Baru**:
   ```bash
   ssh root@IP_VPS_BARU "systemctl restart pb-modalbangsa"
   ```
4. **Update DNS A Record**:
   Ubah IP domain sekolah di Cloudflare dari `64.235.41.108` menjadi `IP_VPS_BARU`.

Semua bank soal, siswa, guru, dan nilai ujian akan langsung berpindah 100% utuh tanpa perlu re-input.

---

## 6. Strategi Sewa VPS Murah 1 Bulan Tanpa Takut Kehilangan Data ("Burst Mode")

Sekolah biasanya **hanya butuh server berspesifikasi tinggi selama 1–2 minggu masa ujian semester (PAS/PAT)**. Di luar masa ujian, aktivitas sekolah sangat minim sehingga menyewa VPS mahal sepanjang tahun adalah pemborosan.

Dengan pola **Burst Mode**, Anda bisa menyewa VPS murah hanya untuk **1 bulan**, lalu mengembalikan database ke VPS Master setelah ujian selesai:

```
[Bulan Biasa]                   [H-3 Masa Ujian: Sewa 1 Bln]                 [H+2 Ujian Selesai: Tutup VPS]
Database aktif di Master   ──>  Data di-copy ke VPS Worker       ──>   Hasil ujian ditarik balik ke Master
(Spek hemat / murah)            (Tahan 1000 siswa serentak)            (VPS Worker dibiarkan expired/mati)
```

### Alur Kerja Siklus 1 Bulan:

#### Fase 1: H-3 Sebelum Ujian Dimulai (Kirim Data ke Worker)
1. Sewa VPS baru 1 bulan (misal RAM 4GB–8GB).
2. Jalankan setup awal Caddy + PocketBase di VPS Baru (lihat Bab 2).
3. Salin data dari Master ke Worker:
   ```bash
   # Di VPS Master:
   systemctl stop pb-modalbangsa
   rsync -avz /opt/pocketbase/schools/modalbangsa/pb_data/* root@IP_VPS_WORKER:/opt/pocketbase/schools/modalbangsa/pb_data/
   ssh root@IP_VPS_WORKER "systemctl restart pb-modalbangsa"
   ```
4. Ubah A Record di Cloudflare ke IP VPS Worker.
5. Ujian siap diselenggarakan di VPS Worker dengan performa maksimal!

---

#### Fase 2: Selama Ujian Berlangsung (Pengaman Auto-Sync Tengah Malam)
Untuk mengantisipasi jika VPS murah tersebut mati mendadak sebelum 1 bulan:
Pasang Cron Job di VPS Worker agar menyalin file `data.db` ke VPS Master setiap jam 02:00 malam:
```bash
# Tambahkan di crontab VPS Worker (crontab -e):
0 2 * * * rsync -az /opt/pocketbase/schools/*/pb_data/data.db root@64.235.41.108:/backup/worker_nightly/
```
Jika terjadi kerusakan hardware pada VPS Worker, Anda paling banyak hanya kehilangan beberapa jam data, bukan seluruh data ujian.

---

#### Fase 3: H+2 Setelah Ujian Selesai (Tarik Balik Data & Hentikan VPS)
Setelah seluruh siswa selesai ujian dan guru selesai merekap nilai:

1. **Tarik seluruh hasil ujian terbaru dari Worker ke Master**:
   ```bash
   # Jalankan perintah ini dari VPS Master:
   rsync -avz root@IP_VPS_WORKER:/opt/pocketbase/schools/modalbangsa/pb_data/* /opt/pocketbase/schools/modalbangsa/pb_data/
   ```
2. **Nyalakan kembali service di VPS Master**:
   ```bash
   systemctl start pb-modalbangsa
   ```
3. **Kembalikan DNS Cloudflare** ke IP VPS Master (`64.235.41.108`).
4. **Biarkan VPS Worker expired / hapus server (terminate)**:
   * Anda tidak perlu memperpanjang biaya sewa VPS tersebut.
   * Seluruh nilai siswa, riwayat jawaban, dan soal ujian sudah **100% aman dan tersimpan abadi di VPS Master**.

---

### Pengaman Tambahan: Backup Otomatis ke Cloudflare R2
Agar semakin aman dari kehilangan data, database SQLite sekolah juga dapat diunggah berkala ke bucket Cloudflare R2 menggunakan script rclone / S3 tool:
* Ukuran database SQLite terkompresi (zip) umumnya hanya 10–50 MB.
* Penyimpanan di Cloudflare R2 berbiaya $0 (gratis untuk kuota awal hingga 10 GB).
* File backup dapat diunduh kapan saja untuk di-restore ke server manapun.

---

## 7. Cara Update & Deploy Kode Otomatis ke Banyak VPS

Anda **tidak perlu login dan SCP satu per satu secara manual** saat ada pembaruan kode frontend atau backend hook.

Sistem deploy kita menggunakan script Python otomatis yang mendukung daftar multi-server:

### Contoh Konfigurasi `deploy_all.py` untuk Multi-Node:
```python
# Daftar seluruh server produksi Anda:
SERVERS = [
    {"host": "64.235.41.108", "user": "root", "name": "VPS Master"},
    {"host": "103.xxx.xxx.1", "user": "root", "name": "VPS Worker 1 (Mosa)"},
    {"host": "103.xxx.xxx.2", "user": "root", "name": "VPS Worker 2 (Kampus B)"},
]

# Script melakukan sinkronisasi otomatis ke semua server:
for s in SERVERS:
    print(f"🚀 Deploying update to {s['name']} ({s['host']})...")
    upload_frontend(s['host'], local_dist, remote_dist)
    upload_hooks(s['host'], local_hook)
    reload_services(s['host'])
```

**Cara Menjalankannya:**
Cukup jalankan satu perintah di laptop/komputer Anda:
```bash
bun run build && python deploy_all.py
```
Semua file frontend di seluruh VPS akan diperbarui secara serentak dalam sekali jalan.

---

## 8. Kompatibilitas Aplikasi Android (Exambro Mobile)

Aplikasi Android EXAM AA **sudah 100% mendukung multi-VPS secara otomatis tanpa perlu rebuild / update APK**.

### Bagaimana Aplikasi Mendeteksi VPS yang Tepat?
```
[Siswa Buka Aplikasi Android (1 File APK)]
                 │
                 ▼
1. Aplikasi menghubungi Master VPS (examku.my.id) meminta daftar sekolah aktif
                 │
                 ▼
2. Siswa memilih sekolahnya (misal: "SMAN 1 Modal Bangsa")
                 │
                 ▼
3. Aplikasi membaca kolom `pb_url` dari data sekolah:
   - Sekolah di VPS 1  ──> Aplikasi otomatis konek ke https://alfa.examku.my.id (VPS 1)
   - Sekolah di VPS 2  ──> Aplikasi otomatis konek ke https://cbt.sman1mosa.sch.id (VPS 2)
                 │
                 ▼
4. Siswa login dan ujian langsung di VPS masing-masing!
```

**Kode Sumber yang Bertanggung Jawab (`TenantContext.tsx`):**
```typescript
// Saat sekolah dipilih, koneksi database instan dialihkan ke URL server sekolah tersebut
const record = await masterPb.collection('schools').getFirstListItem(filter);
setPb(getSchoolPb(record.pb_url));
```
Karena arsitektur ini sudah dinamis, Anda bebas menambah 5 hingga 10 VPS Worker baru di masa depan tanpa pernah perlu merilis ulang file APK Android.

---

## 9. Mengapa Menggunakan "Tenant Partitioning" (Bukan Load Balancing Tradisional)?

Sering muncul pertanyaan: *Kenapa kita tidak memakai Load Balancing biasa (membagi siswa 1 sekolah ke 2 VPS sekaligus)?*

### Alasan Teknis (SQLite Concurrency):
1. **Database PocketBase adalah SQLite (Embedded File)**:
   Database tersimpan dalam 1 file lokal (`data.db`). Jika 1 sekolah di-load balance secara aktif ke 2 server fisik berbeda, data jawaban siswa yang masuk ke Server A tidak akan ada di Server B, sehingga terjadi bentrok data atau sesi ujian terputus.
2. **Kapasitas 1 VPS PocketBase Sangat Besar**:
   PocketBase dibangun menggunakan **Golang** dan mode **SQLite WAL (Write-Ahead Logging)**. Satu VPS standar (misal 4 vCPU, 4–8 GB RAM) sanggup menangani **2.000 hingga 5.000 request per detik**, sedangkan 1.000 siswa ujian serentak rata-rata hanya menghasilkan 20–50 request per detik.
3. **Pemisahan Berdasarkan Tenant (Tenant Sharding)**:
   Maka dari itu, pola yang paling stabil, aman, dan zero-risk adalah memisahkan beban **per sekolah** ke server masing-masing. Sekolah besar tidak akan mengganggu sekolah lain, dan data setiap sekolah 100% konsisten.

