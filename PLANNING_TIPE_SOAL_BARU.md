# PLANNING: 4 Tipe Soal Baru

**Tanggal:** 2026-10-16
**Tipe baru:** `klasifikasi`, `hotspot`, `isian_rumpang`, `matriks`
**Tipe existing:** `pilihan_ganda`, `pilihan_ganda_kompleks`, `menjodohkan`, `benar_salah`, `isian_singkat`, `uraian`, `urutkan`, `drag_drop`

> ⚠️ DOKUMEN PLANNING — belum ada implementasi. Semua line number merujuk ke `feature/saas-v2` per 2026-10-16.

---

## 1. Struktur Data yang Diusulkan

Semua tipe baru memakai field `options` (JSON) di collection `questions`, konsisten dengan pola existing.

### 1.1 `klasifikasi` (Classification / Categorization)

Guru menetapkan daftar kategori + daftar pernyataan, masing-masing pernyataan punya 1 kategori benar. Kategori boleh dipakai berulang. Urutan pernyataan bisa diacak saat ujian.

```jsonc
// options
{
  "categories": [
    { "id": "c1", "text": "Ayah" },
    { "id": "c2", "text": "Ibu" },
    { "id": "c3", "text": "Adik" }
  ],
  "statements": [
    { "id": "s1", "text": "Seorang laki-laki yang menjadi kepala keluarga.", "answer": "c1" },
    { "id": "s2", "text": "Orang tua perempuan yang melahirkan anak.", "answer": "c2" },
    { "id": "s3", "text": "Anak yang lebih muda dari kakaknya.", "answer": "c3" }
  ],
  "shuffleStatements": true   // opsional, default true
}
```

```jsonc
// format jawaban siswa (answers[questionId])
{ "s1": "c1", "s2": "c2", "s3": "c3" }   // object: statementId -> categoryId
```

**Skoring:** `benar / total_pernyataan` (parsial, mirip `benar_salah` & `menjodohkan`).

### 1.2 `hotspot` (Klik Area pada Gambar)

Guru upload 1 gambar + definisikan 1..n area target (koordinat relatif 0–100%). Siswa klik pada gambar; benar jika klik masuk dalam salah satu area target.

```jsonc
// options
{
  "imageUrl": "https://.../gambar.png",
  "areas": [
    { "id": "a1", "x": 20, "y": 30, "w": 15, "h": 10, "label": "Jantung" }
    // x,y = titik kiri-atas dalam %, w,h = lebar/tinggi dalam %
  ],
  "mode": "any"   // "any" = klik di area mana pun yang benar; "all" = harus klik semua area (v2)
}
```

```jsonc
// format jawaban siswa (answers[questionId])
{ "x": 25.5, "y": 33.1 }   // koordinat klik dalam % relatif terhadap gambar
// ATAU untuk mode "all": [{x,y}, {x,y}, ...]
```

**Skoring v1:** 1 jika titik klik berada dalam bounding box salah satu area, 0 jika tidak.
**Catatan:** gambar harus lewat R2/image_proxy agar tampil di siswa (cek `image_proxy.pb.js`).

### 1.3 `isian_rumpang` (Cloze / Fill-in-the-blank dalam teks)

Teks bacaan dengan beberapa bagian rumpang `[[1]]`, `[[2]]`, dst. Siswa mengisi tiap rumpang. Mendukung jawaban alternatif & case-insensitive opsional.

```jsonc
// options
{
  "text": "Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]].",
  "blanks": [
    { "id": "1", "answers": ["Jakarta"], "caseSensitive": false },
    { "id": "2", "answers": ["Rupiah", "IDR"], "caseSensitive": false }
  ]
}
```

```jsonc
// format jawaban siswa (answers[questionId])
{ "1": "jakarta", "2": "rupiah" }   // object: blankId -> teks jawaban
```

