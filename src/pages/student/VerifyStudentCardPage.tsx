import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp } from "../../lib/motion";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { decodeStudentCardVerifyPayload } from "../../utils/domainHelper";
import {
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  School,
  User,
  ExternalLink,
  Download,
  Sun,
  Moon,
  AlertCircle,
  Building,
} from "../../lib/icons/phosphor-bridge";
import { Button } from "../../components/ui/button";

const VerifyStudentCardPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { school, terminology } = useTenant();
  const { actualTheme, toggleTheme } = useTheme();
  const { student } = useStudentAuth();

  const code = searchParams.get("code") || searchParams.get("c") || "";

  const verifyData = useMemo(() => {
    if (!code) return null;
    return decodeStudentCardVerifyPayload(code);
  }, [code]);

  const schoolName = verifyData?.sn || school?.name || "EXAMKU CBT";
  const schoolLogo = school?.logo_url || "";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans select-none relative"
    >
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-xs cursor-pointer"
          title={actualTheme === "dark" ? "Mode Terang" : "Mode Gelap"}
        >
          {actualTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Main Verification Card */}
      <div className="my-auto py-8 w-full max-w-lg mx-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-center p-2.5 overflow-hidden">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={`Logo ${schoolName}`}
                  className="w-full h-full object-contain filter drop-shadow-xs"
                />
              ) : (
                <School className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-block">
              Sistem Verifikasi Kartu Ujian
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight">
              {schoolName}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Portal Validasi Kartu Peserta Ujian Resmi
            </p>
          </div>

          {verifyData ? (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Status Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                      Kartu Resmi Terverifikasi
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 font-medium">
                    Akun peserta aktif &amp; terdaftar sah di server CBT sekolah.
                  </p>
                </div>
              </div>

              {/* Student Identity Details */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Data Identitas {terminology.student}
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  <div className="p-3 flex justify-between items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Nama Lengkap:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right">
                      {verifyData.n || "-"}
                    </span>
                  </div>

                  <div className="p-3 flex justify-between items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">{terminology.id} / Username:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {verifyData.u || "-"}
                    </span>
                  </div>

                  {verifyData.c && (
                    <div className="p-3 flex justify-between items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">{terminology.class}:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {verifyData.c}
                      </span>
                    </div>
                  )}

                  {verifyData.en && (
                    <div className="p-3 flex justify-between items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">No. Peserta:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {verifyData.en}
                      </span>
                    </div>
                  )}

                  {(verifyData.r || verifyData.s) && (
                    <div className="p-3 flex justify-between items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Ruang &amp; Sesi:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {[verifyData.r, verifyData.s].filter(Boolean).join(" / ")}
                      </span>
                    </div>
                  )}

                  <div className="p-3 flex justify-between items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Status Akun:</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={13} />
                      <span>Aktif &amp; Siap Ujian</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Safety & Anti-Abuse Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Proteksi Keamanan Kredensial:</span>
                </p>
                <p className="leading-relaxed">
                  Kata sandi tidak disematkan di dalam kode QR untuk melindungi privasi peserta dan mencegah penyalahgunaan kartu oleh pihak lain.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {student ? (
                  // Jika di peramban ini sudah ada sesi siswa yang login
                  student.nisn === verifyData.u || (student as any).examUsername === verifyData.u ? (
                    <Button
                      onClick={() => navigate("/exam")}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm gap-2 shadow-md shadow-emerald-600/20"
                    >
                      <ExternalLink size={16} />
                      <span>Buka Dashboard Ujian Saya</span>
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                        Perangkat ini sedang aktif sesi: <strong>{student.name}</strong> ({student.nisn}).
                      </div>
                      <Button
                        onClick={() => navigate("/exam")}
                        variant="outline"
                        className="w-full h-11 rounded-2xl font-bold text-slate-700 dark:text-slate-200"
                      >
                        Tetap di Sesi Aktif ({student.name})
                      </Button>
                    </div>
                  )
                ) : (
                  // Jika belum login, tombol untuk menuju halaman login dengan username terisi otomatis
                  <Button
                    onClick={() => navigate(`/exam?u=${encodeURIComponent(verifyData.u)}`)}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm gap-2 shadow-md shadow-emerald-600/20"
                  >
                    <ExternalLink size={16} />
                    <span>Masuk ke Halaman Login Ujian</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => navigate("/unduh")}
                  className="w-full h-11 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 text-xs gap-2"
                >
                  <Download size={15} />
                  <span>Unduh Aplikasi Exambro Siswa</span>
                </Button>
              </div>
            </div>
          ) : (
            // State: Kode QR tidak valid / parameter kosong
            <div className="p-6 sm:p-8 text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Kode Verifikasi Tidak Ditemukan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Tautan atau kode QR ini tidak memuat token verifikasi kartu yang valid. Pastikan Anda memindai kode QR resmi yang tertera pada Kartu Peserta Ujian.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => navigate("/exam")}
                  className="h-11 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl text-xs"
                >
                  Buka Portal Ujian Siswa
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-slate-400 dark:text-slate-600 text-[11px] py-2">
        EXAMKU Computer Based Test System • Verifikasi Keamanan Kartu Siswa
      </div>
    </motion.div>
  );
};

export default VerifyStudentCardPage;

