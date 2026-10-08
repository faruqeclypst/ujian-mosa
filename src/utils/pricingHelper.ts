// ============================================================
// Sumber Tunggal Kebenaran (Single Source of Truth)
// Harga Paket, Kuota Siswa, dan Kalkulasi Invoice EXAMKU
// Sesuai dengan harga yang tertera di Landing Page & Pendaftaran
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

export const PLAN_PRICING: Record<PlanKey, PlanPricingDetail> = {
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
    monthlyRate: 380000,
    rates: {
      1: 380000,
      2: 760000,
      3: 1140000,
      6: 2100000,
      12: 3840000,
    },
  },
  pro: {
    key: "pro",
    label: "Paket Lanjutan",
    name: "Paket Lanjutan (500 Siswa)",
    quota: 500,
    monthlyRate: 760000,
    rates: {
      1: 760000,
      2: 1520000,
      3: 2280000,
      6: 4200000,
      12: 7680000,
    },
  },
  ultimate: {
    key: "ultimate",
    label: "Paket Premium",
    name: "Paket Premium (1000 Siswa)",
    quota: 1000,
    monthlyRate: 1235000,
    rates: {
      1: 1235000,
      2: 2470000,
      3: 3705000,
      6: 6840000,
      12: 12480000,
    },
  },
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
// Aturan durasi langganan EXAMKU:
// - 1 bulan = 28 hari (berlaku untuk paket 1, 2, 3, 4, 5, 6 bulan)
// - 12 bulan (1 tahun) = 12 bulan kalender penuh (tanggal ke tanggal)
// Memberi buffer ±2-3 hari antara masa sewa VPS (kalender) dan
// masa layanan sekolah, agar migrasi darurat H-3 selalu aman.
// ============================================================
export const BILLING_MONTH_DAYS = 28;

export const billingPeriodDays = (months: number): number => {
  const m = Math.max(1, Math.round(Number(months) || 1));
  if (m >= 12) return -1; // -1 = pakai bulan kalender
  return m * BILLING_MONTH_DAYS;
};

export const addBillingPeriod = (from: Date, months: number): Date => {
  const m = Math.max(1, Math.round(Number(months) || 1));
  if (m >= 12) {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 12);
    return d;
  }
  return new Date(from.getTime() + m * BILLING_MONTH_DAYS * 86400000);
};

export const billingPeriodLabel = (months: number): string => {
  const m = Math.max(1, Math.round(Number(months) || 1));
  if (m >= 12) return "12 bulan kalender (1 tahun penuh)";
  const days = m * BILLING_MONTH_DAYS;
  return m === 1 ? `1 bulan (28 hari)` : `${m} bulan (${days} hari)`;
};

export const calculatePlanInvoice = (plan: string, durationMonths: number = 1): {
  amount: number;
  periodLabel: string;
  durationMonths: number;
  durationDays: number; // -1 = 12 bulan kalender
  planKey: PlanKey;
  planLabel: string;
  quota: number;
} => {
  const planKey = normalizePlanKey(plan);
  const detail = PLAN_PRICING[planKey];
  const months = Math.max(1, Math.round(Number(durationMonths) || 1));

  if (planKey === "free") {
    return {
      amount: 0,
      periodLabel: "14 Hari (Free Trial)",
      durationMonths: 1,
      durationDays: 14,
      planKey,
      planLabel: detail.label,
      quota: detail.quota,
    };
  }

  let amount = 0;
  let periodLabel = `${months} bulan`;

  if (months === 12) {
    amount = detail.rates[12];
    periodLabel = "1 tahun (12 bulan kalender)";
  } else if (months === 6) {
    amount = detail.rates[6];
    periodLabel = "1 semester (6 bulan / 168 hari)";
  } else if (months === 3) {
    amount = detail.rates[3];
    periodLabel = "3 bulan (84 hari)";
  } else if (months === 2) {
    amount = detail.rates[2];
    periodLabel = "2 bulan (56 hari)";
  } else if (months === 1) {
    amount = detail.rates[1];
    periodLabel = "1 bulan (28 hari)";
  } else {
    amount = detail.monthlyRate * months;
    periodLabel = `${months} bulan (${months * BILLING_MONTH_DAYS} hari)`;
  }

  return {
    amount,
    periodLabel,
    durationMonths: months,
    durationDays: billingPeriodDays(months),
    planKey,
    planLabel: detail.label,
    quota: detail.quota,
  };
};

export const formatRupiah = (num: number): string => {
  return "Rp " + Math.round(num).toLocaleString("id-ID");
};
