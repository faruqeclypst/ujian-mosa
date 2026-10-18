import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { User, Lock, GraduationCap, School, Eye, EyeOff, Sun, Moon, HardDrive, Globe, KeyRound, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { isLocalServer } from "../landing/SelectSchoolPage";

const StudentLoginPage = () => {
  const { student, loginStudent, changePassword } = useStudentAuth();
  const { pb, school, setManualSchool, terminology } = useTenant();
  const { actualTheme, toggleTheme } = useTheme();

  // Uncontrolled inputs via ref — cegah re-render tiap ketik (lag di mobile)
  const nisnRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // For change password modal
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [changePassError, setChangePassError] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [schoolName, setSchoolName] = useState(school?.name || "");
  const [schoolLogo, setSchoolLogo] = useState(school?.logo_url || "");
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // State for Reset Password Request Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetNisn, setResetNisn] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState<{ studentName: string; nisn: string } | null>(null);

  const handleOpenResetModal = () => {
    const currentVal = nisnRef.current?.value || "";
    setResetNisn(currentVal);
    setResetError("");
    setResetSuccess(null);
    setIsResetModalOpen(true);
  };

  const handleSendResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetNisn.trim();
    if (!trimmed) {
      setResetError(`Silakan masukkan ${terminology.id} atau Username Anda.`);
      return;
    }
    if (!pb) {
      setResetError("Koneksi ke server belum tersedia.");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      const res = await fetch(`${pb.baseUrl}/api/student/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || `Gagal mengajukan reset password (${res.status}).`);
      }

      setResetSuccess({
        studentName: data.studentName || "Siswa",
        nisn: data.nisn || trimmed,
      });
    } catch (err: any) {
      setResetError(err.message || "Terjadi kesalahan saat mengajukan reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseResetModal = () => {
    setIsResetModalOpen(false);
    if (resetSuccess) {
      if (nisnRef.current && resetSuccess.nisn) {
        nisnRef.current.value = resetSuccess.nisn;
      }
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
    }
  };

  useEffect(() => {
    if (school?.name) {
      setSchoolName(school.name);
    }
    if (school?.logo_url) {
      setSchoolLogo(school.logo_url);
    }

    const fetchSettings = async () => {
      if (!pb) { setLogoLoading(false); return; }
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
          if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }

          setSchoolLogo(logoUrl);
          setLogoError(false);
        } else if (school?.name) {
          setSchoolName(school.name);
        }
      } catch (err) {
        console.error(`Gagal memuat logo ${terminology.student.toLowerCase()} (Cek API Rules koleksi settings di PocketBase):`, err);
        if (school?.name) setSchoolName(school.name);
        setLogoError(true);
      } finally {
        setLogoLoading(false);
      }
    };

    fetchSettings();
  }, [pb, school?.name]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginStudent(nisnRef.current?.value || "", passwordRef.current?.value || "");
    } catch (err: any) {
      setError(err.message || `Gagal login. Periksa kembali ${terminology.id} dan password Anda.`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError("");

    const newPassword = newPasswordRef.current?.value || "";
    const confirmPassword = confirmPasswordRef.current?.value || "";

    if (newPassword.length < 6) {
      setChangePassError("Password baru minimal 6 karakter!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError("Konfirmasi password tidak cocok!");
      return;
    }

    setIsChangingPass(true);
    try {
      await changePassword(newPassword);
    } catch (err: any) {
      setChangePassError(err.message || "Gagal mengubah password.");
    } finally {
      setIsChangingPass(false);
    }
  };

  const showChangePassModal = !!(student && !student.hasChangedPassword);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] overflow-y-auto bg-[#f8fafc] dark:bg-[#020617] relative font-sans leading-relaxed px-4 py-8">
      {/* Floating Change School Button */}
      {(Capacitor.isNativePlatform() || window.location.hostname === 'localhost' || (school && isLocalServer(school)) || (typeof window !== 'undefined' && localStorage.getItem('selected_school_slug'))) && (
        <div className="absolute top-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1rem))] left-6 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-200 dark:hover:border-emerald-900 transition-colors shadow-sm"
          >
            <School size={15} />
            <span>Ganti Unit</span>
          </button>
        </div>
      )}
      
      {/* Dark Mode Toggle Button */}
      <div className="absolute top-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1rem))] right-6 z-50">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-11 h-11 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors shadow-sm group"
          title={actualTheme === 'dark' ? "Mode Terang" : "Mode Gelap"}
        >
          {actualTheme === 'dark' ? (
            <Sun size={20} className="group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon size={20} className="group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>
      </div>

      {/* Optimized Background (ringan, tanpa filter blur GPU berat) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-gradient-to-tl from-teal-500/15 via-teal-500/5 to-transparent rounded-full" />
        <div className="absolute inset-0 bg-slate-50/70 dark:bg-slate-950/40" />
      </div>

      <div className="w-full max-w-lg mx-auto z-10 my-auto py-2 flex flex-col items-center">
        {/* Logo Section */}
        <div className="mb-4 sm:mb-8 flex items-center justify-center gap-4 md:gap-6 relative">
          {logoLoading ? (
            <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 flex items-center justify-center">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {schoolLogo && !logoError ? (
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 flex items-center justify-center overflow-hidden">
                  <img
                    src={schoolLogo}
                    alt={`Logo ${terminology.school}`}
                    className="w-full h-full object-contain filter drop-shadow-md"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="relative w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo-default.webp"
                    alt="Logo Default"
                    className="w-full h-full object-contain filter drop-shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/logo-default.png"; }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            Portal Ujian {terminology.student}
          </h1>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center justify-center gap-2">
              <GraduationCap size={18} className="text-emerald-600" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
                {schoolName || school?.name || "Portal Ujian Siswa"}
              </p>
            </div>
            {school && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {isLocalServer(school) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <HardDrive size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Server Lokal {school.pb_url ? `(${school.pb_url.replace(/^https?:\/\//, '')})` : ''}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <Globe size={12} className="text-blue-600 dark:text-blue-400" />
                    <span>Server Online</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Card className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8 md:p-10">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                  <User size={14} className="text-slate-400 dark:text-slate-500" /> {terminology.id} / Username
                </label>
                <Input
                  ref={nisnRef}
                  placeholder={`Masukkan nomor induk ${terminology.student.toLowerCase()}`}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-2xl h-14 px-5 text-base transition-none"
                  disabled={loading}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                  <Lock size={14} className="text-slate-400 dark:text-slate-500" /> Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    ref={passwordRef}
                    placeholder="••••••••"
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-2xl h-14 px-5 pr-12 text-base transition-none"
                    disabled={loading}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Link Minta Reset Password */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Lupa kata sandi?</span>
                <button
                  type="button"
                  onClick={handleOpenResetModal}
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 py-1.5 focus:outline-hidden focus:underline min-h-[44px]"
                >
                  <KeyRound size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Minta Reset Password</span>
                </button>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold h-14 rounded-[20px] border-0 text-lg active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memverifikasi...</span>
                    </div>
                  ) : "Masuk Sekarang"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>


        <div className="mt-4 flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 text-xs font-medium">
          <p>© {new Date().getFullYear()} CBT {schoolName}.</p>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassModal} onOpenChange={() => { }}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-8" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Lock className="text-emerald-600" size={32} />
            </div>
            <DialogTitle className="text-center text-2xl font-extrabold text-slate-900">Ganti Password Wajib!</DialogTitle>
            <p className="text-slate-500 text-center mt-2 font-medium">
              Ini adalah login pertama Anda. Demi keamanan akun, silakan perbarui password Anda.
            </p>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-6">
            {changePassError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-red-500" />
                {changePassError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password Baru</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  ref={newPasswordRef}
                  placeholder="Minimal 6 karakter"
                  className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pr-10 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Konfirmasi Password Baru</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  ref={confirmPasswordRef}
                  placeholder="Ulangi password baru"
                  className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pr-10 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-2xl text-lg"
                disabled={isChangingPass}
              >
                {isChangingPass ? "Menyimpan..." : "Simpan & Lanjutkan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Permintaan Reset Password */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[28px] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {resetSuccess ? (
            <div className="text-center py-2 space-y-5">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle2 size={34} />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Permintaan Terkirim!
                </DialogTitle>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  Permintaan reset password untuk <strong className="text-slate-900 dark:text-white font-bold">{resetSuccess.studentName}</strong> ({resetSuccess.nisn}) telah masuk ke notifikasi pengawas ujian.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl text-left space-y-1.5">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Langkah Selanjutnya:
                </p>
                <ol className="text-xs text-emerald-900/90 dark:text-emerald-200/90 space-y-1 list-decimal list-inside font-medium leading-relaxed">
                  <li>Lapor ke pengawas atau proktor di ruangan Anda.</li>
                  <li>Pengawas akan menekan tombol setujui reset.</li>
                  <li>Setelah disetujui, login kembali dengan password:</li>
                </ol>
                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-center">
                  <span className="inline-block px-3 py-1 font-mono font-black text-base tracking-widest text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    12345678
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleCloseResetModal}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-base shadow-md shadow-emerald-600/20 active:scale-[0.99]"
              >
                Siap, Kembali ke Login
              </Button>
            </div>
          ) : (
            <div>
              <DialogHeader className="mb-5 text-center">
                <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-center mb-3 mx-auto text-amber-600 dark:text-amber-400">
                  <KeyRound size={28} />
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Minta Reset Password
                </DialogTitle>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                  Masukkan {terminology.id} Anda. Permintaan akan dikirimkan ke pengawas ujian untuk mereset password akun menjadi <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">12345678</strong>.
                </p>
              </DialogHeader>

              <form onSubmit={handleSendResetRequest} className="space-y-4">
                {resetError && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm p-3.5 rounded-2xl flex items-start gap-2.5">
                    <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{resetError}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 ml-1">
                    {terminology.id} / Username Siswa
                  </label>
                  <Input
                    value={resetNisn}
                    onChange={(e) => setResetNisn(e.target.value)}
                    placeholder={`Contoh: 0012345678`}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl h-12 px-4 text-base focus:ring-2 focus:ring-emerald-500"
                    disabled={resetLoading}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResetModalOpen(false)}
                    disabled={resetLoading}
                    className="sm:w-1/3 h-12 rounded-2xl font-bold text-slate-600 dark:text-slate-300"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetLoading || !resetNisn.trim()}
                    className="sm:w-2/3 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm gap-2 shadow-md shadow-emerald-600/20"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <span>Kirim ke Pengawas</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentLoginPage;
