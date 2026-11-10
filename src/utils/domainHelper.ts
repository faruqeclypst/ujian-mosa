/**
 * Domain Helper - SINGLE SOURCE OF TRUTH untuk semua URL generation
 * 
 * Menggunakan environment variables untuk memastikan domain bisa diganti
 * dengan cepat tanpa perlu edit banyak file.
 */

/**
 * Get main domain (e.g., "examku.my.id")
 */
export const getMainDomain = (): string => {
  const fromEnv = import.meta.env.VITE_MAIN_DOMAIN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = /^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(host)
      || /\.local$/.test(host)
      || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (!isLocal) {
      // Ambil domain induk: xxx.examku.my.id -> examku.my.id
      const parts = host.split('.');
      if (parts.length >= 3) return parts.slice(-3).join('.');
      if (parts.length === 2) return host;
    }
  }
  return 'examku.my.id';
};

/**
 * Get landing page subdomain (e.g., "app")
 */
export const getLandingSubdomain = (): string => {
  return import.meta.env.VITE_LANDING_SUBDOMAIN || 'ujian';
};

/**
 * Generate full school URL from slug
 * @param slug - School slug (e.g., "modalbangsa")
 * @returns Full URL (e.g., "https://modalbangsa.examku.my.id")
 */
export const getSchoolUrl = (slug: string): string => {
  const domain = getMainDomain();
  return `https://${slug}.${domain}`;
};

/**
 * Generate school domain without protocol
 * @param slug - School slug
 * @returns Domain only (e.g., "modalbangsa.examku.my.id")
 */
export const getSchoolDomain = (slug: string): string => {
  const domain = getMainDomain();
  return `${slug}.${domain}`;
};

/**
 * Detects whether the current environment is local dev or offline LAN server
 */
export const isLocalNetwork = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return /^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(host)
    || /\.local$/.test(host)
    || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
};

/**
 * Get accurate origin for student portal across cloud, LAN, or local dev
 */
export const getStudentPortalOrigin = (slug?: string | null): string => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (isLocalNetwork()) {
      return origin;
    }
    const cleanSlug = (slug || '').trim();
    if (cleanSlug && cleanSlug !== 'local') {
      const domain = getMainDomain();
      const host = window.location.hostname;
      // Jika sudah di tenant subdomain (modalbangsa.examku.my.id) atau domain custom, pakai origin saat ini
      if (host.includes(cleanSlug) || (!host.includes(domain) && !host.includes('app.'))) {
        return origin;
      }
      return `https://${cleanSlug}.${domain}`;
    }
    return origin;
  }
  const cleanSlug = (slug || '').trim();
  const domain = getMainDomain();
  return cleanSlug && cleanSlug !== 'local' ? `https://${cleanSlug}.${domain}` : `https://${domain}`;
};

/**
 * Generate full student exam URL from slug
 * Sesuai konfigurasi SaaS: https://${slug}.${domain}/exam
 * @param slug - School slug (e.g., "modalbangsa")
 * @returns Full URL (e.g., "https://modalbangsa.examku.my.id/exam")
 */
export const getStudentExamUrl = (slug?: string | null): string => {
  const origin = getStudentPortalOrigin(slug);
  return `${origin}/exam`;
};

/**
 * Verification payload for printed student cards (NO PASSWORDS)
 */
export interface StudentCardVerificationData {
  id?: string;
  u: string;
  n: string;
  c?: string;
  en?: string;
  r?: string;
  s?: string;
  slug?: string;
  sn?: string;
}

export const encodeStudentCardVerifyPayload = (payload: StudentCardVerificationData): string => {
  const jsonStr = JSON.stringify(payload);
  try {
    return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  } catch {
    return btoa(jsonStr);
  }
};

