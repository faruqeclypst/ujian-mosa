// ============================================================
// Sumber Tunggal Kebenaran (Single Source of Truth)
// Harga Paket, Kuota Siswa, dan Kalkulasi Invoice EXAMKU
// Mendukung konfigurasi tarif dinamis dari Master PocketBase (app_settings)
// ============================================================

export type PlanKey = "free" | "basic" | "pro" | "ultimate";

export interface PlanPricingDetail {
  key: PlanKey;
  label: string;
  name: string;
  quota: number;
  monthlyRate: number;
  rates: {
    1: number;
    2: number;
    3: number;
    6: number;
    12: number;
  };
}

export const DEFAULT_PLAN_PRICING: Record<PlanKey, PlanPricingDetail> = {
  free: {
    key: "free",
    label: "Free Trial",
    name: "Free Trial (50 Siswa)",
    quota: 50,
    monthlyRate: 0,
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 0,
      12: 0,
    },
  },
  basic: {
    key: "basic",
    label: "Paket Berkembang",
    name: "Paket Berkembang (250 Siswa)",
    quota: 250,
    monthlyRate: 500000,
    rates: {
      1: 500000,
      2: 1000000,
      3: 1500000,
      6: 2750000,
      12: 5000000,
    },
  },
  pro: {
    key: "pro",
    label: "Paket Lanjutan",
    name: "Paket Lanjutan (500 Siswa)",
    quota: 500,
    monthlyRate: 850000,
    rates: {
      1: 850000,
      2: 1700000,
      3: 2550000,
      6: 4680000,
      12: 8500000,
    },
  },
  ultimate: {
    key: "ultimate",
    label: "Paket Premium",
    name: "Paket Premium (1000 Siswa)",
    quota: 1000,
    monthlyRate: 1500000,
    rates: {
      1: 1500000,
      2: 3000000,
      3: 4500000,
      6: 8250000,
      12: 15000000,
    },
  },
};

// ─── Tarif Universal Masa Jeda / Hibernasi Server (Rp / Bulan) ───
export const DEFAULT_HIBERNATION_MONTHLY_RATE = 100000; // Rp 100.000 / bulan
const HIBERNATION_STORAGE_KEY = "examku_hibernation_monthly_rate";

let activeHibernationMonthlyRate: number = (() => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(HIBERNATION_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    }
  } catch {}
  return DEFAULT_HIBERNATION_MONTHLY_RATE;
})();

export const getHibernationMonthlyRate = (): number => {
  return activeHibernationMonthlyRate;
};

export const setHibernationMonthlyRate = (rate: number): void => {
  const val = Math.max(0, Math.round(Number(rate) || 0));
  activeHibernationMonthlyRate = val;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(HIBERNATION_STORAGE_KEY, String(val));
    }
  } catch {}
};

const PRICING_STORAGE_KEY = "examku_custom_pricing";

const getInitialPricing = (): Record<PlanKey, PlanPricingDetail> => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(PRICING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.basic && parsed.pro && parsed.ultimate) {
          if (parsed.hibernation_monthly_rate !== undefined) {
            setHibernationMonthlyRate(parsed.hibernation_monthly_rate);
          }
          return {
            free: DEFAULT_PLAN_PRICING.free,
            basic: { ...DEFAULT_PLAN_PRICING.basic, ...parsed.basic },
            pro: { ...DEFAULT_PLAN_PRICING.pro, ...parsed.pro },
            ultimate: { ...DEFAULT_PLAN_PRICING.ultimate, ...parsed.ultimate },
          };
        }
      }
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_PLAN_PRICING));
};

export const PLAN_PRICING: Record<PlanKey, PlanPricingDetail> = getInitialPricing();

export const applyDynamicPricing = (customPlans?: any): Record<PlanKey, PlanPricingDetail> => {
  if (!customPlans || typeof customPlans !== "object") {
    Object.assign(PLAN_PRICING, JSON.parse(JSON.stringify(DEFAULT_PLAN_PRICING)));
    setHibernationMonthlyRate(DEFAULT_HIBERNATION_MONTHLY_RATE);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(PRICING_STORAGE_KEY);
        localStorage.removeItem(HIBERNATION_STORAGE_KEY);
      }
    } catch {}
    return PLAN_PRICING;
  }

  if (customPlans.hibernation_monthly_rate !== undefined) {
    setHibernationMonthlyRate(customPlans.hibernation_monthly_rate);
  }

  const updated: Record<PlanKey, PlanPricingDetail> = {
    free: DEFAULT_PLAN_PRICING.free,
    basic: { ...DEFAULT_PLAN_PRICING.basic, ...(customPlans.basic || {}) },
    pro: { ...DEFAULT_PLAN_PRICING.pro, ...(customPlans.pro || {}) },
    ultimate: { ...DEFAULT_PLAN_PRICING.ultimate, ...(customPlans.ultimate || {}) },
  };

  // Mutasi in-place agar referensi impor di seluruh modul langsung terbarui
  Object.assign(PLAN_PRICING, updated);

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({
        ...updated,
        hibernation_monthly_rate: activeHibernationMonthlyRate,
      }));
    }
  } catch {}

  return PLAN_PRICING;
};

