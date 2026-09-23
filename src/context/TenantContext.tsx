import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from 'react';
import PocketBase from 'pocketbase';
import { masterPb, getSchoolPb } from '../lib/pocketbase';

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
}

interface TenantContextValue {
  school: SchoolRecord | null;
  pb: PocketBase | null;       // PocketBase instance untuk sekolah aktif
  slug: string | null;
  isLandingDomain: boolean;    // true jika ini ujian.alfaruqasri.my.id
  loading: boolean;
  notFound: boolean;           // true jika slug ada tapi tidak di registry
  inactive: boolean;           // true jika sekolah is_active = false
  terminology: Terminology;     // Helper untuk label dinamis
  setManualSchool: (slug: string | null) => void;
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
    return typeof window !== 'undefined' ? localStorage.getItem('selected_school_slug') : null;
  });

  const { slug: urlSlug, customDomain, isLanding: isUrlLanding } = useMemo(() => resolveSlugFromUrl(), []);

  // Effective slug: URL slug takes priority on web, manual slug for native/override
  const slug = urlSlug || manualSlug;
  const isLanding = isUrlLanding && !manualSlug;

  const cacheKey = useMemo(() => getTenantCacheKey(slug, customDomain), [slug, customDomain]);

  // Read initial cache: instant load with 0ms latency
  const initialCached = useMemo(() => getCachedSchool(cacheKey), [cacheKey]);

  const [school, setSchool] = useState<SchoolRecord | null>(() => initialCached);
  const [pb, setPb] = useState<PocketBase | null>(() => (initialCached?.pb_url ? getSchoolPb(initialCached.pb_url) : null));
  const [loading, setLoading] = useState<boolean>(() => !initialCached && !isLanding && Boolean(slug || customDomain));
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);

  const setManualSchool = (newSlug: string | null) => {
    if (newSlug) {
      localStorage.setItem('selected_school_slug', newSlug);
    } else {
      localStorage.removeItem('selected_school_slug');
    }
    setManualSlug(newSlug);
  };

  useEffect(() => {
    if (isLanding || (!slug && !customDomain)) {
      setLoading(false);
      return;
    }

    const resolveSchool = async () => {
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

      // If record could not be fetched from Master PB, inspect the error
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

        // Fallback 1: Use cached school profile if available
        const cached = getCachedSchool(cacheKey);
        if (cached) {
          setSchool(cached);
          setPb(getSchoolPb(cached.pb_url));
          setNotFound(false);
          setInactive(false);
        } else if (slug && typeof window !== 'undefined' && (currentHostname.endsWith('.examku.my.id') || currentHostname.endsWith('.alfaruqasri.my.id'))) {
          // Fallback 2: We are on school subdomain (e.g. modalbangsa.examku.my.id)
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


  const value = useMemo<TenantContextValue>(
    () => ({ 
      school, 
      pb, 
      slug: slug || null, 
      isLandingDomain: isLanding, 
      loading, 
      notFound, 
      inactive,
      terminology: TERMINOLOGY[school?.type || 'school'],
      setManualSchool
    }),
    [school, pb, slug, isLanding, loading, notFound, inactive]
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
