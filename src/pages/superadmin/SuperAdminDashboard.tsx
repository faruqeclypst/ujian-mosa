import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus, Check, X, Edit, Power, PowerOff,
  School, Clock, Users, RefreshCw,
  Search, Trash2, Monitor, Zap, Server, ChevronDown,
  Building2, Globe, Sparkles, ShieldCheck, Calendar, Cpu, BookOpen, HardDrive,
  Activity, CheckCircle2, XCircle, AlertTriangle, Info, KeyRound, ChevronRight,
  Database, ExternalLink, Lock
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";
import { getSchoolUrl, getSchoolDomain, getDomainSuffix } from "../../utils/domainHelper";
import { calculatePlanInvoice, PLAN_PRICING, normalizePlanKey } from "../../utils/pricingHelper";
import { ensureRenewalInvoice } from "../../utils/subscriptionHelper";
import { OneClickMigrationModal } from "./OneClickMigrationModal";
import { OfflineLicenseModal } from "../../components/dialogs/OfflineLicenseModal";
import { SchoolNpsnSearch } from "../../components/common/SchoolNpsnSearch";
import { generateSlugFromName } from "../../utils/sekolahApiHelper";

// ── Activity Log ──────────────────────────────────────────────
type LogType = "create" | "update" | "delete" | "approve" | "reject" | "activate" | "deactivate";
interface ActivityLog {
  id: string;
  type: LogType;
  message: string;
  target: string;
  timestamp: string;
}
const LOG_KEY = "sa_activity_logs";
const MAX_LOGS = 200;

const addLog = (type: LogType, message: string, target: string) => {
  try {
    const existing: ActivityLog[] = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    const entry: ActivityLog = {
      id: Date.now().toString(),
      type, message, target,
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...existing].slice(0, MAX_LOGS);
    localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  } catch {}
};

const getLogs = (): ActivityLog[] => {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
};

const clearLogs = () => { try { localStorage.removeItem(LOG_KEY); } catch {} };

const timeAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

