import { useState, useEffect, useRef } from "react";
import { useTenant } from "../context/TenantContext";
import { uploadInventoryImage } from "../lib/storage"; 
import { AI_MODELS, testAIConnection } from "../lib/ai";
import { Skeleton } from "../components/ui/skeleton";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import FormField from "../components/forms/FormField";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
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
  Trash
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
  const { pb, school } = useTenant();
  
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
  const [isExambroEnabled, setIsExambroEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { addToast } = useToast();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

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
        setSchoolName(data.name || "E-Ujian");
        setGroqApiKey(data.groq_api_key || "");
        setAiGatewayUrl(data.ai_gateway_url || "");
        setAiGatewayKey(data.ai_gateway_key || "");
        setAiModel(data.ai_model || AI_MODELS[0].id);
        setAiProvider(data.ai_provider || "groq");
        setIsExambroEnabled(data.is_exambro_enabled ?? false);
        
        const logoUrl = data.logoUrl || data.logo || "";
        setSchoolLogo(logoUrl);
        setLogoPreview(logoUrl);

        if (data.allowed_types) setAllowedTypes(data.allowed_types);
        else if (data.allowed_question_types) setAllowedTypes(data.allowed_question_types);
      } else {
        setSchoolName("E-Ujian");
      }
    } catch (e) {
      console.error("Settings fetch err", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAI = async () => {
    if (!groqApiKey) {
      addToast({ title: "Gagal", description: "Masukkan API Key terlebih dahulu.", type: "error" });
      return;
    }
    setIsTestingAI(true);
    setTestResult(null);
    try {
      const isOllama = aiProvider === "ollama";
      const targetKey = isOllama ? (aiGatewayKey || groqApiKey) : groqApiKey;
      const res = await testAIConnection(targetKey, aiModel, aiGatewayUrl || "https://ollama.com", aiProvider);
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
    try {
      const qRecords = await pb.collection("questions").getFullList({
        filter: 'imageUrl != "" || image != ""',
        limit: 20
      });
      const images = qRecords.map(q => q.imageUrl || q.image);
      setGalleryImages(images.filter(Boolean));
    } catch (e) { console.error("Gallery err", e); }
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

  // 🤖 Auto-switch model when provider changes
  useEffect(() => {
    if (!loading) {
      const availableModels = AI_MODELS.filter(m => (m as any).provider === aiProvider);
      const isCurrentModelValid = availableModels.some(m => m.id === aiModel);
      
      if (!isCurrentModelValid && availableModels.length > 0) {
        setAiModel(availableModels[0].id);
      }
    }
  }, [aiProvider, loading]);

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
          // 🛡️ Isolation: Kelompokkan logo berdasarkan slug sekolah
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

      // 🛡️ Robust Payload: Menghindari error 400 Bad Request karena schema mismatch
      const payload: any = {
        name: schoolName || "E-Ujian",
        logo: finalLogoUrl || "",
        logoUrl: finalLogoUrl || "", 
        allowed_types: allowedTypes || {},
        // Coba kirim versi snake_case dan camelCase agar kompatibel dengan versi DB manapun di VPS
        groq_api_key: groqApiKey || "",
        ai_gateway_url: aiGatewayUrl || "",
        ai_gateway_key: aiGatewayKey || "",
        ai_model: aiModel || "llama-3.3-70b-versatile",
        ai_provider: aiProvider || "groq",
        is_exambro_enabled: !!isExambroEnabled,
        // Fallback untuk DB versi baru (camelCase)
        isExambroEnabled: !!isExambroEnabled,
        aiModel: aiModel || "llama-3.3-70b-versatile",
        aiProvider: aiProvider || "groq"
      };

      if (!pb) return;
      
      const isCreate = !settingsId;

      if (!isCreate) {
        await pb.collection("settings").update(settingsId, payload);
      } else {
        // 🧪 Generate random 6-char token untuk memenuhi syarat DB
        const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
        const createPayload = {
          ...payload,
          universal_token: randomToken,
          universal_token_updated_at: new Date().toISOString()
        };
        const created = await pb.collection("settings").create(createPayload);
        setSettingsId(created.id);
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
          description: "Gagal menyimpan. Pastikan API Rules 'Update' & 'Create' koleksi 'settings' di PocketBase Admin (/_/) diset ke: @request.auth.collectionName = 'users'", 
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

  // 🚀 Backup Logic: Export
  const handleExportDB = async () => {
    if (!pb) return;
    setIsBackupLoading(true);
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const collectionName of COLLECTIONS) {
        try {
          const records = await pb.collection(collectionName).getFullList();
          
          // 🛡️ Filter data sensitif/dinamis agar tidak merusak DB saat impor
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

  // 🚀 Backup Logic: Import
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

      // Gunakan urutan COLLECTIONS agar relasi (foreign key) aman
      for (const collectionName of COLLECTIONS) {
        if (!data[collectionName]) continue;

        setImportStatus(`Mengimpor: ${collectionName}...`);
        const records = data[collectionName];
        
        for (const recordData of records) {
          // 🧹 Bersihkan data dari meta-fields PocketBase yang dilarang dikirim kembali
          const { 
            id, created, updated, 
            collectionId, collectionName: _unusedName, expand,
            ...cleanData 
          } = recordData;

          // Hapus juga field sistem lain jika ada (biasanya diawali @)
          Object.keys(cleanData).forEach(key => {
            if (key.startsWith("@")) delete (cleanData as any)[key];
          });

          try {
            // Update jika ada, Create jika tidak ada. ID tetap sama agar relasi terjaga.
            try {
              await pb.collection(collectionName).update(id, cleanData);
            } catch (e: any) {
              if (e.status === 404) {
                const createData: any = { id, ...cleanData };
                
                // 🔐 Khusus koleksi Auth (students & users), butuh password saat Create
                const isAuthCollection = ["students", "users"].includes(collectionName);
                if (isAuthCollection) {
                  const username = (cleanData as any).username || (cleanData as any).nisn || id;
                  const defaultPass = `${username}@mosa`;
                  createData.password = defaultPass;
                  createData.passwordConfirm = defaultPass;
                }

                await pb.collection(collectionName).create(createData);
              } else {
                throw e;
              }
            }
          } catch (e: any) {
            const errorDetails = e.data?.data ? JSON.stringify(e.data.data) : (e.message || "Unknown Error");
            console.error(`Gagal impor record ${id} di ${collectionName}:`, errorDetails);
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

  // 🚀 Backup Logic: Reset DB
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
      // Urutan terbalik agar menghapus anak (attempts) sebelum bapak (exam_rooms)
      const REVERSE_COLLECTIONS = [...COLLECTIONS].reverse();
      const totalCollections = REVERSE_COLLECTIONS.length;
      let processed = 0;

      for (const colName of REVERSE_COLLECTIONS) {
        setImportStatus(`Membersihkan: ${colName}...`);
        
        // Ambil semua records per batch atau langsung (PocketBase default max 200, but getFullList handles it)
        const records = await pb.collection(colName).getFullList({ fields: 'id' });
        
        for (const r of records) {
          // Jangan hapus Admin yang sedang login (jika colName === 'users')
          // Namun di aplikasi ini, admin ada di sistem Auth 'users', sedangkan data lain di koleksi terpisah
          // Kita pastikan tidak menghapus user saat ini
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Save className="h-5 w-5 text-indigo-500" />
            Pengaturan Aplikasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola identitas sekolah, tipe soal, dan backup data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
             <Skeleton className="h-9 w-40 rounded-2xl" />
          ) : (
            <Button 
               form="settings-form"
               type="submit" 
               disabled={saving} 
               size="sm"
               className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4 transition-all active:scale-95"
            >
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
            <CardHeader className="border-b border-slate-200/60 dark:border-slate-800/40 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <Building className="h-4 w-4 text-slate-400" /> Profil Sekolah
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form id="settings-form" onSubmit={handleSave} className="space-y-4">
                <FormField id="schoolName" label="Nama Sekolah" error={undefined}>
                  <Input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Masukkan nama sekolah"
                    className="rounded-xl font-semibold"
                  />
                </FormField>

                <FormField id="schoolLogo" label="Logo Sekolah" error={undefined}>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                      ) : (
                        <Upload className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      {loading ? (
                        <Skeleton className="h-8 w-28 rounded-xl" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 cursor-pointer shadow-sm transition-all active:scale-95"
                          >
                            <Upload className="h-3.5 w-3.5" /> Ganti Logo
                          </button>
                          {(schoolLogo || logoFile) && (
                            <button
                              type="button"
                              onClick={handleDeleteLogo}
                              disabled={saving}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 dark:border-rose-800/40 text-rose-700 cursor-pointer shadow-sm transition-all active:scale-95"
                            >
                              <Trash className="h-3.5 w-3.5" /> Hapus Logo
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Logo akan disimpan ke Cloudflare R2.</p>
                    </div>
                  </div>
                </FormField>

                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/40">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                        <Save className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Mode Exambro (Wajib Aplikasi)</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Siswa wajib menggunakan aplikasi Exambro resmi untuk mengakses ujian.</p>
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={isExambroEnabled}
                          onChange={(e) => setIsExambroEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-orange-600 shadow-inner group-hover:after:scale-110"></div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/40">
                   <div className="flex flex-col gap-6 bg-slate-50/50 dark:bg-slate-900/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                       <div>
                         <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                           <RefreshCw className="h-4 w-4 text-blue-500 animate-spin-slow" />
                           Konfigurasi Mesin AI
                         </h4>
                         <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                           Pilih antara Groq Cloud (Cepat) atau OpenClaw (Agentic/Gratis).
                         </p>
                       </div>
                       <Button 
                         onClick={handleTestAI} 
                         disabled={isTestingAI || (aiProvider === "groq" ? !groqApiKey : !aiGatewayKey)}
                         type="button"
                         variant="outline"
                         size="sm"
                         className="rounded-xl h-9 px-4 text-xs font-bold border-blue-100 bg-blue-50/50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-all shadow-sm active:scale-95"
                       >
                         {isTestingAI ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                         {isTestingAI ? "Mengecek..." : "Cek Koneksi AI"}
                       </Button>
                     </div>

                     <div className="flex p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl w-fit">
                        <button 
                          type="button"
                          onClick={() => setAiProvider("groq")}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiProvider === "groq" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Groq Cloud
                        </button>
                        <button 
                          type="button"
                          onClick={() => setAiProvider("ollama")}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiProvider === "ollama" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Ollama Cloud
                        </button>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                       <FormField id="groqApiKey" label="Groq API Key" error={undefined}>
                         <div className="relative group">
                           <Input
                             type="password"
                             value={groqApiKey}
                             onChange={(e) => setGroqApiKey(e.target.value)}
                             placeholder="gsk_xxxx..."
                             className="rounded-xl font-mono text-xs h-11 pr-10 focus:ring-blue-500/20"
                           />
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500">
                             <Database className="h-4 w-4" />
                           </div>
                         </div>
                       </FormField>

                       <FormField id="aiGatewayKey" label="Ollama API Key" error={undefined}>
                         <div className="relative group">
                           <Input
                             type="password"
                             value={aiGatewayKey}
                             onChange={(e) => setAiGatewayKey(e.target.value)}
                             placeholder="oc_xxxx..."
                             className="rounded-xl font-mono text-xs h-11 pr-10 focus:ring-blue-500/20"
                           />
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500">
                              <Database className="h-4 w-4" />
                           </div>
                         </div>
                       </FormField>

                     </div>
                   </div>

                    <FormField id="aiModel" label="Pilih Model AI" error={undefined}>
                       <div className="space-y-3">
                         <div className="relative">
                           <select
                             value={aiModel}
                             onChange={(e) => setAiModel(e.target.value)}
                             className="w-full h-11 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                           >
                             <optgroup label={aiProvider === "groq" ? "🚀 Meta & Qwen (Groq)" : "☁️ Ollama Cloud Models"}>
                               {AI_MODELS.filter(m => (m as any).provider === aiProvider && m.status?.toLowerCase() === 'production').map((m) => (
                                 <option key={m.id} value={m.id}>{m.name} ({m.speed})</option>
                               ))}
                             </optgroup>
                             {AI_MODELS.some(m => (m as any).provider === aiProvider && m.status?.toLowerCase() === 'preview') && (
                               <optgroup label="🧪 Preview (Eksperimental)">
                                 {AI_MODELS.filter(m => (m as any).provider === aiProvider && m.status?.toLowerCase() === 'preview').map((m) => (
                                   <option key={m.id} value={m.id}>{m.name} ({m.speed})</option>
                                 ))}
                               </optgroup>
                             )}
                           </select>
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <RefreshCw className="h-3.5 w-3.5" />
                           </div>
                         </div>

                         <div className="space-y-2">
                           {AI_MODELS.find(m => m.id === aiModel) && (
                             <div className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
                               AI_MODELS.find(m => m.id === aiModel)?.status?.toLowerCase() === 'production' 
                                 ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800 dark:bg-emerald-500/5 dark:border-emerald-500/20 dark:text-emerald-400' 
                                 : 'bg-amber-50/40 border-amber-100 text-amber-800 dark:bg-amber-500/5 dark:border-amber-500/20 dark:text-amber-400'
                             }`}>
                               <div className={`p-1.5 rounded-lg ${
                                 AI_MODELS.find(m => m.id === aiModel)?.status?.toLowerCase() === 'production' 
                                   ? 'bg-emerald-100 dark:bg-emerald-500/20' 
                                   : 'bg-amber-100 dark:bg-amber-500/20'
                               }`}>
                                 {AI_MODELS.find(m => m.id === aiModel)?.status?.toLowerCase() === 'production' ? (
                                   <CheckCircle2 className="h-3.5 w-3.5" />
                                 ) : (
                                   <AlertTriangle className="h-3.5 w-3.5" />
                                 )}
                               </div>
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                   {AI_MODELS.find(m => m.id === aiModel)?.status?.toLowerCase() === 'production' ? 'Status: Stabil' : 'Status: Eksperimental'}
                                   <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
                                 </span>
                                 <span className="text-[9px] font-medium opacity-80 leading-relaxed">
                                   {AI_MODELS.find(m => m.id === aiModel)?.status?.toLowerCase() === 'production' 
                                     ? 'Performa optimal untuk ujian massal dan hasil yang konsisten.' 
                                     : 'Tinjauan awal: Mungkin terjadi gangguan sesaat pada jam sibuk.'}
                                 </span>
                               </div>
                             </div>
                           )}

                           {testResult && (
                              <div className={`p-3 rounded-xl border animate-in zoom-in-95 duration-300 ${
                                testResult.success 
                                 ? "bg-blue-50/40 border-blue-100 text-blue-800 dark:bg-blue-500/5 dark:border-blue-500/20 dark:text-blue-400" 
                                 : "bg-rose-50/40 border-rose-100 text-rose-800 dark:bg-rose-500/5 dark:border-rose-500/20 dark:text-rose-400"
                              }`}>
                                <div className="flex items-center gap-3">
                                  {testResult.success ? (
                                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                                       <CheckCircle2 className="h-3 w-3" />
                                    </div>
                                  ) : (
                                    <div className="h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                                       <AlertTriangle className="h-3 w-3" />
                                    </div>
                                  )}
                                  <span className="text-[10px] font-bold leading-tight">{testResult.message}</span>
                                </div>
                              </div>
                           )}
                         </div>
                       </div>
                    </FormField>
                   </div>
                </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
            <CardHeader className="border-b border-slate-200/60 dark:border-slate-800/40 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <RefreshCw className="h-4 w-4 text-slate-400" /> Manajemen Tipe Soal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questionTypes.map((type) => (
                      <div key={type.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{type.label}</span>
                              <span className="text-[10px] text-slate-400">{loading ? <Skeleton className="h-3 w-12" /> : (allowedTypes[type.id] ? "Aktif" : "Dinonaktifkan")}</span>
                          </div>
                          {loading ? (
                            <Skeleton className="h-6 w-11 rounded-full" />
                          ) : (
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={allowedTypes[type.id] || false}
                                    onChange={(e) => setAllowedTypes(prev => ({ ...prev, [type.id]: e.target.checked }))}
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600 shadow-inner group-hover:after:scale-110"></div>
                            </label>
                          )}
                      </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm bg-gradient-to-br from-indigo-500 to-blue-700 dark:from-indigo-900 dark:to-slate-950 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Database size={80} />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                 <Database className="h-5 w-5" /> Backup & Restore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs opacity-90 leading-relaxed">
                Ekspor seluruh data aplikasi (Soal, Siswa, Hasil Ujian, dll) ke dalam file JSON untuk cadangan atau pindah server.
              </p>
              
              <div className="flex flex-col gap-3">
                {loading ? (
                  <>
                    <Skeleton className="h-11 w-full rounded-xl" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={handleExportDB} 
                      disabled={isBackupLoading}
                      className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {isBackupLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Ekspor Database (.json)
                    </Button>

                    <Button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isBackupLoading}
                      className="w-full bg-white text-blue-700 hover:bg-slate-50 font-bold rounded-xl h-11 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                      <Upload className="h-4 w-4" />
                      Impor Database
                    </Button>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportDB} 
                  accept=".json" 
                  className="hidden" 
                />
              </div>

              <div className="pt-4 mt-2 border-t border-white/20">
                {loading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <button
                    disabled={isBackupLoading}
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-rose-500 border border-white/20 hover:border-rose-400 text-white shadow-sm transition-all"
                  >
                    Hapus Semua Data
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="h-3 w-3" /> Tampilan & Tema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Mode Gelap (Dark Mode)</span>
                  <span className="text-[10px] text-slate-400">Aktifkan tema gelap sistem</span>
                </div>
                <ThemeToggle />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed px-1">
                Pengaturan tema bersifat personal dan tersimpan secara lokal pada browser Anda.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" /> Info Penting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-[10px] text-slate-500 space-y-2 list-disc pl-4">
                 <li>Impor data akan <b>menimpa</b> data dengan ID yang sama.</li>
                 <li>Pastikan file backup bersumber dari aplikasi E-Ujian yang sama.</li>
                 <li>Proses impor mungkin memakan waktu beberapa menit jika data sangat besar.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-sm bg-card p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Pilih Sumber Gambar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => { setIsPickerOpen(false); document.getElementById("logoInput")?.click(); }}
            >
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                  <span className="font-semibold text-xs text-left">Unggah Gambar Baru</span>
                  <span className="text-[10px] text-slate-400">Menuju Cloudflare R2</span>
              </div>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => { setIsPickerOpen(false); setIsGalleryOpen(true); loadGalleryImages(); }}
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 text-blue-600 dark:text-blue-400">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                  <span className="font-semibold text-xs text-left">Ambil Dari Galeri</span>
                  <span className="text-[10px] text-slate-400">Gunakan yang sudah di-upload</span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-500" /> Galeri Media
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-left">
            {!galleryImages.length ? (
              <div className="text-center py-8 text-slate-400 text-sm italic underline">Belum ada gambar yang ditemukan.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {galleryImages.map((src, idx) => (
                  <div 
                    key={idx} 
                    className="group relative cursor-pointer aspect-square rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-900 overflow-hidden hover:shadow-md transition-all flex items-center justify-center p-2"
                    onClick={() => handlePickGallery(src)}
                  >
                    <img src={src} alt="Gallery item" className="max-h-full max-w-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded-md">Gunakan</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 🛡️ Import Confirmation Dialog */}
      <Dialog open={isImportConfirmOpen} onOpenChange={(val) => {
        console.log("Import Dialog Triggered, state:", val);
        if (!isBackupLoading) setIsImportConfirmOpen(val);
      }}>
        <DialogContent className="z-[100] max-w-md rounded-[2rem] p-6 text-center border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
          <DialogDescription className="sr-only">Konfirmasi pemulihan database dari file JSON.</DialogDescription>
          <div className="flex flex-col items-center gap-4">
            {isBackupLoading ? (
              <div className="relative h-24 w-24 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                  style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
                ></div>
                <span className="text-lg font-black text-blue-600">{importProgress}%</span>
              </div>
            ) : (
              <FileJson className="w-16 h-16 text-blue-600 mb-2" />
            )}
            
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              {isBackupLoading ? "Sedang Memulihkan..." : "Konfirmasi Impor"}
            </DialogTitle>
            
            {!isBackupLoading ? (
              <>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed">
                  Apakah Anda yakin ingin memulihkan database dari file <span className="font-bold text-slate-800 dark:text-slate-200">{importFile?.name}</span>?
                  Data lama dengan ID yang sama akan ditimpa.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-2 text-left">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">Proses ini tidak dapat dibatalkan. Disarankan untuk melakukan Ekspor Backup data saat ini terlebih dahulu.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                  <Button variant="outline" onClick={() => { setIsImportConfirmOpen(false); setImportFile(null); }} className="rounded-xl h-11 font-bold text-xs">Batal</Button>
                  <Button onClick={executeImport} className="bg-blue-600 text-white rounded-xl h-11 font-bold text-xs shadow-lg shadow-blue-200">Lanjutkan</Button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-2 mt-4">
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-blue-600 animate-pulse">{importStatus}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ⚠️ Reset Database Confirmation Dialog */}
      <Dialog open={isResetConfirmOpen} onOpenChange={(val) => {
        console.log("Reset Dialog Triggered, state:", val);
        if (!isBackupLoading) setIsResetConfirmOpen(val);
      }}>
        <DialogContent className="z-[100] max-w-md rounded-[2rem] p-6 text-center border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 pointer-events-auto">
          <DialogDescription className="sr-only">Tindakan berbahaya untuk menghapus seluruh data database.</DialogDescription>
          {/* Animated Background Pulse */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full animate-ping opacity-20"></div>
          
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center mb-2 animate-bounce-slow">
               <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>

            <DialogTitle className="text-xl font-bold text-slate-800 dark:text-white">
              Bahaya: Reset Database
            </DialogTitle>
            
            <div className="space-y-4">
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-relaxed px-4">
                Tindakan ini akan <span className="text-rose-600 underline">MENGHAPUS PERMANEN</span> seluruh data:
                <br/>
                <span className="text-[9px] text-slate-400 font-normal">
                  Siswa, Bank Soal, Pertanyaan, Ruang Ujian, Riwayat Jawaban, Kelas, dan Mata Pelajaran.
                </span>
                <br/><br/>
                Hanya akun <span className="text-slate-800 dark:text-slate-200">Admin</span> Anda yang akan dipertahankan.
              </p>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 text-center block italic">Ketik "RESET" untuk konfirmasi</label>
                <Input 
                   value={resetInput}
                   onChange={(e) => setResetInput(e.target.value.toUpperCase())}
                   placeholder="Ketik 'RESET' di sini..."
                   className="text-center font-bold text-rose-600 rounded-xl border-rose-100 dark:border-rose-900/30 focus:border-rose-500 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <Button variant="outline" onClick={() => { setIsResetConfirmOpen(false); setResetInput(""); }} className="rounded-xl h-11 font-bold text-xs">Batalkan</Button>
                <Button 
                   onClick={handleResetDB} 
                   disabled={resetInput !== "RESET" || isBackupLoading}
                   className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 font-bold text-xs shadow-lg shadow-rose-200 disabled:opacity-30 disabled:grayscale"
                >
                  Ya, Hapus Semua
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        id="logoInput"
        accept="image/*"
        className="hidden"
        onChange={handleLogoChange}
      />
    </div>
  );
};

export default SettingsPage;
