import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Eye, EyeOff, Sparkles, Shield, RefreshCw, User, Mail, Camera } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { AI_MODELS } from "../../lib/ai";

import FormField from "../forms/FormField";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ProfilePictureUpload from "../ui/ProfilePictureUpload";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import { startGoogleRedirectAuth } from "../../utils/googleAuthHelper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password baru dan konfirmasi tidak cocok",
    path: ["confirmPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

const profileSchema = z.object({
  displayName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "profile" | "password";
}

export const ChangePasswordModal = ({ isOpen, onClose, defaultTab = "profile" }: ProfileSettingsModalProps) => {
  const { user } = useAuth();
  const { pb } = useTenant();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"profile" | "password">(defaultTab);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(false);
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState<string>("");
  const [isCheckingGoogle, setIsCheckingGoogle] = useState(false);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);

  useEffect(() => {
    if (isOpen && pb && user) {
      const gid = (user as any).google_id;
      const gemail = (user as any).google_email;
      if (gid) {
        setIsGoogleLinked(true);
        setLinkedGoogleEmail(gemail || "");
      } else {
        setIsCheckingGoogle(true);
        pb.send("/api/auth/google", {
          method: "POST",
          body: { action: "status" },
        })
          .then((res: any) => {
            if (res?.isLinked) {
              setIsGoogleLinked(true);
              setLinkedGoogleEmail(res.googleEmail || "");
            } else {
              setIsGoogleLinked(false);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsCheckingGoogle(false);
          });
      }
    }
  }, [isOpen, pb, user]);

  const handleUnlinkGoogle = async () => {
    if (!pb) return;
    try {
      setIsUnlinkingGoogle(true);
      const res = await pb.send("/api/auth/google", {
        method: "POST",
        body: { action: "unlink" },
      });
      if (res?.ok) {
        setIsGoogleLinked(false);
        setLinkedGoogleEmail("");
        addToast({
          title: "Tautan Akun Google Dilepas",
          description: "Akun Google berhasil diputuskan dari profil Anda.",
          type: "success",
        });
      }
    } catch (err: any) {
      addToast({
        title: "Gagal Melepas Tautan",
        description: err.message || "Terjadi kesalahan saat memutus tautan Google.",
        type: "error",
      });
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setFormError(null);
    }
  }, [isOpen, defaultTab]);

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    watch: watchProfile,
    formState: { errors: profileErrors, isSubmitting: isSubmittingProfile, isDirty: isProfileDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.name || "",
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      resetProfile({ 
        displayName: user.name || "",
      });
    }
  }, [user, isOpen, resetProfile]);

  const onPasswordSubmit = async (values: ChangePasswordFormValues) => {
    if (!user || !pb) {
      setFormError("Koneksi tidak tersedia atau user tidak ditemukan.");
      return;
    }

    setFormError(null);
    try {
      await pb.collection("users").update(user.id, {
        oldPassword: values.currentPassword,
        password: values.newPassword,
        passwordConfirm: values.confirmPassword,
      });

      addToast({
        title: "Password Berhasil Diubah",
        description: "Password akun Anda telah berhasil diperbarui.",
        type: "success",
      });

      resetPassword();
      onClose();
    } catch (error: any) {
      setFormError(
        error.message || "Gagal mengubah password. Pastikan password saat ini benar."
      );
    }
  };

  const onProfileSubmit = async (values: ProfileFormValues) => {
    if (!user || !pb) {
      setFormError("Koneksi tidak tersedia atau user tidak ditemukan.");
      return;
    }

    setFormError(null);
    try {
      await pb.collection("users").update(user.id, {
        name: values.displayName,
      });

      addToast({
        title: "Profil Diperbarui",
        description: "Informasi profil Anda telah berhasil disimpan.",
        type: "success",
      });
      onClose();
    } catch (error: any) {
      setFormError(error.message || "Gagal memperbarui profil.");
    }
  };

  const handleProfileUpdate = (_photoURL: string, _displayName: string) => {
    // Tidak perlu reload: ProfilePictureUpload sudah memanggil authRefresh()
    // setelah upload/hapus, sehingga AuthContext ter-update otomatis
    // dan foto langsung tampil di modal maupun navigasi atas.
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setFormError(null);
        resetPassword();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#111214] shadow-2xl rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 z-50 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
        
        <DialogHeader className="pt-6 px-6 pb-2">
            <DialogTitle className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Pengaturan Profil
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              Kelola informasi profil dan keamanan akun Anda.
            </DialogDescription>
            
            {/* Custom Tabs (Neon Emerald) */}
            <div className="flex items-center gap-1 mt-4 p-1 bg-neutral-100 dark:bg-neutral-850 rounded-xl">
              <button
                type="button"
                onClick={() => { setActiveTab("profile"); setFormError(null); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "profile" 
                    ? "bg-white dark:bg-[#16181d] text-emerald-700 dark:text-emerald-400 shadow-2xs border border-emerald-500/20" 
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                Profil
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("password"); setFormError(null); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "password" 
                    ? "bg-white dark:bg-[#16181d] text-emerald-700 dark:text-emerald-400 shadow-2xs border border-emerald-500/20" 
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                Keamanan
              </button>
            </div>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2">
          {activeTab === "profile" ? (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className="flex flex-col items-center gap-4 mb-6 pt-2">
                <ProfilePictureUpload
                  currentPhotoURL={user?.avatar || ""}
                  displayName={user?.name || ""}
                  onUpdate={handleProfileUpdate}
                  size="xl"
                />
              </div>

              <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-4">
                <FormField id="displayName" label="Nama Lengkap" error={profileErrors.displayName}>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="displayName"
                      placeholder="Masukkan nama lengkap"
                      className="pl-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      {...registerProfile("displayName")}
                    />
                  </div>
                </FormField>

                <FormField id="email" label="Email">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      className="pl-10 rounded-xl border-neutral-200/80 bg-neutral-100/80 text-neutral-500 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                      readOnly
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1 pl-1">Email dikunci. Harap hubungi superadmin.</p>
                </FormField>

                {/* Tautan Akun Google (Neon Light Mode Theme) */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-[#FBF9F5] dark:bg-[#0f1115] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          Tautan Akun Google
                        </h4>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Login cepat tanpa mengetik username &amp; password.
                        </p>
                      </div>
                    </div>

                    {isGoogleLinked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                        <span>Terhubung</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300/60 dark:border-neutral-700/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        <span>Belum Tertaut</span>
                      </span>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                    {isGoogleLinked ? (
                      <>
                        <div className="truncate text-neutral-700 dark:text-neutral-300">
                          <span className="text-[10px] text-neutral-400 mr-1.5">Email:</span>
                          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">{linkedGoogleEmail || user?.email}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUnlinkingGoogle}
                          onClick={handleUnlinkGoogle}
                          className="h-7.5 px-3 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-semibold text-xs transition-all cursor-pointer"
                        >
                          {isUnlinkingGoogle ? "Memproses..." : "Putus Tautan"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Tautkan untuk login 1-klik yang praktis.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startGoogleRedirectAuth({ action: "link", returnUrl: "/admin" })}
                          className="h-7.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Tautkan Akun</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {formError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 overflow-hidden"
                    >
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" />
                        {formError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-2 flex gap-3">
                  <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-11 font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingProfile || !isProfileDirty}
                    className="flex-1 rounded-xl h-11 font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingProfile ? <RefreshCw className="h-4 w-4 animate-spin" /> : <>Simpan</>}
                  </Button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4 pt-2">
                <FormField id="currentPassword" label="Password Saat Ini" error={passwordErrors.currentPassword}>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      {...registerPassword("currentPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField id="newPassword" label="Password Baru" error={passwordErrors.newPassword}>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      className="pl-10 pr-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      {...registerPassword("newPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField id="confirmPassword" label="Konfirmasi Password Baru" error={passwordErrors.confirmPassword}>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ulangi password baru"
                      className="pl-10 pr-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      {...registerPassword("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <AnimatePresence>
                  {formError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 overflow-hidden"
                    >
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" />
                        {formError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-2 flex gap-3">
                  <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-11 font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingPassword}
                    className="flex-1 rounded-xl h-11 font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <>Perbarui</>}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;