const LOG_STYLE: Record<LogType, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  create:     { icon: Plus,          color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  update:     { icon: Edit,          color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200" },
  delete:     { icon: Trash2,        color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200" },
  approve:    { icon: CheckCircle2,  color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  reject:     { icon: XCircle,       color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200" },
  activate:   { icon: Zap,           color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  deactivate: { icon: AlertTriangle, color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200" },
};
// ─────────────────────────────────────────────────────────────

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
  type: "school" | "campus";
  logo_url?: string;
  is_active: boolean;
  plan?: string;
  student_quota?: number;
  contact_email?: string;
  custom_domain?: string;
  active_until?: string;
  server_host?: string;
  created: string;
}

interface SchoolRequest {
  id: string;
  school_name: string;
  slug_request: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  type?: "school" | "campus" | "renewal" | string;
  plan?: string;
  duration?: string;
  status: "pending" | "approved" | "rejected";
  created: string;
}

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: "Free Trial", color: "bg-slate-100 text-slate-600 border-slate-200" },
  basic: { label: "Berkembang", color: "bg-blue-50 text-blue-700 border-blue-200" },
  pro: { label: "Lanjutan", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ultimate: { label: "Premium", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

const formatToDateInput = (val?: string): string => {
  if (!val) return "";
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${date}`;
    }
  } catch {}
  return "";
};

const getTrialDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const getDiffDays = (dateStr?: string): number => {
  if (!dateStr || !dateStr.trim()) return 0;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  const target = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDateIndo = (dateStr?: string): string => {
  if (!dateStr || !dateStr.trim()) return "";
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

const formatDateShortIndo = (dateStr?: string): string => {
  if (!dateStr || !dateStr.trim()) return "";
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

const getActiveUntilInfo = (dateStr?: string) => {
  if (!dateStr || !dateStr.trim()) {
    return { isExpired: false, label: "Masa aktif: permanen", isPermanent: true };
  }
  try {
    const raw = dateStr.trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let d: Date;
    if (match) {
      d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
    } else {
      d = new Date(raw.replace(" ", "T"));
    }
    if (isNaN(d.getTime())) {
      return { isExpired: false, label: "Masa aktif: permanen", isPermanent: true };
    }
    const now = new Date();
    const isExpired = d.getTime() < now.getTime();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    
    if (isExpired) {
      return { isExpired: true, label: `Kadaluarsa (${formatted})`, isPermanent: false };
    }
    if (diffDays === 0) {
      return { isExpired: false, label: `Berakhir hari ini (${formatted})`, isPermanent: false };
    }
    return { isExpired: false, label: `s/d ${formatted} (${diffDays} hr)`, isPermanent: false };
  } catch {
    return { isExpired: false, label: "Masa aktif: permanen", isPermanent: true };
  }
};

const SchoolAvatar = ({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) => {
  const [error, setError] = useState(false);
  const initial = (name || "S").trim()[0]?.toUpperCase() || "S";

  if (logoUrl && !error) {
    return (
      <div className={cn("w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200", className)}>
        <img
          src={logoUrl}
          alt=""
          className="w-full h-full object-contain p-0.5"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black text-xs uppercase shrink-0 shadow-2xs", className)}>
      {initial}
    </div>
  );
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "requests" | "logs">("all");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [requests, setRequests] = useState<SchoolRequest[]>([]);
  const [logEntries, setLogEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [migrationSchool, setMigrationSchool] = useState<SchoolRecord | null>(null);
  const [offlineLicenseSchool, setOfflineLicenseSchool] = useState<SchoolRecord | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendingRenewalId, setSendingRenewalId] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: "danger" | "warning" | "success";
  } | null>(null);

  const refreshLogs = () => setLogEntries(getLogs());

  useEffect(() => {
    if (!masterPb.authStore.isValid) {
      navigate("/superadmin/login");
    }
  }, [navigate]);

  // Load log saat mount
  useEffect(() => { setLogEntries(getLogs()); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolList, requestList] = await Promise.all([
        masterPb.collection("schools").getFullList<SchoolRecord>({ sort: "-created" }),
        masterPb.collection("school_requests").getFullList<SchoolRequest>({ sort: "-created" }),
      ]);
      setSchools(schoolList);
      setRequests(requestList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleActive = (school: SchoolRecord) => {
    const currentState = !!school.is_active;
    const newState = !currentState;
    setConfirmData({
      title: currentState ? "Nonaktifkan Institusi?" : "Aktifkan Institusi?",
      message: currentState
        ? `Apakah Anda yakin ingin menonaktifkan ${school.name}? Seluruh akses guru dan siswa akan dihentikan sementara.`
        : `Aktifkan kembali akses untuk ${school.name}?`,
      type: currentState ? "warning" : "success",
      onConfirm: async () => {
        try {
          await masterPb.collection("schools").update(school.id, { is_active: newState });
          addLog(
            newState ? "activate" : "deactivate",
            newState ? `Mengaktifkan institusi` : `Menonaktifkan institusi`,
            school.name
          );
          refreshLogs();
          loadData();
          setConfirmData(null);
        } catch {
          alert("Gagal mengubah status sekolah.");
        }
      }
    });
  };

  const handleSendRenewalInvoice = async (school: SchoolRecord) => {
    setSendingRenewalId(school.id);
    try {
      const res = await ensureRenewalInvoice(school, 12);
      if (res.isNew) {
        addLog("create", `Menerbitkan tagihan perpanjangan (${res.invoice.invoice_number})`, school.name);
        refreshLogs();
        alert(`Tagihan perpanjangan (${res.invoice.invoice_number}) untuk ${school.name} berhasil diterbitkan dengan harga resmi.`);
      } else {
        alert(`Tagihan perpanjangan (${res.invoice.invoice_number}) untuk ${school.name} sudah aktif dalam antrean belum bayar.`);
      }
    } catch (err: any) {
      console.error("Gagal menerbitkan invoice perpanjangan:", err);
      alert(err?.message || "Gagal menerbitkan invoice perpanjangan.");
    } finally {
      setSendingRenewalId(null);
    }
  };

  const deleteSchool = (school: SchoolRecord) => {
    setConfirmData({
      title: "Hapus Institusi Permanen?",
      message: `Hapus sekolah ${school.name} secara TOTAL? Seluruh data kuesioner, bank soal, dan hasil ujian akan hilang selamanya dan tidak bisa dikembalikan!`,
      type: "danger",
      onConfirm: async () => {
        try {
          await masterPb.collection("schools").delete(school.id);
          addLog("delete", "Menghapus institusi secara permanen", school.name);
          refreshLogs();
          loadData();
          setConfirmData(null);
        } catch {
          alert("Gagal menghapus sekolah.");
        }
      }
    });
  };

  const handleApproveRenewalRequest = async (req: SchoolRequest) => {
    try {
      const matchedSchool = schools.find(s => s.slug === req.slug_request || s.name.toLowerCase() === req.school_name.toLowerCase());
      if (!matchedSchool) {
        alert(`Sekolah "${req.school_name}" (${req.slug_request}) tidak ditemukan di database.`);
        return;
      }

      let months = 12;
      if (req.duration) {
        const match = req.duration.match(/(\d+)/);
        if (match) months = parseInt(match[1], 10);
      }

      const targetPlan = normalizePlanKey(req.plan || matchedSchool.plan || "basic");
      const planInfo = calculatePlanInvoice(targetPlan, months);

      const now = new Date();
      const yy = now.getFullYear().toString().slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 9000) + 1000);
      const invNum = `INV-${yy}${mm}-${seq}`;

      const dueDate = matchedSchool.active_until
        ? matchedSchool.active_until.slice(0, 10)
        : new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

      let finalAmount = planInfo.amount;
      let notesStr = req.address ? `Permintaan Perpanjangan: ${req.address}` : `Tagihan Perpanjangan Layanan ${planInfo.planLabel} (${planInfo.periodLabel})`;

      // Prorating Logic: Hitung sisa masa aktif plan lama dan jadikan potongan untuk tagihan baru
      const currentPlan = normalizePlanKey(matchedSchool.plan || "basic");
      if (currentPlan !== "free" && currentPlan !== targetPlan && matchedSchool.active_until) {
        const activeUntilDate = new Date(matchedSchool.active_until);
        if (activeUntilDate.getTime() > now.getTime()) {
          const diffDays = Math.ceil((activeUntilDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (diffDays > 0) {
            const oldPlanPricePerMonth = calculatePlanInvoice(currentPlan, 1).amount;
            const pricePerDay = oldPlanPricePerMonth / 30;
            const remainingCredit = Math.floor(diffDays * pricePerDay);
            
            if (remainingCredit > 0) {
              finalAmount = Math.max(0, finalAmount - remainingCredit);
              const creditRp = remainingCredit.toLocaleString("id-ID");
              notesStr += `\n\n*Catatan Upgrade: Total tagihan ini telah dipotong sisa masa aktif paket lama Anda (${diffDays} hari) senilai Rp ${creditRp}.`;
            }
          }
        }
      }

      const newInvoice = {
        invoice_number: invNum,
        school_id: matchedSchool.id,
        school_name: matchedSchool.name,
        school_slug: matchedSchool.slug,
        contact_email: req.contact_email || matchedSchool.contact_email || "",
        plan: targetPlan,
        plan_label: planInfo.planLabel,
        duration_months: planInfo.durationMonths,
        period_label: planInfo.periodLabel,
        amount: finalAmount,
        status: "unpaid",
        due_date: dueDate,
        notes: notesStr,
      };

      const createdInv = await masterPb.collection("invoices").create(newInvoice);
      await masterPb.collection("school_requests").update(req.id, { status: "approved" });

      addLog("approve", `Menerbitkan tagihan perpanjangan (${createdInv.invoice_number})`, matchedSchool.name);
      refreshLogs();
      loadData();
      alert(`Tagihan perpanjangan (${createdInv.invoice_number}) senilai Rp ${planInfo.amount.toLocaleString("id-ID")} untuk ${matchedSchool.name} berhasil diterbitkan.`);
    } catch (err: any) {
      console.error("Gagal menyetujui perpanjangan:", err);
      alert(err?.message || "Gagal menerbitkan tagihan perpanjangan.");
    }
  };

  const approveRequest = (req: SchoolRequest) => {
    if (req.type === "renewal") {
      return handleApproveRenewalRequest(req);
    }
    try {
      let targetPlan: 'free' | 'basic' | 'pro' | 'ultimate' = 'basic';
      let targetQuota = 250;
      let durationDays = 365;

      const p = (req.plan || "").toLowerCase();
      if (p === "free" || p.includes("trial") || p.includes("demo")) {
        targetPlan = 'free';
        targetQuota = 50;
        durationDays = 14;
      } else if (p.includes("premium") || p === "ultimate") {
        targetPlan = 'ultimate';
        targetQuota = 1000;
      } else if (p.includes("lanjutan") || p === "pro") {
        targetPlan = 'pro';
        targetQuota = 500;
      } else if (p.includes("berkembang") || p === "basic") {
        targetPlan = 'basic';
        targetQuota = 250;
      }

      if (targetPlan !== 'free' && req.duration) {
        const d = req.duration.toLowerCase();
        const monthMatch = d.match(/(\d+)\s*bulan/);
        if (monthMatch) {
          const m = parseInt(monthMatch[1], 10);
          durationDays = m * 30;
        } else if (d.includes("6 bulan") || d.includes("semester")) {
          durationDays = 180;
        } else if (d.includes("1 tahun") || d.includes("12 bulan") || d.includes("tahun")) {
          durationDays = 365;
        } else if (d.includes("14")) {
          durationDays = 14;
        }
      }

      const expDate = new Date();
      expDate.setDate(expDate.getDate() + durationDays);

      setEditSchool({
        id: "",
        name: req.school_name,
        slug: req.slug_request,
        pb_url: "",
        is_active: true,
        contact_email: req.contact_email,
        created: new Date().toISOString(),
        type: req.type === 'campus' ? 'campus' : 'school',
        plan: targetPlan,
        student_quota: targetQuota,
        active_until: expDate.toISOString(),
      });
      setApprovingRequestId(req.id);
      setShowAddModal(true);
    } catch {
      alert("Gagal membuka formulir pendaftaran.");
    }
  };

  const resetRequestStatus = async (req: SchoolRequest, newStatus: "pending" | "approved" | "rejected") => {
    try {
      await masterPb.collection("school_requests").update(req.id, { status: newStatus });
      addLog("update", `Mengubah status pendaftaran menjadi ${newStatus === "pending" ? "Menunggu" : newStatus === "approved" ? "Disetujui" : "Ditolak"}`, req.school_name);
      refreshLogs();
      loadData();
    } catch {
      alert("Gagal mengubah status pendaftaran.");
    }
  };

  const rejectRequest = (req: SchoolRequest) => {
    setConfirmData({
      title: "Tolak Pendaftaran?",
      message: `Tolak pendaftaran dari ${req.school_name}? status pendaftaran akan berubah menjadi Ditolak.`,
      type: "danger",
      onConfirm: async () => {
        try {
          await masterPb.collection("school_requests").update(req.id, { status: "rejected" });
          addLog("reject", "Menolak pendaftaran institusi", req.school_name);
          refreshLogs();
          loadData();
          setConfirmData(null);
        } catch {
          alert("Gagal menolak pendaftaran.");
        }
      }
    });
  };

  const deleteRequest = (req: SchoolRequest) => {
    setConfirmData({
      title: "Hapus Pendaftaran?",
      message: `Hapus data pendaftaran dari ${req.school_name} secara permanen? Tindakan ini tidak bisa dibatalkan.`,
      type: "danger",
      onConfirm: async () => {
        try {
          await masterPb.collection("school_requests").delete(req.id);
          addLog("delete", "Menghapus data pendaftaran", req.school_name);
          refreshLogs();
          loadData();
          setConfirmData(null);
        } catch {
          alert("Gagal menghapus pendaftaran.");
        }
      }
    });
  };

  const toggleSelectedActive = async (active: boolean) => {
    setConfirmData({
      title: `${active ? "Aktifkan" : "Nonaktifkan"} ${selectedIds.length} Institusi?`,
      message: `Tindakan ini akan mempengaruhi akses sistem untuk ${selectedIds.length} sekolah terpilih.`,
      type: active ? "success" : "warning",
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map(id => masterPb.collection("schools").update(id, { is_active: active })));
          const names = schools.filter(s => selectedIds.includes(s.id)).map(s => s.name).join(", ");
          addLog(
            active ? "activate" : "deactivate",
            `${active ? "Mengaktifkan" : "Menonaktifkan"} ${selectedIds.length} institusi sekaligus`,
            names
          );
          refreshLogs();
          loadData();
          setSelectedIds([]);
          setConfirmData(null);
        } catch {
          alert("Gagal memproses aksi masal.");
        }
      }
    });
  };

  const deleteSelected = async () => {
    setConfirmData({
      title: `Hapus ${selectedIds.length} Institusi Permanen?`,
      message: `Seluruh data dari ${selectedIds.length} sekolah yang dipilih akan DIHAPUS TOTAL dan tidak bisa dikembalikan!`,
      type: "danger",
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map(id => masterPb.collection("schools").delete(id)));
          const names = schools.filter(s => selectedIds.includes(s.id)).map(s => s.name).join(", ");
          addLog("delete", `Menghapus ${selectedIds.length} institusi sekaligus`, names);
          refreshLogs();
          loadData();
          setSelectedIds([]);
          setConfirmData(null);
        } catch {
          alert("Gagal menghapus beberapa sekolah.");
        }
      }
    });
  };

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase());

    if (tab === "all") return matchesSearch;
    if (tab === "active") return matchesSearch && !!s.is_active;
    if (tab === "inactive") return matchesSearch && !s.is_active;
    return matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const activeCount = schools.filter(s => !!s.is_active).length;

  const stats = [
    { label: "Institusi Aktif", value: activeCount, icon: Zap, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "Total Institusi", value: schools.length, icon: School, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "Menunggu", value: pendingCount, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
    { label: "Total Pendaftar", value: requests.length, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  ];

  return (
    <SuperAdminLayout>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manajemen tenant Examku CBT.</p>
        </div>
        <div className="text-[10px] text-slate-500 font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center justify-between sm:justify-end gap-3 shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">DB:</span>
            <span className="font-semibold text-slate-700 truncate max-w-[160px] sm:max-w-[200px]">{masterPb.baseUrl.replace('https://', '')}</span>
          </div>
          <span className="font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">{schools.length} Tenant</span>
        </div>
      </div>

      {/* Banner Akses Cepat Lisensi Offline */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white border border-purple-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm shadow-purple-600/20">
            <KeyRound size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm">Lisensi Server Mandiri (Offline CBT)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                RSA-2048
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Kelola izin operasional CBT lokal proktor tanpa internet: pantau tanggal penerbitan key, sisa masa aktif, dan kirim lisensi ke WhatsApp proktor.
            </p>
          </div>
        </div>
        <Link
          to="/superadmin/offline-licenses"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm transition-all whitespace-nowrap self-stretch sm:self-auto flex-shrink-0"
        >
          <span>Kelola Lisensi Offline</span>
          <ChevronRight size={15} />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, i) => (
          <div key={i} className={cn(
            "bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow",
            stat.border
          )}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{loading ? "–" : stat.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tab + Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1 w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => { setTab("all"); setSelectedIds([]); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              tab === "all"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-2">
              <School size={14} className={tab === "all" ? "text-blue-500" : ""} />
              Semua
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === "all" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
              )}>
                {schools.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => { setTab("active"); setSelectedIds([]); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              tab === "active"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-2">
              <Zap size={14} className={tab === "active" ? "text-amber-500" : ""} />
              Aktif
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === "active" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
              )}>
                {activeCount}
              </span>
            </span>
          </button>
          <button
            onClick={() => { setTab("inactive"); setSelectedIds([]); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              tab === "inactive"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-2">
              <PowerOff size={14} />
              Nonaktif
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === "inactive" ? "bg-red-50 text-red-700" : "bg-slate-200 text-slate-600"
              )}>
                {schools.filter(s => !s.is_active).length}
              </span>
            </span>
          </button>
          <button
            onClick={() => { setTab("requests"); setSelectedIds([]); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              tab === "requests"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-2">
              <Clock size={14} />
              Pendaftaran
              {pendingCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">
                  {pendingCount}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => { setTab("logs"); refreshLogs(); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              tab === "logs"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-2">
              <Activity size={14} className={tab === "logs" ? "text-blue-500" : ""} />
              Log Aktivitas
              {logEntries.length > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  tab === "logs" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                )}>
                  {logEntries.length}
                </span>
              )}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari sekolah/universitas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            className={cn(
              "h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all",
              loading && "opacity-60 pointer-events-none"
            )}
          >
            <RefreshCw size={15} className={cn("text-slate-600", loading && "animate-spin")} />
          </button>

          {/* Docs Multi-VPS */}
          <a
            href="/superadmin/multi-vps-docs"
            className="h-9 px-3 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold shadow-xs flex items-center gap-1.5 transition-all text-xs whitespace-nowrap"
            title="Buka panduan manual Multi-VPS"
          >
            <BookOpen size={14} className="text-purple-600" />
            <span className="hidden md:inline">Panduan Multi-VPS</span>
          </a>

          {/* Add */}
          <button
            onClick={() => { setEditSchool(null); setShowAddModal(true); }}
            className="h-9 px-4 rounded-2xl bg-blue-50 hover:bg-blue-100 active:bg-blue-50 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/30 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm flex items-center gap-1.5 transition-all text-sm whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Tambah Sekolah</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {tab !== "requests" ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse min-w-[940px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                    <th className="px-3.5 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredSchools.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(filteredSchools.map(s => s.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 min-w-[240px]">Institusi & Akses</th>
                    <th className="px-4 py-3 min-w-[170px]">Server Node</th>
                    <th className="px-4 py-3 min-w-[160px]">Paket & Kuota</th>
                    <th className="px-4 py-3 min-w-[110px]">Status</th>
                    <th className="px-4 py-3 text-right min-w-[220px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={6} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <p className="text-sm font-medium tracking-wide">Menyelaraskan data...</p>
                      </div>
                    </td></tr>
                  ) : filteredSchools.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                        <School size={40} strokeWidth={1.5} />
                        <p className="text-sm font-medium">Belum ada data institusi di sini.</p>
                      </div>
                    </td></tr>
                  ) : filteredSchools.map(school => (
                    <tr key={school.id} className={cn(
                      "hover:bg-slate-50/80 transition-all group border-b border-slate-100/80 last:border-0",
                      selectedIds.includes(school.id) && "bg-blue-50/40 hover:bg-blue-50/60"
                    )}>
                      <td className="px-3.5 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedIds.includes(school.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, school.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== school.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SchoolAvatar name={school.name} logoUrl={school.logo_url} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors truncate max-w-[210px]">
                              {school.name}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <a
                                href={getSchoolUrl(school.slug)}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 font-mono transition-colors"
                                title="Buka Website Tenant"
                              >
                                <Globe size={11} className="text-blue-500 shrink-0" />
                                {getSchoolDomain(school.slug)}
                              </a>
                              {school.custom_domain && (
                                <a
                                  href={`https://${school.custom_domain}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title="Custom Domain Aktif"
                                >
                                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                  <span className="truncate max-w-[130px]">{school.custom_domain}</span>
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px] mt-0.5 block">
                              {school.contact_email || "no-email@exam.com"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {school.plan === "offline" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <HardDrive size={11} className="text-emerald-600" /> Server Lokal (Offline)
                            </span>
                          ) : school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost" ? (
                            <button
                              type="button"
                              onClick={() => setMigrationSchool(school)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100 transition-colors shadow-2xs"
                              title="Klik untuk atur / tarik kembali ke Master VPS"
                            >
                              <Cpu size={11} className="text-purple-600" /> Worker: {school.server_host}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setMigrationSchool(school)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100/80 text-slate-700 border border-slate-200/80 hover:bg-slate-200 transition-colors shadow-2xs"
                              title="Klik untuk burst mode ke Worker VPS"
                            >
                              <Server size={11} className="text-slate-500" /> Master Node (Lokal)
                            </button>
                          )}
                          <a
                            href={`${school.pb_url}${school.pb_url.endsWith("/") ? "" : "/"}_/`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-600 font-medium transition-colors pl-0.5"
                            title="Buka PocketBase Database Engine"
                          >
                            <Database size={10} /> Database Engine <ExternalLink size={8} />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border tracking-wide",
                              school.plan === "pro" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              school.plan === "ultimate" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              school.plan === "offline" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {PLAN_CONFIG[school.plan || "free"]?.label || school.plan || "Free"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">{school.student_quota || 0} Siswa</span>
                          </div>
                          {(() => {
                            const info = getActiveUntilInfo(school.active_until);
                            if (info.isPermanent) {
                              return (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-flex items-center gap-1">
                                  <ShieldCheck size={10} /> Permanen
                                </span>
                              );
                            }
                            return (
                              <span className={cn(
                                "text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded border",
                                info.isExpired
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200/80"
                              )}>
                                <Clock size={10} className={info.isExpired ? "text-rose-500" : "text-blue-500"} />
                                {info.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors",
                          school.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            school.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          )} />
                          {school.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(() => {
                            const pendingRenewal = requests.find(r => (r.slug_request === school.slug || r.school_name?.toLowerCase() === school.name?.toLowerCase()) && r.type === "renewal" && r.status === "pending");
                            if (pendingRenewal) {
                              return (
                                <button
                                  onClick={() => handleApproveRenewalRequest(pendingRenewal)}
                                  className="px-2.5 py-1 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 transition-all flex items-center gap-1 text-[11px] font-bold shadow-2xs animate-pulse whitespace-nowrap"
                                  title={`Sekolah ini mengajukan perpanjangan (${pendingRenewal.duration || "1 Tahun"}). Klik untuk terbitkan invoice.`}
                                >
                                  <Clock size={11} className="text-purple-700" />
                                  <span>Terbitkan ({pendingRenewal.duration || "1 Th"})</span>
                                </button>
                              );
                            }
                            if (school.active_until && getDiffDays(school.active_until) <= 14) {
                              return (
                                <button
                                  onClick={() => handleSendRenewalInvoice(school)}
                                  disabled={sendingRenewalId === school.id}
                                  className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all flex items-center gap-1 text-[11px] font-bold shadow-2xs whitespace-nowrap"
                                  title="Buat tagihan perpanjangan 1 tahun & siapkan invoice belum bayar"
                                >
                                  <Clock size={11} className={sendingRenewalId === school.id ? "animate-spin text-amber-700" : "text-amber-700"} />
                                  <span>Tagihan</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                          <div className="inline-flex items-center p-0.5 bg-slate-100/80 border border-slate-200/90 rounded-xl shadow-2xs shrink-0">
                            <button
                              onClick={() => setMigrationSchool(school)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-purple-700 hover:bg-white hover:text-purple-900 hover:shadow-2xs transition-all"
                              title={school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost" ? "Migrasi Server / Tarik ke Master" : "1-Klik Burst Mode (Pindah ke Worker)"}
                            >
                              <Zap size={13} className="text-purple-600" />
                            </button>
                            <button
                              onClick={() => setOfflineLicenseSchool(school)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-700 hover:bg-white hover:text-indigo-900 hover:shadow-2xs transition-all"
                              title="Izin Server Offline CBT (Lisensi Lab / Proktor)"
                            >
                              <KeyRound size={13} className="text-indigo-600" />
                            </button>
                            <button
                              onClick={() => { setEditSchool(school); setShowAddModal(true); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all"
                              title="Edit Konfigurasi Tenant"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => toggleActive(school)}
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                                school.is_active
                                  ? "text-slate-600 hover:bg-white hover:text-amber-600 hover:shadow-2xs"
                                  : "text-slate-600 hover:bg-white hover:text-emerald-600 hover:shadow-2xs"
                              )}
                              title={school.is_active ? "Nonaktifkan Sistem" : "Aktifkan Sistem"}
                            >
                              {school.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                            </button>
                            <button
                              onClick={() => deleteSchool(school)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-red-600 hover:shadow-2xs transition-all"
                              title="Hapus Tenant"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin" /> Memuat...
                </div>
              ) : filteredSchools.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Tidak ada data ditemukan.</div>
              ) : filteredSchools.map(school => (
                <div key={school.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <SchoolAvatar name={school.name} logoUrl={school.logo_url} className="w-10 h-10 text-sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{school.name}</p>
                        <p className="text-xs text-slate-400 truncate">{school.contact_email || "–"}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0",
                      school.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", school.is_active ? "bg-emerald-500" : "bg-slate-400")} />
                      {school.is_active ? "Aktif" : "Nonaktif"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", PLAN_CONFIG[school.plan || "free"]?.color)}>
                      {PLAN_CONFIG[school.plan || "free"]?.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{school.student_quota || 100} Siswa</span>
                    {(() => {
                      const info = getActiveUntilInfo(school.active_until);
                      if (info.isPermanent) return null;
                      return (
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded border",
                          info.isExpired
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200/80"
                        )}>
                          {info.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <a
                      href={getSchoolUrl(school.slug)}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      <Globe size={11} />
                      {getSchoolDomain(school.slug)}
                    </a>
                    {school.custom_domain && (
                      <a
                        href={`https://${school.custom_domain}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
                      >
                        <Globe size={11} className="text-emerald-500" />
                        {school.custom_domain}
                      </a>
                    )}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {school.plan === "offline" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                          <HardDrive size={11} className="text-emerald-600" /> Lokal Server (Offline)
                        </span>
                      ) : school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-md">
                          <Cpu size={11} className="text-purple-600" /> Worker Node: {school.server_host}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                          <Server size={11} className="text-slate-400" /> Master Node (Lokal)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setMigrationSchool(school)}
                      className="min-h-[42px] px-3 py-2 text-xs font-bold border border-purple-200 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-800 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Zap size={14} className="text-purple-600 flex-shrink-0" />
                      <span className="truncate">
                        {school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost"
                          ? "Migrasi ke Master"
                          : "Burst Mode (Worker)"}
                      </span>
                    </button>

                    <button
                      onClick={() => setOfflineLicenseSchool(school)}
                      className="min-h-[42px] px-3 py-2 text-xs font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-800 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <KeyRound size={14} className="text-indigo-600 flex-shrink-0" />
                      <span className="truncate">Izin Offline CBT</span>
                    </button>
                  </div>

                  {(() => {
                    const pendingRenewal = requests.find(r => (r.slug_request === school.slug || r.school_name?.toLowerCase() === school.name?.toLowerCase()) && r.type === "renewal" && r.status === "pending");
                    if (pendingRenewal) {
                      return (
                        <button
                          onClick={() => handleApproveRenewalRequest(pendingRenewal)}
                          className="w-full min-h-[42px] px-3 py-2 text-xs font-bold border border-purple-300 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-900 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs animate-pulse"
                        >
                          <Clock size={14} className="text-purple-700 flex-shrink-0" />
                          <span>Terbitkan Tagihan Perpanjangan ({pendingRenewal.duration || "1 Tahun"})</span>
                        </button>
                      );
                    }
                    if (school.active_until && getDiffDays(school.active_until) <= 14) {
                      return (
                        <button
                          onClick={() => handleSendRenewalInvoice(school)}
                          disabled={sendingRenewalId === school.id}
                          className="w-full min-h-[42px] px-3 py-2 text-xs font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-60"
                        >
                          <Clock size={14} className={sendingRenewalId === school.id ? "animate-spin text-amber-700" : "text-amber-700"} />
                          <span>{sendingRenewalId === school.id ? "Memproses..." : "Terbitkan Tagihan Perpanjangan"}</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => { setEditSchool(school); setShowAddModal(true); }}
                      className="flex-1 min-h-[42px] text-xs font-bold border border-slate-200 bg-white text-slate-700 rounded-xl flex items-center justify-center gap-1.5 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 active:bg-blue-100 transition-all shadow-xs"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(school)}
                      className={cn(
                        "flex-1 min-h-[42px] text-xs font-bold border bg-white rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs",
                        school.is_active
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50 active:bg-amber-100"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100"
                      )}
                    >
                      {school.is_active ? <><PowerOff size={14} /> Nonaktif</> : <><Power size={14} /> Aktifkan</>}
                    </button>
                    <button
                      onClick={() => deleteSchool(school)}
                      className="min-h-[42px] min-w-[42px] border border-red-200 bg-white text-red-500 rounded-xl flex items-center justify-center hover:bg-red-50 active:bg-red-100 transition-all flex-shrink-0 shadow-xs"
                      title="Hapus institusi"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Requests Desktop */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse min-w-[940px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                    <th className="px-3.5 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.length > 0 && selectedIds.length === requests.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(requests.map(r => r.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 min-w-[220px]">Nama Institusi</th>
                    <th className="px-4 py-3 min-w-[180px]">Subdomain</th>
                    <th className="px-4 py-3 min-w-[160px]">Paket & Durasi</th>
                    <th className="px-4 py-3 min-w-[170px]">Kontak</th>
                    <th className="px-4 py-3 min-w-[110px]">Status</th>
                    <th className="px-4 py-3 text-right min-w-[180px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Belum ada pendaftaran.</td></tr>
                  ) : requests.map(req => (
                    <tr key={req.id} className={cn(
                      "hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0",
                      selectedIds.includes(req.id) && "bg-blue-50/40"
                    )}>
                      <td className="px-3.5 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedIds.includes(req.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, req.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== req.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm">{req.school_name}</p>
                          {req.type === "renewal" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0">
                              <Clock size={10} /> Perpanjangan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{new Date(req.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                          {getSchoolDomain(req.slug_request)}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {req.type === "renewal" ? (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                              {PLAN_CONFIG[req.plan || ""]?.label || req.plan || "Paket"}
                            </span>
                          ) : req.plan === "free" || req.plan?.toLowerCase().includes("trial") || req.plan?.toLowerCase().includes("demo") ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <Sparkles size={10} /> Free Trial
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                              {PLAN_CONFIG[req.plan || ""]?.label || req.plan || "Paket"}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 font-medium">
                            {req.duration || (req.plan === "free" ? "14 Hari" : "1 Tahun")}
                          </span>
                          {req.address && req.type === "renewal" && (
                            <span className="text-[10px] text-slate-400 italic max-w-xs truncate" title={req.address}>
                              {req.address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800 font-medium">{req.contact_email}</p>
                        <p className="text-xs text-slate-400">{req.contact_phone || "–"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                          req.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                            : req.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-600 border-red-200"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full",
                            req.status === "pending" ? "bg-amber-500" : req.status === "approved" ? "bg-emerald-500" : "bg-red-500"
                          )} />
                          {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : "Ditolak"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                onClick={() => approveRequest(req)}
                                className={cn(
                                  "px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap",
                                  req.type === "renewal" ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"
                                )}
                                title={req.type === "renewal" ? "Terbitkan tagihan perpanjangan resmi" : "Buat institusi baru"}
                              >
                                <Check size={13} /> {req.type === "renewal" ? "Terbitkan Tagihan" : "Buat"}
                              </button>
                              <button
                                onClick={() => rejectRequest(req)}
                                className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                              >
                                <X size={13} /> Tolak
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {req.type === "renewal" ? (
                                <a
                                  href="/superadmin/invoice"
                                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap"
                                >
                                  Lihat Invoice
                                </a>
                              ) : (() => {
                                const existingSchool = schools.find(s => s.slug === req.slug_request);
                                if (existingSchool) {
                                  return (
                                    <button
                                      onClick={() => { setEditSchool(existingSchool); setShowAddModal(true); }}
                                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                                      title="Tenant sudah ada di daftar sekolah, klik untuk edit konfigurasi"
                                    >
                                      <Edit size={12} /> Edit Tenant
                                    </button>
                                  );
                                } else {
                                  return (
                                    <button
                                      onClick={() => approveRequest(req)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                      title="Buat tenant sekarang dari pendaftaran ini"
                                    >
                                      <Plus size={12} /> Buat Tenant
                                    </button>
                                  );
                                }
                              })()}
                              <button
                                onClick={() => resetRequestStatus(req, "pending")}
                                className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-lg transition-all"
                                title="Kembalikan status pendaftaran ke Menunggu / Pending"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => deleteRequest(req)}
                            className="p-1.5 border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all"
                            title="Hapus permanen"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Requests Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {requests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Belum ada pendaftaran.</div>
              ) : requests.map(req => (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">{req.school_name}</p>
                        {req.type === "renewal" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Clock size={10} /> Perpanjangan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(req.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0",
                      req.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : req.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-600 border-red-200"
                    )}>
                      {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : "Ditolak"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {req.type === "renewal" ? (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                        {PLAN_CONFIG[req.plan || ""]?.label || req.plan || "Paket"}
                      </span>
                    ) : req.plan === "free" || req.plan?.toLowerCase().includes("trial") || req.plan?.toLowerCase().includes("demo") ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <Sparkles size={10} /> Free Trial
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                        {PLAN_CONFIG[req.plan || ""]?.label || req.plan || "Paket"}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                      Durasi: {req.duration || (req.plan === "free" ? "14 Hari" : "1 Tahun")}
                    </span>
                    {req.address && req.type === "renewal" && (
                      <span className="text-[10px] text-slate-400 italic block w-full">
                        {req.address}
                      </span>
                    )}
                  </div>

                  <code className="text-xs font-mono px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md block">
                    {getSchoolDomain(req.slug_request)}
                  </code>
                  <p className="text-xs text-slate-600">{req.contact_email}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {req.status === "pending" ? (
                      <>
                        {req.type === "renewal" ? (
                          <button
                            onClick={() => approveRequest(req)}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Check size={14} /> Terbitkan Tagihan
                          </button>
                        ) : (
                          <button
                            onClick={() => approveRequest(req)}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Check size={14} /> Buat Institusi
                          </button>
                        )}
                        <button
                          onClick={() => rejectRequest(req)}
                          className="min-h-[42px] px-3.5 border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs"
                        >
                          Tolak
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center gap-1.5">
                        {req.type === "renewal" ? (
                          <a
                            href="/superadmin/invoice"
                            className="flex-1 min-h-[42px] px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                          >
                            Lihat Invoice
                          </a>
                        ) : (() => {
                          const existingSchool = schools.find(s => s.slug === req.slug_request);
                          if (existingSchool) {
                            return (
                              <button
                                onClick={() => { setEditSchool(existingSchool); setShowAddModal(true); }}
                                className="flex-1 min-h-[42px] px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                              >
                                <Edit size={13} /> Edit Tenant
                              </button>
                            );
                          } else {
                            return (
                              <button
                                onClick={() => approveRequest(req)}
                                className="flex-1 min-h-[42px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                              >
                                <Plus size={13} /> Buat Tenant
                              </button>
                            );
                          }
                        })()}
                        <button
                          onClick={() => resetRequestStatus(req, "pending")}
                          className="min-h-[42px] px-3 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-amber-50 hover:text-amber-700 transition-all shadow-xs"
                          title="Kembalikan status pendaftaran ke Menunggu / Pending"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => deleteRequest(req)}
                      className="min-h-[42px] min-w-[42px] border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-xs"
                      title="Hapus pendaftaran"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          {tab === "logs"
            ? `${logEntries.length} aktivitas tercatat`
            : tab !== "requests"
              ? `${filteredSchools.length} sekolah ${tab === "all" ? "terdaftar" : tab === "active" ? "aktif" : "nonaktif"}`
              : `${requests.length} pendaftaran`}
        </span>
      </div>

      {/* Log Aktivitas Panel */}
      {tab === "logs" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-blue-500" />
              <span className="text-sm font-bold text-slate-800">Log Aktivitas Admin</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{logEntries.length}</span>
            </div>
            {logEntries.length > 0 && (
              <button
                onClick={() => { clearLogs(); refreshLogs(); }}
                className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Trash2 size={12} /> Bersihkan Log
              </button>
            )}
          </div>
          {logEntries.length === 0 ? (
            <div className="py-16 text-center">
              <Activity size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-slate-400 font-medium">Belum ada aktivitas yang tercatat.</p>
              <p className="text-xs text-slate-300 mt-1">Setiap aksi di dashboard akan muncul di sini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logEntries.map((log, idx) => {
                const style = LOG_STYLE[log.type];
                const Icon = style.icon;
                const dateStr = new Date(log.timestamp).toLocaleString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit"
                });
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", style.bg, style.border)}>
                        <Icon size={14} className={style.color} />
                      </div>
                      {idx < logEntries.length - 1 && (
                        <div className="w-px h-full min-h-[20px] bg-slate-100 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{log.message}</p>
                          <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                            <span className={cn("font-bold", style.color)}>{log.target}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{timeAgo(log.timestamp)}</p>
                          <p className="text-[10px] text-slate-300 mt-0.5 whitespace-nowrap">{dateStr}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showAddModal && (
        <AddEditSchoolModal
          school={editSchool}
          onClose={() => {
            setShowAddModal(false);
            setEditSchool(null);
            setApprovingRequestId(null);
          }}
          onSaved={async () => {
            const isNewSchool = !editSchool?.id;
            const schoolName = editSchool?.name || "Institusi Baru";
            if (approvingRequestId) {
              try {
                await masterPb.collection("school_requests").update(approvingRequestId, { status: "approved" });
                addLog("approve", "Menyetujui dan membuat institusi dari pendaftaran", schoolName);
              } catch (e) {
                console.error("Gagal update status pendaftaran:", e);
              }
              setApprovingRequestId(null);
            } else if (isNewSchool) {
              addLog("create", "Membuat institusi baru", schoolName);
            } else {
              addLog("update", "Mengedit konfigurasi institusi", schoolName);
            }
            refreshLogs();
            setShowAddModal(false);
            setEditSchool(null);
            loadData();
            setTab("active");
          }}
        />
      )}

      {/* 1-Click Migration / Burst Mode Modal */}
      {migrationSchool && (
        <OneClickMigrationModal
          school={migrationSchool}
          onClose={() => setMigrationSchool(null)}
          onSuccess={() => {
            setMigrationSchool(null);
            loadData();
            refreshLogs();
          }}
        />
      )}

      {/* Offline License Authorization Modal */}
      {offlineLicenseSchool && (
        <OfflineLicenseModal
          open={Boolean(offlineLicenseSchool)}
          onOpenChange={(val) => !val && setOfflineLicenseSchool(null)}
          school={offlineLicenseSchool}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-slate-200 text-slate-700 px-6 py-3.5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-100 mr-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-200">
              {selectedIds.length}
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Terpilih</span>
          </div>

          <div className="flex items-center gap-1">
            {tab !== "requests" ? (
              <>
                <button
                  onClick={() => toggleSelectedActive(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl hover:bg-emerald-50 text-xs font-bold text-emerald-600 transition-all active:scale-95"
                >
                  <Power size={14} strokeWidth={2.5} /> Aktifkan
                </button>
                <button
                  onClick={() => toggleSelectedActive(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl hover:bg-amber-50 text-xs font-bold text-amber-600 transition-all active:scale-95"
                >
                  <PowerOff size={14} strokeWidth={2.5} /> Nonaktifkan
                </button>
              </>
            ) : (
              <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-4 mr-2 italic">
                Mode Pembersihan
              </div>
            )}
            <button
              onClick={tab !== "requests" ? deleteSelected : async () => {
                setConfirmData({
                  title: `Hapus ${selectedIds.length} Pendaftaran?`,
                  message: `Seluruh data pendaftaran yang dipilih akan dihapus selamanya.`,
                  type: "danger",
                  onConfirm: async () => {
                    try {
                      await Promise.all(selectedIds.map(id => masterPb.collection("school_requests").delete(id)));
                      loadData();
                      setSelectedIds([]);
                      setConfirmData(null);
                    } catch {
                      alert("Gagal menghapus beberapa pendaftaran.");
                    }
                  }
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-red-100"
            >
              <Trash2 size={14} strokeWidth={2.5} /> Hapus
            </button>
          </div>

          <button
            onClick={() => setSelectedIds([])}
            className="ml-4 w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmData && (
        <ConfirmDialog
          {...confirmData}
          onClose={() => setConfirmData(null)}
        />
      )}
    </SuperAdminLayout>
  );
};

// ============================================================
// Confirm Dialog Modal
// ============================================================
const ConfirmDialog = ({
  title,
  message,
  type,
  onConfirm,
  onClose
}: {
  title: string;
  message: string;
  type: "danger" | "warning" | "success";
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col items-center text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-300",
            type === "danger" ? "bg-red-50 text-red-500 scale-110" :
              type === "warning" ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500"
          )}>
            {type === "danger" ? <Trash2 size={28} /> : type === "warning" ? <PowerOff size={28} /> : <Check size={28} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight px-2">{title}</h3>
          <p className="text-slate-500 text-[13.5px] font-medium leading-relaxed px-2">
            {message}
          </p>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            disabled={loading}
            onClick={onClose}
            className="flex-1 h-11 bg-slate-100 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              "flex-[1.5] h-11 text-white rounded-2xl text-sm font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2",
              type === "danger" ? "bg-red-600 hover:bg-red-700 shadow-red-200" :
                type === "warning" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            )}
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : "Ya, Lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Add/Edit Modal
// ============================================================
const AddEditSchoolModal = ({
  school,
  onClose,
  onSaved,
}: {
  school: SchoolRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isEdit = !!(school?.id);
  const initialDate = formatToDateInput(school?.active_until);

  const [expiryType, setExpiryType] = useState<"subscription" | "permanent">(
    isEdit ? (initialDate ? "subscription" : "permanent") : "subscription"
  );
  const [savedDate, setSavedDate] = useState<string>(initialDate || (isEdit ? "" : getTrialDate()));
  const [extendFromCurrent, setExtendFromCurrent] = useState<boolean>(false);
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [useWorkerNode, setUseWorkerNode] = useState<boolean>(
    !!(school?.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost")
  );

  const [form, setForm] = useState({
    name: school?.name || "",
    slug: school?.slug || "",
    custom_domain: school?.custom_domain || "",
    pb_url: school?.pb_url || "",
    type: school?.type || "school",
    contact_email: school?.contact_email || "",
    student_quota: school?.student_quota || 50,
    plan: school?.plan || "free",
    active_until: isEdit ? initialDate : getTrialDate(),
    server_host: school?.server_host || "127.0.0.1",
    is_active: school?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSchoolCurrentlyActive = Boolean(
    school?.active_until && getDiffDays(school.active_until) > 0
  );

  useEffect(() => {
    if (school) {
      const parsedDate = formatToDateInput(school.active_until);
      const isSub = Boolean(parsedDate);
      setExpiryType(isSub ? "subscription" : "permanent");
      setSavedDate(parsedDate || "");
      setUseWorkerNode(!!(school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost"));
      setForm({
        name: school.name || "",
        slug: school.slug || "",
        custom_domain: school.custom_domain || "",
        pb_url: school.pb_url || "",
        type: school.type || "school",
        contact_email: school.contact_email || "",
        student_quota: school.student_quota || 50,
        plan: school.plan || "free",
        active_until: parsedDate,
        server_host: school.server_host || "127.0.0.1",
        is_active: school.is_active ?? true,
      });
    } else {
      setExpiryType("subscription");
      const trial = getTrialDate();
      setSavedDate(trial);
      setUseWorkerNode(false);
      setForm({
        name: "",
        slug: "",
        custom_domain: "",
        pb_url: "",
        type: "school",
        contact_email: "",
        student_quota: 50,
        plan: "free",
        active_until: trial,
        server_host: "127.0.0.1",
        is_active: true,
      });
    }
  }, [school]);

  const handleToggleExpiryType = (type: "subscription" | "permanent") => {
    setExpiryType(type);
    if (type === "permanent") {
      if (form.active_until) setSavedDate(form.active_until);
      setForm(prev => ({ ...prev, active_until: "" }));
    } else {
      let targetDate = savedDate;
      if (!targetDate) {
        if (form.plan === "free") {
          targetDate = getTrialDate();
        } else {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
      }
      setForm(prev => ({ ...prev, active_until: targetDate }));
    }
  };

  const handleApplyPreset = (days: number) => {
    let baseDate = new Date();
    if (extendFromCurrent && school?.active_until && isSchoolCurrentlyActive) {
      const match = school.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) baseDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    const newDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setForm(prev => ({ ...prev, active_until: newDateStr }));
    setSavedDate(newDateStr);
  };

  const isPresetActive = (days: number) => {
    if (expiryType !== "subscription" || !form.active_until) return false;
    let baseDate = new Date();
    if (extendFromCurrent && school?.active_until && isSchoolCurrentlyActive) {
      const match = school.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) baseDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return form.active_until === str;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === "plan") {
      let autoQuota = form.student_quota;
      if (value === "free") autoQuota = 50;
      else if (value === "basic") autoQuota = 250;
      else if (value === "pro") autoQuota = 500;
      else if (value === "ultimate") autoQuota = 1000;

      let nextActiveUntil = form.active_until;
      let nextExpiryType = expiryType;

      if (value === "free") {
        nextExpiryType = "subscription";
        nextActiveUntil = getTrialDate();
        setSavedDate(nextActiveUntil);
      } else if (form.plan === "free" || !nextActiveUntil) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        nextActiveUntil = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        setSavedDate(nextActiveUntil);
      }

      setExpiryType(nextExpiryType);
      setForm(prev => ({
        ...prev,
        plan: value,
        student_quota: autoQuota,
        active_until: nextExpiryType === "permanent" ? "" : nextActiveUntil,
      }));
      return;
    }
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked
        : type === "number" ? (value === "" ? "" : Number(value))
          : name === "slug" ? value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-")
            : name === "custom_domain" ? value.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
              : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.slug) {
      setError("Nama institusi dan subdomain wajib diisi.");
      return;
    }
    if (expiryType === "subscription" && (!form.active_until || !form.active_until.trim())) {
      setError("Tentukan tanggal kedaluwarsa atau pilih opsi Permanen.");
      return;
    }
    if (useWorkerNode && (!form.server_host || form.server_host === "127.0.0.1" || form.server_host === "localhost")) {
      setError("Masukkan IP Address Worker Node terlebih dahulu.");
      return;
    }

    const autoPbUrl = getSchoolUrl(form.slug);
    const cleanCustomDomain = form.custom_domain
      ? form.custom_domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      : "";

    let finalActiveUntil = "";
    if (expiryType === "subscription" && form.active_until && form.active_until.trim()) {
      finalActiveUntil = `${form.active_until.trim()} 23:59:59.000Z`;
    }

    const resolvedServerHost = useWorkerNode ? (form.server_host || "") : "127.0.0.1";

    const finalForm = {
      ...form,
      server_host: resolvedServerHost.trim(),
      active_until: finalActiveUntil,
      custom_domain: cleanCustomDomain,
      pb_url: autoPbUrl,
      student_quota: Number(form.student_quota) || 0,
    };
    setLoading(true);
    try {
      if (isEdit) {
        await masterPb.collection("schools").update(school!.id, finalForm);
      } else {
        const targetPlanKey = normalizePlanKey(form.plan);
        const isTrial = targetPlanKey === "free";

        let durationMonths = 1;
        if (expiryType === "permanent") {
          durationMonths = 12;
        } else if (form.active_until) {
          const diffDays = getDiffDays(form.active_until);
          durationMonths = Math.max(1, Math.round(diffDays / 30));
        }

        const planInfo = calculatePlanInvoice(targetPlanKey, durationMonths);

        let schoolPayload = { ...finalForm };
        if (!isTrial && initialPaymentStatus === "unpaid") {
          const trialDate = getTrialDate();
          schoolPayload = {
            ...finalForm,
            plan: "free",
            student_quota: 50,
            active_until: `${trialDate} 23:59:59.000Z`,
          };
        } else if (!isTrial && initialPaymentStatus === "paid") {
          schoolPayload = {
            ...finalForm,
            plan: targetPlanKey,
            student_quota: Number(form.student_quota) || planInfo.quota,
            active_until: finalActiveUntil,
          };
        }

        const createdSchool = await masterPb.collection("schools").create(schoolPayload);

        try {
          const now = new Date();
          const yy = now.getFullYear().toString().slice(2);
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const seq = String(Math.floor(Math.random() * 9000) + 1000);
          const invNum = `INV-${yy}${mm}-${seq}`;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);
          const isInvoicePaid = isTrial || initialPaymentStatus === "paid";

          await masterPb.collection("invoices").create({
            invoice_number: invNum,
            school_id: createdSchool?.id || "",
            school_name: form.name,
            school_slug: form.slug,
            contact_email: form.contact_email || "",
            plan: targetPlanKey,
            plan_label: planInfo.planLabel,
            duration_months: planInfo.durationMonths,
            period_label: planInfo.periodLabel,
            amount: isTrial ? 0 : planInfo.amount,
            status: isInvoicePaid ? "paid" : "unpaid",
            due_date: dueDate.toISOString().slice(0, 10),
            paid_date: isInvoicePaid ? now.toISOString().slice(0, 10) : "",
            notes: isTrial
              ? "Akun Free Trial 14 Hari (Otomatis Aktif)"
              : initialPaymentStatus === "paid"
                ? `Tagihan Perdana Paket ${planInfo.planLabel} (${planInfo.periodLabel}) - Lunas`
                : `Tagihan Perdana Paket ${planInfo.planLabel} (${planInfo.periodLabel}) - Menunggu Pembayaran`,
          });
        } catch (invErr) {
          console.error("Gagal membuat auto invoice:", invErr);
        }
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

  const PRESET_DURATIONS = [
    { label: "14 Hari", sub: "Trial", days: 14 },
    { label: "1 Bulan", sub: "30 hr", days: 30 },
    { label: "2 Bulan", sub: "60 hr", days: 60 },
    { label: "3 Bulan", sub: "Triwulan", days: 90 },
    { label: "6 Bulan", sub: "Semester", days: 180 },
    { label: "1 Tahun", sub: "12 bln", days: 365 },
  ];

  const activeUntilSummary = (() => {
    if (expiryType !== "subscription" || !form.active_until) return null;
    const match = form.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
    const diffDays = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    if (diffDays < 0) return { label: `Kedaluwarsa ${Math.abs(diffDays)} hr lalu`, color: "text-rose-700 bg-rose-50 border-rose-200" };
    if (diffDays === 0) return { label: "Berakhir hari ini", color: "text-orange-700 bg-orange-50 border-orange-200" };
    if (diffDays <= 14) return { label: `${formatted} (${diffDays} hr)`, color: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: `${formatted} (${diffDays} hr)`, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  })();

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-4 mt-2 first:mt-0">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );

  const shortDateStr = school?.active_until
    ? new Date(school.active_until).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {isEdit ? `Edit: ${school?.name}` : "Tambah Tenant Baru"}
            </h2>
            <p className="text-[13px] font-medium text-slate-500 mt-0.5">
              {isEdit ? "Perbarui konfigurasi tenant" : "Daftarkan institusi ke sistem"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6 bg-slate-50/30">
          
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2.5 font-bold shadow-sm">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-rose-600" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {/* BAGIAN 1: Identitas */}
          <div>
            <SectionLabel>Identitas Institusi</SectionLabel>
            <div className="space-y-4">
              {/* Nama */}
              {!isEdit ? (
                <SchoolNpsnSearch
                  valueSchoolName={form.name}
                  initialCustomMode={form.type === "campus"}
                  onSelectSchool={(s) => {
                    setForm(prev => ({
                      ...prev,
                      name: s.nama,
                      slug: prev.slug || generateSlugFromName(s.nama),
                      contact_email: prev.contact_email || s.kontak?.email || "",
                    }));
                  }}
                  onManualChange={(name) => {
                    setForm(prev => ({
                      ...prev,
                      name,
                      slug: prev.slug || generateSlugFromName(name),
                    }));
                  }}
                />
              ) : (
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Nama Institusi <span className="text-blue-600">*</span></label>
                  <input
                    type="text" name="name" value={form.name} onChange={handleChange}
                    placeholder="cth. SMP Negeri 1 Jakarta"
                    required
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all shadow-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipe */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Varian Sistem</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { val: "school", label: "Sekolah", icon: School, activeColor: "border-blue-400 bg-blue-50 text-blue-800 shadow-sm", iconBg: "bg-blue-600 text-white" },
                      { val: "campus", label: "Kampus", icon: Building2, activeColor: "border-purple-400 bg-purple-50 text-purple-800 shadow-sm", iconBg: "bg-purple-600 text-white" },
                    ] as const).map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, type: opt.val }))}
                        className={cn(
                          "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-bold transition-all h-11",
                          form.type === opt.val ? opt.activeColor : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn("p-1 rounded-lg flex-shrink-0", form.type === opt.val ? opt.iconBg : "bg-slate-100 text-slate-400")}>
                          <opt.icon size={14} />
                        </div>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Email Admin</label>
                  <input
                    type="email" name="contact_email" value={form.contact_email} onChange={handleChange}
                    placeholder="admin@sekolah.sch.id"
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Subdomain */}
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">
                  Subdomain <span className="text-blue-600">*</span>
                </label>
                {isEdit ? (
                  <div className="h-11 border border-slate-200 rounded-xl px-4 flex items-center gap-2 bg-slate-100 shadow-inner">
                    <span className="text-[13px] font-bold text-slate-600 font-mono truncate">{form.slug}</span>
                    <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-1 rounded-md shrink-0">
                      <Lock size={10} /> Terkunci
                    </div>
                  </div>
                ) : (
                  <input
                    type="text" name="slug" value={form.slug} onChange={handleChange}
                    placeholder="smpn1"
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all shadow-sm font-mono placeholder:font-sans placeholder:font-medium"
                  />
                )}
                <p className="text-[11px] font-medium text-slate-500 mt-1.5 font-mono truncate px-1">
                  Final URL: {form.slug ? getSchoolDomain(form.slug) : `[nama]${getDomainSuffix()}`}
                </p>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: Paket */}
          <div>
            <SectionLabel>Paket & Kuota</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Paket Layanan</label>
                <div className="relative">
                  <select
                    name="plan" value={form.plan} onChange={handleChange}
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 pr-8 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none bg-white cursor-pointer transition-all shadow-sm"
                  >
                    <option value="free">Free Trial (50 siswa)</option>
                    <option value="basic">Berkembang (250 siswa)</option>
                    <option value="pro">Lanjutan (500 siswa)</option>
                    <option value="ultimate">Premium (1000 siswa)</option>
                    <option value="offline">Lokal Offline</option>
                  </select>
                  <ChevronDown size={14} strokeWidth={2.5} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Kuota Siswa</label>
                <input
                  type="number" name="student_quota" value={form.student_quota} onChange={handleChange}
                  min={1}
                  className="w-full h-11 border border-slate-200 rounded-xl px-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Status Pembayaran (hanya saat buat baru non-free) */}
            {!isEdit && form.plan !== "free" && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  {
                    val: "unpaid" as const,
                    label: "Belum Bayar",
                    sub: "Mulai trial, upgrade saat lunas",
                    icon: Clock,
                    colors: "border-amber-400 bg-amber-50 ring-amber-300",
                    iconBg: "bg-amber-100 text-amber-700",
                    textColor: "text-amber-950",
                    subColor: "text-amber-800",
                  },
                  {
                    val: "paid" as const,
                    label: "Sudah Lunas",
                    sub: "Langsung aktif paket penuh",
                    icon: CheckCircle2,
                    colors: "border-emerald-500 bg-emerald-50 ring-emerald-300",
                    iconBg: "bg-emerald-100 text-emerald-700",
                    textColor: "text-emerald-950",
                    subColor: "text-emerald-800",
                  },
                ] as const).map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setInitialPaymentStatus(opt.val)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex items-start gap-3",
                      initialPaymentStatus === opt.val
                        ? `${opt.colors} ring-1 shadow-sm`
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", opt.iconBg)}>
                      <opt.icon size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className={cn("text-[13px] font-black leading-tight", initialPaymentStatus === opt.val ? opt.textColor : "text-slate-800")}>{opt.label}</p>
                      <p className={cn("text-[11px] font-medium mt-1 leading-snug", initialPaymentStatus === opt.val ? opt.subColor : "text-slate-500")}>{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* BAGIAN 3: Masa Aktif */}
          <div>
            <SectionLabel>Masa Aktif</SectionLabel>

            {/* Toggle Langganan vs Permanen */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {([
                { val: "subscription" as const, label: "Berbatas Waktu", icon: Calendar, activeClass: "border-blue-400 bg-blue-50 text-blue-800 shadow-sm", iconClass: "text-blue-600" },
                { val: "permanent" as const, label: "Permanen", icon: ShieldCheck, activeClass: "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm", iconClass: "text-emerald-600" },
              ] as const).map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => handleToggleExpiryType(opt.val)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-bold transition-all h-11",
                    expiryType === opt.val ? opt.activeClass : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <opt.icon size={16} strokeWidth={2.5} className={expiryType === opt.val ? opt.iconClass : "text-slate-400"} />
                  {opt.label}
                </button>
              ))}
            </div>

            {expiryType === "subscription" && (
              <div className="space-y-4">
                {/* Toggle perpanjang dari saat ini (edit & aktif saja) */}
                {isEdit && isSchoolCurrentlyActive && (
                  <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Clock size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Mulai dari batas aktif saat ini</p>
                        <p className="text-[11px] font-medium text-slate-500">{shortDateStr}</p>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center flex-shrink-0 ml-2">
                      <input type="checkbox" checked={extendFromCurrent} onChange={e => setExtendFromCurrent(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </div>
                  </label>
                )}

                {/* Preset durasi */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRESET_DURATIONS.map(preset => {
                    const active = isPresetActive(preset.days);
                    return (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => handleApplyPreset(preset.days)}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all h-14",
                          active
                            ? "border-blue-400 bg-blue-50 text-blue-900 ring-1 ring-blue-400 shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-[12px] font-black leading-tight">{preset.label}</span>
                        <span className={cn("text-[10px] font-medium mt-0.5", active ? "text-blue-600" : "text-slate-400")}>{preset.sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Input tanggal */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <input
                    type="date"
                    name="active_until"
                    value={form.active_until}
                    onChange={e => {
                      setForm(prev => ({ ...prev, active_until: e.target.value }));
                      setSavedDate(e.target.value);
                    }}
                    className="w-full sm:flex-1 h-11 border border-slate-200 rounded-xl px-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer shadow-sm"
                  />
                  {activeUntilSummary ? (
                    <div className={cn("w-full sm:w-auto text-[11px] font-bold px-3 py-2.5 rounded-xl border flex items-center justify-center sm:justify-start gap-1.5 h-11", activeUntilSummary.color)}>
                      <Calendar size={13} strokeWidth={2.5} />
                      {activeUntilSummary.label}
                    </div>
                  ) : (
                    <div className="w-full sm:w-auto text-[11px] font-bold px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center sm:justify-start gap-1.5 h-11">
                      <AlertTriangle size={13} strokeWidth={2.5} />
                      Belum dipilih
                    </div>
                  )}
                </div>
              </div>
            )}

            {expiryType === "permanent" && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl text-[13px] text-emerald-900 font-medium shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} className="text-emerald-700" strokeWidth={2.5} />
                </div>
                <p className="leading-relaxed">Tenant ini <strong>aktif selamanya</strong> tanpa batas waktu. Fitur ini cocok untuk institusi internal atau kontrak seumur hidup.</p>
              </div>
            )}
          </div>

          {/* BAGIAN 4: Opsional */}
          <div>
            <SectionLabel>Infrastruktur (Opsional)</SectionLabel>
            <div className="space-y-4">
              {/* Custom Domain */}
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Custom Domain</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    name="custom_domain"
                    value={form.custom_domain}
                    onChange={handleChange}
                    placeholder="cbt.sman1contoh.sch.id"
                    className="w-full h-11 border border-slate-200 rounded-xl pl-9 pr-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white font-mono placeholder:font-sans placeholder:font-medium placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                {form.custom_domain && (
                  <p className="text-[11px] font-medium text-slate-500 mt-2 px-1">
                    Arahkan DNS <strong>A Record</strong> ke <code className="text-slate-700 font-bold bg-slate-200/70 px-1.5 py-0.5 rounded font-mono">64.235.41.108</code> atau <strong>CNAME</strong> ke <code className="text-slate-700 font-bold bg-slate-200/70 px-1.5 py-0.5 rounded font-mono">{form.slug ? `${form.slug}.examku.my.id` : `subdomain${getDomainSuffix()}`}</code>
                  </p>
                )}
              </div>

              {/* Server Node */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">Isolasi Worker Node</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Pindahkan beban database ke server terpisah</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWorkerNode}
                      onChange={e => {
                        setUseWorkerNode(e.target.checked);
                        if (!e.target.checked) setForm(prev => ({ ...prev, server_host: "127.0.0.1" }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>

                {useWorkerNode && (
                  <div className="relative mt-3">
                    <Cpu size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                    <input
                      type="text"
                      name="server_host"
                      value={form.server_host === "127.0.0.1" || form.server_host === "localhost" ? "" : form.server_host}
                      onChange={handleChange}
                      placeholder="IP Worker (cth. 103.123.45.67)"
                      autoFocus
                      className="w-full h-11 border border-purple-300 rounded-xl pl-9 pr-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-purple-50/30 font-mono placeholder:font-sans placeholder:font-medium placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="shrink-0 px-6 py-5 border-t border-slate-100 bg-white flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-[1] h-12 border border-slate-200 text-slate-600 rounded-xl text-[13px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={(e) => {
               e.preventDefault();
               handleSubmit(e as any);
            }}
            disabled={loading}
            className="flex-[2] h-12 bg-blue-600 text-white rounded-xl text-[13px] font-bold hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <><RefreshCw size={15} className="animate-spin" /> Memproses...</>
            ) : (
              <><Check size={16} strokeWidth={2.5} /> {isEdit ? "Simpan Perubahan" : "Daftarkan Tenant"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
