/**
 * Perbandingan nilai secara mendalam (deep equal).
 *
 * Ditulis sendiri supaya tidak menambah dependensi `lodash` hanya untuk
 * satu fungsi. Dipakai di CBTPage untuk membandingkan objek jawaban siswa
 * (`{[questionId]: jawaban}`) agar penulisan ke server hanya terjadi saat
 * benar-benar ada perubahan.
 *
 * Cakupan: primitif, Array, plain Object, Date, null/undefined.
 * Nilai yang bentuknya sama tapi beda tipe (mis. 1 vs "1") dianggap BEDA,
 * sesuai perilaku `lodash/isEqual`.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  // Cek identitas & primitif lebih dulu (paling sering terjadi → paling cepat)
  if (a === b) return true;

  // NaN === NaN bernilai false, padahal secara nilai keduanya sama
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }

  // null / undefined / beda tipe dasar → tidak mungkin sama
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  // Date dibandingkan lewat waktu-nya, bukan lewat properti
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;

  if (aArr) {
    const x = a as unknown[];
    const y = b as unknown[];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      if (!isEqual(x[i], y[i])) return false;
    }
    return true;
  }

  // Objek biasa: jumlah kunci harus sama, lalu tiap nilai dibandingkan
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const kx = Object.keys(x);
  const ky = Object.keys(y);
  if (kx.length !== ky.length) return false;

  for (const k of kx) {
    if (!Object.prototype.hasOwnProperty.call(y, k)) return false;
    if (!isEqual(x[k], y[k])) return false;
  }
  return true;
}

export default isEqual;