**Skoring:** `benar / total_rumpang`. Per rumpang: cocok jika jawaban siswa (trim + lowercase bila tidak caseSensitive) ada di dalam array `answers`. Bisa pakai `isFuzzyMatch` yang sudah ada untuk toleransi typo (opsional, default off).

### 1.4 `matriks` (Matriks Pilihan Ganda / Tabel Benar-Salah)

N pernyataan (baris) × M kolom opsi yang sama (mis. Benar/Salah atau Ya/Tidak/Setuju...). Tiap baris pilih 1 kolom.

```jsonc
// options
{
  "columns": [
    { "id": "benar", "text": "Benar" },
    { "id": "salah", "text": "Salah" }
  ],
  "statements": [
    { "id": "s1", "text": "Air mendidih pada 100°C.", "answer": "benar" },
    { "id": "s2", "text": "Matahari mengelilingi bumi.", "answer": "salah" }
  ]
}
```

```jsonc
// format jawaban siswa (answers[questionId])
{ "s1": "benar", "s2": "salah" }   // object: statementId -> columnId
```

**Skoring:** `benar / total_pernyataan` (identik dengan `benar_salah`, hanya kolom bisa custom).
**Catatan:** secara data ini generalisasi `benar_salah`. Pertimbangkan apakah `benar_salah` existing di-migrate atau tetap terpisah (rekomendasi: tetap terpisah, jangan migrasi data lama).

---

## 2. Inventaris File per Area

### 2.1 Type Union & Type Mapping (fondasi — ubah duluan)

| File | Line | Yang diubah |
|------|------|-------------|
| `src/pages/admin/QuestionsPage.tsx` | 398 | Tambah 4 tipe ke `QuestionType` union |
| `src/pages/student/CBTPage.tsx` | 76 | Tambah 4 tipe ke type union lokal `ExamQuestion` |
| `src/pages/SettingsPage.tsx` | 147–148, 252–253 | Tambah ke `allowedTypes` default + daftar label tipe |
| `src/pages/admin/QuestionsPage.tsx` | 448–449 | Tambah ke map fitur/validasi per tipe |
| `src/pages/admin/QuestionsPage.tsx` | 510–511, 1501–1502, 1830–1831, 2765–2766, 3739–3740 | Tambah ke map `field` DB (lihat pola: `urutkan: "sequence"`) — putuskan field name: `klasifikasi`, `hotspot`, `isian_rumpang`/`cloze`, `matriks` |
| `src/lib/waygroundApi.ts` | 101–114 | Tambah mapping tipe Wayground → internal (jika Wayground punya padanan) |
| `src/components/dialogs/QuestionRepositoryDialog.tsx` | 113–121, 342–343 | Tambah ke `typeMapReverse` + label dropdown |
| `src/components/dialogs/ItemAnalysisDialog.tsx` | 203–211 | Tambah ke `typeMapReverse` |
| `src/components/dialogs/StudentScoresDialog.tsx` | 219–227 | Tambah ke typeMap |
| `src/pages/admin/MonitoringPage.tsx` | 345–353 | Tambah ke typeMap monitoring |
| `src/pages/admin/GradingPage.tsx` | 61, 66 | Tambah ke typeMap + ekstraksi `options` |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 83, 93 | Tambah ke typeMap + ekstraksi `options` |
| `src/pages/admin/ItemAnalysisPage.tsx` | 423–426 | Tambah ke typeMap |
| `src/pages/student/CBTPage.tsx` | 1087 | Tambah ke `tM` (type map saat load soal) |

### 2.2 Editor Guru (`src/pages/admin/QuestionsPage.tsx`)

File terbesar (~7000 baris). Lokasi kunci (berdasarkan pola `urutkan`/`drag_drop`):

