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

## 5. Strategi Sewa VPS 1 Bulan ("Burst Mode" Ujian Sekolah)

Sekolah umumnya hanya membutuhkan server berspesifikasi tinggi selama 1 sampai 2 pekan masa ujian semester (PAS/PAT). Di luar masa ujian, aktivitas sekolah minim sehingga menyewa VPS mahal sepanjang tahun adalah pemborosan.

### Alur Kerja Siklus 1 Bulan:

#### Fase 1: H-3 Sebelum Ujian Dimulai (Kirim Data ke Worker)
1. Sewa VPS baru 1 bulan (RAM 4GB sampai 8GB).
2. Jalankan setup otomatis:
   ```bash
   curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash
   ```
3. Stop service lokal di Master:
   ```bash
   systemctl stop pb-modalbangsa
   ```
4. Kirim folder database SQLite dari Master ke Worker VPS:
   ```bash
   rsync -avz /opt/pocketbase/schools/modalbangsa/pb_data/* root@IP_WORKER:/opt/pocketbase/schools/modalbangsa/pb_data/
   ```
5. Buka Superadmin (`/superadmin`), edit sekolah tersebut dan ganti Lokasi Server Node menjadi IP Worker.
6. Jalankan service di Worker:
   ```bash
   ssh root@IP_WORKER "systemctl restart pb-modalbangsa"
   ```

#### Fase 2: Masa Ujian Berlangsung
* Ribuan siswa mengerjakan soal serentak di Worker VPS.
* Master VPS tetap ringan dan stabil.
* Pembayaran dan perpanjangan langganan tetap ditangani terpusat di Master VPS.

#### Fase 3: H+2 Setelah Ujian Selesai (Tarik Balik ke Master)
1. Stop service di Worker VPS:
   ```bash
   ssh root@IP_WORKER "systemctl stop pb-modalbangsa"
   ```
2. Tarik database terbaru (berisi nilai dan jawaban siswa) kembali ke Master VPS:
   ```bash
   rsync -avz root@IP_WORKER:/opt/pocketbase/schools/modalbangsa/pb_data/* /opt/pocketbase/schools/modalbangsa/pb_data/
   ```
3. Di Superadmin (`/superadmin`), ubah Lokasi Server Node kembali ke **Master VPS (Lokal)**.
4. Restart service di Master:
   ```bash
   systemctl restart pb-modalbangsa
   ```
5. Biarkan VPS Worker expired / hapus instance VPS Worker tersebut.
6. Hasil ujian, bank soal, dan siswa tetap aman 100% di Master VPS tanpa biaya langganan VPS tambahan.

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
