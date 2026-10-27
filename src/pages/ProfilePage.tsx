import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Shield, ArrowLeft, Save, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
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
    <div className="min-h-screen bg-[#FBF9F5] dark:bg-[#090a0d] p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans text-neutral-900 dark:text-neutral-100">
      {/* Educational Doodle Pattern (Adaptive Watermark) */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.035] dark:invert dark:opacity-[0.045] pointer-events-none select-none z-0"
        style={{
          backgroundImage: "url('/login-pattern.png')",
          backgroundSize: "360px 360px",
        }}
      />

      {/* Signature Examku Neon Mesh Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/12 via-teal-500/8 to-blue-500/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-2xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="relative overflow-hidden rounded-3xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white/95 dark:bg-[#111317]/95 shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            {/* Card Header Top Neon Strip */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <CardHeader className="relative space-y-4 pb-6 pt-8 text-center">
              {/* Back Button */}
              <div className="absolute left-6 top-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-10 w-10 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
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
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <User className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  Profil Pengguna
                </CardTitle>
                <CardDescription className="mt-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  Kelola informasi profil, AI, dan tautan akun Single Sign-On Anda
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="space-y-8 px-6 sm:px-8 pb-8">
              {/* Profile Picture Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-4"
              >
                <ProfilePictureUpload
                  currentPhotoURL={user.avatar || ""}
                  displayName={user.name || ""}
                  onUpdate={handleProfileUpdate}
                  size="lg"
                />

                <div className="text-center">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {user.name || "Pengguna"}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                    {user.email}
                  </p>
                </div>
              </motion.div>

              {/* Profile Form */}
              <motion.form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
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
                      className="pl-10 rounded-xl border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#16181f] text-neutral-900 dark:text-neutral-100 transition-all focus:border-emerald-500/50"
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
                      className="pl-10 rounded-xl border-neutral-200/90 dark:border-neutral-800 bg-neutral-100 dark:bg-[#16181f]/60 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                      {...register("email")}
                      readOnly
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 pl-1">
                    Email terdaftar dikunci demi keamanan akun.
                  </p>
                </FormField>

                {/* AI API Key Field */}
                <FormField id="ai_api_key" label="AI API Key (Opsional)">
                  <div className="flex gap-2">
                    <div className="relative flex-1 group">
                      <Sparkles className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                      <Input
                        id="ai_api_key"
                        type="password"
                        placeholder="gsk_xxxx atau API Key AI lainnya"
                        className="pl-10 rounded-xl border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#16181f] text-neutral-900 dark:text-neutral-100 transition-all focus:border-emerald-500/50"
                        {...register("ai_api_key")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestAI}
                      disabled={isTestingAI}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 h-10 px-4 whitespace-nowrap font-bold text-xs cursor-pointer transition-all"
                    >
                      {isTestingAI ? (
                        <div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                         "Cek Key"
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 pl-1">
                    Bagi {terminology.teacher}, isi API Key sendiri untuk mengaktifkan asisten pembuat soal AI.
                  </p>
                  {testResult && (
                    <p className={`text-[11px] mt-1 pl-1 font-bold ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {testResult.success ? "✓ Koneksi Berhasil" : `✗ ${testResult.message}`}
                    </p>
                  )}
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="ai_provider" label="Provider AI">
                    <select
                      {...register("ai_provider")}
                      className="w-full h-11 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#16181f] text-sm px-3 text-neutral-900 dark:text-neutral-100 transition-all focus:border-emerald-500/50 outline-none"
                    >
                      <option value="groq">Groq Cloud (Cepat & Rekomendasi)</option>
                      <option value="ollama">Ollama (Lokal / Mandiri)</option>
                      <option value="puter">Puter (Gratis, tanpa API Key)</option>
                    </select>
                  </FormField>
                  <FormField id="ai_model" label="Model AI">
                    <select
                      {...register("ai_model")}
                      className="w-full h-11 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#16181f] text-sm px-3 text-neutral-900 dark:text-neutral-100 transition-all focus:border-emerald-500/50 outline-none"
                    >
                      {AI_MODELS.filter(m => m.provider === (watch("ai_provider") || "groq")).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {/* Seksi Tautan Akun Google (Signature Neon) */}
                <div className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0f1115] p-4.5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#16181f] border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-center shrink-0 shadow-xs">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          Tautan Akun Google
                        </h4>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          Masuk cepat tanpa perlu mengetik username &amp; password
                        </p>
                      </div>
                    </div>

                    {isGoogleLinked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)] shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                        <span>Terhubung</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300/60 dark:border-neutral-700/60 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                        <span>Belum Tertaut</span>
                      </span>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-neutral-200/80 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    {isGoogleLinked ? (
                      <>
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                          <span className="text-[11px] text-neutral-400 font-medium">Email Google:</span>
                          <span className="font-semibold text-neutral-900 dark:text-white">{linkedGoogleEmail || user?.email}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUnlinkingGoogle}
                          onClick={handleUnlinkGoogle}
                          className="text-xs font-bold text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50/50 hover:bg-rose-100/60 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 h-8 px-3 rounded-lg cursor-pointer transition-all"
                        >
                          {isUnlinkingGoogle ? "Memproses..." : "Putus Tautan"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                          Tautkan akun Google untuk kemudahan login berikutnya
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startGoogleRedirectAuth({ action: "link", returnUrl: "/admin/profile" })}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm shadow-emerald-600/25 hover:shadow-md hover:shadow-emerald-600/35 border border-emerald-500/30 h-8 px-3.5 rounded-lg gap-1.5 cursor-pointer transition-all"
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
                    className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 dark:bg-rose-950/40 dark:border-rose-900/60"
                  >
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>{formError}</span>
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
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-xs sm:text-sm text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 border border-emerald-500/30 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <motion.div
                      className="flex items-center justify-center gap-2"
                      animate={isUpdating ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 1, repeat: isUpdating ? Infinity : 0 }}
                    >
                      {isUpdating && <Sparkles className="h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4" />
                      <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
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
                  className="text-xs font-semibold text-neutral-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Dashboard</span>
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