| Line | Fungsi |
|------|--------|
| 540 | Inisialisasi `options` default per tipe saat ganti tipe |
| 1252 | Default `items: []` untuk tipe item-based — tambah default `categories`/`statements`/`columns`/`blanks`/`areas` |
| 1574 | Parse/load dari DB ke form |
| 1804 | Validasi `canSave` / `isValid` — tambah aturan validasi per tipe baru |
| 1892 | Serialisasi form → DB |
| 2174–2196 | Mapping saat duplicate/copy soal |
| 2670 | Branch form editor per tipe — **tambah 4 section form editor** |
| 2790 | Branch save per tipe |
| 3334–3335 | Label tipe di badge/list |
| 3437 | Render `options` di daftar soal |
| 3833 | Branch preview/validasi |
| 4026, 4173, 4411, 4532 | Render detail soal (tampilkan categories/statements/areas/blanks/columns) |
| 5288–5289 | `<option>` di dropdown pilih tipe |
| 5981 | Form input per tipe (tambah 4 blok UI) |
| 6201 | Preview jawaban benar |
| 6311 | Preview soal |
| 6392–6401 | Badge warna + label per tipe |
| 6695 | Tampilan items di list |

**Yang harus dibuat per tipe (editor):**
- `klasifikasi`: editor daftar kategori (tambah/hapus) + daftar pernyataan + dropdown kategori benar per pernyataan + toggle acak urutan
- `hotspot`: upload gambar + editor area (klik-drag di gambar untuk buat kotak, atau input koordinat manual) + label per area
- `isian_rumpang`: textarea dengan sintaks `[[n]]` + auto-detect rumpang + input jawaban benar per rumpang (bisa multiple, pisah koma)
- `matriks`: editor kolom (tambah/hapus/rename) + daftar pernyataan + radio/select kolom benar per pernyataan

### 2.3 Ujian Siswa (`src/pages/student/CBTPage.tsx`)

| Line | Fungsi |
|------|--------|
| 101–138 | `getAnswerStatus` untuk `benar_salah` (statements) — **tambah 4 branch**: cek kelengkapan jawaban |
| 180–210 | `getAnswerStatus` untuk `menjodohkan` — pola object-answer yang bisa dicontoh untuk klasifikasi/matriks/isian_rumpang |
| 217–246 | `getAnswerStatus` untuk `urutkan`/`drag_drop` |
| 1104–1131 | Mapping `rawOptions` → `pairs`/`items`/`statements` saat load — **tambah ekstraksi** `categories`, `areas`, `blanks`, `columns` |
| 1159 | Attach `items` ke question object — tambah attach field baru |
| 2025–2057 | **Skoring client-side** (`objectiveCorrect++`) — **tambah 4 branch skoring** |
| 2742–2746 | Kondisional UI (mis. tombol "tandai") — cek apakah tipe baru perlu masuk |
| 2871 | Render komponen `benar_salah` — **tambah 4 blok render**: |
| 3088 | Render komponen `urutkan`/`drag_drop` |

**Komponen render siswa yang harus dibuat:**
- `klasifikasi`: daftar pernyataan, tiap baris ada `<select>`/radio grup berisi kategori (acak urutan pernyataan jika `shuffleStatements`)
- `hotspot`: tampilkan gambar responsif, onClick catat koordinat % → tampilkan marker; tombol "hapus titik"
- `isian_rumpang`: render teks dengan `<input>` inline di posisi `[[n]]`
- `matriks`: tabel HTML — baris = pernyataan, kolom = opsi, radio per sel

**Format autosave:** `answers[questionId]` = object/array sesuai §1. Autosave existing (`answersRef`) sudah generic — tidak perlu ubah, hanya pastikan format konsisten.

### 2.4 Skoring Server-Side (`pb_hooks/security_fix.pb.js`)

Hook ini menghitung ulang skor saat attempt `finished` (anti-tamper). **Wajib tambah, kalau tidak skor 0.**

