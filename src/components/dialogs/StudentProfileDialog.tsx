import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { useTenant } from "../../context/TenantContext";
import { uploadInventoryImage } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";
import {
  ArrowLeft,
  X,
  Camera,
  Trash2,
  Edit,
  Settings,
  KeyRound,
  LogOut,
  ChevronRight,
  MapPin,
  Calendar,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface StudentProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  initialView?: "view" | "edit" | "password";
  onChangePassword?: () => void;
  onLogout?: () => void;
}

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

export const StudentProfileDialog: React.FC<StudentProfileDialogProps> = ({
  isOpen,
  onClose,
  readOnly = false,
  initialView = "view",
  onChangePassword,
  onLogout,
}) => {
  const { student, updateProfile, logoutStudent, changePassword } = useStudentAuth();
  const { terminology, school } = useTenant();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // View mode: 'view' (Flutter profile card) | 'edit' (Form edit biodata) | 'password' (Ganti Password)
  const [viewMode, setViewMode] = useState<"view" | "edit" | "password">(initialView);

  // Form states for editing
  const [photoValue, setPhotoValue] = useState<string>("");
  const [gender, setGender] = useState<"L" | "P">("L");
  const [birthPlace, setBirthPlace] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");

  // Form states for password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sinkronkan state saat dialog dibuka atau data student berubah
  useEffect(() => {
    if (isOpen && student) {
      setPhotoValue(student.photo || "");
      setGender((student.gender === "P" ? "P" : "L") as "L" | "P");
      setBirthPlace(student.birthPlace || "");
      setBirthDate(student.birthDate || "");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMessage(null);
      setSuccessMessage(null);
      setViewMode(initialView || "view");
    }
  }, [isOpen, student, initialView]);

  // Handle pilih & kompres foto profil
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Harap pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage("Ukuran foto maksimal 8MB.");
      return;
    }

    setErrorMessage(null);
    setIsUploadingPhoto(true);

    try {
      // Kompres foto proporsional max 600x600 untuk avatar lingkaran
      const compressed = await compressImage(file, {
        maxWidth: 600,
        maxHeight: 800,
        quality: 0.88,
      });

      const schoolFolder = school?.slug || "students";
      const res = await uploadInventoryImage(
        `schools/${schoolFolder}/students`,
        compressed
      );
      setPhotoValue(res.url);

      // Simpan langsung perubahan foto jika sedang di view mode
      await updateProfile({ photo: res.url });
      setSuccessMessage("Foto profil berhasil diperbarui.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      try {
        const reader = new FileReader();
        reader.onload = async (re) => {
          const dataUrl = re.target?.result as string;
          setPhotoValue(dataUrl);
          await updateProfile({ photo: dataUrl });
          setSuccessMessage("Foto profil berhasil diperbarui.");
          setTimeout(() => setSuccessMessage(null), 3000);
        };
        reader.readAsDataURL(file);
      } catch {
        setErrorMessage("Gagal memproses foto. Silakan coba kembali.");
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsSaving(true);
      await updateProfile({ photo: "" });
      setPhotoValue("");
      setSuccessMessage("Foto profil berhasil dihapus.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage("Gagal menghapus foto profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBiodata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateProfile({
        photo: photoValue,
        gender,
        birthPlace: birthPlace.trim(),
        birthDate: birthDate,
      });

      setSuccessMessage("Biodata berhasil disimpan.");
      setTimeout(() => {
        setSuccessMessage(null);
        setViewMode("view");
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan biodata.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage("Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await changePassword(newPassword);
      setSuccessMessage("Password berhasil diubah.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setSuccessMessage(null);
        setViewMode("view");
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengganti password.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutClick = () => {
    onClose();
    if (onLogout) {
      onLogout();
    } else {
      logoutStudent();
    }
  };

  // Inisial untuk avatar lingkaran
  const studentInitial = (student?.name || "S").trim().charAt(0).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="w-[94vw] sm:w-[88vw] md:w-full max-w-md sm:max-w-lg md:max-w-xl sm:rounded-[2rem] bg-white dark:bg-neutral-850 p-0 border border-neutral-200/80 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[92vh] md:max-h-[88vh] flex flex-col mx-auto">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
          disabled={readOnly || isUploadingPhoto || isSaving}
        />

        {/* ── App Bar Gaya Flutter ── */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-white dark:bg-neutral-850 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {viewMode !== "view" ? (
              <button
                type="button"
                onClick={() => setViewMode("view")}
                disabled={isSaving}
                className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              {viewMode === "edit" ? "Edit Biodata" : viewMode === "password" ? "Ganti Password" : "Profil"}
            </DialogTitle>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aksesibilitas: Deskripsi Tersembunyi */}
        <DialogDescription className="sr-only">
          Informasi profil dan kelengkapan data peserta didik
        </DialogDescription>

        {/* ── Body Konten Scrollable ── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Pesan status */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ── Header Avatar Lingkaran Gaya Flutter / Security Header jika Password ── */}
          {viewMode === "password" ? (
            <div className="flex flex-col items-center text-center pt-2 pb-1">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <KeyRound className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                Ubah Password Akun
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Perbarui password untuk akun {student?.name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center pt-2">
              <div className="relative">
                {/* Lingkaran Avatar */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border-4 border-white dark:border-neutral-800 shadow-md flex items-center justify-center overflow-hidden">
                  {photoValue ? (
                    <img
                      src={photoValue}
                      alt={student?.name || "Foto"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 select-none">
                      {studentInitial}
                    </span>
                  )}
                </div>

                {/* Tombol Kamera Mengambang (Floating Action Button) */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto || isSaving}
                    title="Ganti Foto Profil"
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center shadow-md transition-transform border-2 border-white dark:border-neutral-800 cursor-pointer"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Nama & Badge Status */}
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white tracking-tight mt-3">
                {student?.name || "Peserta Didik"}
              </h3>

              <div className="mt-1.5 inline-flex items-center px-3.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-full text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                {terminology.student || "SISWA"} • {student?.className || "Rombel"}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              MODE 1: TAMPILAN PROFIL (Flutter Info & Actions)
              ══════════════════════════════════════════════ */}
          {viewMode === "view" && (
            <div className="space-y-4 pt-1">
              {/* Grup Informasi Biodata (Card List Flutter Style) */}
              <div className="space-y-2">
                {/* Username / NISN */}
                <div className="bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Username ({terminology.id || "NISN"})
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100 font-mono">
                    {student?.nisn || "-"}
                  </span>
                </div>

                {/* Nama Lengkap */}
                <div className="bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Nama Lengkap
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100 truncate max-w-[200px]">
                    {student?.name || "-"}
                  </span>
                </div>

                {/* Kelas */}
                <div className="bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    {terminology.class || "Kelas (Rombel)"}
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100">
                    {student?.className || "-"}
                  </span>
                </div>

                {/* Jenis Kelamin */}
                <div className="bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Jenis Kelamin
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100">
                    {gender === "P" ? "Perempuan" : "Laki-laki"}
                  </span>
                </div>

                {/* Tempat, Tanggal Lahir */}
                <div className="bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Tempat, Tgl Lahir
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100 truncate max-w-[190px]">
                    {birthPlace || birthDate
                      ? `${birthPlace || "-"}, ${formatIndonesianDate(birthDate)}`
                      : "-"}
                  </span>
                </div>
              </div>

              {/* ── Menu Aksi ListTile Gaya Flutter ── */}
              <div className="space-y-2.5 pt-2">
                {/* Tombol Edit Biodata */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className="w-full bg-white dark:bg-neutral-850 border border-neutral-200/90 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-2xl px-5 py-4 flex items-center justify-between transition-all shadow-2xs group cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5">
                      <Edit className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        Edit Profil
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}

                {/* Tombol Ganti Password */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("password");
                  }}
                  className="w-full bg-white dark:bg-neutral-850 border border-neutral-200/90 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-2xl px-5 py-4 flex items-center justify-between transition-all shadow-2xs group cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <KeyRound className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                    <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      Ganti Password
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Tombol Keluar / Logout */}
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="w-full bg-white dark:bg-neutral-850 border border-neutral-200/90 dark:border-neutral-800 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-2xl px-5 py-4 flex items-center justify-between transition-all shadow-2xs group cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <LogOut className="w-5 h-5 text-rose-500" />
                    <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                      Keluar
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              MODE 2: FORMULIR EDIT BIODATA
              ══════════════════════════════════════════════ */}
          {viewMode === "edit" && !readOnly && (
            <form onSubmit={handleSaveBiodata} className="space-y-4 pt-1">
              {/* Jenis Kelamin */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 text-left">
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setGender("L")}
                    className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      gender === "L"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                        : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        gender === "L" ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    />
                    <span>Laki-laki</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setGender("P")}
                    className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      gender === "P"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                        : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        gender === "P" ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    />
                    <span>Perempuan</span>
                  </button>
                </div>
              </div>

              {/* Tempat Lahir */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Tempat Lahir
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Contoh: Banda Aceh"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    disabled={isSaving}
                    className="h-11 pl-9 rounded-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                </div>
              </div>

              {/* Tanggal Lahir */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Tanggal Lahir
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={isSaving}
                    className="h-11 pl-9 rounded-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                </div>
              </div>

              {/* Info Terkunci Sekolah */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-start gap-2 text-left">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />
                <span>
                  Nama, {terminology.id}, dan {terminology.class} dikunci oleh {terminology.school.toLowerCase()} demi validitas ujian. Hubungi proktor/operator jika terdapat kekeliruan data resmi.
                </span>
              </div>

              {/* Aksi Form Edit */}
              <div className="pt-2 flex gap-2">
                <NeonButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setViewMode("view")}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Batal
                </NeonButton>

                <NeonButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  loading={isSaving}
                  className="flex-1"
                >
                  Simpan Biodata
                </NeonButton>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════
              MODE 3: FORMULIR GANTI PASSWORD
              ══════════════════════════════════════════════ */}
          {viewMode === "password" && (
            <form onSubmit={handleSavePassword} className="space-y-4 pt-1">
              {/* Password Baru */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Password Baru
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSaving}
                    className="h-11 pl-9 rounded-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                </div>
              </div>

              {/* Konfirmasi Password Baru */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSaving}
                    className="h-11 pl-9 rounded-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                </div>
              </div>

              {/* Aksi Form Password */}
              <div className="pt-2 flex gap-2">
                <NeonButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setViewMode("view")}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Batal
                </NeonButton>

                <NeonButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  loading={isSaving}
                  className="flex-1"
                >
                  Simpan Password
                </NeonButton>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentProfileDialog;
