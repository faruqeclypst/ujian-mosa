import React, { useState, useEffect } from "react";
import {
  Tag,
  Save,
  RefreshCw,
  Check,
  AlertCircle,
  Calculator,
  Sparkles,
  Users,
  Moon,
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import {
  DEFAULT_PLAN_PRICING,
  DEFAULT_HIBERNATION_MONTHLY_RATE,
  PlanKey,
  PlanPricingDetail,
  formatRupiah,
  applyDynamicPricing,
  getHibernationMonthlyRate,
  setHibernationMonthlyRate,
} from "../../utils/pricingHelper";

const PAID_PLANS: { key: PlanKey; color: string; badge: string; description: string }[] = [
  {
    key: "basic",
    color: "from-blue-600 to-indigo-700",
    badge: "Berkembang",
    description: "Cocok untuk sekolah skala kecil-menengah hingga 250 siswa aktif.",
  },
  {
    key: "pro",
    color: "from-emerald-600 to-teal-700",
    badge: "Lanjutan",
    description: "Paling populer untuk sekolah menengah hingga 500 siswa aktif.",
  },
  {
    key: "ultimate",
    color: "from-purple-600 to-pink-700",
    badge: "Premium",
    description: "Dukungan penuh skala besar hingga 1.000 siswa aktif & Custom Domain.",
  },
];

export const PricingSettings: React.FC = () => {
  const [plans, setPlans] = useState<Record<PlanKey, PlanPricingDetail>>(() =>
    JSON.parse(JSON.stringify(DEFAULT_PLAN_PRICING))
  );
  const [hibernationMonthlyRate, setHibernationMonthlyRateState] = useState<number>(() => getHibernationMonthlyRate());
  const [appSettingRecordId, setAppSettingRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const records = await masterPb.collection("app_settings").getFullList({ limit: 1 });
      if (records.length > 0) {
        setAppSettingRecordId(records[0].id);
        const rawPricing = records[0].pricing_plans;
        if (rawPricing) {
          const parsed = typeof rawPricing === "string" ? JSON.parse(rawPricing) : rawPricing;
          if (parsed && typeof parsed === "object") {
            const hRate = parsed.hibernation_monthly_rate ?? records[0].hibernation_monthly_rate ?? DEFAULT_HIBERNATION_MONTHLY_RATE;
            setHibernationMonthlyRateState(Number(hRate) || DEFAULT_HIBERNATION_MONTHLY_RATE);
            const merged = {
              free: DEFAULT_PLAN_PRICING.free,
              basic: { ...DEFAULT_PLAN_PRICING.basic, ...(parsed.basic || {}) },
              pro: { ...DEFAULT_PLAN_PRICING.pro, ...(parsed.pro || {}) },
              ultimate: { ...DEFAULT_PLAN_PRICING.ultimate, ...(parsed.ultimate || {}) },
            };
            setPlans(merged);
            applyDynamicPricing({ ...merged, hibernation_monthly_rate: hRate });
            return;
          }
        }
      }
      setPlans(JSON.parse(JSON.stringify(DEFAULT_PLAN_PRICING)));
      setHibernationMonthlyRateState(DEFAULT_HIBERNATION_MONTHLY_RATE);
    } catch (err: any) {
      console.warn("Gagal memuat pricing_plans dari Master PB:", err);
      setErrorMsg("Gagal memuat setelan tarif dari server master. Menggunakan tarif standar.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = (key: PlanKey, field: keyof PlanPricingDetail, value: any) => {
    setPlans(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleUpdateRate = (key: PlanKey, duration: 1 | 2 | 3 | 6 | 12, amount: number) => {
    setPlans(prev => {
      const current = prev[key];
      const newRates = {
        ...current.rates,
        [duration]: amount,
      };
      return {
        ...prev,
        [key]: {
          ...current,
          monthlyRate: duration === 1 ? amount : current.monthlyRate,
          rates: newRates,
        },
      };
    });
  };

  // Helper kalkulasi otomatis diskon standar SaaS:
  // 1 bln: dasar
  // 2 bln: 2x
  // 3 bln: 3x
  // 6 bln: diskon ~8% (dibulatkan ke ribuan)
  // 12 bln: diskon ~16% (2 bulan gratis / bayar 10 bulan)
  const handleAutoCalculateRates = (key: PlanKey) => {
    const plan = plans[key];
    const base = plan.rates[1] || plan.monthlyRate || 0;
    if (base <= 0) return;

    const rate1 = base;
    const rate2 = base * 2;
    const rate3 = base * 3;
    // 6 bulan = hemat ~8% (setara 5.5 bulan)
    const rate6 = Math.round((base * 5.5) / 10000) * 10000;
    // 12 bulan = hemat 2 bulan (setara 10 bulan)
    const rate12 = base * 10;

    setPlans(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        monthlyRate: base,
        rates: {
          1: rate1,
          2: rate2,
          3: rate3,
          6: rate6,
          12: rate12,
        },
      },
    }));

    setSuccessMsg(`Kalkulasi tarif paket "${plan.label}" berhasil dihitung otomatis.`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const payload = {
        pricing_plans: {
          ...plans,
          hibernation_monthly_rate: hibernationMonthlyRate,
        },
      };

      if (appSettingRecordId) {
        await masterPb.collection("app_settings").update(appSettingRecordId, payload);
      } else {
        const created = await masterPb.collection("app_settings").create({
          app_name: "EXAMKU",
          min_version_code: 1,
          min_version_name: "1.0.0",
          ...payload,
        });
        setAppSettingRecordId(created.id);
      }

      // Sinkronkan ke in-memory & localStorage client
      setHibernationMonthlyRate(hibernationMonthlyRate);
      applyDynamicPricing({ ...plans, hibernation_monthly_rate: hibernationMonthlyRate });

      setSuccessMsg("Tarif layanan & biaya hibernasi berhasil disimpan ke Master DB! Berlaku universal untuk seluruh invoice & pendaftaran baru.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      console.error("Gagal simpan pricing:", err);
      setErrorMsg(err.message || "Gagal menyimpan konfigurasi tarif ke Master PB.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm("Kembalikan semua tarif dan kuota ke pengaturan bawaan awal?")) {
      setPlans(JSON.parse(JSON.stringify(DEFAULT_PLAN_PRICING)));
      setHibernationMonthlyRateState(DEFAULT_HIBERNATION_MONTHLY_RATE);
      setSuccessMsg("Form dikembalikan ke tarif bawaan. Jangan lupa klik 'Simpan Tarif Layanan' untuk menerapkan ke server.");
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-medium">Memuat konfigurasi tarif dari Master PB...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Tarif & Paket Layanan EXAMKU</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Kelola harga paket langganan SaaS, kuota siswa, dan diskon periode (1, 2, 3, 6, 12 bulan).
                Perubahan tarif di sini otomatis berlaku untuk seluruh kalkulasi invoice dan perpanjangan sekolah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="Kembalikan nilai ke default sistem"
            >
              <RefreshCw size={13} />
              Reset Default
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Menyimpan..." : "Simpan Tarif Layanan"}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {successMsg && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Universal Hibernation Rate Setting Card */}
      <div className="bg-gradient-to-r from-amber-50/70 via-white to-purple-50/50 border border-amber-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Moon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">Tarif Hibernasi & Pemeliharaan Server</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Universal / Global
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  Masa Jeda Multi-Periode
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Biaya perawatan server cloud, database, dan pengamanan bank soal per bulan selama masa jeda (hibernasi) ujian.
                Berlaku secara universal untuk kalkulasi formulir pendaftaran dan pembuatan invoice paket multi-periode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 bg-white/90 p-3 rounded-xl border border-amber-200/80 shadow-2xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tarif Hibernasi per Bulan
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={hibernationMonthlyRate}
                  onChange={(e) => setHibernationMonthlyRateState(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-36 pl-8 pr-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center gap-1.5">
              {[50000, 100000, 150000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHibernationMonthlyRateState(preset)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer",
                    hibernationMonthlyRate === preset
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {formatRupiah(preset).replace("Rp ", "")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Simulation Banner */}
        <div className="mt-3.5 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-800">💡 Simulasi Masa Jeda 3 Bulan:</span>
            <span>
              3 bulan × {formatRupiah(hibernationMonthlyRate)}/bln ={" "}
              <strong className="text-amber-800 font-extrabold bg-amber-100/70 px-1.5 py-0.5 rounded">
                {formatRupiah(hibernationMonthlyRate * 3)}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Bank soal, akun guru, dan histori nilai tetap aman tersimpan di cloud
          </span>
        </div>
      </div>

      {/* Grid Paket Berbayar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PAID_PLANS.map(item => {
          const plan = plans[item.key];
          const base1 = plan.rates[1] || plan.monthlyRate || 0;
          const rate6 = plan.rates[6] || 0;
          const rate12 = plan.rates[12] || 0;

          // Hitung % hemat untuk 6 bln & 12 bln
          const normal6 = base1 * 6;
          const normal12 = base1 * 12;
          const discount6 = normal6 > 0 && rate6 < normal6 ? Math.round(((normal6 - rate6) / normal6) * 100) : 0;
          const discount12 = normal12 > 0 && rate12 < normal12 ? Math.round(((normal12 - rate12) / normal12) * 100) : 0;

          return (
            <div
              key={item.key}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              {/* Header Card */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg shadow-2xs">
                    {item.badge}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAutoCalculateRates(item.key)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition"
                    title="Hitung otomatis harga 2, 3, 6, 12 bulan dari harga 1 bulan"
                  >
                    <Calculator size={12} />
                    Auto Hitung
                  </button>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{plan.label}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>

              {/* Form Input Body */}
              <div className="p-5 space-y-4 flex-1">
                {/* Kuota Siswa */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Users size={13} className="text-slate-400" />
                    Kuota Siswa Maksimal
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={plan.quota}
                      onChange={e => handleUpdatePlan(item.key, "quota", parseInt(e.target.value) || 0)}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                    <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">Siswa</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-bold text-slate-900 mb-3 flex items-center gap-1">
                    <Tag size={12} className="text-blue-600" />
                    Tarif Berdasarkan Periode
                  </p>

                  <div className="space-y-2.5">
                    {/* 1 Bulan */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600">1 Bulan (Tarif Dasar)</span>
                        <span className="font-mono font-bold text-blue-600">{formatRupiah(plan.rates[1])}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={plan.rates[1]}
                        onChange={e => handleUpdateRate(item.key, 1, parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 2 Bulan */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600">2 Bulan</span>
                        <span className="font-mono font-bold text-slate-700">{formatRupiah(plan.rates[2])}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={plan.rates[2]}
                        onChange={e => handleUpdateRate(item.key, 2, parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 3 Bulan */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600">3 Bulan</span>
                        <span className="font-mono font-bold text-slate-700">{formatRupiah(plan.rates[3])}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={plan.rates[3]}
                        onChange={e => handleUpdateRate(item.key, 3, parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 6 Bulan (1 Semester) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                          6 Bulan (1 Semester)
                          {discount6 > 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                              Hemat {discount6}%
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-emerald-600">{formatRupiah(plan.rates[6])}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={plan.rates[6]}
                        onChange={e => handleUpdateRate(item.key, 6, parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* 12 Bulan (1 Tahun) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                          12 Bulan (1 Tahun)
                          {discount12 > 0 && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[9px] font-bold rounded">
                              Hemat {discount12}%
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-purple-600">{formatRupiah(plan.rates[12])}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={plan.rates[12]}
                        onChange={e => handleUpdateRate(item.key, 12, parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Summary */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Tarif Bulanan Efektif:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatRupiah(plan.monthlyRate)}<span className="text-[10px] font-normal text-slate-400">/bln</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free Trial Info Card */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Paket Free Trial (Uji Coba Gratis)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kuota bawaan pendaftaran mandiri sekolah: <strong>{plans.free?.quota || 50} Siswa</strong> (Aktif selama 14 Hari). Biaya layanan: <strong>Gratis (Rp 0)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-[11px] font-semibold text-slate-600">Kuota Trial:</label>
          <input
            type="number"
            min={10}
            step={5}
            value={plans.free?.quota || 50}
            onChange={e => handleUpdatePlan("free", "quota", parseInt(e.target.value) || 50)}
            className="w-20 text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-center"
          />
          <span className="text-[11px] font-bold text-slate-400">Siswa</span>
        </div>
      </div>
    </div>
  );
};
