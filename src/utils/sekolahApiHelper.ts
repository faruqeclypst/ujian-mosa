/**
 * sekolahApiHelper.ts
 * Integrasi API Data Sekolah Seluruh Indonesia (https://sekolah.devapi.id/)
 * Digunakan untuk pencarian NPSN, nama sekolah, alamat, dan kontak otomatis.
 */

export interface SekolahApiItem {
  npsn: string;
  nama: string;
  bentukPendidikan: string;
  jalurPendidikan?: string;
  jenjangPendidikan?: string;
  statusSatuanPendidikan?: string;
  akreditasi?: string;
  alamat?: {
    jalan?: string;
    rt?: number;
    rw?: number;
    nama_dusun?: string;
    nama_desa?: string;
    nama_kecamatan?: string;
    nama_kabupaten?: string;
    nama_provinsi?: string;
    nama_negara?: string;
  };
  kontak?: {
    nomor_fax?: string;
    nomor_telepon?: string;
    email?: string;
    website?: string;
  };
}

/**
 * Format alamat sekolah menjadi string rapi untuk form
 */
export function formatSchoolAddress(item: SekolahApiItem): string {
  if (!item.alamat) return "";
  const parts: string[] = [];
  if (item.alamat.jalan) parts.push(item.alamat.jalan.trim());
  if (item.alamat.nama_desa) parts.push(`Desa/Kel. ${item.alamat.nama_desa.trim()}`);
  if (item.alamat.nama_kecamatan) parts.push(`Kec. ${item.alamat.nama_kecamatan.trim()}`);
  if (item.alamat.nama_kabupaten) parts.push(item.alamat.nama_kabupaten.trim());
  if (item.alamat.nama_provinsi) parts.push(item.alamat.nama_provinsi.trim());
  return parts.filter(Boolean).join(", ");
}

/**
 * Buat rekomendasi subdomain slug dari nama sekolah resmi
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/^-+|-+$/g, "");
}

/**
 * Cari sekolah berdasarkan nama atau NPSN dari sekolah.devapi.id
 */
export async function searchSekolah(query: string, limit = 12): Promise<SekolahApiItem[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];

  const isNumeric = /^\d+$/.test(clean);
  const param = isNumeric ? `npsn=${encodeURIComponent(clean)}` : `nama=${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(`https://sekolah.devapi.id/sekolah?${param}&limit=${limit}`, {
      headers: { Accept: "application/json" }
    });

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`API error code ${res.status}`);
    }

    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.warn("Pencarian API data sekolah gagal:", err);
    return [];
  }
}
