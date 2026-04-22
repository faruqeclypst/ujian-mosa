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
// Slug Resolver — mudah diganti ke subdomain nanti
// ============================================================
function resolveSlugFromUrl(): { slug: string | null; isLanding: boolean } {
  const hostname = window.location.hostname;
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'alfaruqasri.my.id';
  const landingSubdomain = import.meta.env.VITE_LANDING_SUBDOMAIN || 'ujian';

  // DEV OVERRIDE: jika VITE_DEV_SCHOOL_SLUG diisi, paksa mode sekolah di localhost
  const devSlug = import.meta.env.VITE_DEV_SCHOOL_SLUG;
  if (devSlug && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return { slug: devSlug, isLanding: false };
  }

  // Dev mode: localhost / 127.0.0.1 → tampilkan landing
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === mainDomain
  ) {
    return { slug: null, isLanding: true };
  }

  // Cek apakah ini subdomain dari main domain
  if (hostname.endsWith(`.${mainDomain}`)) {
    const subdomain = hostname.slice(0, hostname.length - mainDomain.length - 1);
    if (subdomain === landingSubdomain) {
      return { slug: null, isLanding: true };
    }
    return { slug: subdomain, isLanding: false };
  }

  return { slug: null, isLanding: true };
}


// ============================================================
// TenantProvider
// ============================================================
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [pb, setPb] = useState<PocketBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [manualSlug, setManualSlug] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('selected_school_slug') : null;
  });

  const { slug: urlSlug, isLanding: isUrlLanding } = useMemo(() => resolveSlugFromUrl(), []);

  // Effective slug: URL slug takes priority on web, manual slug for native/override
  const slug = urlSlug || manualSlug;
  const isLanding = isUrlLanding && !manualSlug;

  const setManualSchool = (newSlug: string | null) => {
    if (newSlug) {
      localStorage.setItem('selected_school_slug', newSlug);
    } else {
      localStorage.removeItem('selected_school_slug');
    }
    setManualSlug(newSlug);
  };

  useEffect(() => {
    if (isLanding || !slug) {
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
          // Fallback to dev school if master pb fails or not set up
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
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    resolveSchool();
  }, [slug, isLanding]);


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
