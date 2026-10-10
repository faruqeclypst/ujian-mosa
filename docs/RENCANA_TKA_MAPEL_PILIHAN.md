# Rencana Sistem Ujian TKA (Mata Pelajaran Pilihan Lintas Kelas)
*Dokumentasi Konsep & Strategi Implementasi Tanpa Wajib Rebuild APK*

---

## 1. Latar Belakang & Masalah

### Kondisi Sistem Saat Ini
- Ruang ujian (`exam_rooms`) membatasi akses siswa berdasarkan rombel/kelas asal (`classId` / `allowedClasses`).
- Logika di aplikasi siswa:
  ```javascript
  if (room.allClasses) return true;
  return allowedClasses.includes(student.classId);
  ```

### Tantangan pada Ujian TKA (Kurikulum Merdeka)
- Pada TKA, siswa memilih **Mapel Pilihan 1** dan **Mapel Pilihan 2**.
- Siswa dari berbagai kelas (misal: XII-A, XII-B, XII-C, XII-D) akan **bercampur** jika memiliki mapel pilihan yang sama (contoh: sama-sama memilih Fisika).
- **Masalah:** Jika ruang Fisika dibuka untuk Kelas XII-A s.d XII-D, maka siswa yang **tidak memilih Fisika** (misal memilih Geografi) akan ikut melihat dan bisa mengerjakan soal Fisika di dashboard mereka.

---

## 2. Solusi Arsitektur: Filter Berbasis Pilihan Mapel

### A. Struktur Data Siswa (PocketBase)
Pada tabel `students`, ditambahkan informasi:
- `pilihan1` (text / relation): ID atau Nama Mata Pelajaran Pilihan 1.
- `pilihan2` (text / relation): ID atau Nama Mata Pelajaran Pilihan 2.
- `pilihanLocked` (boolean): Menandai apakah siswa sudah mengunci pilihannya (`true` = terkunci, hanya bisa dibuka oleh admin).

### B. Mekanisme Server-Side (Backend Filter di PocketBase)
Agar tidak membocorkan soal ke siswa yang tidak berhak:
1. Saat siswa login dan aplikasi meminta daftar ruangan (`exam_rooms`), backend PocketBase (`pb_hooks`) mencegat permintaan tersebut.
2. Server memeriksa siapa siswa yang sedang login dan apa `pilihan1` serta `pilihan2`-nya.
3. Server **hanya mengirimkan** data ruangan ujian yang sesuai dengan pilihan siswa tersebut.
4. Ruangan tersebut dikirim dengan flag `allClasses = true`.
5. **Hasil:** Aplikasi siswa hanya menerima dan menampilkan ujian yang relevan saja.

---

## 3. Strategi Alur Pengisian Pilihan (UX)

Sesuai diskusi, alur paling ideal dan minim beban admin adalah **Siswa Memilih Sendiri secara Mandiri**:

### Alur Kerja Siswa:
1. **Login:** Siswa login ke sistem.
2. **Pengecekan Status:** Jika `pilihanLocked == false`, sistem memunculkan **Modal Pemilihan Mapel TKA**:
   - Pilihan 1: Dropdown Mata Pelajaran (Fisika, Biologi, Ekonomi, Sosiologi, dll.)
   - Pilihan 2: Dropdown Mata Pelajaran
   - Konfirmasi & Peringatan: *"Pilihan ini hanya bisa disimpan 1 kali. Pastikan pilihan Anda sudah benar."*
3. **Kunci Otomatis:** Setelah siswa klik **"Simpan & Kunci Pilihan"**, status berubah menjadi `pilihanLocked = true`.
4. **Proteksi:** Siswa tidak bisa mengubah lagi pilihannya sendiri. Jika ada kesalahan, siswa wajib melapor ke panitia/admin secara manual.
5. **Kontrol Admin:** Di menu *Data Siswa* pada dashboard admin, disediakan tombol **"Buka Kunci Pilihan"** atau **"Reset Pilihan"** untuk siswa yang melapor.

---

## 4. Analisis Rebuild APK Siswa

| Metode Pelaksanaan | Siswa Memilih Mandiri? | Perlu Rebuild APK? | Evaluasi Lapangan |
| :--- | :---: | :---: | :--- |
| **Opsi A: Pemilihan via Web Browser (Pra-Ujian)** ⭐ *Direkomendasikan* | **Ya** | ❌ **TIDAK PERLU** (0 install ulang) | Siswa buka link web di browser HP/Laptop 1-2 hari sebelum ujian untuk kunci pilihan. Hari H siswa langsung buka APK EXAM AA lama. Bebas resiko error instalasi. |
| **Opsi B: Import Excel oleh Panitia** | Tidak (Oleh Panitia) | ❌ **TIDAK PERLU** | Cepat jika sekolah sudah punya rekapan Google Form/angket sebelumnya. |
| **Opsi C: Pemilihan Langsung di Dalam APK EXAM AA** | **Ya** | **WAJIB Rebuild APK** | Memerlukan rilis APK baru ke seluruh siswa (`npm run deploy:apk`), memicu auto-update via `AppVersionGuard`. Rawan kendala memori penuh / WiFi sekolah padat saat download APK massal. |

---

## 5. Rencana Langkah Kerja (Roadmap) Saat Akan Dieksekusi

- [ ] **Langkah 1 (Database):** Update schema `students` di PocketBase (`pilihan1`, `pilihan2`, `pilihanLocked`).
- [ ] **Langkah 2 (Admin Panel):** 
  - Tambahkan kolom Mapel Pilihan 1 & 2 di tabel data siswa.
  - Tambahkan fitur reset/buka kunci pilihan per siswa maupun batch.
  - (Opsional) Tambahkan fitur import Excel rekapan pilihan.
- [ ] **Langkah 3 (Frontend Siswa - Web Modal):**
  - Buat komponen modal popup pemilihan mapel saat siswa login jika status belum terkunci.
- [ ] **Langkah 4 (Backend Hook / Room Filter):**
  - Buat handler di `pb_hooks` agar filtering ruangan TKA bekerja otomatis berdasarkan mapel pilihan siswa.
- [ ] **Langkah 5 (Simulasi & Uji Coba):**
  - Uji alur pemilihan oleh 2 siswa dari kelas berbeda dengan mapel pilihan yang sama dan berbeda.
