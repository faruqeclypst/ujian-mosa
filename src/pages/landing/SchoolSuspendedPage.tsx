import { useNavigate } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";
import { AlertOctagon, ArrowLeft, RefreshCw, CreditCard, ShieldAlert, School, ExternalLink } from "lucide-react";
import { Capacitor } from "@capacitor/core";

const SchoolSuspendedPage = () => {
  const { school, slug, subscriptionStatus, setManualSchool } = useTenant();
  const navigate = useNavigate();

  const schoolName = school?.name || slug?.toUpperCase() || "Institusi";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 relative">
      {/* Floating Change School Button (Mobile App Only) */}
      {Capacitor.isNativePlatform() && (
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-all shadow-sm"
          >
            <School size={16} />
            <span>Ganti Sekolah</span>
          </button>
        </div>
      )}

      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <ShieldAlert size={36} className="text-rose-600 dark:text-rose-400" />
        </div>

        {/* Heading */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 mb-3">
          <AlertOctagon size={13} />
          <span>Masa Aktif Berakhir</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black mb-3 text-slate-900 dark:text-white tracking-tight">
          Layanan Ditangguhkan Sementara
        </h1>

        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
          Masa operasional sistem CBT untuk <strong>{schoolName}</strong> telah melewati masa tenggang dan saat ini dinonaktifkan sementara.
        </p>

        {/* Box Penjelasan untuk Siswa / Guru */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 text-left shadow-xs">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
            Informasi Bagi Siswa & Guru
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sesi ujian dan portal belajar sedang dibekukan sementara. Seluruh data ujian, bank soal, dan riwayat nilai tersimpan aman di server kami. Silakan hubungi proktor, staf kurikulum, atau penanggung jawab CBT sekolah Anda untuk aktivasi perpanjangan layanan.
          </p>
        </div>

        {/* Box Solusi untuk Administrator Sekolah */}
        <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Punya Akses Administrator?
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                Anda dapat membuka kunci seluruh layanan dalam hitungan menit dengan menyelesaikan tagihan perpanjangan via QRIS / Transfer.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => navigate("/admin/invoice")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <CreditCard size={14} />
                  <span>Buka Tagihan & Bayar QRIS</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold px-5 py-2.5 rounded-xl text-xs transition shadow-xs"
          >
            <RefreshCw size={14} /> Cek Status Lagi
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold px-5 py-2.5 rounded-xl text-xs transition shadow-xs"
          >
            <ArrowLeft size={14} /> Login Admin Sekolah
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolSuspendedPage;
