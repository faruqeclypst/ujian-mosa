import { masterPb } from "../lib/pocketbase";
import {
  calculatePlanInvoice,
  normalizePlanKey,
  PLAN_PRICING,
  PlanKey
} from "./pricingHelper";

export interface SchoolRecordForSub {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  student_quota?: number;
  contact_email?: string;
  custom_domain?: string;
  active_until?: string;
  is_active?: boolean;
}

export type SubscriptionTierStatus = "active" | "expiring_soon" | "grace_period" | "suspended" | "trial";

export interface SubscriptionStatusInfo {
  status: SubscriptionTierStatus;
  daysRemaining: number;
  graceDaysRemaining: number;
  isGracePeriod: boolean;
  isSuspended: boolean;
  isExpiringSoon: boolean;
  isTrial: boolean;
  effectiveQuota: number;
  label: string;
}

/**
 * Menghitung status masa aktif langganan sekolah:
 * - Aktif normal (> 14 hari)
 * - Segera berakhir (1 s/d 14 hari)
 * - Masa tenggang / Grace period (H+0 s/d H+3)
 * - Ditangguhkan / Suspended (Lewat H+3 atau is_active = false)
 */
export function getSubscriptionStatus(school: SchoolRecordForSub | null | undefined): SubscriptionStatusInfo {
  if (!school) {
    return {
      status: "active",
      daysRemaining: 999,
      graceDaysRemaining: 3,
      isGracePeriod: false,
      isSuspended: false,
      isExpiringSoon: false,
      isTrial: false,
      effectiveQuota: 250,
      label: "Aktif",
    };
  }

  const planKey = normalizePlanKey(school.plan || "free");
  const defaultQuota = PLAN_PRICING[planKey]?.quota || (planKey === "free" ? 50 : 250);
  const effectiveQuota = Number(school.student_quota) || defaultQuota;
  const isTrial = planKey === "free" || school.plan === "free";

  if (school.is_active === false) {
    return {
      status: "suspended",
      daysRemaining: -999,
      graceDaysRemaining: 0,
      isGracePeriod: false,
      isSuspended: true,
      isExpiringSoon: false,
      isTrial,
      effectiveQuota,
      label: "Ditangguhkan",
    };
  }

  if (!school.active_until) {
    return {
      status: isTrial ? "trial" : "active",
      daysRemaining: 999,
      graceDaysRemaining: 3,
      isGracePeriod: false,
      isSuspended: false,
      isExpiringSoon: false,
      isTrial,
      effectiveQuota,
      label: isTrial ? "Free Trial" : "Aktif",
    };
  }

  const now = Date.now();
  const rawDate = school.active_until.replace(" ", "T");
  const expTime = new Date(rawDate).getTime();
  const diffMs = expTime - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 14) {
    return {
      status: isTrial ? "trial" : "active",
      daysRemaining: diffDays,
      graceDaysRemaining: 3,
      isGracePeriod: false,
      isSuspended: false,
      isExpiringSoon: false,
      isTrial,
      effectiveQuota,
      label: isTrial ? "Free Trial" : "Aktif",
    };
  }

  if (diffDays > 0) {
    return {
      status: "expiring_soon",
      daysRemaining: diffDays,
      graceDaysRemaining: 3,
      isGracePeriod: false,
      isSuspended: false,
      isExpiringSoon: true,
      isTrial,
      effectiveQuota,
      label: `Segera Berakhir (${diffDays} Hari)`,
    };
  }

  const graceDaysRemaining = Math.max(0, 3 + diffDays);
  if (diffDays >= -3) {
    return {
      status: "grace_period",
      daysRemaining: diffDays,
      graceDaysRemaining,
      isGracePeriod: true,
      isSuspended: false,
      isExpiringSoon: false,
      isTrial,
      effectiveQuota,
      label: `Masa Tenggang (${graceDaysRemaining} Hari Tersisa)`,
    };
  }

  return {
    status: "suspended",
    daysRemaining: diffDays,
    graceDaysRemaining: 0,
    isGracePeriod: false,
    isSuspended: true,
    isExpiringSoon: false,
    isTrial,
    effectiveQuota,
    label: "Masa Aktif Berakhir (Ditangguhkan)",
  };
}

