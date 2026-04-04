import { useState, useEffect } from "react";
import pb from "../lib/pocketbase";
import { uploadInventoryImage } from "../lib/storage"; 
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import FormField from "../components/forms/FormField";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Upload, Save, Building, FolderOpen, Image as ImageIcon } from "lucide-react";

const SettingsPage = () => {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

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
        
        // Handle logo dari URL Text
        const logoUrl = data.logoUrl || data.logo || "";
        setSchoolLogo(logoUrl);
        setLogoPreview(logoUrl);

        // Handle allowed types
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
      // Ambil gambar yang sudah pernah di-upload ke soal
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

      // ☁️ Langkah 1: Upload ke Cloudflare R2 jika ada file baru (logoFile)
      if (logoFile) {
        try {
          const uploadRes = await uploadInventoryImage("school", logoFile);
          if (uploadRes && uploadRes.url) {
            finalLogoUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.error("Cloudflare Upload Error:", uploadErr);
          addToast({ title: "Gagal Upload", description: "Gagal mengunggah logo ke Cloudflare. Cek koneksi internet/token R2.", type: "error" });
          setSaving(false);
          return;
        }
      }

      // Pastikan bukan Base64/DataURL yang dikirim (Cegah error 5000 karakter)
      if (finalLogoUrl.startsWith("data:")) {
        addToast({ title: "Gagal Simpan", description: "Format gambar tidak didukung (DataURL). Harap upload ulang.", type: "error" });
        setSaving(false);
        return;
      }

      // 📁 Langkah 2: Simpan URL ke PocketBase
      const payload: any = {
        name: schoolName,
        logo: finalLogoUrl,
        allowed_types: allowedTypes
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
      const detail = err.data?.data ? JSON.stringify(err.data.data) : (err.message || "Gagal simpan");
      addToast({ title: "Gagal", description: "Terjadi kesalahan: " + detail, type: "error" });
    } finally {
      setSaving(false);
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola identitas sekolah dan lisensi tipe soal.</p>
        </div>
      </div>

      <div className="max-w-2xl">
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

        {/* Question Types Card Remains Same */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm mt-6">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-800/40 pb-4">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
               <Save className="h-4 w-4 text-slate-400" /> Manajemen Tipe Soal
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
