import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { masterPb } from "../lib/pocketbase";
import { uploadInventoryImage, deleteImageFromStorage, isOfflineEnvironment } from "../lib/storage";
import { compressImage } from "../lib/imageCompression";
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
import { APP_VERSION } from "../utils/version";
import {
  NeonPageHeader,
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorCard,
  NeonTabs,
  NeonBadge,
  NeonCard,
  NeonCardHeader,
  NeonCardBody,
  NeonSwitch,
} from "../components/ui";
import { SharedGalleryModal } from "../components/dialogs/SharedGalleryModal";
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
  Zap,
  Globe,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  Server,
  Activity,
  ArrowRight,
  RotateCw,
  GitBranch,
  CheckSquare,
  ArrowLeftRight,
  GripVertical,
  Layers,
  LayoutGrid,
  FileText,
  FileCheck,
  BookOpen,
  Terminal,
  Eye,
  EyeOff,
} from "lucide-react";
import { forceHardReload } from "../utils/hardReload";
import { getSchoolDomain, getSchoolUrl } from "../utils/domainHelper";
import { ExambroGuideModal } from "../components/dialogs/ExambroGuideModal";

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
  const navigate = useNavigate();
  const { pb, school, terminology, loading: tenantLoading } = useTenant();

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
  const [isExambroGuideOpen, setIsExambroGuideOpen] = useState(false);
  const [teacherFullAccess, setTeacherFullAccess] = useState(false);
  const [teacherAIAccess, setTeacherAIAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
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

  // 🌐 Custom Domain & DNS Copy States
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDnsGuide, setShowDnsGuide] = useState(false);
  const SERVER_IP = "64.235.41.108";
  const isHighestPlan = school?.plan === "ultimate" || school?.plan === "premium" || school?.plan === "Paket Premium" || Boolean(school?.custom_domain);

  const getDnsHostName = (domain?: string): string => {
    if (!domain) return "@";
    const clean = domain.trim().toLowerCase();
    const parts = clean.split(".");
    const twoLevelTlds = [".sch.id", ".ac.id", ".go.id", ".my.id", ".co.id", ".or.id", ".ponpes.id"];
    const hasTwoLevelTld = twoLevelTlds.some(tld => clean.endsWith(tld));

    if (hasTwoLevelTld) {
      if (parts.length > 3) {
        return parts.slice(0, parts.length - 3).join(".");
      }
      return "@";
    }

    if (parts.length > 2) {
      return parts.slice(0, parts.length - 2).join(".");
    }
    return "@";
  };

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    addToast({ title: "Tersalin!", description: `${text} berhasil disalin ke clipboard.`, type: "success" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
    klasifikasi: true,
    hotspot: true,
    isian_rumpang: true,
    matriks: true,
  });

  // 🔄 Offline 1-Click Update States
  const isOfflineServer = school?.plan === "offline" || school?.id === "local_server" || school?.slug === "local" || isOfflineEnvironment();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; release_date?: string; notes?: string } | null>(null);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      let data: any = null;
      let hasUpdate = false;
      let currentVer = APP_VERSION;

      if (pb) {
        try {
          const res = await pb.send("/api/offline-update-check", { method: "GET" });
          if (res?.ok) {
            data = res.data;
            hasUpdate = Boolean(res.has_update);
            if (res.current_version) currentVer = res.current_version;
          }
        } catch {
          // fallback to fetch directly
        }
      }
      if (!data) {
        const res = await fetch("https://examku.my.id/downloads/version.json", { cache: "no-store" });
        if (res.ok) {
          data = await res.json();
          if (data && data.version && data.version !== currentVer) {
            hasUpdate = true;
          }
        }
      }

      if (data && data.version && hasUpdate) {
        setUpdateAvailable(data);
        addToast({
          title: "Pembaruan Tersedia!",
          description: `Versi terbaru v${data.version} (${data.release_date || "Terbaru"}) siap dipasang.`,
          type: "info"
        });
      } else if (data && data.version) {
        setUpdateAvailable(null);
        setIsReloading(true);
        addToast({
          title: "Sistem Mutakhir",
          description: `Aplikasi CBT Anda sudah menggunakan versi mutakhir (v${currentVer}). Menyegarkan halaman & cache...`,
          type: "success"
        });
        setTimeout(async () => {
          await forceHardReload();
        }, 1000);
      } else {
        throw new Error("Gagal mengambil data versi dari server pusat.");
      }
    } catch (err: any) {
      addToast({
        title: "Pemeriksaan Gagal",
        description: "Tidak dapat menghubungi server pusat. Pastikan laptop terhubung internet.",
        type: "error"
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!pb) {
      addToast({ title: "Koneksi Database Tidak Siap", type: "error" });
      return;
    }
    setIsApplyingUpdate(true);
    try {
      const res = await pb.send("/api/offline-update-apply", { method: "POST" });
      if (res?.ok || res?.message) {
        setIsReloading(true);
        addToast({
          title: "Pembaruan Berhasil!",
          description: "Sistem telah diperbarui. Memuat ulang halaman & membersihkan cache...",
          type: "success"
        });
        setTimeout(async () => {
          await forceHardReload();
        }, 1200);
      } else {
        throw new Error(res?.error || "Gagal menerapkan pembaruan.");
      }
    } catch (err: any) {
      addToast({
        title: "Gagal Memperbarui",
        description: err.message || "Pastikan komputer terhubung ke internet saat proses pembaruan.",
        type: "error"
      });
      setIsApplyingUpdate(false);
    }
  };


  const questionTypes = [
    {
      id: "pilihan_ganda",
      label: "Pilihan Ganda (Single)",
      description: "1 pilihan jawaban benar dari opsi A-E",
      category: "Obyektif",
      icon: CheckCircle2,
    },
    {
      id: "pilihan_ganda_kompleks",
      label: "Pilihan Ganda Kompleks",
      description: "Siswa dapat memilih lebih dari satu jawaban benar",
      category: "Obyektif",
      icon: CheckSquare,
    },
    {
      id: "menjodohkan",
      label: "Menjodohkan (Matching)",
      description: "Menghubungkan premis ke pasangan respons yang cocok",
      category: "Interaktif",
      icon: ArrowLeftRight,
    },
    {
      id: "benar_salah",
      label: "Benar / Salah",
      description: "Pernyataan validasi dengan pilihan Benar atau Salah",
      category: "Obyektif",
      icon: Check,
    },
    {
      id: "isian_singkat",
      label: "Isian Singkat",
      description: "Jawaban kata/angka pendek dengan koreksi teks otomatis",
      category: "Tekstual",
      icon: FileText,
    },
    {
      id: "urutkan",
      label: "Mengurutkan (Ordering)",
      description: "Menyusun urutan atau kronologi langkah yang benar",
      category: "Interaktif",
      icon: GripVertical,
    },
    {
      id: "drag_drop",
      label: "Drag & Drop",
      description: "Memindahkan kartu elemen ke zona klasifikasi target",
      category: "Interaktif",
      icon: Layers,
    },
    {
      id: "uraian",
      label: "Uraian / Essay",
      description: "Jawaban narasi bebas dinilai manual atau rubrik AI",
      category: "Tekstual",
      icon: BookOpen,
    },
    {
      id: "klasifikasi",
      label: "Klasifikasi",
      description: "Mengelompokkan opsi ke wadah kategori yang ditentukan",
      category: "Interaktif",
      icon: LayoutGrid,
    },
    {
      id: "hotspot",
      label: "Hotspot Gambar",
      description: "Memilih area koordinat tertentu pada gambar stimulus",
      category: "Visual",
      icon: ImageIcon,
    },
    {
      id: "isian_rumpang",
      label: "Isian Rumpang",
      description: "Melengkapi kata atau frasa yang hilang di tengah kalimat",
      category: "Tekstual",
      icon: FileCheck,
    },
    {
      id: "matriks",
      label: "Matriks Grid",
      description: "Tabel penilaian silang baris kriteria dan kolom opsi",
      category: "Obyektif",
      icon: LayoutGrid,
    },
  ];

  const activeQuestionTypesCount = questionTypes.filter(t => allowedTypes[t.id] !== false).length;

  const handleSelectAllTypes = () => {
    const all: Record<string, boolean> = {};
    questionTypes.forEach(t => {
      all[t.id] = true;
    });
    setAllowedTypes(all);
  };

  const handleResetMinimumTypes = () => {
    const min: Record<string, boolean> = {};
    questionTypes.forEach(t => {
      min[t.id] = (t.id === "pilihan_ganda" || t.id === "uraian");
    });
    setAllowedTypes(min);
  };

  const fetchSettings = useCallback(async () => {
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
        // Jika name belum pernah diubah dari default, pakai nama dari registry
        const savedName = data.name || "";
        setSchoolName(savedName && savedName !== "EXAMKU" ? savedName : (school?.name || "EXAMKU"));
        setGroqApiKey(data.groq_api_key || "");
        setAiGatewayUrl(data.ai_gateway_url || "");
        setAiGatewayKey(data.ai_gateway_key || "");
        setAiModel(data.ai_model || AI_MODELS[0].id);
        setAiProvider(data.ai_provider || "groq");
        setIsExambroEnabled(data.is_exambro_enabled ?? false);
        setTeacherFullAccess(data.teacher_full_access || false);
        setTeacherAIAccess(data.teacher_ai_access ?? false);

        const logoUrl = data.logoUrl || data.logo || "";
        setSchoolLogo(logoUrl);
        setLogoPreview(logoUrl);

        if (data.allowed_types) setAllowedTypes(prev => ({ ...prev, ...data.allowed_types }));
        else if (data.allowed_question_types) setAllowedTypes(prev => ({ ...prev, ...data.allowed_question_types }));
      } else {
        // Tenant baru: belum ada record settings, pakai nama dari registry
        setSchoolName(school?.name || "EXAMKU");
      }
    } catch (e: any) {
      console.error("Settings fetch err", e);
    } finally {
      setLoading(false);
    }
  }, [pb, school?.name]);

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

  const handleLoadModels = async () => {
    if (!aiGatewayUrl?.trim()) {
      addToast({ title: "Gagal", description: "Isi Base URL terlebih dahulu.", type: "error" });
      return;
    }
    if (!aiGatewayKey?.trim()) {
      addToast({ title: "Gagal", description: "Isi API Key terlebih dahulu.", type: "error" });
      return;
    }
    setIsLoadingModels(true);
    try {
      let baseUrl = aiGatewayUrl.trim().replace(/\/$/, "");
      baseUrl = baseUrl.replace(/\/chat\/completions$/, "");
      const modelsUrl = `${baseUrl}/models`;

      // Gunakan PocketBase proxy untuk menghindari CORS
      const proxyUrl = pb!.baseUrl + "/api/ai-proxy-models";
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": pb!.authStore.token },
        body: JSON.stringify({ baseUrl: modelsUrl, apiKey: aiGatewayKey })
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.data || data.models || data;
        if (Array.isArray(items) && items.length > 0) {
          const models = items.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            speed: "Custom",
            provider: "custom"
          }));
          models.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
          setRemoteModels(models);
          if (!models.find((m: any) => m.id === aiModel) && models.length > 0) {
            setAiModel(models[0].id);
          }
          addToast({ title: "Berhasil!", description: `${models.length} model ditemukan.`, type: "success" });
        } else {
          setRemoteModels([]);
          addToast({ title: "Kosong", description: "Tidak ada model yang dikembalikan server.", type: "error" });
        }
      } else {
        setRemoteModels([]);
        addToast({ title: "Gagal", description: "Server menolak permintaan. Periksa Base URL & API Key.", type: "error" });
      }
    } catch {
      setRemoteModels([]);
      addToast({ title: "Gagal", description: "Tidak bisa menghubungi server model.", type: "error" });
    } finally {
      setIsLoadingModels(false);
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
    if (pb) {
      fetchSettings();
    } else if (!tenantLoading) {
      setLoading(false);
    }
  }, [pb, tenantLoading, fetchSettings]);

  useEffect(() => {
    // Safety fallback: pastikan loading tidak pernah macet
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3500);
    return () => clearTimeout(timer);
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
      // Model dimuat manual via tombol "Muat Model" (handleLoadModels),
      // bukan otomatis — agar admin kontrol kapan request dikirim.
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

  const compressLogo = (file: File): Promise<File> =>
    compressImage(file, { maxWidth: 512, maxHeight: 512, quality: 0.85 });

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
          const fileToUpload = await compressLogo(logoFile);
          // Hapus logo lama dari bucket jika ada
          if (schoolLogo && !schoolLogo.startsWith("data:")) {
            try {
              const oldKey = new URL(schoolLogo).pathname.replace(/^\//, "");
              if (oldKey) deleteImageFromStorage(oldKey); // fire & forget
            } catch { }
          }
          const uploadRes = await uploadInventoryImage(`schools/${schoolFolder}/identity`, fileToUpload);
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

      if (!isOfflineServer && finalLogoUrl.startsWith("data:")) {
        addToast({ title: "Gagal Simpan", description: "Format gambar tidak didukung (DataURL).", type: "error" });
        setSaving(false);
        return;
      }

      const payload: any = {
        name: schoolName || "EXAMKU",
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
        teacher_ai_access: !!teacherAIAccess,
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

      // 🔄 SYNC TO MASTER REGISTRY (SaaS Multi-Tenant Support)
      const currentSlug = school?.slug || window.location.hostname.split('.')[0];
      if (!isOfflineServer && currentSlug && currentSlug !== 'localhost' && currentSlug !== 'ujian' && currentSlug !== 'local') {
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
        const detail = err?.data?.message || err?.message || (err?.data ? JSON.stringify(err.data) : "");
        addToast({
          title: "Gagal",
          description: detail ? `Gagal menyimpan: ${detail}` : "Terjadi kesalahan saat menyimpan.",
          type: "error"
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLogo = () => {
    // Hapus dari bucket saat klik hapus (fire & forget)
    if (schoolLogo && !schoolLogo.startsWith("data:")) {
      try {
        const oldKey = new URL(schoolLogo).pathname.replace(/^\//, "");
        if (oldKey) deleteImageFromStorage(oldKey);
      } catch { }
    }
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
    setImportProgress(10);
    setImportStatus("Membaca berkas backup...");

    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      let totalItems = 0;
      Object.keys(data).forEach(k => {
        if (Array.isArray(data[k])) totalItems += data[k].length;
      });

      setImportProgress(30);
      setImportStatus(`Mengirim ${totalItems} data ke server...`);

      // Coba Fast Restore (Cara 2: Bulk Server Transaction via PocketBase hook)
      let fastRestoreSuccess = false;
      try {
        setImportProgress(60);
        setImportStatus("Memproses transaksi database di server...");

        const res: any = await pb.send("/api/fast-restore", {
          method: "POST",
          body: data
        });

        if (res && res.success) {
          fastRestoreSuccess = true;
          setImportProgress(100);
          setImportStatus("Selesai!");
          const duration = ((res.elapsed_ms || 0) / 1000).toFixed(1);
          addToast({
            title: "Impor Berhasil",
            description: `${res.total || totalItems} data berhasil dipulihkan dalam ${duration} detik.`,
            type: "success"
          });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
      } catch (fastErr: any) {
        // Jika endpoint tidak tersedia (404), fallback ke restore bertahap klien
        if (fastErr.status === 404) {
          console.warn("Fast restore hook belum tersedia di instance ini, beralih ke mode klien.");
        } else {
          console.error("Fast restore gagal:", fastErr);
          throw fastErr;
        }
      }

      // Fallback: Mode klien bertahap jika hook 404
      if (!fastRestoreSuccess) {
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
      }
    } catch (err: any) {
      addToast({
        title: "Gagal Impor",
        description: err.message || "File tidak valid atau rusak.",
        type: "error"
      });
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
    setImportProgress(15);
    setImportStatus("Menyiapkan pembersihan...");

    try {
      // 1. Coba Fast Reset (Transaksi Server-Side Bulk via PocketBase hook)
      let fastResetSuccess = false;
      try {
        setImportProgress(45);
        setImportStatus("Memproses reset kilat di server...");

        const res: any = await pb.send("/api/fast-reset", {
          method: "POST"
        });

        if (res && res.success) {
          fastResetSuccess = true;
          setImportProgress(100);
          setImportStatus("Selesai!");
          const duration = ((res.elapsed_ms || 0) / 1000).toFixed(1);
          addToast({
            title: "Format Berhasil",
            description: `${res.total_deleted || 0} data berhasil dibersihkan dalam ${duration} detik.`,
            type: "success"
          });
          setTimeout(() => {
            window.location.reload();
          }, 1200);
          return;
        }
      } catch (fastErr: any) {
        if (fastErr.status === 404) {
          console.warn("Fast reset hook belum tersedia di instance ini, beralih ke mode klien.");
        } else {
          console.error("Fast reset gagal:", fastErr);
        }
      }

      // 2. Fallback: Pembersihan bertahap klien jika hook belum terpasang
      if (!fastResetSuccess) {
        const REVERSE_COLLECTIONS = [...COLLECTIONS].reverse();
        const totalCollections = REVERSE_COLLECTIONS.length;
        let processed = 0;

        for (const colName of REVERSE_COLLECTIONS) {
          if (colName === "settings") {
            processed++;
            continue;
          }
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
        addToast({ title: "Berhasil", description: "Seluruh data telah dihapus.", type: "success" });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      addToast({ title: "Gagal Reset", description: err.message, type: "error" });
    } finally {
      setIsBackupLoading(false);
      setIsResetConfirmOpen(false);
      setResetInput("");
    }
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* 1. Header Bar: Title, Breadcrumbs & Save Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Pengaturan Sistem
            </h1>
            {/* Breadcrumb line */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                {school?.slug || "modalbangsa"}
              </span>
              <span>/</span>
              <div className="flex items-center gap-1 text-neutral-800 dark:text-neutral-200 font-medium">
                <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
                <span>pengaturan</span>
              </div>
            </div>
          </div>

          {/* Action Button: Simpan Pengaturan */}
          <div className="flex items-center gap-2 shrink-0">
            {loading ? (
              <Skeleton className="h-8 w-36 rounded-md" />
            ) : (
              <Button
                form="settings-form"
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
              >
                {saving ? (
                  <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="mr-1.5 h-3.5 w-3.5" /> Simpan Pengaturan</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 2. Grid Layout: Left Content & Right Inspector */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_340px] gap-8 items-start">
          {/* ── Left Column: Form Settings ── */}
          <div className="min-w-0 space-y-6">
            <form id="settings-form" onSubmit={handleSave} className="space-y-6">
              {/* Card 1: Profil Institusi */}
              <NeonCard>
                <NeonCardHeader
                  icon={Building}
                  title="Profil & Branding Institusi"
                  subtitle="Identitas visual, nama sekolah, dan kontrol kebijakan ujian"
                  badge={
                    <div className="flex items-center gap-1.5">
                      <NeonBadge variant="neutral">
                        {(school as any)?.code || school?.slug || "INSTITUSI"}
                      </NeonBadge>
                      <NeonBadge variant="emerald">
                        Aktif
                      </NeonBadge>
                    </div>
                  }
                />

                <NeonCardBody className="space-y-6">
                  {/* Identitas Visual & Nama Sekolah */}
                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    {/* Logo Uploader */}
                    <div className="w-full sm:w-28 group relative shrink-0">
                      <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
                        Logo Institusi
                      </label>
                      <div className="w-28 h-28 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border-2 border-dashed border-neutral-300 dark:border-neutral-750 flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-emerald-500/60 dark:hover:border-emerald-500/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-850/50 transition-all mx-auto sm:mx-0 shadow-2xs">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2.5" />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
                            <ImageIcon className="h-7 w-7" />
                            <span className="text-[10px] font-medium">Unggah Logo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white pointer-events-none gap-1">
                          <Upload className="h-5 w-5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Ubah</span>
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
                      {logoPreview ? (
                        <button
                          type="button"
                          onClick={handleDeleteLogo}
                          className="text-[11px] text-rose-500 hover:text-rose-600 dark:text-rose-400 font-semibold block mt-1.5 text-center w-28 cursor-pointer transition-colors"
                        >
                          Hapus Logo
                        </button>
                      ) : (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block mt-1.5 text-center w-28 font-mono">
                          PNG / JPG / WEBP
                        </span>
                      )}
                    </div>

                    {/* School Name & Preview */}
                    <div className="flex-1 min-w-0 space-y-3.5 w-full">
                      <FormField
                        id="schoolName"
                        label={`Nama ${terminology.school} / Institusi Utama`}
                        error={undefined}
                      >
                        <Input
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder={`Contoh: ${terminology.school} Modal Bangsa`}
                          className="rounded-xl font-semibold text-sm h-11 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                        />
                      </FormField>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsPickerOpen(true)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <FolderOpen className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                          Pilih dari Galeri Server
                        </button>

                        {/* Live Header Simulation */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 max-w-full">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">Preview Siswa:</span>
                          {logoPreview ? (
                            <img src={logoPreview} alt="" className="h-4 w-4 object-contain shrink-0" />
                          ) : (
                            <Building className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                          )}
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[180px] sm:max-w-[260px]">
                            {schoolName || "EXAMKU"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kebijakan Keamanan & Hak Akses */}
                  <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Kebijakan Keamanan & Hak Akses
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Wajib Exambro */}
                      <div className="flex flex-col justify-between p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <Monitor className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                                Wajib Aplikasi Exambro
                              </h5>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                                Blokir browser umum. Siswa wajib login dari Exambro Android atau Safe Exam Browser (SEB).
                              </p>
                            </div>
                          </div>
                          {loading ? (
                            <Skeleton className="h-5 w-9 rounded-full shrink-0" />
                          ) : (
                            <NeonSwitch
                              checked={isExambroEnabled}
                              onChange={setIsExambroEnabled}
                              variant="amber"
                            />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsExambroGuideOpen(true)}
                          className="w-full py-1.5 px-3 rounded-lg bg-neutral-100/80 dark:bg-neutral-850 hover:bg-neutral-200/80 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-neutral-200/70 dark:border-neutral-750 shadow-2xs cursor-pointer"
                        >
                          <Download className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                          Unduh APK Siswa & Setup SEB (.seb)
                        </button>
                      </div>

                      {/* Akses Guru Penuh */}
                      <div className="flex flex-col justify-between p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                                Akses Penuh {terminology.teacher}
                              </h5>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                                {terminology.teacher} dapat membuat ruang ujian, mengatur jadwal, dan mereset sesi peserta secara mandiri.
                              </p>
                            </div>
                          </div>
                          {loading ? (
                            <Skeleton className="h-5 w-9 rounded-full shrink-0" />
                          ) : (
                            <NeonSwitch
                              checked={teacherFullAccess}
                              onChange={setTeacherFullAccess}
                              variant="emerald"
                            />
                          )}
                        </div>
                        {/* <div className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 px-1">
                          Role Policy: teacher.can_manage_rooms = {teacherFullAccess ? "true" : "false"}
                        </div> */}
                      </div>

                      {/* Subsidi AI Institusi */}
                      <div className="sm:col-span-2 flex items-start justify-between p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Cpu className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                              Subsidi Kuota AI untuk {terminology.teacher}
                            </h5>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                              {terminology.teacher} dapat membuat butir soal otomatis menggunakan kuota API Key institusi tanpa perlu registrasi key pribadi.
                            </p>
                          </div>
                        </div>
                        {loading ? (
                          <Skeleton className="h-5 w-9 rounded-full shrink-0" />
                        ) : (
                          <NeonSwitch
                            checked={teacherAIAccess}
                            onChange={setTeacherAIAccess}
                            variant="blue"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </NeonCardBody>
              </NeonCard>

              {/* Card 2: API Gen-AI Engine */}
              <NeonCard>
                <NeonCardHeader
                  icon={Cpu}
                  title="API Gen-AI Engine"
                  subtitle="Konektivitas Large Language Model (LLM) untuk generator soal dan koreksi analitis"
                  badge={
                    <div className="flex items-center gap-1.5">
                      <NeonBadge variant={aiProvider === "groq" ? "emerald" : aiProvider === "puter" ? "sky" : "neutral"}>
                        {(aiProvider || "groq").toUpperCase()}
                      </NeonBadge>
                      <NeonBadge variant="neutral">OpenAI Compatible</NeonBadge>
                    </div>
                  }
                />

                <NeonCardBody className="space-y-5">
                  {/* Provider Quick Picker */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Pilih Provider LLM
                      </label>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {aiProvider === "groq" ? "LPU Hardware Acceleration" : aiProvider === "puter" ? "Free Tier / No Key" : "REST API"}
                      </span>
                    </div>

                    {/* Quick Segmented Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "groq", name: "Groq Cloud", badge: "⚡ Tercepat" },
                        { id: "google", name: "Gemini", badge: "🔮 Google" },
                        { id: "openrouter", name: "OpenRouter", badge: "🌐 Multi" },
                        { id: "ollama", name: "Ollama", badge: "💻 Lokal" },
                        { id: "puter", name: "Puter", badge: "🎁 Gratis" },
                      ].map((item) => {
                        const isSelected = aiProvider === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setAiProvider(item.id);
                              setAiModel("");
                              setRemoteModels([]);
                            }}
                            className={cn(
                              "px-3 py-2 rounded-xl text-left border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-1",
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-neutral-50/70 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                            )}
                          >
                            <span className="text-[10px] font-mono opacity-80">{item.badge}</span>
                            <span className="text-xs font-bold leading-none truncate">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* All Providers Dropdown */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
                        Atau pilih provider lain:
                      </span>
                      <select
                        value={aiProvider}
                        onChange={(e) => {
                          setAiProvider(e.target.value);
                          setAiModel("");
                          setRemoteModels([]);
                        }}
                        className="flex-1 h-8 px-3 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200 outline-none cursor-pointer"
                      >
                        <option value="groq">Groq Cloud (LPU Ultra-Fast)</option>
                        <option value="google">Google AI Studio (Gemini 1.5 / 2.0)</option>
                        <option value="openrouter">OpenRouter (Ratusan Model Terpadu)</option>
                        <option value="ollama">Ollama (Server Lokal / Offline LAN)</option>
                        <option value="puter">Puter.js (Gratis Tanpa API Key)</option>
                        <option value="together">Together AI</option>
                        <option value="huggingface">Hugging Face (Serverless Inference)</option>
                        <option value="fireworks">Fireworks AI</option>
                        <option value="github">GitHub Models</option>
                        <option value="cloudflare">Cloudflare Workers AI</option>
                        <option value="custom">Custom Endpoint (OpenAI Compatible Gateway)</option>
                      </select>
                    </div>

                    {/* Provider Info Helper Box */}
                    <div className="p-2.5 rounded-lg bg-neutral-100/60 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      <span>
                        {aiProvider === "groq" && "⚡ Groq LPU: Latency ultra cepat (<1 detik per soal), sangat direkomendasikan untuk pembuatan soal massal."}
                        {aiProvider === "google" && "🔮 Google Gemini: Penalaran analitis mendalam dan jendela konteks luas untuk soal studi kasus."}
                        {aiProvider === "openrouter" && "🌐 OpenRouter: Gerbang terpadu untuk mengakses Claude, GPT-4, Llama, Mistral, dan ratusan model lainnya."}
                        {aiProvider === "ollama" && "💻 Ollama: Menjalankan model AI di server LAN offline sekolah tanpa internet eksternal."}
                        {aiProvider === "puter" && "🎁 Puter: Layanan gratis bawaan tanpa perlu API Key, siap pakai langsung untuk demo dan pengujian."}
                        {aiProvider === "together" && "🚀 Together AI: Akses inference cepat untuk open models seperti Llama 3 dan Mixtral."}
                        {aiProvider === "huggingface" && "🤗 Hugging Face: Inference API serverless untuk ribuan model komunitas open-source."}
                        {aiProvider === "fireworks" && "🎆 Fireworks AI: Engine performa tinggi untuk model fine-tuned dan generative teks."}
                        {aiProvider === "github" && "🐙 GitHub Models: Akses model AI via GitHub Personal Access Token."}
                        {aiProvider === "cloudflare" && "☁️ Cloudflare Workers AI: Inference serverless global di edge network Cloudflare."}
                        {aiProvider === "custom" && "🛠 Custom Endpoint: Hubungkan ke private proxy atau server LLM internal yang kompatibel dengan format OpenAI."}
                      </span>
                    </div>
                  </div>

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {(aiProvider === "custom" || aiProvider === "cloudflare") && (
                      <div className="sm:col-span-2">
                        <FormField
                          id="aiGatewayUrl"
                          label={aiProvider === "cloudflare" ? "Cloudflare Account ID" : "Base URL Endpoint (OpenAI Compatible)"}
                          error={undefined}
                        >
                          <Input
                            type="text"
                            value={aiGatewayUrl}
                            onChange={(e) => setAiGatewayUrl(e.target.value)}
                            placeholder={aiProvider === "cloudflare" ? "Masukkan Account ID Cloudflare..." : "https://api.openai.com/v1 atau http://localhost:11434/v1"}
                            className="font-mono text-xs rounded-xl h-11 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                          />
                        </FormField>
                      </div>
                    )}

                    {/* API Key */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          {aiProvider === "groq" ? "Groq API Key" : "API Key / Token"}
                        </label>
                        {aiProvider === "puter" && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            Tidak diperlukan
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={aiProvider === "groq" ? groqApiKey : (aiProvider === "puter" ? "puter-no-key-required" : aiGatewayKey)}
                          disabled={aiProvider === "puter"}
                          onChange={(e) => aiProvider === "groq" ? setGroqApiKey(e.target.value) : setAiGatewayKey(e.target.value)}
                          placeholder={aiProvider === "groq" ? "gsk_xxxxxxxxxxxxxxxxxxxx" : aiProvider === "puter" ? "Gratis - Tanpa Key" : "sk-xxxxxxxxxxxxxxxx"}
                          className="font-mono text-xs rounded-xl h-11 pr-10 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 disabled:opacity-60"
                        />
                        {aiProvider !== "puter" && (
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
                            title={showApiKey ? "Sembunyikan API Key" : "Tampilkan API Key"}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Model ID Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Model Kecerdasan (LLM)
                        </label>
                        {remoteModels.length > 0 && (
                          <span className="text-[10px] font-mono text-neutral-400">
                            {remoteModels.length} Model Terdeteksi
                          </span>
                        )}
                      </div>
                      {remoteModels.length > 0 ? (
                        <select
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl text-xs font-semibold font-mono bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 outline-none cursor-pointer text-neutral-800 dark:text-neutral-200"
                          disabled={isLoadingModels}
                        >
                          <optgroup label={`Model ${aiProvider.toUpperCase()}`}>
                            {remoteModels.map((m: any) => (
                              <option key={m.id} value={m.id}>
                                {m.name || m.id} {m.speed ? `(${m.speed})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      ) : (
                        <Input
                          type="text"
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          placeholder={isLoadingModels ? "Memuat daftar model..." : "Ketik ID Model (cth: llama-3.3-70b-versatile)"}
                          className="font-mono text-xs rounded-xl h-11 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                        />
                      )}
                    </div>
                  </div>

                  {/* Diagnostic Console & Ping Bar */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-neutral-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                          Diagnostik Koneksi Engine
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {aiProvider === "custom" && (
                          <Button
                            type="button"
                            onClick={handleLoadModels}
                            disabled={isLoadingModels || !aiGatewayUrl || !aiGatewayKey}
                            variant="outline"
                            className="h-8 px-3 rounded-lg text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                          >
                            {isLoadingModels ? (
                              <><RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> Memuat...</>
                            ) : (
                              <><Download className="mr-1.5 h-3 w-3" /> Muat Model</>
                            )}
                          </Button>
                        )}

                        <Button
                          type="button"
                          onClick={handleTestAI}
                          disabled={isTestingAI || (aiProvider === "puter" ? false : (aiProvider === "groq" ? !groqApiKey : !aiGatewayKey))}
                          variant="outline"
                          className="h-8 px-3.5 rounded-lg text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer shadow-2xs"
                        >
                          {isTestingAI ? (
                            <><RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> Pinging Gateway...</>
                          ) : (
                            <><RefreshCw className="mr-1.5 h-3 w-3" /> Uji Koneksi (Ping)</>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Console Output */}
                    <div className={cn(
                      "p-3 rounded-xl border font-mono text-xs transition-colors",
                      testResult
                        ? testResult.success
                          ? "bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                          : "bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/30 text-rose-800 dark:text-rose-300"
                        : "bg-neutral-100/60 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400"
                    )}>
                      {testResult ? (
                        <div className="flex items-start gap-2.5">
                          {testResult.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold">
                              {testResult.success ? "[OK 200] HANDSHAKE BERHASIL" : "[ERROR] KONEKSI GAGAL"}
                            </div>
                            <div className="text-[11px] opacity-90 break-words">
                              {testResult.message}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse shrink-0" />
                          <span>[IDLE] Status gateway siap. Tekan "Uji Koneksi (Ping)" untuk memeriksa responsivitas LLM.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </NeonCardBody>
              </NeonCard>

              {/* Card 3: Kustomisasi Soal */}
              <NeonCard>
                <NeonCardHeader
                  icon={LayoutTemplate}
                  title="Kustomisasi Format Soal"
                  subtitle="Aktifkan atau nonaktifkan jenis interaksi soal yang diizinkan untuk guru"
                  badge={
                    <NeonBadge variant="neutral">
                      {activeQuestionTypesCount} / {questionTypes.length} Tipe Aktif
                    </NeonBadge>
                  }
                  actions={
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllTypes}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-750 transition-colors cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        onClick={handleResetMinimumTypes}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-750 transition-colors cursor-pointer"
                      >
                        Reset Minimum
                      </button>
                    </div>
                  }
                />

                <NeonCardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {questionTypes.map((type) => {
                      const isAllowed = allowedTypes[type.id] !== false;
                      const IconComponent = type.icon;
                      return (
                        <div
                          key={type.id}
                          onClick={() => {
                            setAllowedTypes(prev => ({ ...prev, [type.id]: !isAllowed }));
                          }}
                          className={cn(
                            "group p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2.5 select-none",
                            isAllowed
                              ? "bg-white dark:bg-neutral-900/60 border-neutral-300 dark:border-neutral-750 shadow-2xs hover:border-emerald-500/50 dark:hover:border-emerald-500/40"
                              : "bg-neutral-50/50 dark:bg-neutral-950/30 border-neutral-200/60 dark:border-neutral-850 opacity-60 hover:opacity-80"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                  isAllowed
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                                )}
                              >
                                <IconComponent className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                {type.category}
                              </span>
                            </div>

                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                              <NeonSwitch
                                checked={isAllowed}
                                onChange={(checked) => {
                                  setAllowedTypes(prev => ({ ...prev, [type.id]: checked }));
                                }}
                                size="sm"
                                variant="emerald"
                              />
                            </div>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-snug truncate">
                              {type.label}
                            </h5>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </NeonCardBody>
              </NeonCard>
            </form>
          </div>

          {/* ── Right Column: Sidebar Panels ── */}
          <div className="w-full xl:w-[320px] 2xl:w-[340px] space-y-6 shrink-0">
            {/* Card 1: Domain & Akses */}
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-neutral-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Domain & Akses Sistem
                  </h3>
                </div>
                {school?.custom_domain ? (
                  <NeonBadge variant="emerald" pulse>Custom Domain</NeonBadge>
                ) : (
                  <NeonBadge variant="neutral">Default</NeonBadge>
                )}
              </div>

              <div className="p-5 space-y-4">
                {school?.custom_domain ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Domain Resmi Sekolah (Utama)
                      </span>
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white truncate">
                          https://{school.custom_domain}
                        </span>
                        <a
                          href={`https://${school.custom_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-750 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs transition-all flex items-center gap-1 shrink-0"
                        >
                          Buka <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Domain Cadangan (Bawaan Sistem)
                      </span>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-50/50 dark:bg-neutral-850/50 border border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs">
                        <span className="truncate">{getSchoolDomain(school?.slug || "")}</span>
                        <a
                          href={getSchoolUrl(school?.slug || "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-neutral-900 dark:hover:text-white text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1"
                        >
                          Buka <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Alamat Akses Ujian
                      </span>
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white truncate">
                          {getSchoolDomain(school?.slug || "")}
                        </span>
                        <a
                          href={getSchoolUrl(school?.slug || "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-750 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs transition-all flex items-center gap-1 shrink-0"
                        >
                          Buka <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    {isHighestPlan ? (
                      <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            Paket Premium mendukung penggunaan domain sekolah sendiri (cth: <code className="font-semibold text-neutral-900 dark:text-neutral-100">cbt.sekolah.sch.id</code>). Hubungi Administrator Pusat untuk mengaktifkannya.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDnsGuide(!showDnsGuide)}
                          className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                        >
                          {showDnsGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {showDnsGuide ? "Tutup Petunjuk DNS" : "Lihat Petunjuk DNS untuk Admin IT Domain"}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <ShieldCheck size={14} className="text-neutral-400 shrink-0" />
                        <span>Fitur Custom Domain hanya tersedia pada paket tertinggi (Paket Premium). Hubungi Administrator Pusat untuk upgrade.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* DNS guide if visible */}
                {(school?.custom_domain || (isHighestPlan && showDnsGuide)) && (
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                      Panduan Konfigurasi DNS
                    </span>

                    {/* Opsi 1 */}
                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-750 bg-neutral-50/50 dark:bg-neutral-850/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-neutral-700 dark:text-neutral-300 bg-neutral-200/60 dark:bg-neutral-750 px-1.5 py-0.5 rounded">
                          Opsi 1 (A Record - Disarankan)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(SERVER_IP, "a-record")}
                          className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 py-0.5 px-2 rounded bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedKey === "a-record" ? <><Check size={11} className="text-emerald-500" /> Tersalin!</> : <><Copy size={11} /> Salin IP</>}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                        <div>
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Type</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">A</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Host</span>
                          <span className="text-neutral-800 dark:text-neutral-200 truncate block">
                            {school?.custom_domain ? getDnsHostName(school.custom_domain) : "cbt"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Value / IP Target</span>
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">{SERVER_IP}</span>
                        </div>
                      </div>
                    </div>

                    {/* Opsi 2 */}
                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-750 bg-neutral-50/50 dark:bg-neutral-850/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-neutral-700 dark:text-neutral-300 bg-neutral-200/60 dark:bg-neutral-750 px-1.5 py-0.5 rounded">
                          Opsi 2 (CNAME Record)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${school?.slug}.examku.my.id`, "cname")}
                          className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 py-0.5 px-2 rounded bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedKey === "cname" ? <><Check size={11} className="text-emerald-500" /> Tersalin!</> : <><Copy size={11} /> Salin Target</>}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                        <div>
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Type</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">CNAME</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Host</span>
                          <span className="text-neutral-800 dark:text-neutral-200 truncate block">
                            {school?.custom_domain ? getDnsHostName(school.custom_domain) : "cbt"}
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="text-[9px] font-sans font-bold text-neutral-400 uppercase block">Target CNAME</span>
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate block text-[10px]">
                            {school?.slug}.examku.my.id
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Manajemen Database */}
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-neutral-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Manajemen Database
                  </h3>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Amankan data di akhir semester dengan melakukan pencadangan JSON dan hapus riwayat secara total untuk meringankan performa server.
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleExportDB} disabled={isBackupLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {isBackupLoading ? <RefreshCw size={13} className="animate-spin mr-2" /> : <Download size={13} className="mr-2" />}
                    Eksport Backup (.json)
                  </Button>

                  <Button
                    onClick={() => fileInputRef.current?.click()} disabled={isBackupLoading}
                    variant="outline"
                    className="w-full font-semibold text-xs h-9 rounded-xl border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                  >
                    <Upload size={13} className="mr-2" /> Restore Database
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleImportDB} accept=".json" className="hidden" />
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    disabled={isBackupLoading} onClick={() => setIsResetConfirmOpen(true)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 transition-all text-center cursor-pointer disabled:opacity-40"
                  >
                    Hapus Seluruh Data
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Preferensi Visual */}
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                <div className="flex items-center gap-2">
                  <ImageIcon size={15} className="text-neutral-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Preferensi Visual
                  </h3>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">Mode Tampilan</span>
                    <span className="text-[10px] text-neutral-400">Pilih tema terang atau gelap</span>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* Card 4: AI Engine Aktif */}
            {!loading && (
              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                  <div className="flex items-center gap-2">
                    <Cpu size={15} className="text-neutral-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Status AI Engine
                    </h3>
                  </div>
                  <NeonBadge variant="emerald" pulse>Aktif</NeonBadge>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-400">Provider</span>
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {aiProvider.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-400">Model Aktif</span>
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">
                      {aiModel || <span className="text-neutral-400 italic">Belum dipilih</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-400">Mode</span>
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {aiProvider === "groq" ? "Direct API" : "Proxy"}
                    </span>
                  </div>

                  {AI_MODELS.find(m => m.id === aiModel)?.speed && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-400">Kecepatan</span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {AI_MODELS.find(m => m.id === aiModel)?.speed}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card 5: Status Server & VPS */}
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-neutral-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Status Server & VPS
                  </h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="p-5 space-y-3">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Pantau performa real-time CPU, RAM, & Uptime server saat ujian berlangsung serentak.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/status-server")}
                  className="w-full h-9 rounded-xl text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  Buka Status Server <ArrowRight size={13} className="ml-1" />
                </Button>
              </div>
            </div>

            {/* Card 6: Pembaruan 1-Click (if offline) */}
            {isOfflineServer && (
              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-850/20">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={15} className={isApplyingUpdate ? "animate-spin text-neutral-500" : "text-neutral-500"} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Pembaruan 1-Click
                    </h3>
                  </div>
                  <NeonBadge variant="neutral">Offline</NeonBadge>
                </div>

                <div className="p-5 space-y-3">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Perbarui tampilan dan fitur CBT offline Anda ke versi cloud terbaru secara otomatis dengan 1 klik.
                  </p>

                  {updateAvailable && (
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-[11px] space-y-1">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        Versi Rilis: v{updateAvailable.version} ({updateAvailable.release_date})
                      </div>
                      {updateAvailable.notes && (
                        <p className="text-neutral-500 text-[10px]">
                          {updateAvailable.notes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    {updateAvailable ? (
                      <Button
                        type="button"
                        disabled={isApplyingUpdate}
                        onClick={handleApplyUpdate}
                        className="w-full h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs cursor-pointer"
                      >
                        {isApplyingUpdate ? (
                          <><RefreshCw size={13} className="animate-spin mr-1.5" /> Sedang Mengunduh & Memperbarui...</>
                        ) : (
                          <><Download size={13} className="mr-1.5" /> Pasang Pembaruan Sekarang</>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCheckingUpdate || isReloading}
                          onClick={handleCheckUpdate}
                          className="flex-1 h-9 rounded-xl text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        >
                          {isCheckingUpdate ? (
                            <><RefreshCw size={13} className="animate-spin mr-1.5" /> Memeriksa...</>
                          ) : isReloading ? (
                            <><RefreshCw size={13} className="animate-spin mr-1.5" /> Menyegarkan...</>
                          ) : (
                            <><RefreshCw size={13} className="mr-1.5" /> Cek Pembaruan</>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCheckingUpdate || isReloading}
                          onClick={() => {
                            addToast({
                              title: "Hard Reload",
                              description: "Membersihkan cache browser...",
                              type: "info"
                            });
                            setTimeout(() => forceHardReload(), 400);
                          }}
                          className="h-9 px-3 rounded-xl text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 shrink-0"
                          title="Paksa muat ulang browser untuk membersihkan cache tampilan"
                        >
                          <RotateCw size={13} className="mr-1 text-neutral-500" /> Hard Reload
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-start gap-1.5 text-[10px] text-neutral-400">
                    <ShieldCheck size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Database bank soal & siswa dijamin aman dan tidak terhapus.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog Modals ── */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-xl bg-white dark:bg-neutral-900">
          <DialogTitle className="text-base font-bold text-center mb-4 text-neutral-900 dark:text-neutral-100">Pilih Sumber Logo</DialogTitle>
          <DialogDescription className="sr-only">Pilih sumber logo institusi</DialogDescription>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={() => { setIsPickerOpen(false); document.getElementById("logoInput")?.click(); }}
              className="flex flex-col items-center justify-center p-5 bg-neutral-50 dark:bg-neutral-850 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              <Upload size={22} className="mb-2 text-neutral-500" />
              <span className="text-xs font-semibold text-center">Buka Browser<br />File Sistem</span>
            </button>
            <button
              type="button" onClick={() => { setIsPickerOpen(false); setIsGalleryOpen(true); loadGalleryImages(); }}
              className="flex flex-col items-center justify-center p-5 bg-neutral-50 dark:bg-neutral-850 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              <FolderOpen size={22} className="mb-2 text-neutral-500" />
              <span className="text-xs font-semibold text-center">Cloud Galeri<br />EXAMKU</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <SharedGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onSelectImage={handlePickGallery}
        pb={pb!}
        school={school}
        currentUser={{ name: "Admin", role: "admin" }}
      />

      <Dialog open={isImportConfirmOpen} onOpenChange={(val) => { if (!isBackupLoading) setIsImportConfirmOpen(val); }}>
        <DialogContent className="z-[100] max-w-sm rounded-2xl p-6 text-center border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-900">
          <DialogDescription className="sr-only">Konfirmasi pemulihan database dari file JSON.</DialogDescription>
          <div className="flex flex-col items-center gap-4">
            {isBackupLoading ? (
              <div className="h-14 w-14 mb-1 rounded-full border-[3px] border-neutral-200 dark:border-neutral-800 border-t-neutral-900 dark:border-t-white animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
                <FileJson size={28} />
              </div>
            )}
            <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {isBackupLoading ? "Memulihkan Database..." : "Impor Backup Database"}
            </DialogTitle>

            {!isBackupLoading ? (
              <>
                <p className="text-xs text-neutral-500 font-medium">Lanjutkan pemulihan dari file <b>{importFile?.name}</b>?</p>
                <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 p-3 rounded-lg border border-amber-500/20 w-full text-left flex gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium leading-tight">Data dengan ID serupa akan langsung ditimpa secara permanen.</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 w-full mt-1">
                  <Button variant="outline" onClick={() => { setIsImportConfirmOpen(false); setImportFile(null); }} className="rounded-lg h-9 text-xs font-semibold border-neutral-200 dark:border-neutral-800">Batal</Button>
                  <Button onClick={executeImport} className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg h-9 text-xs font-semibold shadow-xs cursor-pointer">Lanjutkan</Button>
                </div>
              </>
            ) : (
              <div className="w-full pt-2">
                <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-neutral-900 dark:bg-white transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                </div>
                <p className="text-[11px] font-mono text-neutral-500">{importProgress}% • {importStatus}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetConfirmOpen} onOpenChange={(val) => { if (!isBackupLoading) setIsResetConfirmOpen(val); }}>
        <DialogContent className="z-[100] max-w-sm rounded-2xl p-6 text-center border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-900">
          <DialogDescription className="sr-only">Tindakan berbahaya untuk menghapus seluruh data database.</DialogDescription>

          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1">
              <AlertTriangle size={28} />
            </div>
            <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">Format Seluruh Data</DialogTitle>

            {isBackupLoading ? (
              <div className="w-full pt-2">
                <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                </div>
                <p className="text-[11px] font-mono text-rose-600 font-semibold">{importProgress}% • {importStatus}</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-snug">
                  Tindakan fatal: <b>Semua records</b> (siswa, ujian, nilai, ruang) akan dihapus, menyisakan akun administrator login.
                </p>
                <div className="w-full text-left mt-2 space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Ketik "RESET" untuk konfirmasi</label>
                  <Input
                    value={resetInput} onChange={(e) => setResetInput(e.target.value.toUpperCase())}
                    className="text-center font-mono font-bold text-rose-600 h-10 rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    placeholder="RESET"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 w-full mt-2">
                  <Button variant="outline" onClick={() => { setIsResetConfirmOpen(false); setResetInput(""); }} className="rounded-lg h-9 text-xs font-semibold border-neutral-200 dark:border-neutral-800">Batal</Button>
                  <Button onClick={handleResetDB} disabled={resetInput !== "RESET"} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg h-9 text-xs font-semibold shadow-xs disabled:opacity-40">Hapus Permanen</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ExambroGuideModal
        open={isExambroGuideOpen}
        onOpenChange={setIsExambroGuideOpen}
        schoolSlug={school?.slug || ""}
        schoolName={schoolName || school?.name || ""}
      />
    </div>
  );
};

export default SettingsPage;
