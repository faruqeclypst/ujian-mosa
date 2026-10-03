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
 * Pure JavaScript SHA-256 implementation
 * Diperlukan agar verifikasi hash berjalan konsisten di semua lingkungan:
 * - HTTPS (Cloud)
 * - Localhost / 127.0.0.1 (PC Server)
 * - HTTP IP LAN lokal misal 192.168.x.x (HP Siswa / Laptop Client),
 *   di mana window.crypto.subtle dinonaktifkan oleh browser karena non-secure context.
 */
function pureSha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const temp1 = (h + sigma1 + ch + k[j] + w[j]) | 0;
      const temp2 = (sigma0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }
  return result;
}

/**
 * Hash function berbasis SHA-256 (pure JavaScript deterministik)
 */
async function computeHash(text: string): Promise<string> {
  try {
    return pureSha256(text);
  } catch {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return "";
  }
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
