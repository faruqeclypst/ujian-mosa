import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { GoogleAuthStatePayload, getGoogleRedirectUri, startGoogleRedirectAuth } from "../utils/googleAuthHelper";
import { Button } from "../components/ui/button";

export default function GoogleAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pb, school } = useTenant();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState<"processing" | "forwarding" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [cachedState, setCachedState] = useState<GoogleAuthStatePayload | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");

  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      if (school?.name) setSchoolName(school.name);
      if (!pb) return;
      try {
        const records = await pb.collection("settings").getFullList({ limit: 1 });
        if (records.length > 0) {
          const data = records[0];
          setSchoolName(data.name || school?.name || "EXAMKU CBT");
          let logoUrl = data.logoUrl || data.logo || "";
          if (logoUrl && !logoUrl.startsWith("http") && !logoUrl.startsWith("data:")) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }
          setSchoolLogo(logoUrl);
        }
      } catch (_) {}
    };
    fetchSchoolInfo();
  }, [pb, school?.name]);

  useEffect(() => {
    const code = searchParams.get("code");
    const rawEncodedState = searchParams.get("state") || "";
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setStatus("error");
      setErrorMessage(
        errorDescription ||
        (errorParam === "access_denied"
          ? "Otorisasi dibatalkan. Anda tidak memberikan izin akses akun Google."
          : `Gagal otentikasi Google: ${errorParam}`)
      );
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("Kode otentikasi dari Google tidak ditemukan pada URL.");
      return;
    }

    // Decode state
    let stateData: GoogleAuthStatePayload | null = null;
    try {
      if (rawEncodedState) {
        const decodedJson = decodeURIComponent(escape(atob(rawEncodedState)));
        stateData = JSON.parse(decodedJson);
        setCachedState(stateData);
      }
    } catch (e) {
      console.warn("Gagal mendekode state data Google Auth:", e);
    }

    // ── STEP 1: HUB GATEWAY FORWARDING ──
    const currentOrigin = window.location.origin;
    if (stateData?.tenantOrigin && stateData.tenantOrigin !== currentOrigin) {
      setStatus("forwarding");
      const targetUrl = `${stateData.tenantOrigin}/auth/google/callback${window.location.search}`;
      window.location.replace(targetUrl);
      return;
    }

    // ── STEP 2: PROSES DI DOMAIN SEKOLAH (TENANT) ──
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const processOAuthCode = async () => {
      if (!pb) {
        setStatus("error");
        setErrorMessage("Koneksi ke sistem backend sekolah belum siap. Silakan muat ulang halaman.");
        return;
      }

      try {
        const redirectUri = getGoogleRedirectUri();
        const action = stateData?.action || "login";
        const token = pb.authStore.token || "";

        const res = await pb.send("/api/auth/google", {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: {
            code,
            redirect_uri: redirectUri,
            action,
            auth_token: token,
          },
        });

        if (!res || !res.ok) {
          throw new Error(res?.error || "Gagal memproses otentikasi Google.");
        }

        if (action === "link") {
          setStatus("success");
          setSuccessMessage(res.message || "Akun Google Anda berhasil ditautkan!");
          await refreshUser();
          setTimeout(() => {
            window.location.replace(stateData?.returnUrl || "/admin");
          }, 1200);
        } else {
          // Action: Login
          if (!res.token || !res.record) {
            throw new Error("Respon server tidak memuat token otentikasi.");
          }

          // Simpan sesi login resmi PocketBase
          pb.authStore.save(res.token, res.record);
          await refreshUser();

          setStatus("success");
          setSuccessMessage("Otentikasi berhasil! Mengalihkan ke dashboard...");
          setTimeout(() => {
            window.location.replace(stateData?.returnUrl || "/admin");
          }, 1000);
        }
      } catch (err: any) {
        console.error("Google Auth Callback Error:", err);
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}

        let serverError = "";
        if (err?.response?.error && typeof err.response.error === "string") {
          serverError = err.response.error;
        } else if (err?.data?.error && typeof err.data.error === "string") {
          serverError = err.data.error;
        } else if (err?.response?.message && typeof err.response.message === "string") {
          serverError = err.response.message;
        } else if (err?.data?.message && typeof err.data.message === "string") {
          serverError = err.data.message;
        } else if (err?.message && typeof err.message === "string") {
          serverError = err.message;
        }

        let detailedMessage = serverError;
        if (
          !serverError ||
          serverError.includes("Something went wrong") ||
          serverError.includes("invalid_grant") ||
          serverError.includes("Bad Request")
        ) {
          detailedMessage = "Kode otorisasi Google telah kedaluwarsa atau sudah pernah digunakan. Silakan klik tombol 'Coba Lagi Sekarang' di bawah untuk meminta kode baru.";
        }

        setStatus("error");
        setErrorMessage(detailedMessage);
      }
    };

    processOAuthCode();
  }, [searchParams, pb, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090a0d] text-neutral-100 font-sans relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Educational Doodle Pattern (Adaptive Watermark) */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.035] dark:invert dark:opacity-[0.045] pointer-events-none select-none z-0"
        style={{
          backgroundImage: "url('/login-pattern.png')",
          backgroundSize: "360px 360px",
        }}
      />

      {/* Ambient Radial Background Glows (Signature Examku Neon Mesh) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/12 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Neon Card Container */}
      <div className="relative z-10 w-full max-w-[450px] bg-[#111317]/95 border border-neutral-800/90 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.7)] p-7 sm:p-9 text-center space-y-6 backdrop-blur-2xl">
        {/* Brand Header with School Logo & Glowing Neon Pill */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-emerald-500/30 p-2 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt="Logo Sekolah"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            ) : (
              <img
                src="/logo-default.webp"
                alt="Examku Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo-default.png";
                }}
              />
            )}
          </div>

          {schoolName && (
            <p className="text-xs font-bold text-neutral-300 tracking-wide">
              {schoolName}
            </p>
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
            <span>EXAMKU Single Sign-On</span>
          </div>
        </div>

        {/* Status Processing / Forwarding */}
        {(status === "processing" || status === "forwarding") && (
          <div className="space-y-4 py-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.25)] animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white tracking-tight">
                {status === "forwarding" ? "Mengarahkan ke Portal Sekolah..." : "Memverifikasi Akun Google..."}
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                {status === "forwarding"
                  ? "Menghubungkan sesi otentikasi ke portal sekolah Anda."
                  : "Mohon tunggu sebentar, sistem sedang menyelaraskan kredensial Anda."}
              </p>
            </div>
          </div>
        )}

        {/* Status Success */}
        {status === "success" && (
          <div className="space-y-4 py-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.35)]">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-emerald-400 tracking-tight">
                Otentikasi Berhasil
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-xs mx-auto">
                {successMessage}
              </p>
            </div>
          </div>
        )}

        {/* Status Error */}
        {status === "error" && (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.3)]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2.5">
              <h2 className="text-lg font-black text-rose-400 tracking-tight">
                Otentikasi Gagal
              </h2>
              <div className="rounded-2xl bg-[#16181f] border border-neutral-800 p-4 text-left shadow-inner">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  startGoogleRedirectAuth({
                    action: cachedState?.action || "link",
                    returnUrl: cachedState?.returnUrl || "/admin",
                  })
                }
                className="h-10 px-4 rounded-xl text-xs font-bold gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 hover:shadow-lg hover:shadow-emerald-600/40 transition-all border border-emerald-500/30 flex items-center justify-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi Sekarang</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(cachedState?.action === "link" ? "/admin" : "/login")}
                className="h-10 px-4 rounded-xl text-xs font-bold gap-2 cursor-pointer border border-neutral-800 bg-[#16181f] hover:bg-neutral-800 text-neutral-200 transition-all flex items-center justify-center"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke {cachedState?.action === "link" ? "Dashboard" : "Halaman Login"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Security Footer Note */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Koneksi Single Sign-On Terenkripsi</span>
        </div>
      </div>
    </div>
  );
}
