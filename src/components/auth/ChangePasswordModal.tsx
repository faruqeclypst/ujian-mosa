import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Eye, EyeOff, Sparkles, Shield, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import pb from "../../lib/pocketbase";

import FormField from "../forms/FormField";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../context/AuthContext";
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

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    if (!user) {
      setFormError("User tidak ditemukan.");
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

      reset();
      onClose();
    } catch (error: any) {
      setFormError(
        error.message || "Gagal mengubah password. Pastikan password saat ini benar."
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-0 bg-white dark:bg-gray-900 shadow-2xl rounded-[2rem]">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-700" />
        
        <DialogHeader className="pt-8 px-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg mb-4"
            >
              <Lock className="h-8 w-8 text-white" />
            </motion.div>
            <DialogTitle className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
              Ubah Password
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400 font-medium">
              Demi keamanan, harap perbarui password Anda secara berkala.
            </DialogDescription>
        </DialogHeader>

        <div className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4">
              <FormField id="currentPassword" label="Password Saat Ini" error={errors.currentPassword}>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                    {...register("currentPassword")}
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

              <FormField id="newPassword" label="Password Baru" error={errors.newPassword}>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                    {...register("newPassword")}
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

              <FormField id="confirmPassword" label="Konfirmasi Password Baru" error={errors.confirmPassword}>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Ulangi password baru"
                    className="pl-10 pr-10 rounded-xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                    {...register("confirmPassword")}
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
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 rounded-xl h-11 font-bold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl h-11 font-bold bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg shadow-blue-500/20"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Perbarui
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;
