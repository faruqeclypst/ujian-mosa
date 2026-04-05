import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, User, Eye, EyeOff, Sparkles, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";

import FormField from "../components/forms/FormField";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { useAuth } from "../context/AuthContext";
import pb from "../lib/pocketbase";

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { signInWithUsername } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLogoLoading(true);
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1
        });

        if (records.length > 0) {
          const data = records[0];
          setSchoolName(data.name || "E-Ujian CBT");
          
          let logoUrl = data.logoUrl || data.logo || "";
          if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }
          setSchoolLogo(logoUrl);
        }
      } catch (err) {
        console.error("Gagal memuat settings sekolah:", err);
      } finally {
        setLogoLoading(false);
      }
    };

    fetchSettings();
  }, []);

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

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await signInWithUsername(values.username, values.password);
    } catch (error: any) {
      setFormError(error.message || "Gagal login. Periksa kembali username dan password.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-gray-900 dark:via-blue-900/20 dark:to-blue-800/20">
      {/* Theme Toggle - Fixed Position */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-700/20 blur-3xl"
        />
        <motion.div
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 right-1/4 h-32 w-32 rounded-full bg-gradient-to-br from-blue-300/10 to-blue-500/10 blur-2xl"
        />
      </div>

      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [-100, -120, -100],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
          className="absolute h-2 w-2 rounded-full bg-blue-500/40"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + i * 10}%`,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.6,
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
        className="relative z-10 w-full max-w-md p-6"
      >
        <Card className="relative overflow-hidden rounded-3xl border-0 bg-white/80 shadow-2xl backdrop-blur-xl dark:bg-gray-900/80">
          {/* Card Header Decoration */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />

          <CardHeader className="relative space-y-4 pb-8 pt-8 text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="mx-auto flex h-24 w-24 items-center justify-center relative overflow-hidden"
            >
              {logoLoading ? (
                <div className="flex items-center justify-center h-full w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse">
                  <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                </div>
              ) : schoolLogo && !logoError ? (
                <img
                  src={schoolLogo}
                  // alt="Logo Sekolah" 
                  className="h-full w-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-inner">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
                Selamat Datang Kembali
              </CardTitle>
              <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                Masuk ke dashboard dengan akun admin Anda
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-8">
            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {/* Username Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <FormField id="username" label="Username" error={errors.username}>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="username"
                      placeholder="Masukkan username admin"
                      autoComplete="username"
                      className="pl-10 rounded-xl border-gray-200 bg-gray-50/50 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:focus:bg-gray-800"
                      {...register("username")}
                    />
                  </div>
                </FormField>
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <FormField id="password" label="Password" error={errors.password}>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Masukkan password"
                      className="pl-10 pr-10 rounded-xl border-gray-200 bg-gray-50/50 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:focus:bg-gray-800"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              </motion.div>

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
                transition={{ delay: 0.7 }}
              >
                <Button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-900 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                  disabled={isSubmitting}
                >
                  <motion.div
                    className="flex items-center justify-center gap-2"
                    animate={isSubmitting ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1, repeat: isSubmitting ? Infinity : 0 }}
                  >
                    {isSubmitting && <Sparkles className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Memproses..." : "Masuk Sekarang"}
                  </motion.div>
                </Button>
              </motion.div>
            </motion.form>

            {/* Register Link */}
            {/* <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Belum punya akun admin?{" "}
                <Link
                  to="/admin/register"
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Daftar di sini
                </Link>
              </p>
            </motion.div> */}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
