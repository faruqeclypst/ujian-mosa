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
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { generateOfflineLicense, OfflineLicensePayload } from "../../utils/offlineLicenseHelper";
import { searchSekolah } from "../../utils/sekolahApiHelper";

interface OfflineLicenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: {
    name: string;
    slug: string;
    student_quota?: number;
    active_until?: string;
    contact_phone?: string;
  } | null;
}

export const OfflineLicenseModal: React.FC<OfflineLicenseModalProps> = ({
  open,
  onOpenChange,
  school
}) => {
  const { addToast } = useToast();
  const [validUntil, setValidUntil] = useState("");
  const [npsn, setNpsn] = useState("");
  const [notes, setNotes] = useState("Izin Ujian Laboratorium Sekolah");
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSearchingNpsn, setIsSearchingNpsn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (school) {
      // Default tanggal: 6 bulan dari sekarang atau active_until jika ada
      if (school.active_until) {
        setValidUntil(school.active_until.split("T")[0]);
      } else {
        const nextSixMonths = new Date();
        nextSixMonths.setMonth(nextSixMonths.getMonth() + 6);
        setValidUntil(nextSixMonths.toISOString().split("T")[0]);
      }
      setGeneratedLicense(null);
    }
  }, [school, open]);

  if (!school) return null;

  const handleGenerate = async () => {
    if (!validUntil) {
      addToast({ title: "Gagal", description: "Tentukan batas tanggal lisensi.", type: "error" });
      return;
    }

    setIsGenerating(true);
    try {
      const payload: OfflineLicensePayload = {
        school_name: school.name,
        slug: school.slug,
        npsn: npsn.trim() || undefined,
        valid_until: validUntil,
        max_students: 0, // 0 = tanpa batas kuota untuk server offline
        issued_at: new Date().toISOString(),
        notes: notes.trim()
      };

      const code = await generateOfflineLicense(payload);
      setGeneratedLicense(code);
      addToast({
        title: "Lisensi RSA-2048 Berhasil Ditandatangani",
        description: `Lisensi server offline untuk ${school.name} siap digunakan.`,
        type: "success"
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Menerbitkan Lisensi",
        description: err?.message || "Terjadi kesalahan saat menandatangani lisensi.",
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
    link.download = `license_${school.slug}.key`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendWA = () => {
    if (!generatedLicense) return;
    const text = `Halo Admin/Proktor *${school.name}*,\n\nBerikut adalah *Kode Lisensi Izin Server Offline (EXAM AA)* Anda:\n\n*Batas Masa Aktif:* ${validUntil}\n*Kapasitas Siswa:* Tanpa Batas Kuota (Mandiri)\n*Kode Lisensi:*\n\`\`\`${generatedLicense}\`\`\`\n\nSilakan masukkan kode ini di halaman aktivasi server lokal PC proktor Anda.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
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
            Konfirmasi dan terbitkan lisensi terenkripsi agar sekolah dapat menjalankan CBT di PC lokal tanpa internet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Identitas Sekolah */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Sekolah Terpilih</span>
              <p className="font-bold text-slate-900 dark:text-white">{school.name}</p>
              <code className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">{school.slug}.examku.my.id</code>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Status Server</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={12} /> Siap Diizinkan
              </span>
            </div>
          </div>

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
                  NPSN Sekolah (Opsional / Custom)
                </label>
                <button
                  type="button"
                  disabled={isSearchingNpsn}
                  onClick={async () => {
                    if (!school?.name) return;
                    setIsSearchingNpsn(true);
                    const items = await searchSekolah(school.name, 3);
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
                        description: "NPSN tidak ditemukan di database Kemdikbud. Anda dapat mengisi manual (custom).",
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

            <div className="col-span-1 sm:col-span-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Keterangan / Keperluan
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
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
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
                className="w-full p-2.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 select-all resize-none outline-none"
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
