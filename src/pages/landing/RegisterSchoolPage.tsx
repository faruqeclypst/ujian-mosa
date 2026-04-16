import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, ArrowLeft, CheckCircle, Send, User, Mail, Phone, MapPin, Hash } from "lucide-react";
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
      setError("Nama sekolah, slug, dan email wajib diisi.");
      return;
    }
    if (form.slug_request.length < 3) {
      setError("Slug minimal 3 karakter.");
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
        setError("Slug tersebut sudah digunakan. Coba nama lain.");
      } else {
        setError(err.message || "Gagal mengirim pendaftaran. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-green-50 border border-green-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h1 className="text-3xl font-extrabold mb-3">Pendaftaran Terkirim!</h1>
          <p className="text-slate-600 text-base mb-2 leading-relaxed font-medium">
            Terima kasih! Pengajuan dari <span className="text-slate-900 font-bold">{form.school_name}</span> telah kami terima.
          </p>
          <p className="text-slate-500 text-sm mb-8 font-medium">
            Tim kami akan menghubungi Anda melalui email <span className="text-blue-600 font-semibold">{form.contact_email}</span> dalam 1×24 jam kerja.
          </p>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8 text-left shadow-sm">
            <p className="text-xs text-slate-500 mb-1 font-medium">Subdomain yang didaftarkan:</p>
            <code className="text-blue-700 font-mono text-sm font-bold">
              {form.slug_request}.alfaruqasri.my.id
            </code>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-slate-500 hover:text-slate-900 font-bold transition-colors text-sm flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={16} /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const fields = [
    { name: "school_name", label: "Nama Sekolah", placeholder: "SMPN 1 Kota Contoh", icon: GraduationCap, type: "text" },
    {
      name: "slug_request", label: "Subdomain yang Diinginkan", placeholder: "smpn1-kota-contoh", icon: Hash, type: "text",
      hint: `Akan menjadi: ${form.slug_request || "nama-sekolah"}.alfaruqasri.my.id`
    },
    { name: "contact_email", label: "Email Kontak", placeholder: "admin@sekolah.sch.id", icon: Mail, type: "email" },
    { name: "contact_phone", label: "No. WhatsApp / HP", placeholder: "08xxxxxxxxxx", icon: Phone, type: "tel" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
      <div className="max-w-lg w-full relative z-10">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors text-sm mb-8"
        >
          <ArrowLeft size={16} /> Kembali ke Beranda
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">E-Ujian SaaS</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Daftarkan Sekolah Anda</h1>
          <p className="text-slate-600 text-base font-medium">
            Isi formulir ini dan tim teknis kami akan menghubungi untuk menyiapkan platform ujian sekolah Anda.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl font-medium">
              {error}
            </div>
          )}

          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {field.label}
                {["school_name", "slug_request", "contact_email"].includes(field.name) && (
                  <span className="text-red-500 ml-1.5">*</span>
                )}
              </label>
              <div className="relative">
                <field.icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={field.type}
                  name={field.name}
                  value={(form as any)[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full h-12 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-11 pr-4 text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-all font-medium"
                />
              </div>
              {field.hint && (
                <div className="mt-2 ml-1">
                  <p className="text-xs text-blue-600/80 font-mono font-medium">{field.hint}</p>
                  {field.name === "slug_request" && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-tight italic">
                      ⚠ PENTING: Subdomain ini bersifat permanen dan tidak dapat diganti setelah sistem aktif.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Address */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <MapPin size={14} className="inline mr-1 text-slate-400" />Alamat Sekolah
            </label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Jl. Pendidikan No. 1, Kota..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-all resize-none font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-base mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={18} />
                Kirim Pengajuan
              </>
            )}
          </button>

          <p className="text-center text-slate-500 text-xs font-medium pt-2">
            Dengan menekan Kirim Pengajuan, Anda menyetujui Ketentuan E-Ujian.
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterSchoolPage;
