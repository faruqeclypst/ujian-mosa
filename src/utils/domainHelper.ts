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
  return import.meta.env.VITE_MAIN_DOMAIN || 'localhost:5173';
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
