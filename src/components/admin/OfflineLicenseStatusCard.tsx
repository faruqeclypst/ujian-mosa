import React, { useState } from "react";
import {
  ShieldCheck,
  Calendar,
  Building2,
  KeyRound,
  RotateCw,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Server
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import { verifyOfflineLicense } from "../../utils/offlineLicenseHelper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export const OfflineLicenseStatusCard: React.FC = () => {
  const { school, pb, refreshSchool } = useTenant();
  const { addToast } = useToast();

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [newLicenseInput, setNewLicenseInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hanya tampilkan jika server berada dalam mode offline lokal
  if (school?.id !== "local_server" && school?.plan !== "offline") {
    return null;
  }

  const payload = school?.offline_license_payload;
  const activeCode = school?.offline_license;
  const validUntilRaw = school?.active_until || payload?.valid_until;

  let daysRemaining: number | null = null;
  let formattedDate = "Tidak Ditentukan";
  let isExpired = false;
  let isExpiringSoon = false;

  if (validUntilRaw) {
    const targetDate = new Date(`${validUntilRaw.split("T")[0]}T23:59:59`);
    if (!isNaN(targetDate.getTime())) {
      const now = new Date();
      const diffTime = targetDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpired = daysRemaining <= 0;
      isExpiringSoon = daysRemaining > 0 && daysRemaining <= 14;
      formattedDate = targetDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
  }

  const handleCopyCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setIsCopied(true);
    addToast({ title: "Tersalin", description: "Kode lisensi aktif disalin ke clipboard.", type: "success" });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleActivateNewLicense = async () => {
    const clean = newLicenseInput.trim();
    if (!clean) {
      setErrorMsg("Masukkan kode lisensi baru dari Super Admin.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const res = await verifyOfflineLicense(clean);
    if (!res.valid) {
      setIsSaving(false);
      setErrorMsg(res.message);
      addToast({ title: "Verifikasi Gagal", description: res.message, type: "error" });
      return;
    }

    const schoolName = res.payload?.school_name || "";

    // 1. Simpan via hook /api/offline-activate
    try {
      await fetch(`${window.location.origin}/api/offline-activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license: clean,
          school_name: schoolName
        })
      });
    } catch (e) {
      console.warn("Hook /api/offline-activate gagal, mencoba direct settings update:", e);
    }

    // 2. Simpan via direct PocketBase settings
    if (pb) {
      try {
        const settingsList = await pb.collection("settings").getList(1, 1);
        if (settingsList.items.length > 0) {
          await pb.collection("settings").update(settingsList.items[0].id, {
            offline_license: clean,
            name: schoolName || settingsList.items[0].name
          });
        }
      } catch (err) {
        console.warn("Gagal update pb settings:", err);
      }
    }

    // 3. Simpan di localStorage
    try {
      localStorage.setItem("exam_offline_license", clean);
    } catch {}

    await refreshSchool();
    setIsSaving(false);
    setIsUpdateModalOpen(false);
    setNewLicenseInput("");

    addToast({
      title: "Lisensi Diperbarui",
      description: `Masa aktif server untuk ${res.payload?.school_name} berhasil diperbarui.`,
      type: "success"
    });
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
        {/* Header Kartu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Server size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Izin &amp; Lisensi Server Mandiri (Offline)
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck size={12} />
                  Resmi &amp; Sah
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Server CBT berjalan secara mandiri di jaringan lokal (LAN / Wi-Fi) dengan izin resmi Super Admin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUpdateModalOpen(true)}
              className="h-8 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <RotateCw size={13} />
              <span>Perbarui Lisensi</span>
            </Button>
          </div>
        </div>

        {/* Detail Data Lisensi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-xs">
          {/* Item 1: Nama Sekolah */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Institusi Berlisensi
            </span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <Building2 size={14} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">{school.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              NPSN: {school.npsn || payload?.npsn || "Mandiri / Custom"}
            </p>
          </div>

          {/* Item 2: Masa Berlaku */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Masa Izin Server
            </span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <Calendar size={14} className="text-slate-400 flex-shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="mt-1">
              {isExpired ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} /> Masa Izin Habis
                </span>
              ) : isExpiringSoon ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Clock size={12} /> Tersisa {daysRemaining} hari lagi
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Aktif (Tersisa {daysRemaining ?? "-"} hari)
                </span>
              )}
            </div>
          </div>

          {/* Item 3: Kuota & Peserta */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Kapasitas Peserta Ujian
            </span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <span className="text-emerald-600 dark:text-emerald-400">Tanpa Batas Kuota</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sesuai kapasitas lab LAN sekolah
            </p>
          </div>

          {/* Item 4: Kunci Lisensi Terpasang */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kode Lisensi Server
              </span>
              {activeCode && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Salin kode lisensi aktif"
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  {isCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{isCopied ? "Tersalin" : "Salin"}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              <KeyRound size={13} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">
                {activeCode ? `${activeCode.substring(0, 24)}...` : "Belum Terpasang"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {payload?.notes || "Izin Resmi Ujian Laboratorium"}
            </p>
          </div>
        </div>
      </div>

      {/* Dialog Aktivator / Pembaruan Lisensi Offline */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>Aktivator &amp; Pembaruan Lisensi Server</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Tempelkan kode lisensi perpanjangan resmi dari Super Admin untuk memperbarui masa aktif server mandiri ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={15} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Kode Lisensi Baru (dari Super Admin)
              </label>
              <textarea
                rows={4}
                value={newLicenseInput}
                onChange={(e) => {
                  setNewLicenseInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Tempelkan kode lisensi di sini (contoh: EXAMKU-OFFLINE.v1...)"
                className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsUpdateModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={handleActivateNewLicense}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4"
              >
                {isSaving ? "Menyimpan..." : "Aktifkan & Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
