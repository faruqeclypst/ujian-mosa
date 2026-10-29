import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Shield, ArrowLeft, Save, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion";
import { Link, useNavigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { testAIConnection, AI_MODELS } from "../lib/ai";
import { startGoogleRedirectAuth } from "../utils/googleAuthHelper";

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
  ai_api_key: z.string().optional(),
  ai_provider: z.string().optional(),
  ai_model: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const { pb, terminology } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Status Tautan Google
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(false);
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState<string>("");
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);

  useEffect(() => {
    const checkGoogleStatus = async () => {
      if (!pb) return;
      try {
        const res = await pb.send("/api/auth/google", {
          method: "POST",
          body: { action: "status" },
        });
        if (res && res.ok) {
          setIsGoogleLinked(Boolean(res.isLinked));
          setLinkedGoogleEmail(res.googleEmail || "");
        }
      } catch (_) {}
    };
    checkGoogleStatus();
  }, [pb, user]);

  const handleUnlinkGoogle = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memutuskan tautan akun Google ini?")) return;
    setIsUnlinkingGoogle(true);
    try {
      const res = await pb?.send("/api/auth/google", {
        method: "POST",
        body: { action: "unlink" },
      });
      if (res && res.ok) {
        setIsGoogleLinked(false);
        setLinkedGoogleEmail("");
        addToast({
          title: "Tautan Diputus",
          description: "Akun Google berhasil dilepas dari profil Anda.",
          type: "success",
        });
      }
    } catch (e: any) {
      addToast({
        title: "Gagal",
        description: e.message || "Gagal memutuskan tautan akun Google.",
        type: "error",
      });
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.name || "",
      email: user?.email || "",
      ai_api_key: (user as any)?.ai_api_key || "",
      ai_provider: (user as any)?.ai_provider || "groq",
      ai_model: (user as any)?.ai_model || "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      setFormError("User tidak ditemukan.");
      return;
    }

    setFormError(null);
    setIsUpdating(true);
    if (!pb) return;

    try {
      await pb.collection("users").update(user.id, {
        name: values.displayName,
        ai_api_key: values.ai_api_key,
        ai_provider: values.ai_provider,
        ai_model: values.ai_model,
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

  const handleTestAI = async () => {
    const aiKey = watch("ai_api_key");
    if (!aiKey) {
      addToast({ title: "Gagal", description: "Masukkan API Key terlebih dahulu.", type: "error" });
      return;
    }

    setIsTestingAI(true);
    setTestResult(null);

    try {
      if (!pb) return;
      const settings = await pb.collection("settings").getFullList({ limit: 1 });
      const config = settings[0];

      // 🚀 Use selected provider/model if available
      const provider = watch("ai_provider") || config?.ai_provider || "groq";
      const modelId = watch("ai_model") || config?.ai_model || AI_MODELS[0].id;
      const customUrl = config?.ai_gateway_url || "https://ollama.com";

      const res = await testAIConnection(pb, aiKey, modelId, customUrl, provider);
      setTestResult(res);

      if (res.success) {
        addToast({ title: "Berhasil!", description: "API Key valid dan terkoneksi.", type: "success" });
      } else {
        addToast({ title: "Koneksi Gagal", description: res.message, type: "error" });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Terjadi kesalahan sistem saat mencoba koneksi." });
    } finally {
      setIsTestingAI(false);
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
          <Link to="/admin" className="text-blue-600 hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="min-h-screen bg-[#FBF9F5] dark:bg-[#0A0A0C] p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Micro-Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      {/* Ambient Neon Glow Accents */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-2xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="relative overflow-hidden rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#111214] shadow-[0_4px_25px_rgba(0,0,0,0.035)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {/* Card Header Decoration (Emerald Neon Line) */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 z-50 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />

            <CardHeader className="relative space-y-4 pb-6 pt-7 text-center">
              {/* Back Button */}
              <div className="absolute left-5 top-5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-9 w-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20
                }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <User className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </motion.div>

              <div>
                <CardTitle className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                  Profil Admin
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                  Kelola informasi profil dan kredensial akun Anda
                </CardDescription>
              </div>
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
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="displayName"
                      placeholder="Masukkan nama lengkap"
                      className="pl-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      {...register("displayName")}
                    />
                  </div>
                </FormField>

                {/* Email Field (Read-only) */}
                <FormField id="email" label="Email">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10 rounded-xl border-neutral-200/80 bg-neutral-100/80 text-neutral-500 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                      {...register("email")}
                      readOnly
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 pl-1">
                    Email terkunci dan tidak dapat diubah
                  </p>
                </FormField>

                {/* AI API Key Field */}
                <FormField id="ai_api_key" label="AI API Key (Opsional)">
                  <div className="flex gap-2">
                    <div className="relative flex-1 group">
                      <Sparkles className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500 dark:text-indigo-400" />
                      <Input
                        id="ai_api_key"
                        type="password"
                        placeholder="gsk_xxxx atau API Key AI lainnya"
                        className="pl-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        {...register("ai_api_key")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestAI}
                      disabled={isTestingAI}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 h-10 px-4 whitespace-nowrap font-bold text-xs cursor-pointer"
                    >
                      {isTestingAI ? (
                        <div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                         "Cek Key"
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1 pl-1">
                    Bagi {terminology.teacher}, wajib mengisi API Key sendiri untuk menggunakan fitur AI.
                  </p>
                  {testResult && (
                    <p className={`text-[10px] mt-1 pl-1 font-bold ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {testResult.success ? "✓ Koneksi Berhasil" : `✗ ${testResult.message}`}
                    </p>
                  )}
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField id="ai_provider" label="Provider AI">
                    <select
                      {...register("ai_provider")}
                      className="w-full h-11 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white text-xs sm:text-sm px-3 transition-all focus:bg-white dark:focus:bg-[#111214] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      <option value="groq">Groq Cloud</option>
                      <option value="ollama">Ollama (Lokal)</option>
                      <option value="puter">Puter (Gratis, tanpa API Key, limit terbatas)</option>
                    </select>
                  </FormField>
                  <FormField id="ai_model" label="Model AI">
                    <select
                      {...register("ai_model")}
                      className="w-full h-11 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 text-neutral-900 dark:text-white text-xs sm:text-sm px-3 transition-all focus:bg-white dark:focus:bg-[#111214] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      {AI_MODELS.filter(m => m.provider === (watch("ai_provider") || "groq")).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {/* Seksi Tautan Akun Google (Neon Light Mode Theme) */}
                <div className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-[#FBF9F5] dark:bg-[#0f1115] p-4.5 space-y-3.5 shadow-2xs">
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
                          Masuk cepat tanpa perlu mengetik username &amp; password.
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

                  <div className="pt-2.5 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    {isGoogleLinked ? (
                      <>
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                          <span className="text-[11px] text-neutral-400">Email Google:</span>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{linkedGoogleEmail || user?.email}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUnlinkingGoogle}
                          onClick={handleUnlinkGoogle}
                          className="h-8 px-3.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-semibold text-xs transition-all cursor-pointer"
                        >
                          {isUnlinkingGoogle ? "Memproses..." : "Putus Tautan"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Tautkan akun Google untuk kemudahan login berikutnya.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startGoogleRedirectAuth({ action: "link", returnUrl: "/admin/profile" })}
                          className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Tautkan Akun Google</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

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
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
                className="text-center pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Dashboard</span>
                </Link>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;
