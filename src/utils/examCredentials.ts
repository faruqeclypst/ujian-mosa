/**
 * Utilitas Kredensial Sesi Ujian (Exam Credentials)
 * 
 * Menghasilkan username & password ujian alternatif yang terikat ke akun siswa.
 * Siswa dapat login menggunakan kredensial ini saat ujian CBT berlangsung
 * tanpa khawatir lupa password akun standar mereka.
 */

/**
 * Menghasilkan password ujian acak (5 digit angka + simbol '*', contoh: '28327*')
 */
export function generateExamPassword(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${num}*`;
}

/**
 * Menghasilkan username ujian terstandarisasi (contoh: 'TU909090')
 * @param nisnOrUsername NISN atau username asli siswa
 * @param prefix Prefix yang diinginkan (default: 'TU')
 */
export function generateExamUsername(nisnOrUsername: string, prefix = "TU"): string {
  const clean = (nisnOrUsername || "").toString().trim();
  const cleanPrefix = (prefix || "TU").trim().toUpperCase();

  if (!clean) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `${cleanPrefix}${randomSuffix}`;
  }

  // Jika sudah diawali dengan prefix (case-insensitive), standarkan ke huruf kapital
  if (clean.toUpperCase().startsWith(cleanPrefix)) {
    return clean.toUpperCase();
  }

  return `${cleanPrefix}${clean}`;
}

/**
 * Menghasilkan pasangan lengkap kredensial ujian untuk satu siswa
 */
export function generateExamCredentials(nisnOrUsername: string, prefix = "TU"): {
  examUsername: string;
  examPassword: string;
} {
  return {
    examUsername: generateExamUsername(nisnOrUsername, prefix),
    examPassword: generateExamPassword(),
  };
}

