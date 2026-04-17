import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertTriangle
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";

const RegisterSchoolPage = () => {
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
  });

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
      setError("Nama sekolah, subdomain, dan email wajib diisi.");
      return;
    }
    if (form.slug_request.length < 3) {
      setError("Subdomain minimal 3 karakter.");
      return;
    }

    setLoading(true);
    try {
      await masterPb.collection("school_requests").create({
        ...form,
        status: "pending",
      });
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

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50 animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />

        <div className="max-w-xl w-full relative z-10">
          <div className="bg-white/80 backdrop-blur-xl border border-white p-8 md:p-12 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] text-center">
            <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] animate-in zoom-in duration-500">
              <CheckCircle size={48} className="text-white" />
            </div>
            
            <h1 className="text-4xl font-display font-extrabold text-slate-900 mb-4 tracking-tight">
              Pendaftaran Berhasil!
            </h1>
            
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Terima kasih telah mempercayai kami. Tim teknis <span className="font-bold text-slate-900">E-Ujian</span> akan segera memvalidasi pengajuan <span className="text-blue-600 font-bold">{form.school_name}</span>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 text-left shadow-sm">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Subdomain</p>
                <div className="flex items-center gap-2 text-blue-600 font-mono font-bold text-sm">
                  <Globe size={14} />
                  {form.slug_request}.alfaruqasri.my.id
                </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 text-left shadow-sm">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Konfirmasi Email</p>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <Mail size={14} />
                  {form.contact_email}
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-10 font-medium italic">
              * Estimasi aktivasi sistem adalah 1x24 jam kerja.
            </p>

            <button
              onClick={() => navigate("/")}
              className="w-full h-14 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
            >
              <ArrowLeft size={20} /> Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Dynamic Animated Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/60 rounded-full blur-[120px] animate-blob" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100/60 rounded-full blur-[120px] animate-blob animation-delay-2000" />
      <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-emerald-50/60 rounded-full blur-[100px] animate-blob animation-delay-4000" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative z-10">
        
        {/* Left Column: Information & Branding */}
        <div className="lg:col-span-5 lg:sticky lg:top-12">
          <div className="flex items-center gap-4 mb-10 group cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)] transition-transform group-hover:scale-110 duration-500">
              <GraduationCap size={32} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-2xl text-slate-900 leading-none">E-Ujian</h2>
              <p className="text-blue-600 font-bold text-sm tracking-widest uppercase">Platform SaaS</p>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight">
            Mulai Transformasi <span className="text-blue-600 italic">Digital</span> Sekolah Anda
          </h1>
          
          <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-md">
            Hanya butuh beberapa langkah untuk memiliki platform ujian online profesional yang mandiri, aman, dan canggih.
          </p>

          <div className="space-y-6">
            {[
              { icon: ShieldCheck, title: "Infrastruktur Terisolasi", desc: "Data sekolah Anda aman dalam server yang terpisah (multi-tenant)." },
              { icon: Zap, title: "Aktivasi Super Cepat", desc: "Sistem siap digunakan dalam kurang dari 24 jam setelah pengajuan." },
              { icon: Globe, title: "Subdomain Kustom", desc: "Gunakan nama sekolah Anda sebagai identitas digital resmi." }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                  <item.icon size={22} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/")}
            className="mt-12 group flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold transition-all text-sm"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Kembali ke Beranda
          </button>
        </div>

        {/* Right Column: The Form Card */}
        <div className="lg:col-span-7">
          <div className="bg-white/70 backdrop-blur-xl border border-white p-8 md:p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/50">
            <div className="mb-8">
              <h3 className="text-2xl font-display font-extrabold text-slate-900 mb-2">Formulir Pendaftaran</h3>
              <p className="text-slate-500 font-medium">Lengkapi data berikut dengan benar.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 text-sm p-4 rounded-2xl font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle size={18} />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nama Sekolah */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Nama Sekolah <span className="text-blue-600">*</span></label>
                  <div className="relative group">
                    <GraduationCap size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text"
                      name="school_name"
                      value={form.school_name}
                      onChange={handleChange}
                      placeholder="SMPN 1 Kota Contoh"
                      required
                      className="w-full h-14 bg-white/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-4 text-slate-900 placeholder:text-slate-300 text-sm outline-none transition-all font-semibold shadow-sm"
                    />
                  </div>
                </div>

                {/* Subdomain */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Subdomain <span className="text-blue-600">*</span></label>
                  <div className="relative group">
                    <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text"
                      name="slug_request"
                      value={form.slug_request}
                      onChange={handleChange}
                      placeholder="smpn1-kota"
                      required
                      className="w-full h-14 bg-white/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-4 text-slate-900 placeholder:text-slate-300 text-sm outline-none transition-all font-semibold shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Subdomain Preview - Re-styled to look like a premium browser bar */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Pratinjau Alamat Web</label>
                <div className="bg-slate-900 rounded-2xl p-4 shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Globe size={60} className="text-white" />
                  </div>
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="flex gap-1.5 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    
                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-lg h-9 flex items-center px-4 gap-2 border border-white/10">
                      <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                      <div className="flex items-center text-sm font-mono overflow-hidden">
                        <span className="text-white/40">https://</span>
                        <span className="text-emerald-400 font-bold tracking-tight">{form.slug_request || "nama-sekolah"}</span>
                        <span className="text-white/60">.alfaruqasri.my.id</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 px-1 text-[11px]">
                    <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md font-bold flex items-center gap-1.5 uppercase letter-spacing-wide">
                      <AlertTriangle size={12} />
                      Aturan Permanen
                    </div>
                    <p className="text-white/40 font-medium">Domain tidak dapat diubah setelah sistem diaktifkan.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Email Kontak <span className="text-blue-600">*</span></label>
                  <div className="relative group">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="email"
                      name="contact_email"
                      value={form.contact_email}
                      onChange={handleChange}
                      placeholder="admin@sekolah.sch.id"
                      required
                      className="w-full h-14 bg-white/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-4 text-slate-900 placeholder:text-slate-300 text-sm outline-none transition-all font-semibold shadow-sm"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">No. WhatsApp / HP</label>
                  <div className="relative group">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="tel"
                      name="contact_phone"
                      value={form.contact_phone}
                      onChange={handleChange}
                      placeholder="08xxxxxxxxxx"
                      className="w-full h-14 bg-white/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-4 text-slate-900 placeholder:text-slate-300 text-sm outline-none transition-all font-semibold shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Alamat Lengkap Sekolah</label>
                <div className="relative group">
                  <MapPin size={18} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Masukkan alamat lengkap sekolah Anda..."
                    rows={3}
                    className="w-full bg-white/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-4 py-4 text-slate-900 placeholder:text-slate-300 text-sm outline-none transition-all font-semibold shadow-sm resize-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl transition-all hover:scale-[1.01] active:translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] text-lg relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Kirim Pengajuan</span>
                      <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-slate-400 text-xs font-medium max-w-xs mx-auto leading-relaxed">
                Dengan mendaftar, Anda menyetujui <span className="text-blue-500 cursor-pointer hover:underline">Ketentuan Layanan</span> dan <span className="text-blue-500 cursor-pointer hover:underline">Kebijakan Privasi</span> E-Ujian.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSchoolPage;
