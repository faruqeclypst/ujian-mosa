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
  Clock,
  Calendar,
  Minus,
  Plus,
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import { getSchoolDomain, getDomainSuffix } from "../../utils/domainHelper";

const formatRupiah = (num: number) => {
  return "Rp " + num.toLocaleString("id-ID");
};

interface PlanPricingConfig {
  monthlyRate: number;
  fixed: {
    "1 Bulan": { total: string; detail: string };
    "6 Bulan": { total: string; detail: string };
    "1 Tahun": { total: string; detail: string };
  };
}

const PLAN_RATES: Record<string, PlanPricingConfig> = {
  basic: {
    monthlyRate: 380000,
    fixed: {
      "1 Bulan": { total: "Rp 380.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 2.100.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 3.840.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
  pro: {
    monthlyRate: 760000,
    fixed: {
      "1 Bulan": { total: "Rp 760.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 4.200.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 7.680.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
  ultimate: {
    monthlyRate: 1235000,
    fixed: {
      "1 Bulan": { total: "Rp 1.235.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 6.840.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 12.480.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
  "Paket Berkembang": {
    monthlyRate: 380000,
    fixed: {
      "1 Bulan": { total: "Rp 380.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 2.100.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 3.840.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
  "Paket Lanjutan": {
    monthlyRate: 760000,
    fixed: {
      "1 Bulan": { total: "Rp 760.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 4.200.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 7.680.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
  "Paket Premium": {
    monthlyRate: 1235000,
    fixed: {
      "1 Bulan": { total: "Rp 1.235.000", detail: "Tarif bulanan fleksibel" },
      "6 Bulan": { total: "Rp 6.840.000", detail: "Hemat 12% (1 Semester)" },
      "1 Tahun": { total: "Rp 12.480.000", detail: "Hemat 20% (12 Bulan)" },
    },
  },
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free Trial",
  basic: "Paket Berkembang",
  pro: "Paket Lanjutan",
  ultimate: "Paket Premium",
  "Paket Berkembang": "Paket Berkembang",
  "Paket Lanjutan": "Paket Lanjutan",
  "Paket Premium": "Paket Premium",
};

const getPricingEstimate = (
  planName: string,
  mode: "1 Bulan" | "6 Bulan" | "1 Tahun" | "custom",
  months: number
) => {
  const plan = PLAN_RATES[planName];
  if (!plan) return null;

  if (mode !== "custom") {
    const fixedInfo = plan.fixed[mode];
    if (fixedInfo) {
      return {
        total: fixedInfo.total,
        period: mode,
        detail: fixedInfo.detail,
      };
    }
  }

  // Jika custom bulan bernilai 6 bulan, harga sama dengan paket 6 bulannya (hemat 12%)
  if (months === 6) {
    return {
      total: plan.fixed["6 Bulan"].total,
      period: "6 Bulan",
      detail: "Sama dengan tarif Paket 6 Bulan (Hemat 12% / 1 Semester)",
    };
  }

  // Jika custom bulan bernilai 12 bulan, harga sama dengan paket 1 tahun
  if (months === 12) {
    return {
      total: plan.fixed["1 Tahun"].total,
      period: "12 Bulan (1 Tahun)",
      detail: "Sama dengan tarif Paket 1 Tahun (Hemat 20%)",
    };
  }

  // Perhitungan custom bulan: flat sesuai tarif bulanan
  const totalAmount = plan.monthlyRate * months;
  return {
    total: formatRupiah(totalAmount),
    period: `${months} Bulan`,
    detail: `${months} × ${formatRupiah(plan.monthlyRate)} / bln (Tarif flat bulanan)`,
  };
};

const RegisterSchoolPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [durationMode, setDurationMode] = useState<"1 Bulan" | "6 Bulan" | "1 Tahun" | "custom">("1 Tahun");
  const [customMonths, setCustomMonths] = useState<number>(2);

  const [form, setForm] = useState({
    school_name: "",
    slug_request: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    type: "school" as "school" | "campus",
    plan: "free" as string,
    duration: "14 Hari",
  });

  const isTrial = form.plan === "free" || form.plan.toLowerCase().includes("trial") || form.plan.toLowerCase().includes("demo");

  useEffect(() => {
    if (location.state?.selectedPlan) {
      const sp = String(location.state.selectedPlan);
      const spLower = sp.toLowerCase();
      if (spLower.includes("demo") || spLower.includes("trial") || spLower.includes("free") || spLower.includes("uji coba")) {
        setForm(prev => ({
          ...prev,
          plan: "free",
          duration: "14 Hari",
        }));
      } else {
        let targetPlan = "basic";
        if (spLower.includes("premium") || spLower.includes("ultimate")) {
          targetPlan = "ultimate";
        } else if (spLower.includes("lanjutan") || spLower.includes("pro")) {
          targetPlan = "pro";
        } else if (spLower.includes("berkembang") || spLower.includes("basic")) {
          targetPlan = "basic";
        }

        const matchDuration = sp.match(/\(([^)]+)\)/);
        const planClean = sp.replace(/\s*\([^)]+\)/, "").trim();
        const durRaw = matchDuration ? matchDuration[1] : "1 Tahun";

        if (durRaw.includes("1 Bulan")) {
          setDurationMode("1 Bulan");
          setForm(prev => ({ ...prev, plan: targetPlan, duration: "1 Bulan" }));
        } else if (durRaw.includes("6 Bulan") || durRaw.includes("semester")) {
          setDurationMode("6 Bulan");
          setForm(prev => ({ ...prev, plan: targetPlan, duration: "6 Bulan" }));
        } else if (durRaw.includes("1 Tahun") || durRaw.includes("12 Bulan") || durRaw.includes("tahun")) {
          setDurationMode("1 Tahun");
          setForm(prev => ({ ...prev, plan: targetPlan, duration: "1 Tahun" }));
        } else {
          // Tangani custom bulan misalnya "2 Bulan", "3 Bulan", dll
          const mMatch = durRaw.match(/(\d+)\s*bulan/i);
          const parsedM = mMatch ? parseInt(mMatch[1], 10) : 2;
          const validM = Math.min(36, Math.max(2, parsedM));
          setDurationMode("custom");
          setCustomMonths(validM);
          setForm(prev => ({
            ...prev,
            plan: targetPlan,
            duration: `${validM} Bulan`,
          }));
        }
      }
    }
  }, [location.state]);

  const handleDurationSelect = (mode: "1 Bulan" | "6 Bulan" | "1 Tahun" | "custom") => {
    setDurationMode(mode);
    if (mode === "custom") {
      setForm(prev => ({ ...prev, duration: `${customMonths} Bulan` }));
    } else {
      setForm(prev => ({ ...prev, duration: mode }));
    }
  };

  const handleCustomMonthsChange = (months: number) => {
    const valid = Math.min(36, Math.max(2, months));
    setCustomMonths(valid);
    if (durationMode === "custom") {
      setForm(prev => ({ ...prev, duration: `${valid} Bulan` }));
    }
  };

  const handlePlanSelect = (p: { key: string; isTrial: boolean }) => {
    if (p.isTrial) {
      setForm(prev => ({ ...prev, plan: "free", duration: "14 Hari" }));
    } else {
      setForm(prev => ({
        ...prev,
        plan: p.key,
        duration: prev.duration === "14 Hari"
          ? (durationMode === "custom" ? `${customMonths} Bulan` : durationMode)
          : prev.duration,
      }));
    }
  };

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

  const pricingEstimate = getPricingEstimate(form.plan, durationMode, customMonths);

  // SUCCESS STATE
  if (step === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 text-center shadow-sm">
          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-600/25">
            <CheckCircle size={34} className="text-white" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">
            {isTrial ? "Permintaan Free Trial Terkirim!" : "Pendaftaran Berhasil!"}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
            {isTrial ? (
              <>
                Terima kasih. Tim <span className="font-bold text-slate-800">EXAM AA</span> segera menyiapkan akses Free Trial 14 hari untuk{" "}
                <span className="text-blue-600 font-bold">{form.school_name}</span>.
              </>
            ) : (
              <>
                Terima kasih. Tim <span className="font-bold text-slate-800">EXAM AA</span> segera memvalidasi pendaftaran{" "}
                <span className="text-blue-600 font-bold">{form.school_name}</span>.
              </>
            )}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Subdomain</p>
              <div className="flex items-center gap-1.5 text-blue-600 font-mono font-bold text-xs truncate">
                <Globe size={13} className="shrink-0" />
                <span className="truncate">{getSchoolDomain(form.slug_request)}</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Paket & Durasi</p>
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs truncate">
                <Clock size={13} className="shrink-0 text-blue-600" />
                <span className="truncate">{isTrial ? "Free Trial (14 Hari)" : `${PLAN_LABELS[form.plan] || form.plan} (${form.duration})`}</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left col-span-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Email Konfirmasi</p>
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs truncate">
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{form.contact_email}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 mb-6">
            <p className="text-amber-800 text-xs font-medium text-center">
              Estimasi aktivasi sistem: <strong>1×24 jam kerja</strong>
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full h-11 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 text-xs sm:text-sm cursor-pointer"
          >
            <ArrowLeft size={16} />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // FORM STATE
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              aria-label="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <GraduationCap size={15} className="text-white" />
              </div>
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">EXAM AA</span>
            </div>
            <span className="text-slate-300 text-sm hidden sm:inline">/</span>
            <span className="text-slate-600 text-sm font-medium hidden sm:inline">Daftar Institusi</span>
          </div>

          <a
            href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20tanya%20seputar%20pendaftaran%20sekolah..."
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5"
          >
            <Phone size={13} className="text-emerald-600" />
            <span className="hidden sm:inline">Bantuan CS:</span> 0853 5990 7696
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

          {/* Left: Info column */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-3 py-1 rounded-full mb-3">
                <Sparkles size={13} className="text-blue-600" />
                <span>Portal Resmi Ujian Online</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3 leading-tight tracking-tight">
                Mulai Transformasi{" "}
                <span className="text-blue-600">Digital</span>{" "}
                {form.type === "school" ? "Sekolah" : "Universitas"} Anda
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Hanya butuh beberapa langkah untuk mengaktifkan platform ujian online profesional yang mandiri, aman, dan siap pakai.
              </p>
            </div>

            <div className="space-y-3.5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              {[
                { icon: ShieldCheck, title: "Infrastruktur Terisolasi", desc: "Data sekolah tersimpan aman dalam arsitektur multi-tenant mandiri.", color: "text-blue-600 bg-blue-50 border-blue-100" },
                { icon: Zap, title: "Aktivasi Super Cepat", desc: "Sistem siap digunakan dalam waktu kurang dari 24 jam kerja.", color: "text-amber-600 bg-amber-50 border-amber-100" },
                { icon: Globe, title: "Subdomain Kustom", desc: "Nama institusi tampil resmi sebagai identitas digital ujian.", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", item.color)}>
                    <item.icon size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-0.5">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "50+", label: "Institusi Terdaftar" },
                { value: "<24 Jam", label: "Waktu Aktivasi" },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-3.5 text-center shadow-2xs">
                  <p className="text-lg sm:text-xl font-black text-blue-600 tracking-tight">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              {/* Form header */}
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 flex items-center justify-center shrink-0">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-base">Formulir Pendaftaran</h2>
                    <p className="text-xs text-slate-500">Lengkapi data berikut untuk menyiapkan portal CBT.</p>
                  </div>
                </div>
                <span className="hidden sm:inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Aktivasi Cepat
                </span>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7 sm:space-y-8">
                {/* Error Banner */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-center gap-2.5 font-medium">
                    <AlertTriangle size={17} className="shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* SECTION 1: PAKET LAYANAN & DURASI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      1. Pilih Paket Layanan atau Uji Coba <span className="text-blue-600">*</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Pilih salah satu</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    {[
                      { key: "free", name: "Free Trial", quota: "50 Siswa", subtitle: "Uji Coba 14 Hari", icon: Clock, color: "emerald", isTrial: true },
                      { key: "basic", name: "Paket Berkembang", quota: "250 Siswa", subtitle: "Sekolah Standar", icon: Zap, color: "blue", isTrial: false },
                      { key: "pro", name: "Paket Lanjutan", quota: "500 Siswa", subtitle: "Sekolah Menengah", icon: ShieldCheck, color: "amber", isTrial: false },
                      { key: "ultimate", name: "Paket Premium", quota: "1000 Siswa", subtitle: "Sekolah Besar", icon: Sparkles, color: "purple", isTrial: false },
                    ].map((p) => {
                      const isSelected = form.plan === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handlePlanSelect(p)}
                          className={cn(
                            "flex flex-col p-3.5 rounded-2xl border transition-all text-left relative overflow-hidden cursor-pointer",
                            isSelected
                              ? p.isTrial
                                ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs"
                                : "bg-blue-50/80 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              isSelected
                                ? p.isTrial ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            )}>
                              <p.icon size={15} />
                            </div>
                            {p.isTrial && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Free Trial
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold leading-tight truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5">{p.quota}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Duration Selection for Paid Plans */}
                  {!isTrial ? (
                    <div className="pt-2 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Durasi Berlangganan <span className="text-blue-600">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Pilihan paket tetap atau atur durasi kustom</span>
                      </div>

                      {/* 4 Duration Buttons: 1 Bulan, 6 Bulan, 1 Tahun, Custom Bulan */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        {[
                          { label: "1 Bulan", mode: "1 Bulan" as const, sub: "Fleksibel" },
                          { label: "6 Bulan", mode: "6 Bulan" as const, sub: "1 Semester", badge: "Hemat 12%" },
                          { label: "1 Tahun", mode: "1 Tahun" as const, sub: "12 Bulan", badge: "Disarankan" },
                          { label: "Custom Bulan", mode: "custom" as const, sub: "Atur Sendiri", badge: "Kustom" },
                        ].map((d) => {
                          const isSelected = durationMode === d.mode;
                          return (
                            <button
                              key={d.mode}
                              type="button"
                              onClick={() => handleDurationSelect(d.mode)}
                              className={cn(
                                "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer min-h-[66px]",
                                isSelected
                                  ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-600/20 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                              )}
                            >
                              {d.badge && (
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-wider mb-1 px-1.5 py-0.2 rounded",
                                  d.mode === "1 Tahun"
                                    ? "bg-blue-100 text-blue-700"
                                    : d.mode === "6 Bulan"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-800"
                                )}>
                                  {d.badge}
                                </span>
                              )}
                              <span className="text-xs font-extrabold">{d.label}</span>
                              <span className="text-[10px] font-medium text-slate-400 mt-0.5">{d.sub}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Box Custom Bulan */}
                      {durationMode === "custom" && (
                        <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/90 shadow-2xs space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Calendar size={15} className="text-blue-600 shrink-0" />
                                <span className="text-xs font-bold text-slate-900">Atur Durasi Kustom</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Tarif flat bulanan {PLAN_LABELS[form.plan] || form.plan} (khusus durasi 6 bulan otomatis menggunakan harga hemat semester).
                              </p>
                            </div>

                            {/* Stepper control */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleCustomMonthsChange(customMonths - 1)}
                                disabled={customMonths <= 2}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                aria-label="Kurangi jumlah bulan"
                              >
                                <Minus size={14} />
                              </button>
                              <div className="px-3 min-w-[76px] text-center font-black text-xs sm:text-sm text-slate-900 select-none">
                                {customMonths} Bulan
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCustomMonthsChange(customMonths + 1)}
                                disabled={customMonths >= 36}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                aria-label="Tambah jumlah bulan"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Quick Preset Chips */}
                          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-200/70">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">Pilihan Cepat:</span>
                            {[2, 3, 4, 5, 6, 8, 9, 12].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleCustomMonthsChange(m)}
                                className={cn(
                                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                                  customMonths === m
                                    ? "bg-blue-600 text-white shadow-2xs"
                                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                )}
                              >
                                <span>{m} Bulan</span>
                                {m === 6 && (
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.2 rounded font-extrabold",
                                    customMonths === m ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                                  )}>
                                    Hemat
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pricing Info Card */}
                      {pricingEstimate && (
                        <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Perkiraan Biaya Layanan</p>
                            <div className="flex items-baseline gap-1.5 mt-1">
                              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                {pricingEstimate.total}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold">/ {pricingEstimate.period}</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="inline-block text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg shadow-2xs">
                              {pricingEstimate.detail}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-800 text-xs flex items-center gap-2.5">
                      <Clock size={16} className="text-emerald-600 shrink-0" />
                      <span>Uji coba Free Trial selama 14 hari penuh dengan kuota hingga 50 peserta ujian.</span>
                    </div>
                  )}
                </div>

                {/* SECTION 2: TIPE & IDENTITAS SEKOLAH */}
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Identitas Sekolah & Subdomain <span className="text-blue-600">*</span>
                    </h3>
                  </div>

                  {/* Institutional Type */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: "school" }))}
                      className={cn(
                        "flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden cursor-pointer",
                        form.type === "school"
                          ? "bg-blue-50/70 border-blue-500 text-blue-700 shadow-xs ring-2 ring-blue-500/10"
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      <GraduationCap size={26} className={cn(form.type === "school" ? "text-blue-600" : "text-slate-400")} />
                      <div className="text-center">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Sekolah</p>
                        <p className="text-[10px] text-slate-400 font-medium">SD, SMP, SMA, SMK</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: "campus" }))}
                      className={cn(
                        "flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden cursor-pointer",
                        form.type === "campus"
                          ? "bg-blue-50/70 border-blue-500 text-blue-700 shadow-xs ring-2 ring-blue-500/10"
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      <Building2 size={26} className={cn(form.type === "campus" ? "text-blue-600" : "text-slate-400")} />
                      <div className="text-center">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Universitas</p>
                        <p className="text-[10px] text-slate-400 font-medium">Kampus & Institusi</p>
                      </div>
                    </button>
                  </div>

                  {/* School Name & Slug */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Nama {form.type === "school" ? "Sekolah" : "Universitas"} <span className="text-blue-600">*</span>
                      </label>
                      <div className="relative">
                        <GraduationCap size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          name="school_name"
                          value={form.school_name}
                          onChange={handleChange}
                          placeholder={form.type === "school" ? "SMPN 1 Kota Contoh" : "Universitas Contoh Indonesia"}
                          required
                          className="w-full h-12 border border-slate-200 rounded-xl pl-10 pr-4 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Subdomain Permintaan <span className="text-blue-600">*</span>
                      </label>
                      <div className="relative">
                        <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          name="slug_request"
                          value={form.slug_request}
                          onChange={handleChange}
                          placeholder="smpn1-kota"
                          required
                          className="w-full h-12 border border-slate-200 rounded-xl pl-10 pr-4 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* URL Preview */}
                  <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                      Pratinjau Alamat Web CBT
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                      </div>
                      <div className="flex-1 bg-white/10 rounded-xl h-9 flex items-center px-3 gap-2 border border-white/10 overflow-hidden">
                        <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                        <div className="flex items-center text-xs font-mono overflow-hidden min-w-0">
                          <span className="text-white/40">https://</span>
                          <span className="text-emerald-400 font-bold">{form.slug_request || "subdomain"}</span>
                          <span className="text-white/60">{getDomainSuffix()}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                      <span>Subdomain ini akan menjadi alamat portal masuk ujian bagi siswa dan guru.</span>
                    </p>
                  </div>
                </div>

                {/* SECTION 3: INFORMASI KONTAK PENGELOLA */}
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Informasi Kontak Pengelola <span className="text-blue-600">*</span>
                    </h3>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Email Kontak <span className="text-blue-600">*</span>
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          name="contact_email"
                          value={form.contact_email}
                          onChange={handleChange}
                          placeholder="admin@sekolah.sch.id"
                          required
                          className="w-full h-12 border border-slate-200 rounded-xl pl-10 pr-4 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                        Gunakan email aktif. Seluruh informasi akun dan aktivasi dikirim ke sini.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        No. WhatsApp / HP
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          name="contact_phone"
                          value={form.contact_phone}
                          onChange={handleChange}
                          placeholder="08xxxxxxxxxx"
                          className="w-full h-12 border border-slate-200 rounded-xl pl-10 pr-4 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                        Untuk konfirmasi cepat dan koordinasi aktivasi oleh tim teknis.
                      </p>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Alamat Lengkap {form.type === "school" ? "Sekolah" : "Universitas"}
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                      <textarea
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        placeholder={`Masukkan alamat lengkap ${form.type === "school" ? "sekolah" : "universitas"}...`}
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: SUBMIT BUTTON */}
                <div className="pt-2 space-y-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full h-12 sm:h-13 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl",
                      "flex items-center justify-center gap-2.5 transition-all text-xs sm:text-sm",
                      "shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30",
                      "disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] cursor-pointer",
                      "relative overflow-hidden group"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        <span>Kirim Pengajuan Pendaftaran</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-slate-400 text-xs font-normal">
                    Dengan mendaftar, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi EXAM AA.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSchoolPage;
