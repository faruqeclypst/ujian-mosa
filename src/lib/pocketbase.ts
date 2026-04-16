import PocketBase, { LocalAuthStore } from 'pocketbase';

// ============================================================
// MASTER PocketBase — Registry Sekolah (SaaS Control Plane)
// Koleksi: schools, school_requests, super_admins
// ============================================================
export const masterPb = new PocketBase(
  import.meta.env.VITE_MASTER_PB_URL || 'http://127.0.0.1:8090',
  new LocalAuthStore('master_pb_auth')
);
masterPb.autoCancellation(false);

// ============================================================
// SCHOOL PocketBase — Per-School Instance (Data Plane)
// Setiap sekolah punya PocketBase sendiri dengan schema E-Ujian
// ============================================================
const schoolPbCache = new Map<string, PocketBase>();

export function getSchoolPb(pbUrl: string): PocketBase {
  if (!schoolPbCache.has(pbUrl)) {
    // Generate a unique auth store key per tenant to prevent collisions
    const urlHash = pbUrl.replace(/[^a-zA-Z0-9]/g, '_');
    const instance = new PocketBase(
       pbUrl,
       new LocalAuthStore(`tenant_pb_auth_${urlHash}`)
    );
    instance.autoCancellation(false);
    schoolPbCache.set(pbUrl, instance);
  }
  return schoolPbCache.get(pbUrl)!;
}

// ============================================================
// Legacy export — dipakai oleh file yang belum dimigrate
// Akan dihapus setelah semua file menggunakan useTenant().pb
// ============================================================
const pbUrl =
  import.meta.env.VITE_POCKETBASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://127.0.0.1:8090');

const pb = getSchoolPb(pbUrl);

export default pb;