export const fetchAndApplyPricing = async (masterPbInstance: any): Promise<Record<PlanKey, PlanPricingDetail>> => {
  if (!masterPbInstance) return PLAN_PRICING;
  try {
    const records = await masterPbInstance.collection("app_settings").getFullList({ limit: 1 });
    if (records.length > 0) {
      const rec = records[0];
      let plans = rec.pricing_plans;
      if (typeof plans === "string") {
        try { plans = JSON.parse(plans); } catch {}
      }
      if (plans && typeof plans === "object") {
        if (rec.hibernation_monthly_rate !== undefined && plans.hibernation_monthly_rate === undefined) {
          plans.hibernation_monthly_rate = rec.hibernation_monthly_rate;
        }
        return applyDynamicPricing(plans);
      } else if (rec.hibernation_monthly_rate !== undefined) {
        setHibernationMonthlyRate(rec.hibernation_monthly_rate);
      }
    }
  } catch (err) {
    console.warn("Gagal fetch pricing dari app_settings Master PB:", err);
  }
  return PLAN_PRICING;
};

export const normalizePlanKey = (raw?: string): PlanKey => {
  const p = (raw || "").toLowerCase().trim();
  if (p === "free" || p.includes("trial") || p.includes("demo")) return "free";
  if (p === "ultimate" || p.includes("premium")) return "ultimate";
  if (p === "pro" || p.includes("lanjutan")) return "pro";
  if (p === "basic" || p.includes("berkembang")) return "basic";
  return "basic";
};

// ============================================================
// Aturan durasi langganan EXAMKU: bulan kalender (standar SaaS).
// 1 bulan = 1 bulan kalender (mis. 8 Okt -> 8 Nov),
// 12 bulan (1 tahun) = 12 bulan kalender penuh, tanggal ke tanggal.
// ============================================================
export const addBillingPeriod = (from: Date, months: number): Date => {
  const m = Math.max(1, Math.round(Number(months) || 1));
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};

export const billingPeriodLabel = (months: number): string => {
  const m = Math.max(1, Math.round(Number(months) || 1));
  if (m >= 12) return "1 tahun (12 bulan)";
  if (m === 6) return "1 semester (6 bulan)";
  return m === 1 ? "1 bulan" : `${m} bulan`;
};

export const calculatePlanInvoice = (plan: string, durationMonths: number = 1): {
  amount: number;
  periodLabel: string;
  durationMonths: number;
  planKey: PlanKey;
  planLabel: string;
  quota: number;
} => {
  const planKey = normalizePlanKey(plan);
  const detail = PLAN_PRICING[planKey] || DEFAULT_PLAN_PRICING[planKey];
  const months = Math.max(1, Math.round(Number(durationMonths) || 1));

  if (planKey === "free") {
    return {
      amount: 0,
      periodLabel: "14 Hari (Free Trial)",
      durationMonths: 1,
      planKey,
      planLabel: detail.label,
      quota: detail.quota,
    };
  }

  let amount = 0;
  let periodLabel = `${months} bulan`;

  if (months === 12) {
    amount = detail.rates[12];
    periodLabel = "1 tahun (12 bulan)";
  } else if (months === 6) {
    amount = detail.rates[6];
    periodLabel = "1 semester (6 bulan)";
  } else if (months === 3) {
    amount = detail.rates[3];
    periodLabel = "3 bulan";
  } else if (months === 2) {
    amount = detail.rates[2];
    periodLabel = "2 bulan";
  } else if (months === 1) {
    amount = detail.rates[1];
    periodLabel = "1 bulan";
  } else {
    amount = detail.monthlyRate * months;
    periodLabel = `${months} bulan`;
  }

  return {
    amount,
    periodLabel,
    durationMonths: months,
    planKey,
    planLabel: detail.label,
    quota: detail.quota,
  };
};

export const calculateMultiPeriodInvoice = (
  plan: string,
  activeMonths: number = 6,
  pauseMonths: number = 3,
  customHibernationRate?: number
): {
  planKey: PlanKey;
  planLabel: string;
  activeMonths: number;
  activeAmount: number;
  pauseMonths: number;
  hibernationRate: number;
  hibernationAmount: number;
  totalAmount: number;
} => {
  const planKey = normalizePlanKey(plan);
  const detail = PLAN_PRICING[planKey] || DEFAULT_PLAN_PRICING[planKey];
  const hibernationRate = customHibernationRate !== undefined ? customHibernationRate : getHibernationMonthlyRate();

  // 6 bulan aktif (mengikuti rates[6] paket diskon semester, atau rate per bulan)
  const activeAmount = activeMonths === 6
    ? detail.rates[6]
    : (detail.rates[1] || detail.monthlyRate) * activeMonths;

  const hibernationAmount = Math.max(0, pauseMonths) * hibernationRate;
  const totalAmount = activeAmount + hibernationAmount;

  return {
    planKey,
    planLabel: detail.label,
    activeMonths,
    activeAmount,
    pauseMonths,
    hibernationRate,
    hibernationAmount,
    totalAmount,
  };
};

export const formatRupiah = (num: number): string => {
  return "Rp " + Math.round(num).toLocaleString("id-ID");
};
