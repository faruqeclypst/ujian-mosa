import { useState, useEffect, useRef } from "react";
import pb from "../lib/pocketbase";
import { uploadInventoryImage } from "../lib/storage"; 
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
  CheckCircle2
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
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [groqApiKey, setGroqApiKey] = useState("");
  const [aiModel, setAiModel] = useState("llama-3.1-7b-instant");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        setAiModel(data.ai_model || "llama-3.1-7b-instant");
        
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

  const loadGalleryImages = async () => {
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
          const uploadRes = await uploadInventoryImage("school", logoFile);
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
        name: schoolName,
        logo: finalLogoUrl,
        allowed_types: allowedTypes,
        groq_api_key: groqApiKey,
        ai_model: aiModel
      };

      if (settingsId) {
        await pb.collection("settings").update(settingsId, payload);
      } else {
        const created = await pb.collection("settings").create(payload);
        setSettingsId(created.id);
      }

      setSchoolLogo(finalLogoUrl);
      setLogoFile(null);
      addToast({ title: "Berhasil!", description: "Pengaturan berhasil diperbarui.", type: "success" });
      fetchSettings();
    } catch (err: any) {
      console.error("Save settings err", err);
      addToast({ title: "Gagal", description: "Terjadi kesalahan saat menyimpan.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // 🚀 Backup Logic: Export
  const handleExportDB = async () => {
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
    if (!importFile) return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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
              <form onSubmit={handleSave} className="space-y-4">
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
                      <button
                        type="button"
                        onClick={() => setIsPickerOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-sm transition-all"
                      >
                        <Upload className="h-3.5 w-3.5" /> Ganti Logo
                      </button>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Logo akan disimpan ke Cloudflare R2.</p>
                    </div>
                  </div>
                </FormField>

                <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/40 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin-slow" />
                    Konfigurasi AI (Beta)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Gunakan Groq Cloud (Gratis & Cepat) untuk fitur Generate Soal Otomatis. <a href="https://console.groq.com/keys" target="_blank" className="text-blue-600 underline">Dapatkan API Key di sini</a>.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField id="groqApiKey" label="Groq API Key" error={undefined}>
                      <Input
                        type="password"
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                        placeholder="gsk_xxxx..."
                        className="rounded-xl font-mono text-xs"
                      />
                    </FormField>

                    <FormField id="aiModel" label="Model AI" error={undefined}>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                      >
                        <option value="llama-3.1-7b-instant">Llama 3.1 8B (Sangat Cepat)</option>
                        <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Sangat Cerdas)</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B (Seimbang)</option>
                      </select>
                    </FormField>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/40 mt-4 flex justify-end">
                  <Button 
                     type="submit" 
                     disabled={saving} 
                     className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-9 gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
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
                              <span className="text-[10px] text-slate-400">{allowedTypes[type.id] ? "Aktif" : "Dinonaktifkan"}</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer group">
                              <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={allowedTypes[type.id] || false}
                                  onChange={(e) => setAllowedTypes(prev => ({ ...prev, [type.id]: e.target.checked }))}
                              />
                              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600 shadow-inner group-hover:after:scale-110"></div>
                          </label>
                      </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm bg-gradient-to-br from-indigo-500 to-blue-700 text-white overflow-hidden relative">
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
              
              <div className="space-y-2 pt-2">
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
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportDB} 
                  accept=".json" 
                  className="hidden" 
                />
              </div>

              <div className="pt-4 mt-2 border-t border-white/20">
                <button
                   disabled={isBackupLoading}
                   onClick={() => setIsResetConfirmOpen(true)}
                   className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/80 hover:bg-rose-600 text-white border border-rose-400/50 shadow-sm transition-all"
                >
                  Hapus Semua Data
                </button>
              </div>
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
