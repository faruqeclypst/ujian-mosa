/**
 * EXAMKU GOOGLE OAUTH 2.0 HELPER (FULL-PAGE REDIRECT / 0 POPUPS)
 * 
 * Alur Multi-Tenant Hub & Spoke:
 * 1. Pengguna di subdomain (contoh: modalbangsa.examku.my.id) klik "Masuk dengan Google".
 * 2. Halaman penuh browser redirect ke Google OAuth dengan state yang membawa asal tenant.
 * 3. Google mengalihkan ke Authorized Redirect URI tunggal: https://examku.my.id/auth/google/callback.
 * 4. Master Hub membaca state lalu me-redirect balik ke subdomain sekolah terkait.
 * 5. Backend sekolah menukar authorization code ke token & userinfo secara aman di server.
 */

const GOOGLE_CLIENT_ID_PREFIX = "154329205514-8lihf47poev3dr7na015jvga8ucvv2aq";
const GOOGLE_CLIENT_ID_SUFFIX = "apps.googleusercontent.com";
export const GOOGLE_CLIENT_ID = `${GOOGLE_CLIENT_ID_PREFIX}.${GOOGLE_CLIENT_ID_SUFFIX}`;

export interface GoogleAuthStatePayload {
  tenantOrigin: string; // e.g. "https://modalbangsa.examku.my.id" atau "http://localhost:5173"
  action: "login" | "link";
  returnUrl: string; // e.g. "/admin" atau "/admin/profile"
  timestamp: number;
  nonce: string;
}

/**
 * Mengambil redirect URI resmi yang didaftarkan di Google Cloud Console.
 * - Produksi: https://examku.my.id/auth/google/callback
 * - Dev lokal: http://localhost:5173/auth/google/callback
 */
export function getGoogleRedirectUri(): string {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return `${window.location.origin}/auth/google/callback`;
    }
  }
  return "https://examku.my.id/auth/google/callback";
}

/**
 * Memulai proses otentikasi Google dengan Pengalihan Halaman Penuh (Full-Page Redirect).
 * Bebas dari pemblokir pop-up browser & nyaman untuk seluruh perangkat.
 */
export function startGoogleRedirectAuth(options: {
  action?: "login" | "link";
  returnUrl?: string;
}) {
  if (typeof window === "undefined") return;

  const action = options.action || "login";
  const returnUrl = options.returnUrl || (action === "link" ? "/admin/profile" : "/admin");
  const tenantOrigin = window.location.origin;

  const statePayload: GoogleAuthStatePayload = {
    tenantOrigin,
    action,
    returnUrl,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 12),
  };

  const rawState = JSON.stringify(statePayload);
  // Simpan backup state di sessionStorage lokal
  sessionStorage.setItem("examku_google_auth_state", rawState);

  // Encode state menggunakan Base64URL
  const encodedState = btoa(unescape(encodeURIComponent(rawState)));
  const redirectUri = getGoogleRedirectUri();

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state: encodedState,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Redirect layar penuh!
  window.location.href = authUrl;
}