| Line | Fungsi |
|------|--------|
| ~148–158 | `TYPE_MAP` — tambah: `klasifikasi: "klasifikasi"`, `hotspot: "hotspot"`, `isian_rumpang`/`cloze: "isian_rumpang"`, `matriks: "matriks"` |
| ~197–266 | Branch skoring per tipe (duplikat di `onRecordCreateRequest` dan `onRecordUpdateRequest` ~line 366) — **tambah 4 `else if` dengan logika §1** |
| 93–94 | Strip `correctAnswer` — sudah generic, tidak perlu ubah. **Pastikan** field kunci baru (`options.statements[].answer`, `options.blanks[].answers`, `options.areas`) ikut ke-strip untuk siswa. Cek apakah strip hanya `correctAnswer` atau seluruh `options` — jika `options` ikut dikirim ke siswa, kunci bocor! |

> ⚠️ **KRITIS:** Audit apa yang dikirim ke client untuk soal. Jika `options` dikirim utuh (berisi `answer`), siswa bisa intip kunci via DevTools. Pola existing: `benar_salah` menyimpan kunci di `options.statements[].answer` — cek bagaimana hook menanganinya. Tipe baru harus ikut pola yang sama (strip atau pisahkan kunci).

### 2.5 Monitoring

| File | Line | Yang diubah |
|------|------|-------------|
| `src/pages/admin/MonitoringPage.tsx` | 345–369 | TypeMap + ekstraksi options (tambah field baru) |
| `src/pages/admin/monitoring/utils/helpers.ts` | 156, 305 | `computeQuestionScore` — **tambah 4 branch skoring** (dipakai Live Score & rekap) |
| `src/pages/admin/monitoring/components/StudentTable.tsx` | 656 | Format tampilan jawaban siswa per tipe (tambah 4 branch) |
| `src/lib/roomExcelExport.ts` | 67, 147 | `checkAns` — **tambah 4 branch skoring** |
| `src/lib/roomExcelExport.ts` | 166–167 | `typeLabel` singkat: `klasifikasi: "KLAS"`, `hotspot: "HS"`, `isian_rumpang: "IR"`, `matriks: "MTX"` |
| `src/lib/roomExcelExport.ts` | 288–310 | TypeMap + ekstraksi options |
| `src/pages/admin/monitoring/utils/exportExcel.ts` | 58 | Format jawaban untuk export Excel — **tambah 4 branch** |
| `src/pages/admin/monitoring/utils/exportExcel.ts` | 87–88 | `typeLabel` — tambah 4 singkatan |

### 2.6 Detail Jawaban & Grading (Admin)

| File | Line | Yang diubah |
|------|------|-------------|
| `src/pages/admin/GradingPage.tsx` | 137 | Skoring manual/otomatis — **tambah 4 branch** |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 162 | Kategorisasi tipe (objektif vs uraian) — pastikan 4 tipe baru masuk "objektif" (auto-scored) |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 373 | Label tipe singkat |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 396, 419 | Format tampil jawaban siswa & kunci — **tambah 4 branch** |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 608, 662 | Validasi/branch per tipe |
| `src/pages/admin/StudentGradingDetailPage.tsx` | 786–797 | Badge warna + label |
| `src/components/dialogs/StudentScoresDialog.tsx` | 315 | Branch items-based — cek apakah tipe baru perlu |

### 2.7 Analisis Butir Soal

| File | Line | Yang diubah |
|------|------|-------------|
| `src/lib/itemAnalysisEvaluator.ts` | 449, 480 | Branch `benar_salah` untuk analisis per-pernyataan — `klasifikasi`/`matriks`/`isian_rumpang` bisa ikut pola ini (analisis per sub-item) |
| `src/components/dialogs/ItemAnalysisDialog.tsx` | 258 | Ekstraksi `items` — tambah ekstraksi field baru |
| `src/components/dialogs/ItemAnalysisDialog.tsx` | 335 | Branch tampil analisis per tipe |
| `src/components/dialogs/ItemAnalysisDialog.tsx` | 1128 | Dropdown filter tipe |
| `src/pages/admin/ItemAnalysisPage.tsx` | 511 | Ekstraksi options |
| `src/pages/admin/ItemAnalysisPage.tsx` | 656 | Branch analisis per tipe |