export const decodeStudentCardVerifyPayload = (token: string): StudentCardVerificationData | null => {
  try {
    let decoded = '';
    try {
      decoded = decodeURIComponent(
        Array.prototype.map
          .call(atob(token), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      decoded = atob(token);
    }

    if (decoded.startsWith('{')) {
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.id || '',
        u: parsed.u || parsed.user || parsed.username || '',
        n: parsed.n || parsed.name || 'Peserta Ujian',
        c: parsed.c || parsed.className || parsed.class || '',
        en: parsed.en || parsed.examNumber || '',
        r: parsed.r || parsed.room || '',
        s: parsed.s || parsed.session || '',
        slug: parsed.slug || parsed.schoolSlug || '',
        sn: parsed.sn || parsed.schoolName || '',
      };
    }
  } catch (e) {
    console.warn('Gagal membaca token verifikasi kartu:', e);
  }
  return null;
};

/**
 * Parse student credentials / identity safely from scanned QR code text
 * (Works with verification URLs, raw tokens, JSON, or plain usernames)
 */
export const parseStudentQrCodeText = (text: string): { u: string; name?: string } | null => {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Jika URL /verifikasi-kartu?code=...
  if (trimmed.includes("verifikasi-kartu") || trimmed.includes("verify-card") || trimmed.includes("code=")) {
    try {
      const url = new URL(trimmed);
      const code = url.searchParams.get("code") || url.searchParams.get("c");
      if (code) {
        const payload = decodeStudentCardVerifyPayload(code);
        if (payload?.u) {
          return { u: payload.u, name: payload.n };
        }
      }
    } catch {
      const match = trimmed.match(/code=([^&]+)/);
      if (match && match[1]) {
        const payload = decodeStudentCardVerifyPayload(decodeURIComponent(match[1]));
        if (payload?.u) {
          return { u: payload.u, name: payload.n };
        }
      }
    }
  }

  // 2. Jika base64 verification token langsung
  const directVerify = decodeStudentCardVerifyPayload(trimmed);
  if (directVerify?.u) {
    return { u: directVerify.u, name: directVerify.n };
  }

  // 3. Fallback jika base64 JSON
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const u = parsed.u || parsed.username || parsed.nisn;
      if (u) return { u, name: parsed.n || parsed.name };
    } catch {}
  }

  // 4. Jika raw username/nisn string biasa
  if (!trimmed.includes("/") && !trimmed.includes("?") && trimmed.length >= 3 && trimmed.length <= 30) {
    return { u: trimmed };
  }

  return null;
};

/**
 * Encode student auto-login credentials into URL-safe token
 */
export const encodeStudentAuthPayload = (payload: { u: string; p: string; s?: string }): string => {
  const jsonStr = JSON.stringify(payload);
  try {
    return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  } catch {
    return btoa(jsonStr);
  }
};

/**
 * Decode student auto-login token safely
 */
export const decodeStudentAuthPayload = (token: string): { u: string; p: string; s?: string } | null => {
  try {
    let decoded = '';
    try {
      decoded = decodeURIComponent(
        Array.prototype.map
          .call(atob(token), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      decoded = atob(token);
    }

    if (decoded.startsWith('{')) {
      const parsed = JSON.parse(decoded);
      return {
        u: parsed.u || parsed.user || parsed.username || '',
        p: parsed.p || parsed.pass || parsed.password || '',
        s: parsed.s || parsed.slug || '',
      };
    } else if (decoded.includes(':')) {
      const [u, ...rest] = decoded.split(':');
      return { u, p: rest.join(':') };
    }
  } catch (e) {
    console.warn('Gagal membaca token otentikasi QR:', e);
  }
  return null;
};

/**
 * Generate student exam domain/path without protocol (e.g., "modalbangsa.examku.my.id/exam")
 * @param slug - School slug
 * @returns Domain + path
 */
export const getStudentExamDomain = (slug?: string | null): string => {
  const domain = getMainDomain();
  const cleanSlug = (slug || '').trim();
  if (!cleanSlug || cleanSlug === 'local') {
    if (typeof window !== 'undefined' && window.location.host) {
      return `${window.location.host}/exam`;
    }
    return `${domain}/exam`;
  }
  return `${cleanSlug}.${domain}/exam`;
};

/**
 * Get landing page URL
 * @returns Full landing URL (e.g., "https://app.examku.my.id")
 */
export const getLandingUrl = (): string => {
  const subdomain = getLandingSubdomain();
  const domain = getMainDomain();
  return `https://${subdomain}.${domain}`;
};

/**
 * Get master PocketBase URL
 * @returns Master PB URL from env
 */
export const getMasterPbUrl = (): string => {
  return import.meta.env.VITE_MASTER_PB_URL || 'http://localhost:8090';
};

/**
 * Get domain suffix for display (e.g., ".examku.my.id")
 */
export const getDomainSuffix = (): string => {
  return `.${getMainDomain()}`;
};
