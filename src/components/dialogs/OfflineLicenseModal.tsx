import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "../ui/dialog";
import {
  KeyRound,
  ShieldCheck,
  Calendar,
  Users,
  Copy,
  Check,
  Download,
  MessageCircle,
  Sparkles,
  Server,
  Search,
  Loader2,
  Building2,
  ChevronDown
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { generateOfflineLicense, OfflineLicensePayload } from "../../utils/offlineLicenseHelper";
import { searchSekolah, generateSlugFromName } from "../../utils/sekolahApiHelper";

export interface AvailableSchoolItem {
  id?: string;
  name: string;
  slug: string;
  student_quota?: number;
  active_until?: string;
  contact_phone?: string;
  contact_email?: string;
}

interface OfflineLicenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school?: AvailableSchoolItem | null;
  availableSchools?: AvailableSchoolItem[];
  onSuccess?: (licenseCode: string) => void;
}

export const OfflineLicenseModal: React.FC<OfflineLicenseModalProps> = ({
  open,
  onOpenChange,
  school: initialSchool,
  availableSchools = [],
  onSuccess
}) => {
  const { addToast } = useToast();

  const [selectedSchool, setSelectedSchool] = useState<AvailableSchoolItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isCustomSchool, setIsCustomSchool] = useState(false);

  const [validUntil, setValidUntil] = useState("");
  const [npsn, setNpsn] = useState("");
  const [notes, setNotes] = useState("Izin Ujian Laboratorium Sekolah");
  const [contactPhone, setContactPhone] = useState("");
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSearchingNpsn, setIsSearchingNpsn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Inisialisasi form saat modal terbuka atau data initialSchool berubah
  useEffect(() => {
    if (open) {
      setGeneratedLicense(null);
      setIsCopied(false);

      if (initialSchool) {
        setSelectedSchool(initialSchool);
        setIsCustomSchool(false);
        setCustomName(initialSchool.name);
        setCustomSlug(initialSchool.slug);
        setContactPhone(initialSchool.contact_phone || "");

        if (initialSchool.active_until) {
          setValidUntil(initialSchool.active_until.split("T")[0]);
        } else {
          const nextSixMonths = new Date();
          nextSixMonths.setMonth(nextSixMonths.getMonth() + 6);
          setValidUntil(nextSixMonths.toISOString().split("T")[0]);
        }
      } else {
        // Jika tidak ada initialSchool tapi ada availableSchools, default ke sekolah pertama atau mode custom
        if (availableSchools.length > 0) {
          const first = availableSchools[0];
          setSelectedSchool(first);
          setIsCustomSchool(false);
          setCustomName(first.name);
          setCustomSlug(first.slug);
          setContactPhone(first.contact_phone || "");
          if (first.active_until) {
            setValidUntil(first.active_until.split("T")[0]);
          } else {
            const nextSixMonths = new Date();
            nextSixMonths.setMonth(nextSixMonths.getMonth() + 6);
            setValidUntil(nextSixMonths.toISOString().split("T")[0]);
          }
        } else {
          setSelectedSchool(null);
          setIsCustomSchool(true);
          setCustomName("");
          setCustomSlug("");
          setContactPhone("");
          const nextSixMonths = new Date();
          nextSixMonths.setMonth(nextSixMonths.getMonth() + 6);
          setValidUntil(nextSixMonths.toISOString().split("T")[0]);
        }
      }
    }
  }, [initialSchool, open, availableSchools]);

  const activeName = isCustomSchool ? customName.trim() : (selectedSchool?.name || "");
  const activeSlug = isCustomSchool
    ? (customSlug.trim() || generateSlugFromName(customName))
    : (selectedSchool?.slug || "");

  const handleSchoolSelectChange = (slug: string) => {
    if (slug === "__custom__") {
      setIsCustomSchool(true);
      setSelectedSchool(null);
      setCustomName("");
      setCustomSlug("");
      setContactPhone("");
    } else {
      setIsCustomSchool(false);
      const found = availableSchools.find((s) => s.slug === slug);
      if (found) {
        setSelectedSchool(found);
        setCustomName(found.name);
        setCustomSlug(found.slug);
        setContactPhone(found.contact_phone || "");
        if (found.active_until) {
          setValidUntil(found.active_until.split("T")[0]);
        }
      }
    }
  };

  const handleGenerate = async () => {
    if (!activeName) {
      addToast({ title: "Gagal", description: "Nama sekolah wajib diisi.", type: "error" });
      return;
    }
    if (!activeSlug) {
      addToast({ title: "Gagal", description: "Slug subdomain sekolah wajib diisi.", type: "error" });
      return;
    }
    if (!validUntil) {
      addToast({ title: "Gagal", description: "Tentukan batas tanggal lisensi.", type: "error" });
      return;
    }

    setIsGenerating(true);
    try {
      const payload: OfflineLicensePayload = {
        school_name: activeName,
        slug: activeSlug,
        npsn: npsn.trim() || undefined,
        valid_until: validUntil,
        max_students: 0, // 0 = tanpa batas kuota untuk server offline
        issued_at: new Date().toISOString(),
        notes: notes.trim()
      };

      const code = await generateOfflineLicense(payload);
      setGeneratedLicense(code);
      onSuccess?.(code);

      addToast({
        title: "Lisensi RSA-2048 Berhasil Diterbitkan",
        description: `Lisensi server offline untuk ${activeName} berhasil ditandatangani secara kriptografis.`,
        type: "success"
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Menerbitkan Lisensi",
        description: err?.message || "Terjadi kendala teknis saat menandatangani lisensi.",
        type: "error"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLicense) return;
    navigator.clipboard.writeText(generatedLicense);
    setIsCopied(true);
    addToast({ title: "Tersalin", description: "Kode lisensi disalin ke clipboard.", type: "success" });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!generatedLicense) return;
    const blob = new Blob([generatedLicense], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `license_${activeSlug || "offline"}.key`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendWA = () => {
    if (!generatedLicense) return;
    const cleanPhone = contactPhone.replace(/\D/g, "");
    let phoneParam = "";
    if (cleanPhone) {
      phoneParam = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;
    }

    const text = `Halo Bapak/Ibu Proktor *${activeName}*,\n\nBerikut adalah *Kode Lisensi Izin Server Mandiri (EXAMKU Offline CBT)* resmi dari Super Admin:\n\n*Sekolah:* ${activeName}\n*Subdomain:* ${activeSlug}.examku.my.id\n*Masa Aktif Server:* Sampai dengan ${validUntil}\n*Kapasitas Siswa:* Tanpa Batas Kuota (Mandiri)\n*Keperluan:* ${notes}\n\n*Kode Lisensi Resmi (RSA-2048):*\n\`\`\`${generatedLicense}\`\`\`\n\n*Panduan Aktivasi:*\n1. Buka dashboard server CBT di komputer proktor laboratorium sekolah.\n2. Buka menu Pengaturan atau halaman Aktivasi Server Offline.\n3. Tempelkan kode lisensi di atas lalu klik Aktifkan.\n\nSelamat melaksanakan kegiatan ujian dengan lancar.`;

    const targetUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(targetUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <KeyRound size={16} />
            </div>
            Izin & Lisensi Server Offline (Proktor)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Terbitkan tanda tangan digital resmi RSA-2048 agar server lokal sekolah dapat melaksanakan ujian secara penuh tanpa internet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Pemilihan / Identitas Sekolah */}
          {initialSchool ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Sekolah Terpilih</span>
                <p className="font-bold text-slate-900 dark:text-white">{initialSchool.name}</p>
                <code className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">{initialSchool.slug}.examku.my.id</code>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Status Validasi</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={12} /> Terverifikasi
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Pilih Sekolah Pemohon
              </label>
              {availableSchools.length > 0 && (
                <div className="relative">
                  <select
                    value={isCustomSchool ? "__custom__" : (selectedSchool?.slug || "")}
                    onChange={(e) => handleSchoolSelectChange(e.target.value)}
                    className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <optgroup label="Sekolah Terdaftar di Database">
                      {availableSchools.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name} ({s.slug}.examku.my.id)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Lainnya">
                      <option value="__custom__">+ Ketik Sekolah Baru / Custom</option>
                    </optgroup>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              )}

              {isCustomSchool && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Nama Sekolah
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: SMA Negeri 1 Banda Aceh"
                      value={customName}
                      onChange={(e) => {
                        setCustomName(e.target.value);
                        if (!customSlug) {
                          setCustomSlug(generateSlugFromName(e.target.value));
                        }
                      }}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Slug Subdomain
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: sman1bandaaceh"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                      className="h-9 text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Konfigurasi Lisensi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Batas Masa Aktif Server Offline
              </label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  NPSN Sekolah (Opsional)
                </label>
                <button
                  type="button"
                  disabled={isSearchingNpsn}
                  onClick={async () => {
                    if (!activeName) return;
                    setIsSearchingNpsn(true);
                    const items = await searchSekolah(activeName, 3);
                    setIsSearchingNpsn(false);
                    if (items.length > 0 && items[0].npsn) {
                      setNpsn(items[0].npsn);
                      addToast({
                        title: "NPSN Ditemukan",
                        description: `${items[0].nama} (${items[0].npsn})`,
                        type: "success"
                      });
                    } else {
                      addToast({
                        title: "Tidak Ditemukan",
                        description: "NPSN tidak ditemukan di database Kemdikbud. Anda dapat mengisi secara manual.",
                        type: "warning"
                      });
                    }
                  }}
                  className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  {isSearchingNpsn ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  <span>{isSearchingNpsn ? "Mencari..." : "Cari di Kemdikbud"}</span>
                </button>
              </div>
              <Input
                type="text"
                value={npsn}
                onChange={(e) => setNpsn(e.target.value)}
                placeholder="Contoh: 10203040 atau ketik custom"
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                No. WhatsApp Proktor (Opsional)
              </label>
              <Input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Keperluan / Keterangan
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Izin Ujian Laboratorium Sekolah"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={isGenerating || !activeName || !activeSlug}
            onClick={handleGenerate}
            className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={14} /> {isGenerating ? "Menandatangani Kriptografi..." : "Terbitkan & Tandatangani Lisensi RSA-2048"}
          </Button>

          {/* Kotak Hasil Kode Lisensi */}
          {generatedLicense && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Kode Lisensi RSA-2048 Resmi Super Admin
                </span>
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-700">
                  Asymmetric Verified
                </span>
              </div>

              <textarea
                readOnly
                rows={3}
                value={generatedLicense}
                className="w-full p-2.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 select-all resize-none outline-none focus:ring-1 focus:ring-purple-500"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1 h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center gap-1.5"
                >
                  {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  Salin Kode
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadFile}
                  className="h-9 px-3 rounded-xl text-xs font-bold border-purple-200 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950 flex items-center gap-1.5"
                >
                  <Download size={13} /> Unduh .key
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendWA}
                  className="h-9 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <MessageCircle size={13} /> Kirim WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
