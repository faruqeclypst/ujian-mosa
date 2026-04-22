import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  GraduationCap,
  ArrowLeft,
  CheckCircle,
  Send,
  Mail,
  Phone,
  MapPin,
  Hash,
  ShieldCheck,
  Zap,
  Globe,
  AlertTriangle,
  Building2,
  Sparkles,
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

const RegisterSchoolPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    school_name: "",
    slug_request: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    type: "school" as "school" | "campus",
    plan: "Paket Berkembang",
  });

  useEffect(() => {
    if (location.state?.selectedPlan) {
      setForm(prev => ({ ...prev, plan: location.state.selectedPlan }));
    }
  }, [location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === "slug_request"
        ? value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-")
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.school_name || !form.slug_request || !form.contact_email) {
      setError("Nama institusi, subdomain, dan email wajib diisi.");
      return;
    }
    if (form.slug_request.length < 3) {
      setError("Subdomain minimal 3 karakter.");
      return;
    }
    setLoading(true);
    try {
      await masterPb.collection("school_requests").create({ ...form, status: "pending" });
      setStep("success");
    } catch (err: any) {
      if (err.message?.includes("slug_request")) {
        setError("Subdomain tersebut sudah digunakan. Coba nama lain.");
      } else {
        setError(err.message || "Gagal mengirim pendaftaran. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS STATE
  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-600/30">
            <CheckCircle size={40} className="text-white" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">Pendaftaran Berhasil!</h1>
          <p className="text-slate-500 text-base mb-8 leading-relaxed max-w-sm mx-auto">
            Terima kasih! Tim <span className="font-bold text-slate-900">EXAM AA</span> akan segera memvalidasi pengajuan{" "}
            <span className="text-blue-600 font-bold">{form.school_name}</span>.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Subdomain</p>
              <div className="flex items-center gap-1.5 text-blue-600 font-mono font-bold text-xs">
                <Globe size={12} />
                {form.slug_request}.alfaruqasri.my.id
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Email Konfirmasi</p>
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs truncate">
                <Mail size={12} className="flex-shrink-0" />
                <span className="truncate">{form.contact_email}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-8">
            <p className="text-amber-700 text-xs font-medium text-center">
              ⏱ Estimasi aktivasi sistem: <strong>1×24 jam kerja</strong>
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full h-12 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 text-sm"
          >
            <ArrowLeft size={18} />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // FORM STATE
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">EXAM AA</span>
          </div>
          <span className="text-slate-300 text-sm">/</span>
          <span className="text-slate-600 text-sm font-medium">Daftar Institusi</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left: Info column */}
          <div className="lg:col-span-4 lg:sticky lg:top-20">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 leading-tight">
                Mulai Transformasi{" "}
                <span className="text-blue-600">Digital</span>{" "}
                {form.type === 'school' ? 'Sekolah' : 'Universitas'} Anda
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Hanya butuh beberapa langkah untuk memiliki platform ujian online profesional yang mandiri dan aman.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: ShieldCheck, title: "Infrastruktur Terisolasi", desc: "Data sekolah aman dalam server yang terpisah (multi-tenant).", color: "text-blue-600 bg-blue-50 border-blue-100" },
                { icon: Zap, title: "Aktivasi Super Cepat", desc: "Sistem siap dalam kurang dari 24 jam setelah pengajuan.", color: "text-amber-600 bg-amber-50 border-amber-100" },
                { icon: Globe, title: "Subdomain Kustom", desc: "Nama institusi sebagai identitas digital resmi.", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border", item.color)}>
                    <item.icon size={17} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { value: "50+", label: "Institusi Terdaftar" },
                { value: "<24 Jam", label: "Waktu Aktivasi" },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
                  <p className="text-xl font-bold text-blue-600">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Form header */}
              <div className="px-5 sm:px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Formulir Pendaftaran</h2>
                  <p className="text-xs text-slate-400">Lengkapi data berikut dengan benar.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Package Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Pilih Paket Layanan <span className="text-blue-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: "Paket Berkembang", quota: "250 Siswa", icon: Zap, color: "blue" },
                      { name: "Paket Lanjutan", quota: "500 Siswa", icon: ShieldCheck, color: "amber" },
                      { name: "Paket Premium", quota: "1000 Siswa", icon: Sparkles, color: "purple" },
                    ].map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, plan: p.name }))}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          form.plan === p.name
                            ? `bg-${p.color}-50 border-${p.color}-500/50 text-${p.color}-700 ring-2 ring-${p.color}-500/10 shadow-sm`
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          form.plan === p.name ? `bg-${p.color}-600 text-white` : "bg-slate-100 text-slate-400"
                        )}>
                          {p.name === "Paket Berkembang" ? <Zap size={14} /> :
                            p.name === "Paket Lanjutan" ? <ShieldCheck size={14} /> :
                              <Sparkles size={14} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold leading-tight truncate">{p.name}</span>
                          <span className="text-[10px] opacity-60 font-medium">{p.quota}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Institutional Type Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipe Institusi <span className="text-blue-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: 'school' }))}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative overflow-hidden group",
                        form.type === 'school'
                          ? "bg-blue-50 border-blue-500/50 text-blue-600 shadow-md ring-2 ring-blue-500/10"
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      {form.type === 'school' && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                      <GraduationCap size={28} className={cn("transition-transform", form.type === 'school' && "scale-110")} />
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sekolah</p>
                        <p className="text-[9px] font-medium opacity-60">Guru & Siswa</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: 'campus' }))}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative overflow-hidden group",
                        form.type === 'campus'
                          ? "bg-indigo-50 border-indigo-500/50 text-indigo-600 shadow-md ring-2 ring-indigo-500/10"
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      {form.type === 'campus' && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
                      <Building2 size={28} className={cn("transition-transform", form.type === 'campus' && "scale-110")} />
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Universitas</p>
                        <p className="text-[9px] font-medium opacity-60">Dosen & Mahasiswa</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Row 1: Nama + Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama {form.type === 'school' ? 'Sekolah' : 'Universitas'} <span className="text-blue-600">*</span>
                    </label>
                    <div className="relative">
                      <GraduationCap size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text" name="school_name" value={form.school_name}
                        onChange={handleChange} placeholder={form.type === 'school' ? "SMPN 1 Kota Contoh" : "Universitas Contoh Indonesia"} required
                        className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Subdomain <span className="text-blue-600">*</span>
                    </label>
                    <div className="relative">
                      <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text" name="slug_request" value={form.slug_request}
                        onChange={handleChange} placeholder="smpn1-kota" required
                        className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* URL Preview */}
                <div className="bg-slate-900 rounded-xl p-4 relative overflow-hidden group">
                  <div className="absolute top-3 right-3 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Globe size={64} className="text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Pratinjau Alamat Web</p>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400/70" />
                      <div className="w-2 h-2 rounded-full bg-amber-400/70" />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/70" />
                    </div>
                    <div className="flex-1 bg-white/10 rounded-lg h-8 flex items-center px-3 gap-2 border border-white/10">
                      <ShieldCheck size={12} className="text-emerald-400 flex-shrink-0" />
                      <div className="flex items-center text-xs font-mono overflow-hidden min-w-0">
                        <span className="text-white/30">https://</span>
                        <span className="text-emerald-400 font-bold">{form.slug_request || "subdomain"}</span>
                        <span className="text-white/50">.alfaruqasri.my.id</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-red-400/70 font-medium mt-3 flex items-center gap-1.5">
                    <AlertTriangle size={10} />
                    Domain tidak dapat diubah setelah sistem diaktifkan.
                  </p>
                </div>

                {/* Row 2: Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Kontak <span className="text-blue-600">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email" name="contact_email" value={form.contact_email}
                        onChange={handleChange} placeholder="admin@sekolah.sch.id" required
                        className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      No. WhatsApp / HP
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel" name="contact_phone" value={form.contact_phone}
                        onChange={handleChange} placeholder="08xxxxxxxxxx"
                        className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alamat Lengkap {form.type === 'school' ? 'Sekolah' : 'Universitas'}
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <textarea
                      name="address" value={form.address}
                      onChange={handleChange}
                      placeholder={`Masukkan alamat lengkap ${form.type === 'school' ? 'sekolah' : 'universitas'}...`}
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  className={cn(
                    "w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl",
                    "flex items-center justify-center gap-2.5 transition-all text-sm",
                    "shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30",
                    "disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]",
                    "relative overflow-hidden group"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      Kirim Pengajuan Pendaftaran
                    </>
                  )}
                </button>

                <p className="text-center text-slate-400 text-xs font-medium">
                  Dengan mendaftar, Anda menyetujui{" "}
                  <span className="text-blue-500 cursor-pointer hover:underline">Ketentuan Layanan</span>{" "}
                  dan{" "}
                  <span className="text-blue-500 cursor-pointer hover:underline">Kebijakan Privasi</span>{" "}
                  EXAM AA.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSchoolPage;