**Keputusan:** `hotspot` (skor biner 0/1) bisa ikut analisis butir standar. `klasifikasi`/`matriks`/`isian_rumpang` (skor parsial) — putuskan apakah dianalisis per-sub-item atau sebagai skor keseluruhan.

### 2.8 Import/Export Excel (`src/lib/questionExcel.ts`)

Template Excel saat ini hanya mendukung: PG, PGK, BS, Isian, Uraian.

| Line | Yang diubah |
|------|-------------|
| 103–113 | Panduan template — tambah dokumentasi 4 tipe baru |
| ~125–145 | `TYPE_MAP` — tambah mapping: `klasifikasi`, `hotspot`, `isian_rumpang`/`isian rumpang`/`cloze`, `matriks` + field DB |
| 161+ | `parseQuestionImportExcel` — **tambah 4 branch parsing**. Format kolom yang diusulkan: |
| | - `klasifikasi`: kolom "Kategori" (pisah `\|`) + "Pernyataan & Kunci" (format `pernyataan => kategori`) |
| | - `hotspot`: kolom "URL Gambar" + "Area" (format `x,y,w,h:label; ...`) |
| | - `isian_rumpang`: kolom "Teks" dengan `[[n]]` + "Kunci Rumpang" (format `1=Jakarta; 2=Rupiah/IDR`) |
| | - `matriks`: kolom "Kolom" (pisah `\|`) + "Pernyataan & Kunci" (format `pernyataan => kolom`) |

**Risiko:** format Excel untuk tipe kompleks rawan salah input. Pertimbangkan: Excel hanya untuk tipe sederhana, tipe kompleks via editor UI saja (v1).

### 2.9 Word Parser (`src/lib/questionWordParser.ts`)

Line 903: hanya `pilihan_ganda` yang di-keep saat `includeEssay=false`. Cek apakah parser mengenali tipe lain — dari grep, tidak ada branch `menjodohkan`/`urutkan` di sini, jadi **kemungkinan Word import hanya support PG** dan 4 tipe baru otomatis tidak terpengaruh. Verifikasi saat implementasi.

### 2.10 AI Generator (`src/lib/ai.ts`)

| Line | Yang diubah |
|------|-------------|
| 670–671 | Validasi `items` untuk urutkan/drag_drop — tambah validasi field baru |
| 840–841 | Daftar tipe untuk prompt |
| 891–894 | Contoh JSON literasi per tipe — **tambah 4 contoh** |
| 904 | Instruksi khusus per tipe |
| 982–986 | Template output per tipe — **tambah 4 template** |
| 1089–1090 | Daftar tipe (fungsi kedua) |
| 1109–1111 | Contoh JSON singkat — **tambah 4 contoh** |
| 1129 | `maxTokens` — tambah tipe baru yang butuh token besar |
| 1463–1464, 1488–1492 | Duplikat ketiga — tambah juga |

**Catatan:** `hotspot` sulit di-generate AI (butuh gambar + koordinat). Rekomendasi: AI tidak generate `hotspot` di v1 (atau generate tanpa gambar, guru lengkapi manual).

### 2.11 Wayground (`src/lib/waygroundApi.ts`, `QuestionRepositoryDialog.tsx`)

| File | Line | Yang diubah |
|------|------|-------------|
| `src/lib/waygroundApi.ts` | 101–114 | Mapping tipe Wayground → internal. Jika Wayground tidak punya padanan (kemungkinan besar untuk 4 tipe ini), soal bertipe tersebut di-skip atau di-map ke terdekat |
| `src/components/dialogs/QuestionRepositoryDialog.tsx` | 172 | Ekstraksi `options.items` — tambah ekstraksi field baru agar soal hasil import tampil benar |

### 2.12 Lainnya

