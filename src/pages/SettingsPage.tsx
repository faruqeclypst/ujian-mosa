import { useState, useEffect, useRef } from "react";
import { useTenant } from "../context/TenantContext";
import { masterPb } from "../lib/pocketbase";
import { uploadInventoryImage } from "../lib/storage";
import { AI_MODELS, testAIConnection } from "../lib/ai";
import { Skeleton } from "../components/ui/skeleton";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import FormField from "../components/forms/FormField";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import {
  Upload,
  Save,
  Building,
  FolderOpen,
  Image as ImageIcon,
  Database,
  Download,
  FileJson,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Trash,
  Settings,
  Cpu,
  Monitor,
  HelpCircle,
  LayoutTemplate,
  Zap
} from "lucide-react";

const COLLECTIONS = [
  "users",
  "settings",
  "classes",
  "subjects",
  "teachers",
  "students",
  "exams",
  "questions",
  "exam_rooms",
  "attempts"
];

const SettingsPage = () => {
  const { pb, school, terminology } = useTenant();

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [groqApiKey, setGroqApiKey] = useState("");
  const [aiGatewayUrl, setAiGatewayUrl] = useState("");
  const [aiGatewayKey, setAiGatewayKey] = useState("");
  const [aiModel, setAiModel] = useState(AI_MODELS[0].id);
  const [aiProvider, setAiProvider] = useState("groq");

  const [remoteModels, setRemoteModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isExambroEnabled, setIsExambroEnabled] = useState(false);
  const [teacherFullAccess, setTeacherFullAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { addToast } = useToast();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryGroups, setGalleryGroups] = useState<{ title: string; images: string[] }[]>([]);

  // 📝 Backup States
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 📝 Question Types Management
  const [allowedTypes, setAllowedTypes] = useState<Record<string, boolean>>({
    pilihan_ganda: true,
    pilihan_ganda_kompleks: true,
    menjodohkan: true,
    benar_salah: true,
    isian_singkat: true,
    urutkan: true,
    drag_drop: true,
    uraian: true,
  });

  const questionTypes = [
    { id: "pilihan_ganda", label: "Pilihan Ganda (Single)" },
    { id: "pilihan_ganda_kompleks", label: "Pilihan Ganda Kompleks" },
    { id: "menjodohkan", label: "Menjodohkan (Matching)" },
    { id: "benar_salah", label: "Benar / Salah" },
    { id: "isian_singkat", label: "Isian Singkat" },
    { id: "urutkan", label: "Mengurutkan (Ordering)" },
    { id: "drag_drop", label: "Drag & Drop" },
    { id: "uraian", label: "Uraian / Essay" },
  ];

  const fetchSettings = async () => {
    if (!pb) return;
    try {
      setLoading(true);
      const records = await pb.collection("settings").getFullList({
        sort: "created",
        limit: 1
      });

      if (records.length > 0) {
        const data = records[0];
        setSettingsId(data.id);
        setSchoolName(data.name || "EXAM AA");
        setGroqApiKey(data.groq_api_key || "");
        setAiGatewayUrl(data.ai_gateway_url || "");
        setAiGatewayKey(data.ai_gateway_key || "");
        setAiModel(data.ai_model || AI_MODELS[0].id);
        setAiProvider(data.ai_provider || "groq");
        setIsExambroEnabled(data.is_exambro_enabled ?? false);
        setTeacherFullAccess(data.teacher_full_access || false);

        const logoUrl = data.logoUrl || data.logo || "";
        setSchoolLogo(logoUrl);
        setLogoPreview(logoUrl);

        if (data.allowed_types) setAllowedTypes(data.allowed_types);
        else if (data.allowed_question_types) setAllowedTypes(data.allowed_question_types);
      } else {
        setSchoolName("EXAM AA");
      }
    } catch (e) {
      console.error("Settings fetch err", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAI = async () => {
    const targetKey = aiProvider === "puter" ? "puter-no-key" : (aiProvider === "groq" ? groqApiKey : aiGatewayKey);
    if (!targetKey && aiProvider !== "puter") {
      addToast({ title: "Gagal", description: "Masukkan API Key terlebih dahulu.", type: "error" });
      return;
    }
    setIsTestingAI(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(pb!, targetKey, aiModel, aiGatewayUrl || "https://ollama.com", aiProvider);
      setTestResult(res);
      if (res.success) {
        addToast({ title: "Berhasil!", description: "Koneksi AI berjalan lancar.", type: "success" });
      } else {
        addToast({ title: "Gagal", description: res.message, type: "error" });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Terjadi kesalahan sistem." });
    } finally {
      setIsTestingAI(false);
    }
  };

  const loadGalleryImages = async () => {
    if (!pb) return;
    const userGroups: Record<string, Set<string>> = {
      "Gambar Admin / Sistem": new Set(),
    };

    try {
      const examToTeacher: Record<string, string> = {};
      const teacherMap: Record<string, string> = {};

      try {
        const [examsData, teachersData] = await Promise.all([
          pb.collection("exams").getFullList(),
          pb.collection("teachers").getFullList()
        ]);

        examsData.forEach(ex => {
          examToTeacher[ex.id] = ex.teacherId || ex.teacherid;
        });

        teachersData.forEach((t: any) => {
          teacherMap[t.id] = t.name;
        });
      } catch (e) {
        console.warn("Gagal mengambil mapping guru untuk galeri.");
      }

      const pRes = await pb.collection("questions").getList(1, 100, {
        filter: 'imageUrl != ""',
        sort: '-created'
      });
      const qRecords = pRes.items || [];

      const extractHtmlImages = (html: string, uploadName: string) => {
        if (!html || !html.includes("<img")) return;
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          doc.querySelectorAll("img").forEach(img => {
            const src = img.getAttribute("src");
            if (src && !src.startsWith("data:")) userGroups[uploadName].add(src);
          });
        } catch (e) { }
      };

      qRecords.forEach((q: any) => {
        let uploaderName = "Gambar Admin / Sistem";
        if (q.examId) {
          const tId = examToTeacher[q.examId];
          if (tId && teacherMap[tId]) {
            uploaderName = `Dari: ${teacherMap[tId]}`;
          }
        }
        if (!userGroups[uploaderName]) userGroups[uploaderName] = new Set();
        if (q.imageUrl) userGroups[uploaderName].add(q.imageUrl);
        extractHtmlImages(q.text, uploaderName);

        if (q.options) {
          Object.values(q.options).forEach((c: any) => {
            if (c.imageUrl) userGroups[uploaderName].add(c.imageUrl);
            extractHtmlImages(c.text, uploaderName);
          });
        }
        if (q.choices) {
          Object.values(q.choices).forEach((c: any) => {
            if (c.imageUrl) userGroups[uploaderName].add(c.imageUrl);
            extractHtmlImages(c.text, uploaderName);
          });
        }
      });
    } catch (e) { console.error("Gallery err", e); }

    const arr: { title: string; images: string[] }[] = Object.keys(userGroups)
      .map(key => ({ title: key, images: Array.from(userGroups[key]) }))
      .filter(g => g.images.length > 0);

    setGalleryGroups(arr);
  };

  const handlePickGallery = (url: string) => {
    setLogoPreview(url);
    setSchoolLogo(url);
    setLogoFile(null);
    setIsGalleryOpen(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (aiProvider === "groq" || aiProvider === "ollama" || aiProvider === "puter") {
      const availableModels = AI_MODELS.filter((m: any) => m.provider === aiProvider);
      setRemoteModels(availableModels);
      if (!availableModels.some(m => m.id === aiModel) && availableModels.length > 0) {
        setAiModel(availableModels[0].id);
      }
      return;
    }

    if (aiProvider === "custom") {
      setRemoteModels([]); // allow typing
      return;
    }

    // 🚀 ANTI-CORS: Jangan panggil fetch langsung untuk provider yang memblokir Browser (CORS)
    const corsRestricted = ["cloudflare", "google", "huggingface", "github"];
    if (corsRestricted.includes(aiProvider)) {
      const fallback = AI_MODELS.filter((m: any) => m.provider === aiProvider);
      setRemoteModels(fallback);
      if (!fallback.some(m => m.id === aiModel) && fallback.length > 0) {
        setAiModel(fallback[0].id);
      }
      return;
    }

    const key = aiProvider === "groq" ? groqApiKey : aiGatewayKey;
    if (!key) {
      setRemoteModels([]);
      return;
    }

    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        let baseUrl = "";
        switch (aiProvider) {
          case "google": baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai"; break;
          case "openrouter": baseUrl = "https://openrouter.ai/api/v1"; break;
          case "together": baseUrl = "https://api.together.xyz/v1"; break;
          case "huggingface": baseUrl = "https://api-inference.huggingface.co/v1"; break;
          case "fireworks": baseUrl = "https://api.fireworks.ai/inference/v1"; break;
          case "github": baseUrl = "https://models.inference.ai.azure.com"; break;
          case "cloudflare":
            if (!aiGatewayUrl) { setIsLoadingModels(false); return; }
            baseUrl = `https://api.cloudflare.com/client/v4/accounts/${aiGatewayUrl}/ai/v1`;
            break;
        }

        if (!baseUrl) {
          setIsLoadingModels(false); return;
        }

        const res = await fetch(`${baseUrl}/models`, {
          headers: {
            "Authorization": `Bearer ${key}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          const items = data.data || data.models || data;
          if (Array.isArray(items)) {
            const models = items.map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
              speed: "Remote API",
              provider: aiProvider
            }));
            models.sort((a: any, b: any) => a.name.localeCompare(b.name));
            setRemoteModels(models);

            if (!models.find((m: any) => m.id === aiModel) && models.length > 0) {
              setAiModel(models[0].id);
            }
          }
        } else {
          // Silent fallback for 401/403/CORS
          const fallback = AI_MODELS.filter((m: any) => m.provider === aiProvider);
          if (fallback.length > 0) setRemoteModels(fallback);
        }
      } catch (err) {
        // Suppress console error for expected CORS blocks on local dev
        const fallback = AI_MODELS.filter((m: any) => m.provider === aiProvider);
        setRemoteModels(fallback);

        if (!fallback.find((m: any) => m.id === aiModel) && fallback.length > 0) {
          setAiModel(fallback[0].id);
        }
      } finally {
        setIsLoadingModels(false);
      }
    };

    const timeout = setTimeout(fetchModels, 800);
    return () => clearTimeout(timeout);
  }, [aiProvider, aiGatewayKey, groqApiKey, aiGatewayUrl, loading]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      addToast({ title: "Gagal", description: "Nama sekolah tidak boleh kosong.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      let finalLogoUrl = schoolLogo;

      if (logoFile) {
        try {
          const schoolFolder = school?.slug || "unknown";
          const uploadRes = await uploadInventoryImage(`schools/${schoolFolder}/identity`, logoFile);
          if (uploadRes && uploadRes.url) {
            finalLogoUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.error("Cloudflare Upload Error:", uploadErr);
          addToast({ title: "Gagal Upload", description: "Gagal mengunggah logo ke Cloudflare.", type: "error" });
          setSaving(false);
          return;
        }
      }

      if (finalLogoUrl.startsWith("data:")) {
        addToast({ title: "Gagal Simpan", description: "Format gambar tidak didukung (DataURL).", type: "error" });
        setSaving(false);
        return;
      }

      const payload: any = {
        name: schoolName || "EXAM AA",
        logo: finalLogoUrl || "",
        logoUrl: finalLogoUrl || "",
        allowed_types: allowedTypes || {},
        groq_api_key: groqApiKey || "",
        ai_gateway_url: aiGatewayUrl || "",
        ai_gateway_key: aiGatewayKey || "",
        ai_model: aiModel || "llama-3.3-70b-versatile",
        ai_provider: aiProvider || "groq",
        aiProvider: aiProvider || "groq",
        is_exambro_enabled: !!isExambroEnabled,
        teacher_full_access: !!teacherFullAccess,
        isExambroEnabled: !!isExambroEnabled,
        teacherFullAccess: !!teacherFullAccess,
        aiModel: aiModel || "llama-3.3-70b-versatile"
      };

      if (!pb) return;

      const isCreate = !settingsId;

      if (!isCreate) {
        await pb.collection("settings").update(settingsId, payload);
      } else {
        const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
        const createPayload = {
          ...payload,
          universal_token: randomToken,
          universal_token_updated_at: new Date().toISOString()
        };
        const created = await pb.collection("settings").create(createPayload);
        setSettingsId(created.id);
      }

      // 🔄 SYNC TO MASTER REGISTRY (SaaS SaaS Multi-Tenant Support)
      const currentSlug = school?.slug || window.location.hostname.split('.')[0];
      if (currentSlug && currentSlug !== 'localhost' && currentSlug !== 'ujian') {
        try {
          console.log("Attempting sync to Master Registry for slug:", currentSlug);
          const masterRecords = await masterPb.collection("schools").getList(1, 1, {
            filter: `slug ~ "${currentSlug}"` // Use ~ for flexible matching
          });

          if (masterRecords.items.length > 0) {
            const masterId = masterRecords.items[0].id;
            await masterPb.collection("schools").update(masterId, {
              name: schoolName,
              logo_url: finalLogoUrl
            });
            console.log("Master Registry synced successfully for ID:", masterId);
            addToast({
              title: "Branding Disinkronkan",
              description: "Logo di halaman pilih sekolah telah diperbarui.",
              type: "success"
            });
          } else {
            console.warn("School not found in Master Registry for slug:", currentSlug);
          }
        } catch (syncErr: any) {
          console.error("Failed to sync to Master Registry:", syncErr);
          addToast({
            title: "Sinkronisasi Superadmin Gagal",
            description: `Error: ${syncErr.message}. Pastikan API Rules 'schools' sudah benar.`,
            type: "error"
          });
        }
      }

      setSchoolLogo(finalLogoUrl);
      setLogoFile(null);
      addToast({ title: "Berhasil!", description: "Pengaturan berhasil diperbarui.", type: "success" });
      fetchSettings();
    } catch (err: any) {
      console.error("Save settings err", err);
      if (err?.status === 404) {
        addToast({
          title: "Akses Ditolak (404)",
          description: "Gagal menyimpan. Pastikan API Rules 'Update' & 'Create' koleksi 'settings' diset dengan benar.",
          type: "error"
        });
      } else {
        addToast({ title: "Gagal", description: "Terjadi kesalahan saat menyimpan.", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLogo = () => {
    setSchoolLogo("");
    setLogoPreview(null);
    setLogoFile(null);
    addToast({ title: "Logo Dihapus", description: "Logo akan dihapus permanen setelah Klik Simpan.", type: "info" });
  };

  // 🚀 Backup Logic
  const handleExportDB = async () => {
    if (!pb) return;
    setIsBackupLoading(true);
    try {
      const backupData: Record<string, any[]> = {};

      for (const collectionName of COLLECTIONS) {
        try {
          const records = await pb.collection(collectionName).getFullList();
          const cleanedRecords = records.map(record => {
            const r = { ...record };
            if (collectionName === "settings") {
              delete (r as any).universal_token;
              delete (r as any).universal_token_updated_at;
            }
            return r;
          });
          backupData[collectionName] = cleanedRecords;
        } catch (e) {
          console.warn(`Export skipping ${collectionName}:`, e);
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_eujian_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast({ title: "Ekspor Berhasil", description: "Data berhasil diunduh.", type: "success" });
    } catch (err: any) {
      addToast({ title: "Gagal Ekspor", description: err.message, type: "error" });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setIsImportConfirmOpen(true);
    }
  };

  const executeImport = async () => {
    if (!importFile || !pb) return;
    setIsBackupLoading(true);
    setImportProgress(0);
    setImportStatus("Membaca File...");

    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      const totalCollections = Object.keys(data).length;
      let processed = 0;

      for (const collectionName of COLLECTIONS) {
        if (!data[collectionName]) continue;

        setImportStatus(`Mengimpor: ${collectionName}...`);
        const records = data[collectionName];

        for (const recordData of records) {
          const {
            id, created, updated,
            collectionId, collectionName: _unusedName, expand,
            ...cleanData
          } = recordData;

          Object.keys(cleanData).forEach(key => {
            if (key.startsWith("@")) delete (cleanData as any)[key];
          });

          try {
            try {
              await pb.collection(collectionName).update(id, cleanData);
            } catch (e: any) {
              if (e.status === 404) {
                const createData: any = { id, ...cleanData };

                const isAuthCollection = ["students", "users"].includes(collectionName);
                if (isAuthCollection) {
                  const defaultPass = "12345678";
                  createData.password = defaultPass;
                  createData.passwordConfirm = defaultPass;
                }

                await pb.collection(collectionName).create(createData);
              } else {
                throw e;
              }
            }
          } catch (e: any) {
            console.error(`Gagal impor record ${id} di ${collectionName}`);
          }
        }

        processed++;
        setImportProgress(Math.round((processed / totalCollections) * 100));
      }

      setImportStatus("Selesai!");
      addToast({ title: "Impor Berhasil", description: "Semua data telah dipulihkan.", type: "success" });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      addToast({ title: "Gagal Impor", description: "File tidak valid atau rusak.", type: "error" });
    } finally {
      setIsBackupLoading(false);
      setIsImportConfirmOpen(false);
      setImportFile(null);
    }
  };

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");

  const handleResetDB = async () => {
    if (!pb) return;
    if (resetInput !== "RESET") {
      addToast({ title: "Gagal", description: "Kata konfirmasi salah.", type: "error" });
      return;
    }

    setIsBackupLoading(true);
    setImportProgress(0);
    setImportStatus("Mulai Pembersihan...");

    try {
      const REVERSE_COLLECTIONS = [...COLLECTIONS].reverse();
      const totalCollections = REVERSE_COLLECTIONS.length;
      let processed = 0;

      for (const colName of REVERSE_COLLECTIONS) {
        setImportStatus(`Membersihkan: ${colName}...`);

        const records = await pb.collection(colName).getFullList({ fields: 'id' });

        for (const r of records) {
          const currentAdminId = pb.authStore.model?.id;
          if (colName === "users" && r.id === currentAdminId) continue;

          try {
            await pb.collection(colName).delete(r.id);
          } catch (e) {
            console.warn(`Gagal hapus ${r.id} di ${colName}`);
          }
        }

        processed++;
        setImportProgress(Math.round((processed / totalCollections) * 100));
      }

      setImportStatus("Selesai!");
      addToast({ title: "Berhasil!", description: "Seluruh data telah dihapus.", type: "success" });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      addToast({ title: "Gagal Reset", description: err.message, type: "error" });
    } finally {
      setIsBackupLoading(false);
      setIsResetConfirmOpen(false);
      setResetInput("");
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto animate-in fade-in duration-500">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
            <Settings size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Pengaturan Sistem
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola branding institusi, konfigurasi server, dan pencadangan.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0">
          {loading ? (
            <Skeleton className="h-10 w-40 rounded-xl" />
          ) : (
            <Button
              form="settings-form"
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm shadow-blue-500/20 h-10 px-5 transition-all active:scale-95"
            >
              {saving ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Simpan Pengaturan</>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left Column: Form & Tools ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Building size={14} /> Profil Institusi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form id="settings-form" onSubmit={handleSave} className="space-y-6">

                {/* Logo & Name */}
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="w-full sm:w-24 group relative">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1.5 block">Logo</label>
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto sm:mx-0">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon size={24} className="text-slate-400" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Upload size={16} className="text-white" />
                      </div>
                      <input
                        id="logoInput"
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleLogoChange}
                        title="Upload Logo"
                      />
                    </div>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={handleDeleteLogo}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold block mt-2 text-center w-24"
                      >
                        Hapus Logo
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <FormField id="schoolName" label={`Nama ${terminology.school} / Institusi Utama`} error={undefined}>
                      <Input
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder={`Contoh: ${terminology.school} Maju Bersama`}
                        className="rounded-xl font-semibold h-11 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </FormField>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPickerOpen(true)}
                        className="px-4 py-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-slate-200 hover:bg-blue-100 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                      >
                        <FolderOpen size={14} /> Pilih dari Galeri Server
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 text-orange-600 dark:text-orange-500">
                        <Monitor size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">Wajib Exambro</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight pr-4">Blokir browser biasa, wajib pakai aplikasi resmi.</p>
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full shrink-0" />
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" className="sr-only peer" checked={isExambroEnabled} onChange={(e) => setIsExambroEnabled(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-500">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">Akses {terminology.teacher} Penuh</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight pr-4">{terminology.teacher} bisa buat ruang dan reset ujian {terminology.student.toLowerCase()} secara mandiri.</p>
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full shrink-0" />
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" className="sr-only peer" checked={teacherFullAccess} onChange={(e) => setTeacherFullAccess(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    )}
                  </div>
                </div>

                {/* ── AI Engine Config ── */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-indigo-500" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">API Gen-AI Engine</h4>
                    </div>
                    <div className="w-full sm:w-64">
                      <select
                        value={aiProvider}
                        onChange={(e) => {
                          setAiProvider(e.target.value);
                          setAiModel("");
                        }}
                        className="w-full h-9 px-3 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                      >
                        <option value="groq">Groq Cloud</option>
                        <option value="ollama">Ollama (Local / Proxy)</option>
                        <option value="ollama">Ollama (Local / Proxy)</option>
                        <option value="google">Google AI Studio (Gemini)</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="together">Together AI</option>
                        <option value="huggingface">Hugging Face (Serverless)</option>
                        <option value="fireworks">Fireworks AI</option>
                        <option value="github">GitHub Models</option>
                        <option value="cloudflare">Cloudflare Workers AI</option>
                        <option value="custom">Custom Endpoint (Lainnya)</option>
                        <option value="puter">Puter (Gratis, tanpa API Key, limit terbatas)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(aiProvider === "custom" || aiProvider === "cloudflare") && (
                      <div className="sm:col-span-2">
                        <FormField id="aiGatewayUrl" label={aiProvider === "cloudflare" ? "Cloudflare Account ID" : "Base URL (OpenAI Compatible)"} error={undefined}>
                          <Input
                            type="text"
                            value={aiGatewayUrl}
                            onChange={(e) => setAiGatewayUrl(e.target.value)}
                            placeholder={aiProvider === "cloudflare" ? "Masukkan Account ID Cloudflare..." : "Contoh: https://openrouter.ai/api/v1"}
                            className="rounded-xl h-11 text-xs font-mono bg-white dark:bg-slate-900"
                          />
                        </FormField>
                      </div>
                    )}

                    <FormField id="apiKey" label={aiProvider === "groq" ? "Kunci API Groq" : "API Key"} error={undefined}>
                      <Input
                        type="password"
                        value={aiProvider === "groq" ? groqApiKey : aiGatewayKey}
                        onChange={(e) => aiProvider === "groq" ? setGroqApiKey(e.target.value) : setAiGatewayKey(e.target.value)}
                        placeholder={aiProvider === "groq" ? "gsk_xxxxxxx" : "API Key..."}
                        className="rounded-xl h-11 text-xs font-mono"
                      />
                    </FormField>

                    <FormField id="aiModel" label={isLoadingModels ? "Memuat Model..." : "Model Kecerdasan (LLM)"} error={undefined}>
                      <div className="relative">
                        {remoteModels.length > 0 && aiProvider !== "custom" ? (
                          <select
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                            disabled={isLoadingModels}
                          >
                            <optgroup label={`Model ${aiProvider.toUpperCase()}`}>
                              {remoteModels.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.name} {m.speed && `(${m.speed})`}{m.dailyLimit ? ` [${m.dailyLimit}]` : ''}</option>
                              ))}
                            </optgroup>
                          </select>
                        ) : (
                          <Input
                            type="text"
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            placeholder={isLoadingModels ? "Mencari model..." : aiProvider === "custom" ? "Masukkan ID model..." : "Ketik ID Model secara manual"}
                            className="rounded-xl h-11 text-xs font-bold"
                          />
                        )}
                      </div>
                    </FormField>

                    <div className="sm:col-span-2 pt-1 flex justify-end">
                      <Button
                        type="button" onClick={handleTestAI} disabled={isTestingAI || (aiProvider === "puter" ? false : (aiProvider === "groq" ? !groqApiKey : !aiGatewayKey))}
                        variant="outline"
                        className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {isTestingAI ? <RefreshCw size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                        Pinging Server
                      </Button>
                    </div>
                  </div>

                  {/* Test Results Message */}
                  {testResult && (
                    <div className={cn("mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2", testResult.success ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800")}>
                      {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <LayoutTemplate size={14} /> Kustomisasi Soal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {questionTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{type.label}</span>
                    {loading ? (
                      <Skeleton className="h-5 w-9 rounded-full" />
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox" className="sr-only peer"
                          checked={allowedTypes[type.id] || false}
                          onChange={(e) => setAllowedTypes(prev => ({ ...prev, [type.id]: e.target.checked }))}
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Danger Zone & Theme ── */}
        <div className="space-y-6">
          <Card className="rounded-2xl border border-slate-200 dark:border-indigo-500/20 shadow-sm bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-950/80 dark:to-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
              <Database size={80} />
            </div>
            <CardHeader className="p-5 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-50 dark:text-indigo-200">
                <Database size={16} /> Manajemen Database
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 relative z-10 space-y-4">
              <p className="text-[11px] font-medium text-indigo-100 dark:text-slate-300 leading-relaxed bg-white/10 dark:bg-slate-800/80 p-3 rounded-xl border border-transparent dark:border-slate-700/50">
                Amankan data di akhir semester dengan melakukan pencadangan JSON dan hapus riwayat secara total untuk meringankan performa.
              </p>

              <div className="flex flex-col gap-2.5">
                {loading ? (
                  <>
                    <Skeleton className="h-10 w-full rounded-xl bg-white/20 dark:bg-slate-800" />
                    <Skeleton className="h-10 w-full rounded-xl bg-white/20 dark:bg-slate-800" />
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleExportDB} disabled={isBackupLoading}
                      className="w-full bg-white/10 hover:bg-white/20 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/40 dark:text-indigo-300 text-white font-bold text-xs h-10 rounded-xl transition-all"
                    >
                      {isBackupLoading ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />}
                      Eksport File Backup (.json)
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()} disabled={isBackupLoading}
                      className="w-full bg-white text-indigo-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700 dark:hover:text-blue-300 dark:border dark:border-slate-700 font-bold text-xs h-10 rounded-xl shadow-lg dark:shadow-none transition-all"
                    >
                      <Upload size={14} className="mr-2" /> Restore Database
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleImportDB} accept=".json" className="hidden" />
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-white/20 mt-2">
                <button
                  disabled={isBackupLoading} onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-all text-center border-b-4 border-rose-700 active:border-b-0 active:translate-y-1"
                >
                  Hapus Seluruh Data
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ImageIcon size={14} /> Preferensi Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">Mode Gelap</span>
                  <span className="text-[10px] font-medium text-slate-400">Sinkron dengan sistem Anda</span>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          {/* ── Active AI Status Card ── */}
          {!loading && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">AI Aktif Sekarang</span>
              </div>
              <div className="p-4 space-y-3">
                {/* Provider */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider</span>
                  <span className={cn(
                    "text-[10px] font-black px-2.5 py-1 rounded-full",
                    aiProvider === "groq" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                      aiProvider === "cloudflare" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        aiProvider === "google" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          aiProvider === "openrouter" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                            aiProvider === "ollama" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}>
                    {{
                      groq: "⚡ Groq Cloud",
                      cloudflare: "☁️ Cloudflare AI",
                      google: "🔵 Google Gemini",
                      openrouter: "🔀 OpenRouter",
                      together: "🤝 Together AI",
                      huggingface: "🤗 Hugging Face",
                      fireworks: "🎆 Fireworks AI",
                      github: "🐙 GitHub Models",
                      ollama: "🦙 Ollama (Local)",
                      custom: "⚙️ Custom Endpoint",
                    }[aiProvider] || aiProvider}
                  </span>
                </div>

                {/* Model */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mt-0.5">Model</span>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-right font-mono break-all leading-tight">{
                    aiModel
                      ? (AI_MODELS.find(m => m.id === aiModel)?.name || aiModel)
                      : <span className="text-slate-400 italic">Belum dipilih</span>
                  }</span>
                </div>

                {/* Mode */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode</span>
                  {aiProvider === "groq" ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
                      <Zap size={9} /> Direct API
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center gap-1">
                      🔒 Via Proxy
                    </span>
                  )}
                </div>

                {/* Speed badge if model found */}
                {AI_MODELS.find(m => m.id === aiModel)?.speed && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kecepatan</span>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      {AI_MODELS.find(m => m.id === aiModel)?.speed}
                    </span>
                  </div>
                )}
                {/* Daily limit info for Groq models */}
                {(AI_MODELS.find(m => m.id === aiModel) as any)?.dailyLimit && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kuota Harian</span>
                    <span className={`text-[10px] font-bold ${(AI_MODELS.find(m => m.id === aiModel) as any)?.dailyLimit?.includes('⚠️') ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {(AI_MODELS.find(m => m.id === aiModel) as any)?.dailyLimit}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex gap-3 text-blue-800 dark:text-blue-300">
            <HelpCircle size={16} className="shrink-0 mt-0.5 opacity-70" />
            <p className="text-[11px] font-medium leading-relaxed">
              Gunakan tab 'Panduan' untuk dokumentasi penggunaan lengkap. Segala modifikasi pada panel ini langsung berdampak seluas aplikasi institusi Anda.
            </p>
          </div>
        </div>
      </div>

      {/* ── Dialog Modals ── */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-sm rounded-[2rem] p-5 border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
          <DialogTitle className="text-lg font-bold text-center mb-4">Pilih Sumber Logo</DialogTitle>
          <DialogDescription className="sr-only">Choose logo source</DialogDescription>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={() => { setIsPickerOpen(false); document.getElementById("logoInput")?.click(); }}
              className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Upload size={24} className="mb-3 text-indigo-500" />
              <span className="text-xs font-bold text-center">Buka Browser<br />File Sistem</span>
            </button>
            <button
              type="button" onClick={() => { setIsPickerOpen(false); setIsGalleryOpen(true); loadGalleryImages(); }}
              className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <FolderOpen size={24} className="mb-3 text-blue-500" />
              <span className="text-xs font-bold text-center">Cloud Galeri<br />EXAM AA</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FolderOpen size={16} className="text-blue-500" /> Galeri Gambar Server
            </DialogTitle>
            <DialogDescription className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">Gambar dari koleksi soal-soal di server Anda.</DialogDescription>
          </div>
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-8">
            {galleryGroups.length === 0 ? (
              <div className="text-center py-10 font-bold text-slate-400 text-xs">Belum ada media gambar tersimpan di server.</div>
            ) : (
              galleryGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-4">
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-500 pl-2 border-l-2 border-indigo-500 flex items-center gap-2">
                    {group.title} <span className="text-slate-400 font-medium">({group.images.length})</span>
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {group.images.map((src, idx) => (
                      <div key={idx} className="aspect-square bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer group relative shadow-sm" onClick={() => handlePickGallery(src)}>
                        <img src={src} className="w-full h-full object-contain p-2" alt="Media" />
                        <div className="absolute inset-0 bg-blue-600/90 items-center justify-center hidden group-hover:flex transition-all">
                          <span className="text-white text-[10px] font-black tracking-widest uppercase">Pilih</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportConfirmOpen} onOpenChange={(val) => { if (!isBackupLoading) setIsImportConfirmOpen(val); }}>
        <DialogContent className="z-[100] max-w-sm rounded-[2rem] p-6 text-center border-0 shadow-2xl bg-white dark:bg-slate-900">
          <DialogDescription className="sr-only">Konfirmasi pemulihan database dari file JSON.</DialogDescription>
          <div className="flex flex-col items-center gap-4">
            {isBackupLoading ? (
              <div className="h-16 w-16 mb-2 rounded-full border-[3px] border-blue-100 dark:border-blue-900 border-t-blue-600 animate-spin" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center mb-2">
                <FileJson size={32} />
              </div>
            )}
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isBackupLoading ? "Memulihkan..." : "Impor Backup"}
            </DialogTitle>

            {!isBackupLoading ? (
              <>
                <p className="text-xs text-slate-500 font-medium">Lanjutkan pemulihan dari file <b>{importFile?.name}</b>?</p>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 w-full text-left flex gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">Data dengan ID serupa akan langsung ditimpa permanen.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <Button variant="outline" onClick={() => { setIsImportConfirmOpen(false); setImportFile(null); }} className="rounded-xl h-10 text-xs font-bold">Batal</Button>
                  <Button onClick={executeImport} className="bg-blue-600 text-white rounded-xl h-10 text-xs font-bold shadow-md">Lanjutkan</Button>
                </div>
              </>
            ) : (
              <div className="w-full pt-2">
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-slate-500">{importProgress}% • {importStatus}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetConfirmOpen} onOpenChange={(val) => { if (!isBackupLoading) setIsResetConfirmOpen(val); }}>
        <DialogContent className="z-[100] max-w-sm rounded-[2rem] p-6 text-center border-0 shadow-2xl bg-white dark:bg-slate-900">
          <DialogDescription className="sr-only">Tindakan berbahaya untuk menghapus seluruh data database.</DialogDescription>
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center mb-2 animate-bounce-slow">
              <AlertTriangle size={32} />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Format Sistem</DialogTitle>

            {isBackupLoading ? (
              <div className="w-full pt-2">
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-red-500">{importProgress}% • {importStatus}</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Tindakan fatal: <b>Seluruh records</b> (siswa, ujian, nilai) akan dihapus, menyisakan akun login Anda.</p>
                <div className="w-full text-left mt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Ketik "RESET" di bawah</label>
                  <Input
                    value={resetInput} onChange={(e) => setResetInput(e.target.value.toUpperCase())}
                    className="text-center font-bold text-red-600 h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border-red-200 dark:border-red-900 focus:border-red-500 focus:ring-red-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <Button variant="outline" onClick={() => { setIsResetConfirmOpen(false); setResetInput(""); }} className="rounded-xl h-11 text-xs font-bold">Urungkan</Button>
                  <Button onClick={handleResetDB} disabled={resetInput !== "RESET"} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 text-xs font-bold shadow-md">Hapus</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
