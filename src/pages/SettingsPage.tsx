import { useState, useEffect } from "react";
import { database } from "../lib/firebase";
import { ref, get, update } from "firebase/database";
import { uploadInventoryImage } from "../lib/storage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import FormField from "../components/forms/FormField";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Upload, Save, Building, FolderOpen, Image } from "lucide-react";

const SettingsPage = () => {
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

  const loadGalleryImages = async () => {
    try {
      const snapshot = await get(ref(database, "questions"));
      const images = new Set<string>();
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.values(data).forEach((q: any) => {
          if (q.imageUrl) images.add(q.imageUrl);
          if (q.choices) {
             Object.values(q.choices).forEach((c: any) => {
                if (c.imageUrl) images.add(c.imageUrl);
             });
          }
        });
      }
      setGalleryImages(Array.from(images));
    } catch (e) { console.error("Gallery err", e); }
  };

  const handlePickGallery = (url: string) => {
     setLogoPreview(url);
     setSchoolLogo(url); 
     setLogoFile(null); 
     setIsGalleryOpen(false);
  };

  useEffect(() => {
    const configRef = ref(database, "settings/school");
    get(configRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSchoolName(data.name || "E-Ujian");
        setSchoolLogo(data.logoUrl || "");
        setLogoPreview(data.logoUrl || "");
      } else {
        setSchoolName("E-Ujian");
      }
      setLoading(false);
    });
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
      let logoUrl = schoolLogo;

      if (logoFile) {
        const uploadRes = await uploadInventoryImage("school", logoFile);
        logoUrl = uploadRes.url;
      }

      const configRef = ref(database, "settings/school");
      await update(configRef, {
        name: schoolName,
        logoUrl: logoUrl,
        updatedAt: Date.now(),
      });

      setSchoolLogo(logoUrl);
      setLogoFile(null);
      addToast({ title: "Berhasil!", description: "Pengaturan berhasil diperbarui.", type: "success" });
    } catch (err: any) {
      addToast({ title: "Gagal", description: "Terjadi kesalahan saat menyimpan pengaturan.", type: "error" });
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola informasi sekolah dan aset visual identitas CBT.</p>
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
                  className="rounded-xl"
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
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Rekomendasi model sirkel/kotak, max 2MB.</p>
                  </div>
                </div>
              </FormField>

              <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/40 mt-4 flex justify-end">
                <Button 
                   type="submit" 
                   disabled={saving} 
                   className="bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold rounded-xl h-9 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
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
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 text-purple-600 dark:text-purple-400">
                <Image className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                  <span className="font-semibold text-xs">Unggah Dari Komputer</span>
                  <span className="text-[10px] text-slate-400">File foto maksimal 2MB</span>
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
                  <span className="font-semibold text-xs">Ambil Dari Galeri</span>
                  <span className="text-[10px] text-slate-400">Gunakan file yang sudah di-upload</span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-500" /> Galeri Media Soal
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {galleryImages.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Belum ada gambar di galeri.</div>
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
