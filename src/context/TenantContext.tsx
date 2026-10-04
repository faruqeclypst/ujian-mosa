import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from 'react';
import PocketBase from 'pocketbase';
import { Capacitor } from '@capacitor/core';
import { masterPb, getSchoolPb } from '../lib/pocketbase';
import { verifyOfflineLicense, OfflineLicensePayload } from '../utils/offlineLicenseHelper';

// ============================================================
// Types
// ============================================================
export type SchoolType = 'school' | 'campus';

export interface Terminology {
  teacher: string;
  student: string;
  class: string;
  school: string;
  id: string;
  subject: string;
}

export const TERMINOLOGY: Record<SchoolType, Terminology> = {
  school: {
    teacher: 'Guru',
    student: 'Siswa',
    class: 'Kelas',
    school: 'Sekolah',
    id: 'NISN',
    subject: 'Mata Pelajaran',
  },
  campus: {
    teacher: 'Dosen',
    student: 'Mahasiswa',
    class: 'Prodi / Semester',
    school: 'Kampus',
    id: 'NIM',
    subject: 'Mata Kuliah',
  },
};

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
  type: SchoolType;
  logo_url?: string;
  primary_color?: string;
  is_active: boolean;
  plan?: string;
  student_quota?: number;
  contact_email?: string;
  custom_domain?: string;
  active_until?: string;
  server_host?: string;
  created?: string;
  npsn?: string;
  offline_license?: string;
  offline_license_payload?: OfflineLicensePayload;
}

import { getSubscriptionStatus, SubscriptionStatusInfo } from '../utils/subscriptionHelper';

interface TenantContextValue {
  school: SchoolRecord | null;
  pb: PocketBase | null;       // PocketBase instance untuk sekolah aktif
  slug: string | null;
  isLandingDomain: boolean;    // true jika ini examku.my.id
  loading: boolean;
  notFound: boolean;           // true jika slug ada tapi tidak di registry
  inactive: boolean;           // true jika sekolah is_active = false
  inactiveReason?: string | null;
  isDeviceMismatch?: boolean;
  terminology: Terminology;     // Helper untuk label dinamis
  subscriptionStatus: SubscriptionStatusInfo; // Status masa aktif, grace period, dan suspensi
  setManualSchool: (school: string | SchoolRecord | null) => void;
  refreshSchool: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

// ============================================================
// Slug & Custom Domain Resolver
// ============================================================
function resolveSlugFromUrl(): { slug: string | null; customDomain: string | null; isLanding: boolean } {
  const hostname = window.location.hostname.toLowerCase();
  const mainDomain = (import.meta.env.VITE_MAIN_DOMAIN || 'examku.my.id').toLowerCase();
  const landingSubdomain = (import.meta.env.VITE_LANDING_SUBDOMAIN || 'ujian').toLowerCase();

  // DEV OVERRIDE: jika VITE_DEV_SCHOOL_SLUG diisi, paksa mode sekolah di localhost
  const devSlug = import.meta.env.VITE_DEV_SCHOOL_SLUG;
  if (devSlug && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return { slug: devSlug, customDomain: null, isLanding: false };
  }

  // Cek apakah hostname adalah IP address lokal / LAN atau localhost non-dev (Server Offline CBT)
  const isPrivateIp = /^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(hostname);
  const isLocalOfflinePort = (hostname === 'localhost' || hostname === '127.0.0.1') && window.location.port !== '5173';
  if (isPrivateIp || isLocalOfflinePort) {
    return { slug: 'local', customDomain: hostname, isLanding: false };
  }

  // Dev mode: localhost / 127.0.0.1 / root domain → tampilkan landing
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === mainDomain ||
    hostname === `www.${mainDomain}`
  ) {
    return { slug: null, customDomain: null, isLanding: true };
  }

  // Cek apakah ini subdomain dari main domain (misal: modalbangsa.examku.my.id)
  if (hostname.endsWith(`.${mainDomain}`)) {
    const subdomain = hostname.slice(0, hostname.length - mainDomain.length - 1);
    if (subdomain === landingSubdomain || subdomain === 'www') {
      return { slug: null, customDomain: null, isLanding: true };
    }
    return { slug: subdomain, customDomain: null, isLanding: false };
  }

  // Support domain sekunder/legacy (alfaruqasri.my.id)
  const legacyDomain = 'alfaruqasri.my.id';
  if (hostname === legacyDomain || hostname === `www.${legacyDomain}`) {
    return { slug: null, customDomain: null, isLanding: true };
  }