| File | Line | Yang diubah |
|------|------|-------------|
| `src/pages/admin/GuidePage.tsx` | 505 | Dokumentasi tipe soal untuk guru — tambah 4 section |
| `src/pages/admin/ExamsPage.tsx` | 1142, 1289 | Duplikasi/validasi soal per tipe — tambah branch |
| `pb_hooks/monitoring_stats.pb.js` | — | Cek apakah ada logika per-tipe (saat ini agregasi umum, kemungkinan tidak perlu) |

---

## 3. Urutan Pengerjaan yang Aman

```
Fase 0: Fondasi tipe
  1. Tambah ke QuestionType union (QuestionsPage.tsx:398, CBTPage.tsx:76)
  2. Tambah ke semua TYPE_MAP / typeMapReverse (daftar di §2.1)
  3. Tambah field mapping DB (§2.1)
  → Verifikasi: bun transpile lolos, tidak ada TS error

Fase 1: Skoring (backend dulu agar tidak skor 0)
  4. pb_hooks/security_fix.pb.js: TYPE_MAP + 4 branch skoring (2 lokasi: create & update)
  5. Audit strip kunci jawaban (pastikan options.answer tidak bocor ke siswa)
  → Verifikasi: node --check, deploy ke 1 tenant test

Fase 2: Editor guru
  6. QuestionsPage.tsx: form editor + validasi + preview per tipe (satu tipe per commit)
  → Urutan disarankan: matriks → klasifikasi → isian_rumpang → hotspot
     (matriks paling mirip benar_salah; hotspot paling kompleks karena gambar)

Fase 3: Ujian siswa
  7. CBTPage.tsx: getAnswerStatus + render + skoring client per tipe
  → Verifikasi: buat exam test, jawab sebagai siswa dummy, cek autosave format

Fase 4: Monitoring & rekap
  8. helpers.ts computeQuestionScore + roomExcelExport.ts checkAns
  9. StudentTable.tsx format jawaban + exportExcel.ts
  10. MonitoringPage.tsx typeMap

Fase 5: Grading & analisis butir
  11. GradingPage.tsx + StudentGradingDetailPage.tsx
  12. itemAnalysisEvaluator.ts + ItemAnalysisDialog.tsx + ItemAnalysisPage.tsx

Fase 6: Import/Export & AI
  13. questionExcel.ts (template + parser)
  14. ai.ts (prompt + validasi + contoh JSON)
  15. waygroundApi.ts + QuestionRepositoryDialog.tsx
  16. GuidePage.tsx (dokumentasi guru)

Fase 7: Release
  17. Commit per fase, push, git pull di laptop, build, release:quick
  18. Smoke test di tenant test sebelum production
```

**Aturan commit:** 1 tipe per commit untuk Fase 2–3 (mudah revert jika bermasalah). Jangan campur 4 tipe dalam 1 commit besar.

---

## 4. Risiko & Error Potensial per Area

