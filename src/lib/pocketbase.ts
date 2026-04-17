import PocketBase, { LocalAuthStore } from 'pocketbase';

// ============================================================
// MASTER PocketBase — Registry Sekolah (SaaS Control Plane)
// Koleksi: schools, school_requests, super_admins
// ============================================================
// Custom AuthStore to use sessionStorage for Super Admin
// This ensures session is cleared when the tab is closed
class SessionAuthStore extends LocalAuthStore {
    // In newer SDKs, we can just replace the internal storage reference
    // if it's available, or manually handle the save/clear.
    // To be safe and clean, we'll use LocalAuthStore logic but point to sessionStorage
    save(token: string, model: any) {
        super.save(token, model);
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('master_pb_auth', JSON.stringify({ token, model }));
        }
    }

    clear() {
        super.clear();
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('master_pb_auth');
        }
    }

    loadFromStorage() {
        if (typeof window !== 'undefined') {
            const data = window.sessionStorage.getItem('master_pb_auth');
            if (data) {
                const parsed = JSON.parse(data);
                super.save(parsed.token, parsed.model);
            }
        }
    }
}

const sessionStore = new SessionAuthStore();
sessionStore.loadFromStorage();

export const masterPb = new PocketBase(
  import.meta.env.VITE_MASTER_PB_URL || 'http://127.0.0.1:8090',
  sessionStore
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