  const legacySubdomain = hostname.endsWith(`.${legacyDomain}`)
    ? hostname.slice(0, hostname.length - legacyDomain.length - 1)
    : null;

  if (legacySubdomain && (legacySubdomain === landingSubdomain || legacySubdomain === 'www')) {
    return { slug: null, customDomain: null, isLanding: true };
  }

  // Jika bukan subdomain bawaan dan bukan landing:
  // Berarti ini adalah Custom Domain milik tenant (misal: cbt.sman1modalbangsa.sch.id atau exam.alfaruqasri.my.id)
  return { slug: legacySubdomain, customDomain: hostname, isLanding: false };
}


// Helper cache functions for instant resolution and offline resilience
const getTenantCacheKey = (slug: string | null, customDomain: string | null) => {
  if (slug) return `tenant_school_cache_${slug}`;
  if (customDomain) return `tenant_school_cache_domain_${customDomain}`;
  return null;
};

const getCachedSchool = (key: string | null): SchoolRecord | null => {
  if (typeof window === 'undefined' || !key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.pb_url) return parsed;
  } catch {
    // Ignore parse errors
  }
  return null;
};

const setCachedSchool = (key: string | null, record: SchoolRecord | null) => {
  if (typeof window === 'undefined' || !key) return;
  try {
    if (record) {
      localStorage.setItem(key, JSON.stringify(record));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota / access errors
  }
};

// ============================================================
// TenantProvider
// ============================================================
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [manualSlug, setManualSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const isApp = Capacitor.isNativePlatform();
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isApp || isLocalhost) {
        return localStorage.getItem('selected_school_slug');
      } else {
        // Hapus residual selected_school_slug di domain publik agar tidak mengganggu landing page
        localStorage.removeItem('selected_school_slug');
      }
    }
    return null;
  });

  const { slug: urlSlug, customDomain, isLanding: isUrlLanding } = useMemo(() => resolveSlugFromUrl(), []);

  const isApp = Capacitor.isNativePlatform();
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const allowManualSlug = isApp || isLocalhost;

  // Effective slug: URL slug takes priority on web, manual slug for native/override
  const slug = urlSlug || (allowManualSlug ? manualSlug : null);
  const isLanding = isUrlLanding && (!allowManualSlug || !manualSlug);

  const cacheKey = useMemo(() => getTenantCacheKey(slug, customDomain), [slug, customDomain]);

  // Read initial cache: instant load with 0ms latency
  const initialCached = useMemo(() => getCachedSchool(cacheKey), [cacheKey]);

  const [school, setSchool] = useState<SchoolRecord | null>(() => initialCached);
  const [pb, setPb] = useState<PocketBase | null>(() => (initialCached?.pb_url ? getSchoolPb(initialCached.pb_url) : null));
  const [loading, setLoading] = useState<boolean>(() => !initialCached && !isLanding && Boolean(slug || customDomain));
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [inactiveReason, setInactiveReason] = useState<string | null>(null);
  const [isDeviceMismatch, setIsDeviceMismatch] = useState(false);

  const setManualSchool = (newSlugOrSchool: string | SchoolRecord | null) => {
    if (!newSlugOrSchool) {
      localStorage.removeItem('selected_school_slug');
      localStorage.removeItem('local_server_url');
      setManualSlug(null);
      setSchool(null);
      setPb(null);
      setLoading(false);
      setNotFound(false);
      setInactive(false);
      return;
    }

    if (typeof newSlugOrSchool === 'object') {
      const schoolRec = newSlugOrSchool;
      localStorage.setItem('selected_school_slug', schoolRec.slug);
      if (schoolRec.pb_url) {
        localStorage.setItem('local_server_url', schoolRec.pb_url);
      }
      const schoolCacheKey = getTenantCacheKey(schoolRec.slug, null);
      setCachedSchool(schoolCacheKey, schoolRec);

      // LANGSUNG update state secara sinkron (0ms delay)!
      setManualSlug(schoolRec.slug);
      setSchool(schoolRec);
      setPb(getSchoolPb(schoolRec.pb_url));
      setNotFound(false);
      setInactive(false);
      setLoading(false);
      return;
    }

    const newSlug = newSlugOrSchool;
    localStorage.setItem('selected_school_slug', newSlug);
    const newCacheKey = getTenantCacheKey(newSlug, null);
    const cached = getCachedSchool(newCacheKey);

    setManualSlug(newSlug);
    if (cached) {
      setSchool(cached);
      setPb(getSchoolPb(cached.pb_url));
      setNotFound(false);
      setInactive(false);
      setLoading(false);
    } else {
      // PENTING: Bersihkan data sekolah lama agar tidak ada flash sekolah sebelumnya!
      setSchool(null);
      setPb(null);
      setLoading(true);
    }
  };

  useEffect(() => {
    if (isLanding || (!slug && !customDomain)) {
      setLoading(false);
      return;
    }

    const resolveSchool = async () => {
      // Jika data sekolah sudah cocok dengan slug dan pb sudah siap, tidak perlu fetch blocking (hanya untuk tenant cloud)
      if (slug !== 'local' && school && school.slug === slug && pb) {
        setLoading(false);
        return;
      }
      // 0. Mode Server Mandiri / Standalone Offline CBT
      if (slug === 'local') {
        try {
          const isPrivateIp = /^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(window.location.hostname);
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const savedLocalUrl = typeof window !== 'undefined' ? localStorage.getItem('local_server_url') : null;

          const targetOrigin = (isLocalhost || isPrivateIp)
            ? window.location.origin
            : (savedLocalUrl || 'http://localhost:8090');

          const localPb = getSchoolPb(targetOrigin);
          let schoolName = 'EXAMKU - Server Lokal';
          let logoUrl = '';

          let activeLicenseCode = '';
          let licensePayload: OfflineLicensePayload | undefined = undefined;

          // 1. Cek database tabel settings server lokal terlebih dahulu
          let isRevoked = false;
          try {
            const settingsRes = await localPb.collection('settings').getList(1, 1);
            if (settingsRes.items.length > 0) {
              const sData = settingsRes.items[0];
              if ((sData as any).offline_license) {
                activeLicenseCode = (sData as any).offline_license;
              }
              if ((sData as any).offline_license_status === 'revoked') {
                isRevoked = true;
              }
              if (sData.name) {
                schoolName = sData.name;
              }
              logoUrl = sData.logoUrl || sData.logo || '';
            }
          } catch (e) {
            console.warn('[TenantContext] Settings lokal belum terbaca:', e);
          }

          // Cek status lisensi terkini ke backend hook (termasuk Hardware ID check & kill-switch online)
          let isDeviceMismatchDetected = false;
          let mismatchMsg = '';
          try {
            const licStatusRes = await localPb.send('/api/offline-license', { method: 'GET' });
            if (licStatusRes?.isRevoked) {
              isRevoked = true;
            }
            if (licStatusRes?.isDeviceMismatch) {
              isDeviceMismatchDetected = true;
              mismatchMsg = licStatusRes?.revocation_message || '';
            }
          } catch {}

          // 2. Verifikasi lisensi dan ambil detail izin (DATABASE ADALAH SINGLE SOURCE OF TRUTH)
          if (activeLicenseCode) {
            try {
              const res = await verifyOfflineLicense(activeLicenseCode);
              if (res.payload) {
                licensePayload = res.payload;
                if (res.payload.school_name) {
                  schoolName = res.payload.school_name;
                }
                if (typeof window !== 'undefined') {
                  localStorage.setItem('exam_offline_license', activeLicenseCode);
                }
              }
            } catch {}
          } else {
            // Jika server lokal saat ini belum memiliki lisensi di databasenya,
            // bersihkan cache lokal agar tidak terjadi kebocoran identitas antar-instance PocketBase!
            if (typeof window !== 'undefined') {
              localStorage.removeItem('exam_offline_license');
              localStorage.removeItem('tenant_school_cache_local');
            }
          }

          const localSchool: SchoolRecord = {
            id: 'local_server',
            name: schoolName,
            slug: 'local',
            pb_url: targetOrigin,
            type: 'school',
            is_active: !isRevoked && !isDeviceMismatchDetected,
            logo_url: logoUrl,
            plan: 'offline',
            active_until: licensePayload?.valid_until || '',
            npsn: licensePayload?.npsn || '',
            offline_license: activeLicenseCode,
            offline_license_payload: licensePayload,
          };

          if (isRevoked || isDeviceMismatchDetected) {
            setSchool(localSchool);
            setPb(localPb);
            setNotFound(false);
            setInactive(true);
            setIsDeviceMismatch(isDeviceMismatchDetected);
            setInactiveReason(
              isDeviceMismatchDetected
                ? (mismatchMsg || 'Terdeteksi duplikasi lisensi di komputer yang berbeda. Hubungi Super Admin.')
                : 'Server CBT Offline ini telah dinonaktifkan oleh Administrator Pusat karena pelanggaran kebijakan penggunaan.'
            );
            setLoading(false);
            return;
          }

          if (activeLicenseCode) {
            setCachedSchool(cacheKey, localSchool);
          }
          setSchool(localSchool);
          setPb(localPb);
          setNotFound(false);
          setInactive(false);
          setIsDeviceMismatch(false);
          setInactiveReason(null);
          setLoading(false);
          return;
        } catch (err) {
          console.error('[TenantContext] Gagal inisialisasi server lokal offline:', err);
        }
      }

      const devSlug = import.meta.env.VITE_DEV_SCHOOL_SLUG;
      const isDev = import.meta.env.DEV;

      // In dev mode with devSlug, we still want to fetch real data from Master PB if possible!
      if (isDev && devSlug && slug === devSlug) {
        try {
          const record = await masterPb
            .collection('schools')
            .getFirstListItem<SchoolRecord>(`slug = "${slug}"`);
          
          if (!record.is_active) {
            setInactive(true);
            setLoading(false);
            return;
          }
          setSchool(record);
          setPb(getSchoolPb(record.pb_url));
          setLoading(false);
          return;
        } catch (e) {
          console.warn("Master PB fetch failed in DEV mode, using fallback dev school mock.");
          const directPbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
          const devSchool: SchoolRecord = {
            id: 'dev',
            name: import.meta.env.VITE_APP_NAME || 'Sekolah Dev',
            slug: devSlug,
            pb_url: directPbUrl,
            is_active: true,
            type: 'school',
          };
          setSchool(devSchool);
          setPb(getSchoolPb(directPbUrl));
          setLoading(false);
          return;
        }
      }

      const currentHostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
      let filter = '';
      if (customDomain && slug) {
        filter = `custom_domain = "${customDomain}" || slug = "${slug}"`;
      } else if (customDomain) {
        filter = `custom_domain = "${customDomain}" || slug = "${customDomain}"`;
      } else if (slug) {
        filter = `custom_domain = "${currentHostname}" || slug = "${slug}"`;
      } else if (currentHostname) {
        filter = `custom_domain = "${currentHostname}"`;
      }

      // Fetch with automatic retry (up to 2 retries for transient network/server delays)
      let record: SchoolRecord | null = null;
      let lastErr: any = null;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          record = await masterPb
            .collection('schools')
            .getFirstListItem<SchoolRecord>(filter);
          break;
        } catch (err: any) {
          lastErr = err;
          const isGenuine404 = err?.status === 404 || err?.data?.code === 404;
          if (isGenuine404) break; // If genuinely 404, don't retry
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
      }

      if (record) {
        if (!record.is_active) {
          setCachedSchool(cacheKey, null);
          setInactive(true);
          setNotFound(false);
          setSchool(null);
          setPb(null);
          setLoading(false);
          return;
        }

        // Active school verified
        setCachedSchool(cacheKey, record);
        setSchool(record);
        setPb(getSchoolPb(record.pb_url));
        setNotFound(false);
        setInactive(false);
        setLoading(false);
        return;
      }

      // If record could not be fetched from Master PB, inspect fallback options
      // 1. Fallback Server Mandiri / Offline CBT: Cek apakah instance ini memiliki database sekolah sendiri
      try {
        const localPb = getSchoolPb(window.location.origin);
        const settingsRes = await localPb.collection('settings').getList(1, 1);
        const sData = settingsRes.items[0];
        const localSchool: SchoolRecord = {
          id: 'local_server',
          name: sData?.name || 'EXAMKU - Server Lokal',
          slug: slug || 'local',
          pb_url: window.location.origin,
          type: 'school',
          is_active: true,
          logo_url: sData?.logoUrl || sData?.logo || '',
        };
        setSchool(localSchool);
        setPb(localPb);
        setNotFound(false);
        setInactive(false);
        setLoading(false);
        return;
      } catch {
        // Bukan server lokal mandiri, lanjutkan pengecekan berikutnya
      }

      const isGenuine404 = lastErr?.status === 404 || lastErr?.data?.code === 404;

      if (isGenuine404) {
        // Genuine 404: The school does not exist in the Master database
        setCachedSchool(cacheKey, null);
        setNotFound(true);
        setSchool(null);
        setPb(null);
      } else {
        // Network failure, timeout, 502/504, or abort
        console.warn('[TenantContext] Koneksi ke Master PB terganggu, menggunakan fallback:', lastErr);

        // Fallback 2: Use cached school profile if available
        const cached = getCachedSchool(cacheKey);
        if (cached) {
          setSchool(cached);
          setPb(getSchoolPb(cached.pb_url));
          setNotFound(false);
          setInactive(false);
        } else if (slug && typeof window !== 'undefined' && (currentHostname.endsWith('.examku.my.id') || currentHostname.endsWith('.alfaruqasri.my.id'))) {
          // Fallback 3: We are on school subdomain (e.g. modalbangsa.examku.my.id)
          // The school database is directly reachable at current origin (/api/*)
          const fallbackPbUrl = window.location.origin;
          const fallbackRecord: SchoolRecord = {
            id: slug,
            name: slug.toUpperCase(),
            slug: slug,
            pb_url: fallbackPbUrl,
            type: 'school',
            is_active: true,
          };
          setSchool(fallbackRecord);
          setPb(getSchoolPb(fallbackPbUrl));
          setNotFound(false);
          setInactive(false);
        } else {
          setNotFound(true);
        }
      }

      setLoading(false);
    };

    resolveSchool();
  }, [slug, customDomain, isLanding, cacheKey]);

  const refreshSchool = async () => {
    if (!school?.id) return;
    if (school.id === 'local_server' || slug === 'local') {
      try {
        let schoolName = 'EXAMKU - Server Lokal';
        let activeLicenseCode = '';
        let licensePayload: OfflineLicensePayload | undefined = undefined;

        const localPb = getSchoolPb(window.location.origin);
        const settingsRes = await localPb.collection('settings').getList(1, 1);
        const sData = settingsRes.items[0];
        if (sData) {
          if ((sData as any).offline_license) {
            activeLicenseCode = (sData as any).offline_license;
          }
          if (sData.name) {
            schoolName = sData.name;
          }
        }

        if (activeLicenseCode) {
          try {
            const res = await verifyOfflineLicense(activeLicenseCode);
            if (res.payload) {
              licensePayload = res.payload;
              if (res.payload.school_name) {
                schoolName = res.payload.school_name;
              }
              if (typeof window !== 'undefined') {
                localStorage.setItem('exam_offline_license', activeLicenseCode);
              }
            }
          } catch {}
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('exam_offline_license');
            localStorage.removeItem('tenant_school_cache_local');
          }
        }

        setSchool(prev => prev ? ({
          ...prev,
          name: schoolName,
          logo_url: sData?.logoUrl || sData?.logo || prev.logo_url,
          plan: 'offline',
          active_until: licensePayload?.valid_until || '',
          npsn: licensePayload?.npsn || '',
          offline_license: activeLicenseCode,
          offline_license_payload: licensePayload,
        }) : prev);
      } catch (e) {
        console.warn('Gagal refresh local server settings:', e);
      }
      return;
    }
    try {
      const updated = await masterPb.collection('schools').getOne<SchoolRecord>(school.id);
      setSchool(updated);
      setCachedSchool(cacheKey, updated);
      if (updated.pb_url) {
        setPb(getSchoolPb(updated.pb_url));
      }
    } catch (e) {
      console.warn('[TenantContext] Gagal refresh data sekolah:', e);
    }
  };

  const subscriptionStatus = useMemo(
    () => getSubscriptionStatus(school),
    [school]
  );

  const value = useMemo<TenantContextValue>(
    () => ({ 
      school, 
      pb, 
      slug: slug || null, 
      isLandingDomain: isLanding, 
      loading, 
      notFound, 
      inactive,
      inactiveReason,
      isDeviceMismatch,
      terminology: TERMINOLOGY[school?.type || 'school'],
      subscriptionStatus,
      setManualSchool,
      refreshSchool
    }),
    [school, pb, slug, isLanding, loading, notFound, inactive, inactiveReason, isDeviceMismatch, subscriptionStatus]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

// ============================================================
// Hook
// ============================================================
export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant harus digunakan di dalam TenantProvider');
  return ctx;
};