| Area | Risiko | Mitigasi |
|------|--------|----------|
| **Strip kunci (security_fix.pb.js)** | `options.statements[].answer` / `blanks[].answers` / `areas` bocor ke siswa via API → siswa intip kunci di DevTools | Audit response API soal untuk siswa; pastikan field kunci di-strip atau tidak ikut di-serialize. Test dengan curl sebagai siswa |
| **Skoring tidak sinkron** | Skor client (CBTPage) ≠ skor server (hook) → nilai berubah setelah submit | Samakan rumus persis di kedua tempat; server adalah source of truth |
| **Format jawaban tidak konsisten** | Autosave kirim `{s1: "c1"}` tapi skoring baca format lain → skor 0 | Definisikan format di §1 sebagai kontrak; tulis test manual per tipe |
| **Hotspot koordinat** | Gambar di-resize responsif → koordinat % harus relatif, bukan px. Beda device = beda ukuran render | Selalu pakai % relatif terhadap bounding box gambar saat diklik; jangan simpan px |
| **Hotspot gambar** | Gambar tidak load di siswa (R2/blocked) → soal tidak bisa dijawab | Wajib lewat image_proxy; fallback tampil pesan jika gambar gagal load |
| **Isian rumpang parsing** | Guru lupa tutup `[[` atau nomor tidak urut → blank tidak terdeteksi | Validasi di editor: highlight rumpang yang terdeteksi, warning jika ada `[[` tanpa pasangan |
| **Excel import** | Format kolom kompleks membingungkan guru → data rusak | v1: Excel hanya untuk matriks & klasifikasi sederhana; hotspot & isian_rumpang via UI saja |
| **AI generate** | AI output JSON tidak sesuai skema → soal rusak | Perketat `validateQuestions` (§2.10 line 670); hotspot di-exclude dari AI v1 |
| **Monitoring perf** | `computeQuestionScore` dipanggil per siswa per soal — tipe baru tambah overhead | Skoring O(n) per sub-item, tetap ringan; tidak ada query tambahan |
| **QuestionType union** | Lupa tambah di salah satu file → TS error atau runtime fallback ke PG | Gunakan grep `drag_drop` sebagai checklist; semua file di §2.1 harus tersentuh |
| **Migrasi data lama** | `benar_salah` vs `matriks` overlap konsep → guru bingung | Jangan migrasi; dokumentasikan perbedaan di GuidePage |
| **Shuffle** | `klasifikasi` acak urutan pernyataan — jawaban tersimpan by ID (bukan index) agar tidak rusak | Selalu pakai ID sebagai key jawaban, jangan index array |

---

## 5. Checklist File (ringkas untuk eksekutor)

```
[ ] src/pages/admin/QuestionsPage.tsx          (type union, editor, validasi, preview, list)
[ ] src/pages/student/CBTPage.tsx              (type union, status, render, skoring client)
[ ] pb_hooks/security_fix.pb.js                (TYPE_MAP, skoring server x2, audit strip kunci)
[ ] src/pages/admin/monitoring/utils/helpers.ts (computeQuestionScore)
[ ] src/lib/roomExcelExport.ts                 (checkAns, typeLabel, typeMap)
[ ] src/pages/admin/monitoring/utils/exportExcel.ts (format jawaban, typeLabel)
[ ] src/pages/admin/monitoring/components/StudentTable.tsx (format jawaban)
[ ] src/pages/admin/MonitoringPage.tsx         (typeMap, ekstraksi options)
[ ] src/pages/admin/GradingPage.tsx             (typeMap, skoring)
[ ] src/pages/admin/StudentGradingDetailPage.tsx (label, format jawaban/kunci, badge)
[ ] src/lib/itemAnalysisEvaluator.ts           (analisis per sub-item)
[ ] src/components/dialogs/ItemAnalysisDialog.tsx (typeMap, ekstraksi, dropdown)
[ ] src/pages/admin/ItemAnalysisPage.tsx       (typeMap, ekstraksi)
[ ] src/lib/questionExcel.ts                   (template, TYPE_MAP, parser)
[ ] src/lib/ai.ts                              (validasi, prompt, contoh JSON x3 lokasi)
[ ] src/lib/waygroundApi.ts                    (mapping tipe)
[ ] src/components/dialogs/QuestionRepositoryDialog.tsx (typeMap, ekstraksi, label)
[ ] src/components/dialogs/StudentScoresDialog.tsx (typeMap)
[ ] src/pages/SettingsPage.tsx                 (allowedTypes, label)
[ ] src/pages/admin/GuidePage.tsx              (dokumentasi)
[ ] src/pages/admin/ExamsPage.tsx              (duplikasi/validasi)
[ ] vps/template_school/pb_hooks/security_fix.pb.js (sync hook)
```

**Estimasi:** ~21 file, 60+ titik edit. Rekomendasi dikerjakan bertahap per fase, bukan sekaligus.
