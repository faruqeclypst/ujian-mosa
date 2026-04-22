import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

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
    } catch {
      setError("Autentikasi gagal. Periksa email dan master key Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[120px] translate-y-1/2" />
        <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Branding Area */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] mb-6 group hover:scale-105 transition-transform duration-500">
            <div className="w-14 h-14 bg-blue-600 rounded-[1.8rem] flex items-center justify-center shadow-lg shadow-blue-200">
              <ShieldCheck size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            Super Admin
          </h1>
          <p className="text-slate-400 font-medium text-sm px-8 leading-relaxed">
            Portal Manajemen Infrastruktur & Distribusi Layanan EXAM AA
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.06)] border border-white p-8 md:p-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-4 py-3.5 rounded-2xl flex items-center gap-3 animate-in shake-in duration-300">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
                Email Pengelola
              </label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@exam.id"
                  required
                  className={cn(
                    "w-full h-14 bg-slate-50 border-transparent rounded-[1.5rem] pl-12 pr-5",
                    "text-slate-900 placeholder:text-slate-300 text-sm font-semibold transition-all",
                    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  )}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
                Master Security Key
              </label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className={cn(
                    "w-full h-14 bg-slate-50 border-transparent rounded-[1.5rem] pl-12 pr-5",
                    "text-slate-900 placeholder:text-slate-300 text-sm font-semibold transition-all",
                    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  )}
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-14 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-[1.5rem]",
                "flex items-center justify-center gap-3 transition-all duration-300 shadow-xl shadow-blue-100 hover:shadow-blue-200",
                "disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              )}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Masuk ke Konsol Manajemen</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Brand/Security Badge */}
        <div className="mt-12 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-500">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Server Protected by EXAM AA Shield</span>
          </div>
          <p className="text-slate-400 text-xs font-semibold">
            &copy; {new Date().getFullYear()} EXAM AA SaaS Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLoginPage;
