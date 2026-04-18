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

const ChangePasswordModal = ({ isOpen, onClose, defaultTab = "profile" }: ProfileSettingsModalProps) => {
  const { user } = useAuth();
  const { pb } = useTenant();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"profile" | "password">(defaultTab);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleProfileUpdate = (photoURL: string, displayName: string) => {
    if (photoURL !== user?.avatar) {
      window.location.reload();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setFormError(null);
        resetPassword();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-0 bg-white dark:bg-gray-900 shadow-2xl rounded-[2rem]">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-700 z-50" />
        
        <DialogHeader className="pt-6 px-6 pb-2">
            <DialogTitle className="text-xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
              Pengaturan Profil
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400 font-medium">
              Kelola informasi profil dan keamanan akun Anda.
            </DialogDescription>
            
            {/* Custom Tabs */}
            <div className="flex items-center gap-1 mt-4 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl">
              <button
                type="button"
                onClick={() => { setActiveTab("profile"); setFormError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  activeTab === "profile" 
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Profil
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("password"); setFormError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  activeTab === "password" 
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                  size="md"
                />
              </div>

              <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-4">
                <FormField id="displayName" label="Nama Lengkap" error={profileErrors.displayName}>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="displayName"
                      placeholder="Masukkan nama lengkap"
                      className="pl-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                      {...registerProfile("displayName")}
                    />
                  </div>
                </FormField>

                <FormField id="email" label="Email">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      className="pl-10 rounded-xl border-gray-200/60 bg-gray-100 text-gray-500 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      readOnly
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 pl-1">Email dikunci. Harap hubungi superadmin.</p>
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
                  <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-11 font-bold">
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingProfile || !isProfileDirty}
                    className="flex-1 rounded-xl h-11 font-bold bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg shadow-blue-500/20"
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
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                      {...registerPassword("currentPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField id="newPassword" label="Password Baru" error={passwordErrors.newPassword}>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                      {...registerPassword("newPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField id="confirmPassword" label="Konfirmasi Password Baru" error={passwordErrors.confirmPassword}>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ulangi password baru"
                      className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                      {...registerPassword("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                  <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-11 font-bold">
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingPassword}
                    className="flex-1 rounded-xl h-11 font-bold bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg shadow-blue-500/20"
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
