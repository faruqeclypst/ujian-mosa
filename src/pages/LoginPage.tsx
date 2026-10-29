import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion";
import { Capacitor } from "@capacitor/core";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  School,
  Sun,
  Moon,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  BarChart2
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";
import { useTheme } from "../context/ThemeContext";
import { APP_DISPLAY_VERSION } from "../utils/version";
import { startGoogleRedirectAuth } from "../utils/googleAuthHelper";

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { signInWithUsername, user, changePassword, signOut } = useAuth();
  const { pb: tenantPb, school, setManualSchool } = useTenant();
  const { actualTheme, toggleTheme } = useTheme();
  const pb = tenantPb;

  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Setelah ganti password wajib -> dipaksa logout -> tampilkan info saat balik ke login
  useEffect(() => {
    if (sessionStorage.getItem("pw_changed_relogin") === "1") {
      sessionStorage.removeItem("pw_changed_relogin");
      setInfoMessage("Password berhasil diubah. Silakan login kembali dengan password baru Anda.");
    }
  }, []);

  // For change password modal (Guru & Proktor)
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePassError, setChangePassError] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (school?.name) {
        setSchoolName(school.name);
      }
      if (!pb) {
        setLogoLoading(false);
        return;
      }
      try {
        setLogoLoading(true);
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1
        });

        if (records.length > 0) {
          const data = records[0];
          setSchoolName(data.name && data.name !== "EXAMKU CBT" ? data.name : (school?.name || "EXAMKU CBT"));

          let logoUrl = data.logoUrl || data.logo || "";
          if (logoUrl && !logoUrl.startsWith("http") && !logoUrl.startsWith("data:")) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }
          setSchoolLogo(logoUrl);
        } else if (school?.name) {
          setSchoolName(school.name);
        }
      } catch (err) {
        console.error("Gagal memuat logo sekolah:", err);
        if (school?.name) setSchoolName(school.name);
        setLogoError(true);
      } finally {
        setLogoLoading(false);
      }
    };

    fetchSettings();
  }, [pb, school?.name]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user && !user.hasChangedPassword && !currentPassword) {
      setCurrentPassword("12345678");
    }
  }, [user, currentPassword]);

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    setCurrentPassword(values.password);
    try {
      await signInWithUsername(values.username, values.password);
    } catch (error: any) {
      const raw = error.message || "";
      // Terjemahkan pesan teknis PocketBase ke bahasa Indonesia yang mudah dipahami
      const friendly = /failed to authenticate/i.test(raw)
        ? "Password salah, silakan periksa kembali."
        : raw || "Gagal masuk. Periksa kembali username dan password Anda.";
      setFormError(friendly);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="min-h-[100dvh] flex flex-col lg:flex-row bg-[#FBF9F5] dark:bg-[#0A0A0C] text-neutral-900 dark:text-neutral-100 selection:bg-emerald-500/20">
      {/* ========================================================
          LEFT PANEL: BRAND & CBT HIGHLIGHTS (DESKTOP ONLY)
          ======================================================== */}
      <aside className="hidden lg:flex lg:w-[420px] xl:w-[480px] 2xl:w-[540px] shrink-0 bg-[#0E1013] text-white p-8 sm:p-10 xl:p-14 2xl:p-16 flex-col justify-between border-r border-neutral-800/80 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Educational Doodle Pattern (Brand Aside) */}
        <div
          className="absolute inset-0 bg-repeat invert opacity-[0.06] pointer-events-none select-none z-0"
          style={{
            backgroundImage: "url('/login-pattern.png')",
            backgroundSize: "320px 320px",
          }}
        />

        {/* Top: Brand Header */}
        <div className="relative z-10 space-y-7">
          {/* Logo Brand Line */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center shrink-0 shadow-xs">
              {logoLoading ? (
                <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              ) : schoolLogo && !logoError ? (
                <img
                  src={schoolLogo}
                  alt="Logo Sekolah"
                  className="h-full w-full object-contain filter drop-shadow-2xs"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <img
                  src="/logo-default.webp"
                  alt="Logo Examku"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo-default.png";
                  }}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-white">
                  Examku
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
              </div>
              <span className="text-xs font-semibold text-neutral-400 block -mt-0.5">
                by alfaprojects
              </span>
            </div>
          </div>

          {/* Subtitle / School Identity */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
              {schoolName || school?.name || "Sistem Asesmen Berbasis Komputer"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-normal">
              Platform evaluasi modern terintegrasi untuk proktor, guru pengampu, dan tim kurikulum sekolah.
            </p>
          </div>
        </div>

        {/* Middle: Feature Highlights (Neon Card List Style) */}
        <div className="relative z-10 my-8 space-y-6 xl:space-y-7">
          {/* Feature 1: Keamanan & Kiosk */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 shadow-2xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Keamanan Kiosk &amp; Anti-Kecurangan
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Proteksi penuh terhadap pergantian tab, pembagian layar, dan peretasan sesi ujian siswa.
              </p>
            </div>
          </div>

          {/* Feature 2: Server Mandiri & Hybrid */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5 shadow-2xs">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Server Mandiri &amp; Mode Offline
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kinerja lancar untuk ratusan siswa serentak, baik di jaringan lokal (LAN) maupun VPS Cloud.
              </p>
            </div>
          </div>

          {/* Feature 3: Analisis Butir & Psikometri */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5 shadow-2xs">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Analisis Psikometri &amp; AI CTT
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Otomatisasi kalkulasi daya pembeda (D), tingkat kesukaran (P), dan efektivitas pengecoh.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Left Footer */}
        <div className="relative z-10 pt-5 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 font-medium">
          <span>examku.my.id &copy; {new Date().getFullYear()}</span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
            {APP_DISPLAY_VERSION}
          </span>
        </div>
      </aside>

      {/* ========================================================
          RIGHT PANEL: AUTHENTICATION CANVAS (NEON THEME)
          ======================================================== */}
      <section className="flex-1 min-h-[100dvh] flex flex-col justify-between p-6 sm:p-12 xl:p-16 relative overflow-y-auto">
        {/* Educational Doodle Pattern (Adaptive Watermark) */}
        <div
          className="absolute inset-0 bg-repeat opacity-[0.04] dark:invert dark:opacity-[0.05] pointer-events-none select-none z-0"
          style={{
            backgroundImage: "url('/login-pattern.png')",
            backgroundSize: "360px 360px",
          }}
        />

        {/* Top-Right Floating Controls (Pinned Elegantly in Corner) */}
        <div className="absolute top-5 sm:top-6 right-5 sm:right-6 z-20 flex items-center gap-2">
          {Capacitor.getPlatform() === "android" && (
            <button
              type="button"
              onClick={() => setManualSchool(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/90 dark:bg-[#111214]/90 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 shadow-2xs backdrop-blur-sm transition-colors cursor-pointer"
            >
              <School className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ganti Sekolah</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-[#111214]/90 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 shadow-2xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={actualTheme === "dark" ? "Mode Terang" : "Mode Gelap"}
            aria-label="Toggle Theme"
          >
            {actualTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {/* Center: Sign In Form Box */}
        <div className="w-full max-w-[460px] xl:max-w-[490px] mx-auto my-auto space-y-6 xl:space-y-7 relative z-10">
          {/* Mobile Branding */}
          <div className="flex flex-col items-center justify-center text-center pt-4 lg:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 dark:bg-[#111214] border border-neutral-800 p-1.5 flex items-center justify-center shadow-xs">
                {schoolLogo && !logoError ? (
                  <img
                    src={schoolLogo}
                    alt="Logo Sekolah"
                    className="h-full w-full object-contain filter drop-shadow-2xs"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <img
                    src="/logo-default.webp"
                    alt="Logo Examku"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/logo-default.png";
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                  examku
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
              </div>
            </div>
            {schoolName && (
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {schoolName}
              </span>
            )}
          </div>

          {/* Sign In Header with NEON Pill */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <span>Portal CBT Proktor &amp; Guru</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
              Masuk ke Akun
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              Gunakan akun administrator atau guru untuk masuk ke sistem.
            </p>
          </div>

          {/* Form Card Container (NEON Theme) */}
          <div className="bg-white dark:bg-[#111214] rounded-2xl border border-neutral-200/90 dark:border-neutral-800 p-7 sm:p-9 xl:p-10 shadow-[0_4px_25px_rgba(0,0,0,0.035)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Field: Username / Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400"
                >
                  Email atau Username
                </label>
                <div className="relative group">
                  <Input
                    id="username"
                    placeholder="Isi username / email"
                    autoComplete="username"
                    className="h-12 sm:h-12.5 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm font-medium px-4 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    {...register("username")}
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.username.message}</span>
                  </p>
                )}
              </div>

              {/* Field: Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400"
                >
                  Password
                </label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Minimal 6 karakter"
                    className="h-12 sm:h-12.5 pr-11 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm font-medium px-4 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1.5 cursor-pointer transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.password.message}</span>
                  </p>
                )}
              </div>

              {/* Info Message */}
              {infoMessage && !formError && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-3.5">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{infoMessage}</span>
                  </p>
                </div>
              )}

              {/* Error Message */}
              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-3.5">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <span>{formError}</span>
                  </p>
                </div>
              )}

              {/* Primary Action Button (NEON Emerald) */}
              <Button
                type="submit"
                className="group w-full h-12 sm:h-12.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50 mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <LogIn className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>

              {/* Pembatas "atau" */}
              <div className="relative my-3.5 flex items-center justify-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
                <span className="absolute bg-white dark:bg-[#111214] px-3 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  atau
                </span>
              </div>

              {/* Tombol Masuk dengan Akun Google (Full-Page Redirect) */}
              <button
                type="button"
                onClick={() => startGoogleRedirectAuth({ action: "login" })}
                className="group relative w-full h-11 sm:h-12 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#12141a] hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.06] hover:border-emerald-500/40 dark:hover:border-emerald-500/40 text-neutral-800 dark:text-neutral-100 font-bold text-xs sm:text-sm shadow-2xs hover:shadow-[0_4px_20px_rgba(16,185,129,0.12)] transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.99]"
                title="Masuk menggunakan akun Google guru atau proktor yang terdaftar"
              >
                <div className="w-6 h-6 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <span>Masuk dengan Akun Google</span>
              </button>
            </form>

            {/* Security Footnote */}
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Sesi terenkripsi &amp; aman</span>
            </div>
          </div>
        </div>

        {/* Bottom Right Footer */}
        <div className="w-full max-w-[460px] xl:max-w-[490px] mx-auto text-center pt-6 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
          <p>Butuh bantuan login? Hubungi Proktor Utama atau Tim IT Sekolah.</p>
        </div>
      </section>

      {/* ========================================================
          MANDATORY CHANGE PASSWORD DIALOG (NEON THEME)
          ======================================================== */}
      <Dialog open={!!(user && !user.hasChangedPassword)} onOpenChange={() => { }}>
        <DialogContent
          className="w-[94vw] max-w-md bg-white dark:bg-[#111214] rounded-2xl p-6 sm:p-7 border border-neutral-200 dark:border-neutral-800 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center space-y-2 mb-4">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <Lock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              Ganti Password Wajib
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Demi keamanan sistem CBT sekolah, silakan perbarui password default akun Anda sebelum mengakses dashboard.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setChangePassError("");
              if (!currentPassword) return setChangePassError("Password saat ini wajib diisi.");
              if (newPassword.length < 6) return setChangePassError("Password baru minimal 6 karakter.");
              if (newPassword === currentPassword) return setChangePassError("Password baru tidak boleh sama dengan password saat ini.");
              if (newPassword !== confirmPassword) return setChangePassError("Konfirmasi password tidak cocok.");

              setIsChangingPass(true);
              try {
                await changePassword(newPassword, currentPassword);
                // Paksa login ulang: sesi & data di-refresh total agar tidak tampil "fresh"/kosong
                sessionStorage.setItem("pw_changed_relogin", "1");
                await signOut();
              } catch (err: any) {
                setChangePassError(err.message || "Gagal mengubah password.");
              } finally {
                setIsChangingPass(false);
              }
            }}
            className="space-y-3.5"
          >
            {changePassError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{changePassError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Password Saat Ini
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password saat ini (default: 12345678)"
                  className="rounded-lg h-10 bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-700 pr-10 text-xs font-medium focus:ring-1 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Password Baru
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="rounded-lg h-10 bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-700 pr-10 text-xs font-medium focus:ring-1 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Konfirmasi Password Baru
              </label>
              <Input
                type={showNewPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="rounded-lg h-10 bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-700 text-xs font-medium focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => signOut()}
                className="w-full sm:w-1/3 rounded-lg h-10 text-xs text-neutral-600 dark:text-neutral-300 font-semibold border-neutral-200 dark:border-neutral-700 cursor-pointer"
                disabled={isChangingPass}
              >
                Batal / Keluar
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 rounded-lg text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
                disabled={isChangingPass}
              >
                {isChangingPass ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </span>
                ) : (
                  "Simpan Password Baru"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default LoginPage;
