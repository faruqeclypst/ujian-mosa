import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Shield, ArrowLeft, Save, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import pb from "../lib/pocketbase";

import FormField from "../components/forms/FormField";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import ProfilePictureUpload from "../components/ui/ProfilePictureUpload";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/toast";

const profileSchema = z.object({
  displayName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  email: z.string().email("Format email tidak valid").optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.name || "",
      email: user?.email || "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      setFormError("User tidak ditemukan.");
      return;
    }

    setFormError(null);
    setIsUpdating(true);

    try {
      await pb.collection("users").update(user.id, {
        name: values.displayName,
      });

      addToast({
        title: "Profil Diperbarui",
        description: "Informasi profil Anda telah berhasil disimpan.",
        type: "success"
      });
    } catch (error: any) {
      setFormError(error.message || "Gagal memperbarui profil.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProfileUpdate = (photoURL: string, displayName: string) => {
    if (photoURL !== user?.avatar) {
      // Photo was updated, trigger a state update via AuthContext which is automatic in PB
      // but we can refresh just in case if the user wants immediate feedback
      window.location.reload();
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Silakan login terlebih dahulu</p>
          <Link to="/admin/login" className="text-blue-600 hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-gray-900 dark:via-blue-900/20 dark:to-blue-800/20 p-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="relative overflow-hidden rounded-3xl border-0 bg-white/80 shadow-2xl backdrop-blur-xl dark:bg-gray-900/80">
            {/* Card Header Decoration */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />

            <CardHeader className="relative space-y-4 pb-8 pt-8 text-center">
              {/* Back Button */}
              <div className="absolute left-6 top-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-10 w-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg"
              >
                <User className="h-8 w-8 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
                  Profil Admin
                </CardTitle>
                <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                  Kelola informasi profil dan foto Anda
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="space-y-8 px-8 pb-8">
              {/* Profile Picture Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-6"
              >
                <ProfilePictureUpload
                  currentPhotoURL={user.avatar || ""}
                  displayName={user.name || ""}
                  onUpdate={handleProfileUpdate}
                  size="lg"
                />

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {user.name || "Admin"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </motion.div>

              {/* Profile Form */}
              <motion.form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {/* Display Name Field */}
                <FormField id="displayName" label="Nama Lengkap" error={errors.displayName}>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="displayName"
                      placeholder="Masukkan nama lengkap"
                      className="pl-10 rounded-xl border-gray-200 bg-gray-50/50 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:focus:bg-gray-800"
                      {...register("displayName")}
                    />
                  </div>
                </FormField>

                {/* Email Field (Read-only) */}
                <FormField id="email" label="Email">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10 rounded-xl border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      {...register("email")}
                      readOnly
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Email tidak dapat diubah
                  </p>
                </FormField>

                {/* Error Message */}
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="rounded-xl bg-red-50 border border-red-200 p-3 dark:bg-red-900/20 dark:border-red-800"
                  >
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {formError}
                    </p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    type="submit"
                    disabled={!isDirty || isUpdating}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-900 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    <motion.div
                      className="flex items-center justify-center gap-2"
                      animate={isUpdating ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 1, repeat: isUpdating ? Infinity : 0 }}
                    >
                      {isUpdating && <Sparkles className="h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4" />
                      {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                    </motion.div>
                  </Button>
                </motion.div>
              </motion.form>

              {/* Back to Dashboard */}
              <motion.div
                className="text-center pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Link
                  to="/admin"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors dark:text-blue-400 dark:hover:text-blue-300"
                >
                  ← Kembali ke Dashboard
                </Link>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;