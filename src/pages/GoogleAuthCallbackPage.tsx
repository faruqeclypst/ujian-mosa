import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { GoogleAuthStatePayload, getGoogleRedirectUri, startGoogleRedirectAuth } from "../utils/googleAuthHelper";
import { Button } from "../components/ui/button";
import { NeonProgress } from "../components/ui/NeonProgress";

export default function GoogleAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pb } = useTenant();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState<"processing" | "forwarding" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [cachedState, setCachedState] = useState<GoogleAuthStatePayload | null>(null);

  const hasProcessedRef = useRef(false);

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

    // STEP 1: HUB GATEWAY FORWARDING
    const currentOrigin = window.location.origin;
    if (stateData?.tenantOrigin && stateData.tenantOrigin !== currentOrigin) {
      setStatus("forwarding");
      const targetUrl = `${stateData.tenantOrigin}/auth/google/callback${window.location.search}`;
      window.location.replace(targetUrl);
      return;
    }

    // STEP 2: PROSES DI DOMAIN SEKOLAH (TENANT)
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
          setSuccessMessage(res.message || "Akun Google Anda berhasil ditautkan.");
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
          setSuccessMessage("Otentikasi berhasil. Mengalihkan ke dashboard...");
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
          detailedMessage = "Kode otorisasi Google telah kedaluwarsa atau sudah pernah digunakan. Silakan klik tombol Coba Lagi di bawah untuk meminta kode baru.";
        }

        setStatus("error");
        setErrorMessage(detailedMessage);
      }
    };

    processOAuthCode();
  }, [searchParams, pb, refreshUser]);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="min-h-screen flex items-center justify-center p-4 bg-[#FBF9F5] dark:bg-[#0A0A0C] text-neutral-900 dark:text-neutral-100 font-sans relative overflow-hidden">
      {/* Background Micro-Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      {/* Ambient Neon Glow Accents */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card (Neon Light Theme) */}
      <div className="w-full max-w-md bg-white dark:bg-[#111214] border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.035)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-7 sm:p-9 text-center space-y-6 relative z-10">
        {/* Brand Neon Pill Header */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="uppercase tracking-wider font-bold">EXAMKU Single Sign-On</span>
          </div>
        </div>

        {/* Status: Processing / Forwarding */}
        {(status === "processing" || status === "forwarding") && (
          <div className="space-y-4 py-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                {status === "forwarding" ? "Mengarahkan ke Sekolah..." : "Memverifikasi Kredensial..."}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium max-w-xs mx-auto leading-relaxed">
                {status === "forwarding"
                  ? "Menghubungkan sesi otentikasi Google ke portal sekolah Anda."
                  : "Mohon tunggu sebentar, sistem sedang menyelaraskan kredensial Anda."}
              </p>
            </div>
            <div className="w-48 mx-auto pt-2">
              <NeonProgress value={75} variant="emerald" glow pulseHead size="sm" />
            </div>
          </div>
        )}

        {/* Status: Success */}
        {status === "success" && (
          <div className="space-y-4 py-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Otentikasi Berhasil
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 font-medium">
                {successMessage}
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <div className="inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Mengalihkan ke dashboard...</span>
              </div>
            </div>
          </div>
        )}

        {/* Status: Error */}
        {status === "error" && (
          <div className="space-y-5 py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.18)]">
              <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Otentikasi Belum Berhasil
              </h2>
              <div className="bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed max-w-sm mx-auto font-medium">
                {errorMessage}
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
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Lagi Sekarang</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(cachedState?.action === "link" ? "/admin" : "/login")}
                className="h-10 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141a] hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-200 font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2 hover:border-neutral-300 dark:hover:border-neutral-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ke Halaman {cachedState?.action === "link" ? "Dashboard" : "Login"}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
