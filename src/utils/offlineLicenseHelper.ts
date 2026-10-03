/**
 * offlineLicenseHelper.ts
 * Utility untuk membuat (di sisi Super Admin) dan memvalidasi (di sisi Server Offline)
 * izin lisensi server mandiri (Offline CBT).
 */

// Kunci rahasia internal untuk menandatangani lisensi offline.
// Menggunakan salt tetap yang diverifikasi secara offline di sisi klien.
const LICENSE_SECRET = "EXAMKU_OFFLINE_SECRET_AUTH_KEY_2026_SECURE_SALT_9918";

export interface OfflineLicensePayload {
  school_name: string;
  slug: string;
  npsn?: string;
  valid_until: string;    // Format YYYY-MM-DD
  max_students: number;   // Kuota peserta offline
  issued_at: string;      // ISO String
  notes?: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  payload?: OfflineLicensePayload;
  isExpired?: boolean;
}

/**
 * Hash function sederhana berbasis SHA-256 browser Web Crypto API
 */
async function computeHash(text: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback hash jika crypto.subtle tidak tersedia
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

/**
 * Generate Kode Lisensi Bertanda Tangan (Hanya dijalankan oleh Super Admin)
 */
export async function generateOfflineLicense(payload: OfflineLicensePayload): Promise<string> {
  const jsonPayload = JSON.stringify(payload);
  const base64Payload = btoa(unescape(encodeURIComponent(jsonPayload)));
  const signature = await computeHash(`${base64Payload}::${LICENSE_SECRET}`);
  
  // Format: EXAMKU-OFFLINE.v1.<BASE64_PAYLOAD>.<SIGNATURE_16_CHARS>
  const shortSig = signature.substring(0, 16);
  return `EXAMKU-OFFLINE.v1.${base64Payload}.${shortSig}`;
}

/**
 * Verifikasi Kode Lisensi di Server Offline (Berjalan 100% Offline)
 */
export async function verifyOfflineLicense(licenseCode: string): Promise<VerificationResult> {
  if (!licenseCode || typeof licenseCode !== "string") {
    return { valid: false, message: "Kode lisensi tidak boleh kosong." };
  }

  const clean = licenseCode.trim();
  const parts = clean.split(".");

  if (parts.length !== 4 || parts[0] !== "EXAMKU-OFFLINE" || parts[1] !== "v1") {
    return { valid: false, message: "Format kode lisensi tidak valid atau rusak." };
  }

  const base64Payload = parts[2];
  const givenSig = parts[3];

  try {
    const expectedHash = await computeHash(`${base64Payload}::${LICENSE_SECRET}`);
    const expectedSig = expectedHash.substring(0, 16);

    if (givenSig.toLowerCase() !== expectedSig.toLowerCase()) {
      return { valid: false, message: "Tanda tangan lisensi tidak cocok (lisensi palsu atau telah diubah)." };
    }

    const jsonStr = decodeURIComponent(escape(atob(base64Payload)));
    const payload: OfflineLicensePayload = JSON.parse(jsonStr);

    if (!payload.school_name || !payload.valid_until) {
      return { valid: false, message: "Data lisensi tidak lengkap." };
    }

    // Cek kadaluarsa
    const expiryDate = new Date(`${payload.valid_until}T23:59:59`);
    const now = new Date();

    if (now > expiryDate) {
      return {
        valid: false,
        isExpired: true,
        message: `Masa izin server offline telah berakhir pada ${payload.valid_until}. Silakan hubungi Super Admin untuk perpanjangan.`,
        payload
      };
    }

    return {
      valid: true,
      message: "Lisensi server offline terverifikasi dan sah dari Super Admin.",
      payload
    };
  } catch (err: any) {
    return { valid: false, message: `Gagal membaca isi lisensi: ${err.message || "Format salah"}` };
  }
}