/**
 * Otomatis meng-upgrade data sekolah saat invoice berstatus 'paid' (lunas)
 */
export const upgradeSchoolFromInvoice = async (invoice: {
  school_id?: string;
  school_slug?: string;
  plan?: string;
  duration_months?: number;
  amount?: number;
}): Promise<boolean> => {
  try {
    let school: any = null;
    if (invoice.school_id) {
      try {
        school = await masterPb.collection("schools").getOne(invoice.school_id);
      } catch {}
    }
    if (!school && invoice.school_slug) {
      try {
        school = await masterPb.collection("schools").getFirstListItem(`slug = "${invoice.school_slug}"`);
      } catch {}
    }
    if (!school) return false;

    const planKey = normalizePlanKey(invoice.plan || school.plan || "basic");
    const planDetail = PLAN_PRICING[planKey];
    const targetQuota = planDetail.quota;
    const months = Number(invoice.duration_months) || 1;

    // Tentukan tanggal kedaluwarsa baru
    const now = new Date();
    let baseDate = new Date();

    if (school.active_until) {
      const match = school.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const curDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
        // Jika masa aktif masih berjalan di masa depan dan paket bukan free trial, perpanjang dari tanggal tersebut
        if (curDate.getTime() > now.getTime() && school.plan !== "free") {
          baseDate = curDate;
        }
      }
    }

    const newExp = new Date(baseDate);
    newExp.setMonth(newExp.getMonth() + months);
    newExp.setHours(23, 59, 59, 999);

    const year = newExp.getFullYear();
    const month = String(newExp.getMonth() + 1).padStart(2, "0");
    const date = String(newExp.getDate()).padStart(2, "0");
    const finalActiveUntil = `${year}-${month}-${date} 23:59:59.000Z`;

    await masterPb.collection("schools").update(school.id, {
      plan: planKey,
      student_quota: Math.max(school.student_quota || 0, targetQuota),
      active_until: finalActiveUntil,
      is_active: true,
    });

    console.log(`[Upgrade School] Berhasil meng-upgrade ${school.name} ke ${planDetail.label} (kuota: ${targetQuota}, s/d ${finalActiveUntil})`);
    return true;
  } catch (err) {
    console.error("Gagal meng-upgrade tenant dari invoice:", err);
    return false;
  }
};

/**
 * Memastikan invoice perpanjangan berstatus unpaid sudah tersedia untuk sekolah.
 * Jika belum ada, otomatis membuatkan invoice perpanjangan sesuai harga resmi landing page.
 */
export const ensureRenewalInvoice = async (
  school: SchoolRecordForSub,
  durationMonths: number = 12
): Promise<{ invoice: any; isNew: boolean }> => {
  // Cek apakah sudah ada tagihan belum dibayar
  try {
    const existing = await masterPb.collection("invoices").getFullList({
      filter: `school_id = "${school.id}" && status = "unpaid"`,
      sort: "-created",
    });
    if (existing.length > 0) {
      return { invoice: existing[0], isNew: false };
    }
  } catch {}

  const currentPlan = (school.plan || "").toLowerCase();
  const targetPlan: PlanKey = normalizePlanKey(currentPlan === "free" ? "basic" : currentPlan);
  const planInfo = calculatePlanInvoice(targetPlan, durationMonths);

  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  const invNum = `INV-${yy}${mm}-${seq}`;

  const dueDate = school.active_until
    ? school.active_until.slice(0, 10)
    : new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  const newInvoice = {
    invoice_number: invNum,
    school_id: school.id,
    school_name: school.name,
    school_slug: school.slug,
    contact_email: school.contact_email || "",
    plan: targetPlan,
    plan_label: planInfo.planLabel,
    duration_months: planInfo.durationMonths,
    period_label: planInfo.periodLabel,
    amount: planInfo.amount,
    status: "unpaid",
    due_date: dueDate,
    notes: `Tagihan Perpanjangan Layanan ${planInfo.planLabel} (${planInfo.periodLabel})`,
  };

  const created = await masterPb.collection("invoices").create(newInvoice);
  return { invoice: created, isNew: true };
};
