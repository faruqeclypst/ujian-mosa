# Panduan Arsitektur & Operasional Multi-VPS (Worker Node) : EXAM AA

Dokumen ini berisi panduan teknis dan operasional untuk mengelola tenant/institusi yang di-hosting pada VPS terpisah (**Worker Node**), dengan **Master Control Plane, Billing Gateway, dan Central Ingress** tetap terpusat di VPS Utama (`64.235.41.108`).

---

## 1. Konsep & Alur Arsitektur

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               VPS MASTER (64.235.41.108)               │
                                    │  - Master Registry PB (examku.my.id)                   │
                                    │  - Super Admin Dashboard                               │
                                    │  - Central Billing, Invoice & SumoPod Payment API      │
                                    │  - Caddy Ingress Gateway (Wildcard SSL *.examku.my.id) │
                                    └───────────────┬────────────────────────┬───────────────┘
                                                    │                        │
                    Proxy /api/* & /_*              │                        │ Proxy /api/* & /_*
                    (0ms frontend latency)          │                        │ (0ms frontend latency)
                                                    ▼                        ▼
                                     ┌────────────────────────┐    ┌────────────────────────┐
                                     │  WORKER VPS 1 (NODE A) │    │  WORKER VPS 2 (NODE B) │
                                     │     IP: 103.xxx.xxx.1  │    │     IP: 103.xxx.xxx.2  │
                                     │  - SMAN Modal Bangsa   │    │  - SMP 1 Banda Aceh    │
                                     │  - 1000 Siswa Ujian    │    │  - 800 Siswa Ujian     │
                                     └────────────────────────┘    └────────────────────────┘
```

### Keunggulan Arsitektur Ini:
1. **Central Ingress Gateway & Zero CORS**:
   - Master Caddy tetap memegang wildcard SSL `*.examku.my.id` dan custom domain.
   - Master Caddy menyajikan berkas React frontend statis dari `/opt/frontend/ujian/dist` dengan kecepatan 0ms, lalu mem-proxy `/api/*` dan `/_*` ke IP Worker Node tujuan (`$SERVER_HOST:$PORT`).
   - Browser siswa tidak perlu mengakses IP asing langsung atau terbentur CORS & multi-SSL.
2. **Billing & Pembayaran Terpusat 100%**:
   - Tagihan (invoices), webhook SumoPod (QRIS / Virtual Account), serta kwitansi SPJ BOS tetap diproses di Master VPS melalui `masterPb`.
   - Worker VPS sama sekali tidak menyimpan data keuangan; murni menangani beban baca-tulis ujian.
3. **Fleksibilitas Sewa VPS (Burst Mode Ujian)**:
   - Sekolah yang butuh server besar saat PAS/PAT (1 bulan) bisa diarahkan ke Worker VPS, dan datanya bisa dipindah kembali ke Master saat ujian usai tanpa merubah URL atau login siswa.

---

## 2. Persiapan VPS Baru (Cukup 1x Saja)

Saat Anda baru menyewa VPS baru (Ubuntu 22.04 / 24.04 LTS), lakukan langkah berikut sekali saja:

### Cara Cepat (1 Baris Perintah Otomatis)
Login via SSH ke VPS Worker baru sebagai `root`, lalu jalankan:

```bash
curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash
```

Script ini otomatis:
1. Mengunduh PocketBase binary v0.22.20 ke `/opt/pocketbase/schools/template/pocketbase`.
2. Memasang hook database `busy_timeout=5000` dan journal size limit untuk SQLite.
3. Memasang helper script `/usr/local/bin/add-school.sh` dan `/usr/local/bin/remove-school.sh` pada worker.
4. Menyiapkan systemd template service untuk PocketBase.

---

## 3. Menghubungkan Kunci SSH untuk Otomasi Penuh (Direkomendasikan)

Agar saat Anda menekan tombol **Simpan** di dashboard Superadmin, Master VPS otomatis membuatkan folder sekolah dan menjalankan PocketBase di Worker tanpa Anda harus menyentuh terminal worker lagi:

1. **Lihat Public Key di Master VPS (64.235.41.108)**:
   ```bash
   cat /root/.ssh/id_ed25519.pub || ssh-keygen -t ed25519 -N '' -f /root/.ssh/id_ed25519
   ```
2. **Buka file `authorized_keys` di Worker VPS baru dan tempelkan kunci di atas**:
   ```bash
   mkdir -p /root/.ssh
   nano /root/.ssh/authorized_keys
   chmod 600 /root/.ssh/authorized_keys
   ```
3. **Uji koneksi dari Master VPS**:
   ```bash
   ssh root@IP_WORKER_BARU "echo 'Koneksi Berhasil!'"
   ```

---

## 4. Cara Menempatkan Tenant ke Worker VPS

1. Buka Dashboard Superadmin: `https://examku.my.id/superadmin`.
2. Klik tombol **Tambah Sekolah** (atau tombol **Edit** pada institusi yang sudah ada).
3. Pada bagian **Lokasi Server Node (Multi-VPS)**:
   - Pilih tombol **Worker Node**.
   - Masukkan IP address VPS Worker Anda (misal `103.123.45.67`).
4. Klik **Simpan** / **Buat Tenant**.
5. Master PB akan otomatis:
   - Menyimpan `server_host` ke database Master.
   - Mengonfigurasi Caddy di Master VPS agar mem-proxy `/api/*` dan `/_*` ke `http://103.123.45.67:PORT`.
   - Menjalankan pembuatan instance PocketBase pada Worker VPS via SSH.
6. Tenant siap diakses di `https://slug.examku.my.id` dengan enkripsi HTTPS penuh!

---

## 5. Sistem Otomasi 1-Klik ("Burst Mode" Ujian Sekolah)

Sekolah umumnya hanya membutuhkan server berspesifikasi tinggi selama 1 sampai 2 pekan masa ujian semester (PAS/PAT). Di luar masa ujian, aktivitas sekolah minim sehingga menyewa VPS mahal sepanjang tahun adalah pemborosan.

Sistem Ujian AA kini telah dilengkapi **Fitur Otomasi 1-Klik di SuperAdmin Dashboard**, sehingga Anda tidak perlu mengetik perintah terminal manual lagi.

---

### A. Alur Kerja 1-Klik (Melalui Antarmuka SuperAdmin)

#### 1. Setup VPS Worker Baru (Hanya 1 Baris Perintah)
Buka terminal VPS Worker baru Anda lalu jalankan:
```bash
curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash
```
> Script ini otomatis menginstal PocketBase, membuka firewall, dan **memasangkan kunci SSH Master VPS**, sehingga Master bisa mengontrol worker tanpa password.

#### 2. Pindahkan Sekolah Sebelum Ujian (Fase Ujian)
1. Buka SuperAdmin Dashboard: `https://examku.my.id/superadmin`.
2. Cari nama sekolah pada tabel, lalu klik **ikon Petir (⚡)** atau klik tombol badge server.
3. Masukkan IP Worker VPS baru (misal: `103.123.45.67`).
4. Klik **"Tes Koneksi"** (akan muncul latensi ms dan status PocketBase siap).
5. Pilih opsi **"Mulai Ujian (Ke Worker VPS)"**.
6. Klik **"Mulai Migrasi Sekarang"**.
7. Sistem otomatis:
   - Menghentikan sementara service untuk menjaga integritas database.
   - Menyinkronkan file SQLite dan bank soal via `rsync`.
   - Mengalihkan Caddy reverse-proxy ke IP Worker.
   - Menyalakan service PocketBase di Worker node.
   - Status sekolah langsung aktif di Worker!

#### 3. Tarik Kembali Data Setelah Ujian Selesai (Fase Penghematan)
1. Setelah ujian semester selesai, buka kembali SuperAdmin Dashboard.
2. Klik **ikon Petir (⚡)** pada sekolah yang ada di worker.
3. Sistem otomatis mendeteksi bahwa sekolah berada di worker dan mengarahkan ke opsi **"Selesai Ujian (Tarik ke Master VPS)"**.
4. Klik **"Mulai Migrasi Sekarang"**.
5. Seluruh jawaban ujian siswa, rekap nilai, dan log aktivitas ditarik 100% utuh ke Master VPS.
6. Anda dapat mematikan atau menghapus VPS Worker tersebut tanpa khawatir ada data yang tertinggal.

---

### B. Opsi Manual CLI (Darurat / Fallback)

Jika suatu saat Anda ingin memindahkan data langsung via command-line Master VPS:

**Kirim ke Worker:**
```bash
/usr/local/bin/migrate-tenant.sh "SLUG_SEKOLAH" "IP_WORKER" "to_worker"
```

**Tarik balik ke Master:**
```bash
/usr/local/bin/migrate-tenant.sh "SLUG_SEKOLAH" "IP_WORKER" "to_master"
```

---

## 6. Troubleshooting & FAQ

### Q1: Latensi di halaman Infrastruktur menunjukkan TIMEOUT?
Pastikan port tenant pada Worker VPS (misal 8095) sudah dibuka di firewall UFW:
```bash
ufw allow proto tcp from 64.235.41.108 to any port 8091:8150
```
Dan pastikan service PocketBase di Worker VPS berstatus aktif:
```bash
systemctl status pb-slug.service
```

### Q2: Apakah Custom Domain sekolah bisa diarahkan ke Worker?
Bisa. Tim IT sekolah tetap mengarahkan DNS (A Record) ke IP Master (`64.235.41.108`). Master Caddy yang mengurus SSL Let's Encrypt secara otomatis dan meneruskan lalu lintas API ke Worker VPS.

### Q3: Bagaimana jika Master VPS tidak memiliki akses SSH ke Worker?
Jika SSH key belum dipasang, Anda cukup menjalankan perintah manual sekali di Worker VPS:
```bash
/usr/local/bin/add-school.sh <slug> <port> [custom_domain] [quota]
```
Lalu di Superadmin dashboard, masukkan IP Worker tersebut. Master Caddy akan langsung mem-proxy traffic ke worker.
