import { useNavigate } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";
import { Building2, ArrowLeft, RefreshCw, LogOut, School, Laptop, ShieldAlert } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const SchoolNotFoundPage = () => {
  const { slug, inactive, inactiveReason, isDeviceMismatch, setManualSchool } = useTenant();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 relative">
      {/* Floating Change School Button (Android Only) */}
      {Capacitor.isNativePlatform() && (
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full text-sm font-semibold text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
          >
            <School size={16} />
            <span>Ganti Sekolah</span>
          </button>
        </div>
      )}

      <div className="max-w-md w-full text-center">
        <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border ${
          isDeviceMismatch
            ? "bg-purple-50 border-purple-200 text-purple-600"
            : "bg-red-50 border-red-100 text-red-500"
        }`}>
          {isDeviceMismatch ? (
            <Laptop size={38} className="text-purple-600" />
          ) : (
            <Building2 size={36} className="text-red-500" />
          )}
        </div>

        {inactive ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-3 text-rose-600">
              {slug === "local" 
                ? (isDeviceMismatch ? "Aplikasi Terkunci: Duplikasi Perangkat" : "Akses Server Dinonaktifkan")
                : "Sekolah Tidak Aktif"}
            </h1>
            <p className="text-slate-600 leading-relaxed mb-3 font-medium text-xs sm:text-sm">
              {slug === "local"
                ? (inactiveReason || (isDeviceMismatch 
                    ? "Lisensi ini terikat khusus untuk komputer server awal. Duplikasi folder aplikasi ke komputer ini melanggar kebijakan lisensi sekolah." 
                    : "Server CBT Offline ini telah dinonaktifkan oleh Administrator Pusat karena pelanggaran kebijakan penggunaan."))
                : (
                  <>Platform ujian untuk sekolah <code className="text-slate-800 font-bold bg-slate-200 px-2 py-0.5 rounded-md text-sm">{slug}</code> saat ini ditangguhkan.</>
                )}
            </p>

            {slug === "local" && isDeviceMismatch && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 mb-3 text-left leading-relaxed space-y-1.5">
                <div>
                  ⚠️ <strong>Pencegahan Duplikasi:</strong> 1 lisensi hanya berlaku sah untuk 1 perangkat laptop/komputer server ujian.
                </div>
                <div>
                  🔄 <strong>Ganti Laptop Resmi?</strong> Jika laptop server utama sekolah Anda rusak atau ganti unit resmi, silakan hubungi <strong>Super Admin</strong> untuk mereset kunci perangkat (<em>Hardware ID</em>).
                </div>
              </div>
            )}

            {slug === "local" && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 mb-4 text-left leading-relaxed">
                🛡️ <strong>Database Anda Tetap Aman:</strong> Seluruh bank soal, ruang ujian, dan data siswa Anda <strong>tidak dihapus</strong> dan tetap 100% utuh di file database komputer ini (<code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded">data.db</code>).
              </div>
            )}
            <p className="text-slate-500 text-xs mb-6 font-medium">
              Silakan hubungi administrator pusat di <span className="font-mono text-slate-800 font-bold">admin@examku.my.id</span> untuk informasi pemulihan izin akses.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold mb-3 text-slate-900">Sekolah Tidak Ditemukan</h1>
            <p className="text-slate-600 leading-relaxed mb-3 font-medium">
              URL <code className="text-slate-800 font-bold bg-slate-200 px-2 py-0.5 rounded-md text-sm">{slug}</code> tidak dikenali oleh sistem EXAMKU.
            </p>
            <p className="text-slate-500 text-sm mb-8 font-medium">Mohon pastikan pengetikan link ujian sekolah Anda sudah benar.</p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            <RefreshCw size={16} /> Coba Lagi
          </button>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <button
            onClick={() => { setManualSchool(null); navigate("/"); }}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Ke Beranda EXAMKU
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolNotFoundPage;
