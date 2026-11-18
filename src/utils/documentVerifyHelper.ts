/**
 * Helper untuk encode, decode, dan verifikasi dokumen resmi EXAMKU (Kuitansi SPJ & Invoice)
 * Digunakan untuk QR Code TTE (Tanda Tangan Elektronik) agar dapat discan & divalidasi langsung di browser.
 */

export interface DocumentVerificationPayload {
  v: number;                 // Versi format payload
  t: "receipt" | "invoice";  // Tipe dokumen: "receipt" (Kuitansi SPJ) atau "invoice"
  no: string;                // Nomor dokumen: misal "KWT/BOS/INV-2611-7933" atau "#INV-2611-7933"
  invId?: string;            // PocketBase ID jika ada
  sn: string;                // Nama Sekolah / Institusi
  sl?: string;               // Slug sekolah / subdomain
  amt: number;               // Grand total transaksi (Rp)
  dt: string;                // Tanggal dokumen (misal "18 November 2026")
  st: "paid" | "unpaid" | "overdue"; // Status pembayaran
  pr: string;                // Nama Penyedia: "Alfaruq Asri (EXAMKU CBT)"
  act?: string;              // Uraian peruntukan pembayaran / nama kegiatan SPJ
  plan?: string;             // Paket layanan (misal: "Paket Premium")
  tax?: {
    rate: number;            // Persen PPN (11)
    amount: number;          // Nominal PPN (Rp)
    subtotal: number;        // Subtotal hak layanan (Rp)
  };
  hash: string;              // Digital security fingerprint
}

/**
 * Buat security hash / digital fingerprint deterministik dari dokumen
 */
export function generateDocFingerprint(no: string, amt: number, dt: string): string {
  const seed = `${no}:${amt}:${dt}:EXAMKU_OFFICIAL_TTE_2026`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const cleanNo = no.replace(/[^A-Za-z0-9]/g, "").slice(-8);
  return `EXAMKU-TTE-${cleanNo}-${hex}`;
}

/**
 * Encode payload verifikasi ke string Base64 URL-safe yang ringkas untuk QR Code
 */
export function encodeDocVerification(payload: DocumentVerificationPayload): string {
  try {
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    console.error("Gagal encode verifikasi dokumen:", e);
    return "";
  }
}

/**
 * Decode payload verifikasi dari string Base64 URL-safe
 */
export function decodeDocVerification(token: string): DocumentVerificationPayload | null {
  try {
    if (!token) return null;
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) {
      b64 += "=";
    }
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Gagal decode verifikasi dokumen:", e);
    return null;
  }
}

/**
 * Buat URL verifikasi lengkap yang akan di-encode ke QR Code
 */
export function getDocumentVerifyUrl(payload: DocumentVerificationPayload, domainOrigin?: string): string {
  const encoded = encodeDocVerification(payload);
  const base = domainOrigin || "https://examku.my.id";
  const cleanBase = base.replace(/\/+$/, "");
  return `${cleanBase}/validasi-dokumen?no=${encodeURIComponent(payload.no)}&d=${encoded}`;
}
