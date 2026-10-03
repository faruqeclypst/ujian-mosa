import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Server,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { verifyOfflineLicense, OfflineLicensePayload } from "../../utils/offlineLicenseHelper";
import PocketBase from "pocketbase";

interface OfflineActivationGateProps {
  pb: PocketBase | null;
  onActivated: () => void;
  currentLicense?: string | null;
  expiredReason?: string | null;
}

export const OfflineActivationGate: React.FC<OfflineActivationGateProps> = ({
  pb,
  onActivated,
  currentLicense,
  expiredReason
}) => {
  const [licenseInput, setLicenseInput] = useState(currentLicense || "");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(expiredReason || null);
  const [verifiedPayload, setVerifiedPayload] = useState<OfflineLicensePayload | null>(null);
  const { addToast } = useToast();

  const handleVerifyAndActivate = async () => {
    if (!licenseInput.trim()) {
      setErrorMsg("Masukkan kode lisensi dari Super Admin.");
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    const res = await verifyOfflineLicense(licenseInput.trim());

    if (!res.valid) {
      setIsVerifying(false);
      setErrorMsg(res.message);
      addToast({ title: "Aktivasi Gagal", description: res.message, type: "error" });
      return;
    }

    setVerifiedPayload(res.payload!);

    // Simpan lisensi ke server PocketBase (database server) agar permanen untuk semua browser & komputer peserta di LAN
    const cleanLicense = licenseInput.trim();
    const schoolName = res.payload?.school_name || "";

    // 1. Coba via hook /api/offline-activate
    try {
      await fetch(`${window.location.origin}/api/offline-activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license: cleanLicense,
          school_name: schoolName
        })
      });
    } catch (e) {
      console.warn("Hook /api/offline-activate tidak tersedia, mencoba direct settings update:", e);
    }

    // 2. Coba via direct PB settings update
    if (pb) {
      try {
        const settingsList = await pb.collection("settings").getList(1, 1);
        if (settingsList.items.length > 0) {
          await pb.collection("settings").update(settingsList.items[0].id, {
            offline_license: cleanLicense,
            name: schoolName || settingsList.items[0].name
          });
        }
      } catch (err) {
        console.warn("Gagal update pb settings lokal:", err);
      }
    }

    // Simpan juga di localStorage sebagai backup cepat
    try {
      localStorage.setItem("exam_offline_license", licenseInput.trim());
    } catch {}

    setIsVerifying(false);
    addToast({
      title: "Server Offline Aktif!",
      description: `Lisensi resmi ${res.payload?.school_name} berhasil diverifikasi.`,
      type: "success"
    });

    setTimeout(() => {
      onActivated();
    }, 1200);
  };

  const handleContactSuperAdmin = () => {
    const text = "Halo Super Admin EXAM AA, kami ingin mengajukan aktivasi / perpanjangan Izin Lisensi Server Offline CBT untuk sekolah kami. Mohon bantuannya.";
    window.open(`https://wa.me/6285359907696?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden text-slate-100">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6 relative z-10 text-center">
        {/* Icon & Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shadow-inner">
            <KeyRound size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Aktivasi Izin Server Offline
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Penggunaan server mandiri (LAN / Lab Komputer) memerlukan konfirmasi &amp; lisensi resmi dari Super Admin.
            </p>
          </div>
        </div>

        {/* Status Error jika ada */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs text-left flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Sukses */}
        {verifiedPayload && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs text-left space-y-1 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-bold text-emerald-200">
              <CheckCircle2 size={16} /> Lisensi Berhasil Diverifikasi!
            </div>
            <p className="text-[11px] text-emerald-300/80">Sekolah: <b>{verifiedPayload.school_name}</b></p>
            <p className="text-[11px] text-emerald-300/80">Masa Aktif: <b>Sampai {verifiedPayload.valid_until}</b> ({verifiedPayload.max_students} Siswa)</p>
          </div>
        )}

        {/* Input Lisensi */}
        <div className="space-y-3 text-left">
          <label className="text-xs font-bold text-slate-300 block">
            Kode Lisensi dari Super Admin
          </label>
          <textarea
            rows={4}
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value)}
            placeholder="Tempelkan kode lisensi di sini (contoh: EXAMKU-OFFLINE.v1...)"
            className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
          />
        </div>

        {/* Tombol Aksi */}
        <div className="space-y-2.5">
          <Button
            type="button"
            onClick={handleVerifyAndActivate}
            disabled={isVerifying || !licenseInput.trim()}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              "Memverifikasi Tanda Tangan..."
            ) : (
              <>
                <Sparkles size={14} /> Aktifkan Server Offline <ArrowRight size={14} />
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleContactSuperAdmin}
            className="w-full h-10 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <MessageCircle size={14} className="text-emerald-400" />
            Minta Izin / Hubungi Super Admin
          </Button>
        </div>

        <p className="text-[10px] text-slate-500 font-medium">
          Lisensi terikat dengan identitas sekolah dan diverifikasi secara kriptografis tanpa membutuhkan koneksi internet.
        </p>
      </div>
    </div>
  );
};
