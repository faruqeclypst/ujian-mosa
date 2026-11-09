import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Shield, Save, X, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

import FormField from "../forms/FormField";
import { NeonButton } from "../ui/NeonButton";
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
  ai_api_key: z.string().optional(),
  ai_provider: z.string().min(1, "Provider wajib dipilih"),
  ai_model: z.string().optional(),
});

type AISettingsFormValues = z.infer<typeof aiSettingsSchema>;

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsModal = ({ isOpen, onClose }: AISettingsModalProps) => {
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
      ai_provider: "custom",
      ai_model: "agnes-2.5-flash",
    },
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !pb || !isOpen) return;

      try {
        if (user.role === 'admin') {
          const records = await pb.collection("settings").getFullList({ limit: 1 });
          const config = records[0];
          if (config) {
            const isOllama = config.ai_provider === 'ollama';
            reset({
              ai_api_key: isOllama ? (config.ai_gateway_key || config.groq_api_key) : (config.ai_gateway_key || config.groq_api_key || ""),
              ai_provider: config.ai_provider && config.ai_provider !== "groq" ? config.ai_provider : "custom",
              ai_model: config.ai_model || "agnes-2.5-flash",
            });
          }
        } else {
          reset({
            ai_api_key: (user as any)?.ai_api_key || "",
            ai_provider: (user as any)?.ai_provider && (user as any)?.ai_provider !== "groq" ? (user as any).ai_provider : "custom",
            ai_model: (user as any)?.ai_model || "agnes-2.5-flash",
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
        const records = await pb.collection("settings").getFullList({ limit: 1 });
        const config = records[0];

        const isOllama = values.ai_provider === 'ollama';
        const isPuter = values.ai_provider === 'puter';
        const payload: any = {
          ai_provider: values.ai_provider,
          ai_model: values.ai_model,
        };

        if (isPuter) {
          // Puter doesn't need API key
        } else {
          payload.ai_gateway_key = values.ai_api_key || "";
          payload.groq_api_key = values.ai_api_key || "";
        }

        if (config) {
          await pb.collection("settings").update(config.id, payload);
        } else {
          await pb.collection("settings").create({ ...payload, name: "EXAMKU" });
        }

        addToast({
          title: "Pengaturan Global Disimpan",
          description: "Konfigurasi AI sekolah telah berhasil diperbarui.",
          type: "success",
        });
      } else {
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

    if (aiProvider !== "ollama" && aiProvider !== "puter" && !aiKey) {
      addToast({ title: "Gagal", description: "Masukkan API Key terlebih dahulu.", type: "error" });
      return;
    }

    setIsTestingAI(true);
    setTestResult(null);

    try {
      const settings = await pb?.collection("settings").getFullList({ limit: 1 });
      const config = settings?.[0];

      const modelId = aiModel || config?.ai_model || AI_MODELS[0].id;
      const customUrl = config?.ai_gateway_url || "https://apihub.agnes-ai.com/v1";

      const res = await testAIConnection(pb!, aiKey || "", modelId, customUrl);
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-0 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500 z-50" />

        <DialogHeader className="pt-7 px-7 pb-3">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Konfigurasi AI
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                {user?.role === 'admin'
                  ? "Atur kunci pribadi atau biarkan kosong untuk menggunakan Pengaturan Global."
                  : "Atur mesin kecerdasan buatan untuk akun Anda."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-7 pb-7 space-y-4">
          <FormField id="ai_api_key" label="API Key">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
                <Input
                  id="ai_api_key"
                  type="password"
                  placeholder="sk-... atau sk-ant-..."
                  className="pl-10 rounded-xl border-neutral-200 bg-neutral-50/50 transition-all focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:border-neutral-750 dark:bg-neutral-850"
                  {...register("ai_api_key")}
                />
              </div>
              <NeonButton
                type="button"
                variant="soft"
                color="brand"
                size="sm"
                onClick={handleTestAI}
                disabled={isTestingAI}
                className="h-10 px-3.5"
              >
                {isTestingAI ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tes"}
              </NeonButton>
            </div>
            {testResult && (
              <p className={`text-[10px] mt-1.5 font-bold ${testResult.success ? 'text-emerald-600' : 'text-rose-600'} pl-1`}>
                {testResult.success ? "✓ Koneksi Berhasil" : `✗ ${testResult.message}`}
              </p>
            )}
          </FormField>

          <div className="space-y-3.5">
            <FormField id="ai_model" label="Pilihan Model Kecerdasan (LLM)">
              <select
                {...register("ai_model")}
                className="w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-750 bg-neutral-50/50 dark:bg-neutral-850 text-xs px-3 text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                {AI_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed">
              <strong className="text-neutral-800 dark:text-neutral-200">Info:</strong> {user?.role === 'admin'
                ? "Konfigurasi ini digunakan untuk akun Admin Anda saat menyusun naskah di Bank Soal."
                : "Jika Admin sudah mengaktifkan 'Akses Guru Penuh', Anda bisa langsung menggunakan AI tanpa API Key pribadi."}
            </p>
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Tautan Penyedia AI:</span>
              <div className="flex flex-col gap-1">
                <a
                  href="https://platform.agnes-ai.com/settings/usage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                >
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">⚡ Agnes AI Platform (Token Plan & Usage)</span>
                  <ExternalLink className="w-3 h-3 text-emerald-500" />
                </a>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-600 text-xs font-semibold"
              >
                {formError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2.5 pt-2">
            <NeonButton type="button" variant="secondary" size="md" onClick={onClose} className="flex-1 justify-center">
              Batal
            </NeonButton>
            <NeonButton
              type="submit"
              variant="primary"
              color="brand"
              size="md"
              disabled={isSubmitting || !isDirty}
              className="flex-1 justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Simpan</span>
                </>
              )}
            </NeonButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AISettingsModal;
