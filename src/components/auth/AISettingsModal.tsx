import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Shield, Save, X, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

import FormField from "../forms/FormField";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import { AI_MODELS, testAIConnection } from "../../lib/ai";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const aiSettingsSchema = z.object({
  ai_api_key: z.string().min(1, "API Key wajib diisi untuk menggunakan fitur AI"),
  ai_provider: z.string().min(1, "Provider wajib dipilih"),
  ai_model: z.string().optional(),
});

type AISettingsFormValues = z.infer<typeof aiSettingsSchema>;

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AISettingsModal = ({ isOpen, onClose }: AISettingsModalProps) => {
  const { user, refreshUser } = useAuth();
  const { pb } = useTenant();
  const { addToast } = useToast();

  const [formError, setFormError] = useState<string | null>(null);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, isDirty },
  } = useForm<AISettingsFormValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      ai_api_key: "",
      ai_provider: "groq",
      ai_model: "",
    },
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !pb || !isOpen) return;

      try {
        if (user.role === 'admin') {
          // 🏛️ Admin: Ambil dari Global Settings
          const records = await pb.collection("settings").getFullList({ limit: 1 });
          const config = records[0];
          if (config) {
            const isOllama = config.ai_provider === 'ollama';
            reset({
              ai_api_key: isOllama ? (config.ai_gateway_key || config.groq_api_key) : config.groq_api_key,
              ai_provider: config.ai_provider || "groq",
              ai_model: config.ai_model || "",
            });
          }
        } else {
          // 👨‍🏫 Guru: Ambil dari Profil Pribadi
          reset({
            ai_api_key: (user as any)?.ai_api_key || "",
            ai_provider: (user as any)?.ai_provider || "groq",
            ai_model: (user as any)?.ai_model || "",
          });
        }
      } catch (err) {
        console.error("Failed to load AI settings:", err);
      }
    };

    loadSettings();
    setFormError(null);
    setTestResult(null);
  }, [user, isOpen, reset, pb]);

  const onSubmit = async (values: AISettingsFormValues) => {
    if (!user || !pb) return;

    setFormError(null);
    try {
      if (user.role === 'admin') {
        // 🏛️ Admin: Update Global Settings
        const records = await pb.collection("settings").getFullList({ limit: 1 });
        const config = records[0];

        const isOllama = values.ai_provider === 'ollama';
        const payload: any = {
          ai_provider: values.ai_provider,
          ai_model: values.ai_model,
        };

        if (isOllama) {
          payload.ai_gateway_key = values.ai_api_key;
        } else {
          payload.groq_api_key = values.ai_api_key;
        }

        if (config) {
          await pb.collection("settings").update(config.id, payload);
        } else {
          await pb.collection("settings").create({ ...payload, name: "EXAM AA" });
        }

        addToast({
          title: "Pengaturan Global Disimpan",
          description: "Konfigurasi AI sekolah telah berhasil diperbarui.",
          type: "success",
        });
      } else {
        // 👨‍🏫 Guru: Update Profil Pribadi
        await pb.collection("users").update(user.id, {
          ai_api_key: values.ai_api_key,
          ai_provider: values.ai_provider,
          ai_model: values.ai_model,
        });

        addToast({
          title: "Konfigurasi Disimpan",
          description: "Pengaturan AI Anda telah berhasil diperbarui.",
          type: "success",
        });
      }

      await refreshUser();
      onClose();
    } catch (error: any) {
      setFormError(error.message || "Gagal menyimpan konfigurasi AI.");
    }
  };

  const handleTestAI = async () => {
    const aiKey = watch("ai_api_key");
    const aiProvider = watch("ai_provider");
    const aiModel = watch("ai_model");

    if (!aiKey) {
      addToast({ title: "Gagal", description: "Masukkan API Key terlebih dahulu.", type: "error" });
      return;
    }

    setIsTestingAI(true);
    setTestResult(null);

    try {
      const settings = await pb?.collection("settings").getFullList({ limit: 1 });
      const config = settings?.[0];

      const provider = aiProvider || config?.ai_provider || "groq";
      const modelId = aiModel || config?.ai_model || AI_MODELS[0].id;
      const customUrl = config?.ai_gateway_url || "https://ollama.com";

      const res = await testAIConnection(pb!, aiKey, modelId, customUrl, provider);
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

  const selectedProvider = watch("ai_provider");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-0 bg-white dark:bg-gray-900 shadow-2xl rounded-[2rem]">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700 z-50" />

        <DialogHeader className="pt-8 px-8 pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
                Konfigurasi AI
              </DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-gray-400 font-medium">
                {user?.role === 'admin'
                  ? "Atur kunci pribadi atau biarkan kosong untuk menggunakan Pengaturan Global."
                  : "Atur mesin kecerdasan buatan untuk akun Anda."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-8 pb-8 space-y-5">
          <FormField id="ai_api_key" label="API Key">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  id="ai_api_key"
                  type="password"
                  placeholder="gsk_xxxx..."
                  className="pl-10 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800"
                  {...register("ai_api_key")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestAI}
                disabled={isTestingAI}
                className="rounded-xl border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 h-11 px-4"
              >
                {isTestingAI ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tes"}
              </Button>
            </div>
            {testResult && (
              <p className={`text-[10px] mt-1.5 font-bold ${testResult.success ? 'text-emerald-600' : 'text-rose-600'} pl-1`}>
                {testResult.success ? "✓ Koneksi Berhasil" : `✗ ${testResult.message}`}
              </p>
            )}
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="ai_provider" label="Provider Mesin">
              <select
                {...register("ai_provider")}
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 text-sm px-3 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="groq">Groq Cloud (Cepat)</option>
                <option value="ollama">Ollama (Lokal)</option>
              </select>
            </FormField>

            <FormField id="ai_model" label="Pilihan Model">
              <select
                {...register("ai_model")}
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 text-sm px-3 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {AI_MODELS.filter(m => m.provider === selectedProvider).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 space-y-3">
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              <strong>Info:</strong> {user?.role === 'admin'
                ? "Konfigurasi ini digunakan untuk akun Admin Anda saat menyusun naskah di Bank Soal."
                : "Akun Guru wajib memiliki API Key sendiri. Penggunaan fitur AI Lab akan memotong kuota dari Key di atas."}
            </p>
            <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50 flex flex-col gap-2">
              <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest">Dapatkan Key Gratis:</span>
              <div className="flex flex-col gap-1.5">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group hover:bg-white/50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                >
                  <span className="text-[10px] font-bold text-indigo-600">🚀 Ambil di Groq Console (Disarankan)</span>
                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                </a>
                <a
                  href="https://ollama.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group hover:bg-white/50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                >
                  <span className="text-[10px] font-bold text-gray-600">🦙 Ambil di Ollama Keys</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-xs font-bold"
              >
                {formError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-12 font-bold">
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex-1 rounded-xl h-12 font-bold bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-xl shadow-blue-500/20"
            >
              {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <div className="flex items-center gap-2"><Save className="h-4 w-4" /> Simpan</div>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AISettingsModal;
