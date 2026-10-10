# SumoPod Sandbox ke Production

Status sandbox: webhook sudah berhasil diuji dengan respons `204`.

Dokumen ini dipakai saat akun SumoPod production sudah aktif.

## Arsitektur saat ini

Backend payment berjalan di VPS:

```text
/opt/frontend/ujian/payment-api
```

Service: `exam-aa-payment-api.service`

Backend listen lokal di `127.0.0.1:8787`. Caddy meneruskan route:

```text
https://examku.my.id/api/sumopod/*
```

## Prasyarat production

Jangan pindah sebelum semua selesai:

- Verifikasi akun SumoPod production selesai.
- Project production aktif.
- API key production tersedia.
- Webhook Token atau Signing Secret production tersedia.
- Payment method production aktif.
- Redirect URL production diizinkan.
- Settlement, fee, limit, dan jadwal pencairan sudah dipahami.

Jangan kirim API key, token, signing secret, atau password PocketBase melalui chat.

## 1. Siapkan SumoPod production

Di dashboard SumoPod:

1. Pindah ke project production.
2. Buka `Managed Payment > API Key`.
3. Buat atau salin API key production.
4. Buka `Managed Payment > Settings > Webhook`.
5. Set URL:

```text
https://examku.my.id/api/sumopod/webhook
```

6. Aktifkan event `payment.completed`, `payment.failed`, dan `payment.expired`.
7. Salin Webhook Token atau Signing Secret production.
8. Buka `Redirect URLs` dan pastikan URL berikut diizinkan:

```text
https://examku.my.id/admin/invoice?payment=success
https://examku.my.id/admin/invoice?payment=cancelled
```

Backend menambahkan `invoice=<invoice_id>` saat membuat payment.

## 2. Backup sandbox

```bash
cp /opt/frontend/ujian/payment-api/.env \
  /opt/frontend/ujian/payment-api/.env.sandbox.backup
chmod 600 /opt/frontend/ujian/payment-api/.env.sandbox.backup
cp /etc/caddy/Caddyfile \
  /etc/caddy/Caddyfile.backup-before-sumopod-production
```

## 3. Ubah environment VPS

```bash
nano /opt/frontend/ujian/payment-api/.env
```

Ubah nilai SumoPod:

```env
SUMOPOD_API_URL=URL_API_PRODUCTION_RESmi_DARI_SUMOPOD
SUMOPOD_API_KEY=API_KEY_PRODUCTION_DARI_DASHBOARD
SUMOPOD_WEBHOOK_TOKEN=WEBHOOK_TOKEN_PRODUCTION_DARI_DASHBOARD
SUMOPOD_WEBHOOK_SECRET=whsec_SIGNING_SECRET_PRODUCTION_JIKA_DIPAKAI
```

Nilai lain tetap:

```env
PORT=8787
MASTER_PB_URL=http://127.0.0.1:8090
MASTER_PB_ADMIN_EMAIL=EMAIL_SUPERADMIN_MASTER
MASTER_PB_ADMIN_PASSWORD=PASSWORD_SUPERADMIN_MASTER
PUBLIC_APP_URL=https://examku.my.id
```

Gunakan URL API production resmi dari dashboard/dokumentasi SumoPod. Jangan menebak URL.

```bash
chmod 600 /opt/frontend/ujian/payment-api/.env
systemctl restart exam-aa-payment-api
systemctl --no-pager --full status exam-aa-payment-api
journalctl -u exam-aa-payment-api -n 50 --no-pager
```

Harus terlihat `Active: active (running)`.

## 4. Validasi

```bash
curl -fsS https://examku.my.id/health
```

Saat ini expected response masih:

```json
{"ok":true,"environment":"sandbox"}
```

Label health ini bukan penentu URL API. Ubah label backend menjadi `production` jika perlu agar monitoring tidak membingungkan.

Klik `Save & Test` di dashboard SumoPod. Expected response `204`.

`GET` lewat browser bukan tes valid. Webhook hanya menerima `POST`.

## 5. Uji payment production

1. Buat invoice nominal kecil.
2. Klik pembayaran dari aplikasi.
3. Pastikan request memakai `POST /api/sumopod/create-payment`.
4. Pastikan browser diarahkan ke `payment_link_url` production.
5. Selesaikan pembayaran.
6. Tunggu `payment.completed`.
7. Pastikan invoice berubah menjadi `paid` dan `paid_date` terisi.
8. Refresh halaman tenant dan superadmin.
9. Cek transaksi di dashboard SumoPod.

Redirect sukses bukan bukti pembayaran. Status invoice berubah hanya dari webhook tervalidasi.

## 6. Uji event gagal dan kedaluwarsa

Pastikan:

- Payment gagal tidak mengubah invoice menjadi `paid`.
- Payment kedaluwarsa mengubah invoice menjadi `overdue`.
- Webhook tanpa autentikasi ditolak.
- Webhook dengan token salah ditolak.
- Payload test tanpa `order_id` tidak diproses sebagai pembayaran.

## 7. Rollback ke sandbox

```bash
cp /opt/frontend/ujian/payment-api/.env \
  /opt/frontend/ujian/payment-api/.env.production.failed
cp /opt/frontend/ujian/payment-api/.env.sandbox.backup \
  /opt/frontend/ujian/payment-api/.env
chmod 600 /opt/frontend/ujian/payment-api/.env
systemctl restart exam-aa-payment-api
systemctl --no-pager --full status exam-aa-payment-api
```

Setelah rollback, gunakan kembali project dan credential sandbox di dashboard.

## Checklist go-live

- [ ] Akun production terverifikasi.
- [ ] API key production dibuat.
- [ ] Webhook production disimpan.
- [ ] Redirect URL production disimpan.
- [ ] `.env` production hanya tersimpan di VPS.
- [ ] Permission `.env` bernilai `600`.
- [ ] Service aktif setelah restart.
- [ ] Caddy tetap valid.
- [ ] Health endpoint merespons.
- [ ] `Save & Test` menghasilkan `204`.
- [ ] Payment production nominal kecil berhasil.
- [ ] Webhook mengubah invoice menjadi `paid`.
- [ ] Payment failed tidak menjadi `paid`.
- [ ] Payment expired menjadi `overdue`.
- [ ] Tenant dan superadmin menampilkan status terbaru.
- [ ] API key sandbox lama di-rotate atau dinonaktifkan bila tidak dipakai.
- [ ] Tidak ada secret di frontend, Git, atau folder `dist`.
