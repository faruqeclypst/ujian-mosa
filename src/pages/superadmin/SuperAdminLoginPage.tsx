import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, Mail, ChevronRight, Loader2, Server } from "lucide-react";
import { masterPb } from "../../lib/pocketbase";

const SuperAdminLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (masterPb.authStore.isValid && masterPb.authStore.model?.collectionName === "super_admins") {
      navigate("/superadmin");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await masterPb.collection("super_admins").authWithPassword(email, password);
      navigate("/superadmin");
    } catch (err: any) {
      setError("Ditolak. Pastikan email dan master key Anda benar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="max-w-md w-full relative z-10">
        <div className="bg-white border border-slate-200 p-8 sm:p-10 rounded-[2rem] shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin</h1>
            <p className="text-slate-500 font-medium text-sm mt-2">Masuk ke Portal Manajemen SaaS E-Ujian</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email Admin"
                  className="w-full h-12 bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-11 pr-4 text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all shadow-sm"
                />
              </div>

              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Master Key Password"
                  className="w-full h-12 bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-11 pr-4 text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Autentikasi <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-6 text-slate-500 text-xs font-semibold">
          © {new Date().getFullYear()} E-Ujian Manajemen Infrastruktur
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLoginPage;

