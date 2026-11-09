import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { uploadInventoryImage } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";
import { StudentBottomNav } from "../../components/layout/StudentBottomNav";
import {
  ArrowLeft,
  Camera,
  User,
  Edit,
  KeyRound,
  Lock,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";

function formatIndonesianDate(d?: string): string {
  if (!d) return "-";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      if (months[monthIdx]) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return d;
  } catch {
    return d;
  }
}

export const StudentProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { student, updateProfile, changePassword, logoutStudent } = useStudentAuth();
  const { terminology, school } = useTenant();
  const { theme, setTheme } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states untuk Edit Biodata
  const [isEditingBiodata, setIsEditingBiodata] = useState(false);
  const [gender, setGender] = useState<"L" | "P">("L");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isSavingBiodata, setIsSavingBiodata] = useState(false);
  const [biodataMsg, setBiodataMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states untuk Ganti Password
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(() => searchParams.get("action") === "password");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Photo upload
  const [photoValue, setPhotoValue] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showExamPassword, setShowExamPassword] = useState(false);

  // Sinkronkan state awal dari data student
  useEffect(() => {
    if (student) {
      setPhotoValue(student.photo || "");
      setGender((student.gender as "L" | "P") || "L");
      setBirthPlace(student.birthPlace || "");
      setBirthDate(student.birthDate || "");
    }
  }, [student]);

  // Handler Upload Foto
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBiodataMsg({ type: "error", text: "File harus berupa format gambar." });
      return;
    }

    setIsUploadingPhoto(true);
    setBiodataMsg(null);

    try {
      const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 800, quality: 0.88 });
      const schoolFolder = school?.slug || "students";
      const res = await uploadInventoryImage(
        `schools/${schoolFolder}/students`,
        compressed
      );
      const url = res.url;

      await updateProfile({ photo: url });
      setPhotoValue(url);
      setBiodataMsg({ type: "success", text: "Foto profil berhasil diperbarui!" });
      setTimeout(() => setBiodataMsg(null), 3500);
    } catch {
      try {
        const reader = new FileReader();
        reader.onload = async (re) => {
          const dataUrl = re.target?.result as string;
          setPhotoValue(dataUrl);
          await updateProfile({ photo: dataUrl });
          setBiodataMsg({ type: "success", text: "Foto profil berhasil diperbarui!" });
          setTimeout(() => setBiodataMsg(null), 3500);
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        console.error("Gagal upload foto siswa:", err);
        setBiodataMsg({ type: "error", text: "Gagal mengunggah foto profil." });
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handler Simpan Biodata
  const handleSaveBiodata = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBiodata(true);
    setBiodataMsg(null);

    try {
      await updateProfile({
        gender,
        birthPlace: birthPlace.trim(),
        birthDate: birthDate.trim(),
      });
      setIsEditingBiodata(false);
      setBiodataMsg({ type: "success", text: "Biodata profil berhasil disimpan." });
      setTimeout(() => setBiodataMsg(null), 3500);
    } catch (err: any) {
      setBiodataMsg({ type: "error", text: err?.message || "Gagal menyimpan biodata." });
    } finally {
      setIsSavingBiodata(false);
    }
  };

  // Handler Simpan Password Baru
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password minimal 6 karakter." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Konfirmasi password baru tidak cocok." });
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "Password berhasil diperbarui! Silakan gunakan password baru ini untuk login berikutnya." });
      setTimeout(() => setPasswordMsg(null), 5000);
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err?.message || "Gagal mengganti password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0b0f14] text-neutral-900 dark:text-neutral-100 pb-28">
      {/* ── Flutter-style App Bar ── */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/exam")}
              className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-300 transition-all cursor-pointer active:scale-95"
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                Profil & Akun Siswa
              </h1>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[200px] sm:max-w-none">
                {school?.name || "CBT Examku System"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Aktif
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Banner Pesan Feedback */}
        {biodataMsg && (
          <div
            className={cn(
              "p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2",
              biodataMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300/60 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-300/60 text-rose-800 dark:text-rose-300"
            )}
          >
            {biodataMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{biodataMsg.text}</span>
          </div>
        )}

        {/* ── Hero Profile Card (Gaya Flutter Mobile) ── */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Avatar Bulat dengan Tombol Kamera */}
          <div className="relative inline-block mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-4 border-white dark:border-neutral-800 shadow-md flex items-center justify-center overflow-hidden">
              {photoValue ? (
                <img
                  src={photoValue}
                  alt={student?.name || "Foto Siswa"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            {/* Tombol Kamera Unggah Foto */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95 border-2 border-white dark:border-neutral-900"
              title="Ganti Foto Profil"
            >
              {isUploadingPhoto ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-3">
            {student?.name || "Peserta Didik"}
          </h2>

          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {terminology.student || "SISWA"} • {student?.className || "Rombel"}
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              NISN: {student?.nisn || "-"}
            </span>
          </div>
        </div>

        {/* ── Kredensial Sesi Ujian (ANBK / CBT) ── */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                  Kredensial Sesi Ujian (TU / Kartu)
                </h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Data login alternatif dari kartu ujian
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExamPassword(!showExamPassword)}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              title={showExamPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
            >
              {showExamPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="bg-neutral-50 dark:bg-neutral-850 p-3 rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Username Ujian
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                {student?.examUsername ? (
                  student.examUsername
                ) : (
                  <span className="text-neutral-400 font-sans text-xs italic font-normal">Belum dibuat admin</span>
                )}
              </span>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-850 p-3 rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Sandi Sesi Ujian
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {student?.examPassword ? (
                  showExamPassword ? student.examPassword : "••••••"
                ) : (
                  <span className="text-neutral-400 font-sans text-xs italic font-normal">Belum dibuat admin</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ── Section Biodata Siswa ── */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <User className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                Biodata Siswa
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingBiodata(!isEditingBiodata)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
            >
              {isEditingBiodata ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </>
              ) : (
                <>
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </>
              )}
            </button>
          </div>

          {!isEditingBiodata ? (
            /* Tampilan View Biodata (ListTile Flutter Style) */
            <div className="space-y-2">
              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">{terminology.id || "NISN"}</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-100 font-mono">{student?.nisn || "-"}</span>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Nama Lengkap</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-100">{student?.name || "-"}</span>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">{terminology.class || "Kelas"} / Rombel</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-100">{student?.className || "-"}</span>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Jenis Kelamin</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-100">{student?.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Tempat, Tgl Lahir</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-100">
                  {student?.birthPlace ? `${student.birthPlace}, ` : ""}{formatIndonesianDate(student?.birthDate)}
                </span>
              </div>
            </div>
          ) : (
            /* Formulir Edit Biodata (In-Place, Tanpa Modal) */
            <form onSubmit={handleSaveBiodata} className="space-y-4 pt-1 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender("L")}
                    className={cn(
                      "h-11 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-2 cursor-pointer",
                      gender === "L"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    <span>Laki-laki (L)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("P")}
                    className={cn(
                      "h-11 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-2 cursor-pointer",
                      gender === "P"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    <span>Perempuan (P)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Tempat Lahir
                </label>
                <input
                  type="text"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  placeholder="Contoh: Banda Aceh"
                  className="w-full h-11 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 text-xs font-medium focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-11 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 text-xs font-medium focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBiodata(false)}
                  disabled={isSavingBiodata}
                  className="flex-1 h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingBiodata}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingBiodata ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Section Ganti Password Akun (Tanpa Modal Tumpuk!) ── */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                  Keamanan & Ganti Password
                </h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Perbarui kata sandi akun pribadi siswa
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPasswordSectionOpen(!isPasswordSectionOpen)}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
            >
              {isPasswordSectionOpen ? "Tutup" : "Buka Form"}
            </button>
          </div>

          {passwordMsg && (
            <div
              className={cn(
                "p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in",
                passwordMsg.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300/60 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300/60 text-rose-800 dark:text-rose-300"
              )}
            >
              {passwordMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          {isPasswordSectionOpen && (
            <form onSubmit={handleSavePassword} className="space-y-3.5 pt-1 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full h-11 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 pr-11 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full h-11 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 pr-11 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPassword}
                className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>Simpan Password Baru</span>
              </button>
            </form>
          )}
        </div>

        {/* ── Section Personalisasi Tema ── */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
            Tema Tampilan
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "h-11 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95",
                theme === "light"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <Sun className="w-4 h-4" />
              <span>Terang</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "h-11 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95",
                theme === "dark"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <Moon className="w-4 h-4" />
              <span>Gelap</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "h-11 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95",
                theme === "system"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <Monitor className="w-4 h-4" />
              <span>Sistem</span>
            </button>
          </div>
        </div>

        {/* ── Tombol Keluar / Logout Gaya Flutter ── */}
        <button
          type="button"
          onClick={logoutStudent}
          className="w-full bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 rounded-3xl p-4 flex items-center justify-between transition-all shadow-sm cursor-pointer active:scale-[0.99] text-rose-600 dark:text-rose-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100/70 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-xs sm:text-sm font-bold block">
                Keluar dari Akun
              </span>
              <span className="text-[10px] text-rose-400 dark:text-rose-500 font-medium">
                Akhiri sesi login siswa pada perangkat ini
              </span>
            </div>
          </div>
        </button>
      </main>

      {/* ── Flutter-style Bottom Navigation Bar (Mobile / Android) ── */}
      <StudentBottomNav activeTab="profile" />
    </div>
  );
};

export default StudentProfilePage;
