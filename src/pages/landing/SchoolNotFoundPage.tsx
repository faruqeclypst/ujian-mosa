import { useNavigate } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";
import { Building2, ArrowLeft, RefreshCw, LogOut, School } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const SchoolNotFoundPage = () => {
  const { slug, inactive, setManualSchool } = useTenant();
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
        <div className="w-24 h-24 bg-red-50 border border-red-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Building2 size={36} className="text-red-500" />
        </div>

        {inactive ? (
          <>
            <h1 className="text-3xl font-extrabold mb-3 text-slate-900">Sekolah Tidak Aktif</h1>
            <p className="text-slate-600 leading-relaxed mb-3 font-medium">
              Platform ujian untuk sekolah <code className="text-slate-800 font-bold bg-slate-200 px-2 py-0.5 rounded-md text-sm">{slug}</code> saat ini ditangguhkan.
            </p>
            <p className="text-slate-500 text-sm mb-8 font-medium">Silakan hubungi administrator sekolah atau tim EXAM AA untuk informasi lebih lanjut.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold mb-3 text-slate-900">Sekolah Tidak Ditemukan</h1>
            <p className="text-slate-600 leading-relaxed mb-3 font-medium">
              URL <code className="text-slate-800 font-bold bg-slate-200 px-2 py-0.5 rounded-md text-sm">{slug}</code> tidak dikenali oleh sistem EXAM AA.
            </p>
            <p className="text-slate-500 text-sm mb-8 font-medium">Mohon pastikan pengetikan link ujian sekolah Anda sudah benar.</p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
            Ke Beranda EXAM AA
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolNotFoundPage;
