import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Check, X, Edit, Power, PowerOff,
  School, Clock, Users, RefreshCw,
  Search, Trash2, Monitor, Zap, Server, ChevronDown,
  Building2, Globe, Sparkles, ShieldCheck, Calendar, Cpu, BookOpen,
  Activity, CheckCircle2, XCircle, AlertTriangle, Info
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";
import { getSchoolUrl, getSchoolDomain, getDomainSuffix } from "../../utils/domainHelper";
import { calculatePlanInvoice, PLAN_PRICING, normalizePlanKey } from "../../utils/pricingHelper";
import { ensureRenewalInvoice } from "../../utils/subscriptionHelper";

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
  type?: "school" | "campus";
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

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "requests" | "logs">("all");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [requests, setRequests] = useState<SchoolRequest[]>([]);
  const [logEntries, setLogEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
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

  const approveRequest = async (req: SchoolRequest) => {
    try {
      await masterPb.collection("school_requests").update(req.id, { status: "approved" });
      loadData();
      setTab("active");

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
        type: req.type || 'school',
        plan: targetPlan,
        student_quota: targetQuota,
        active_until: expDate.toISOString(),
      });
      setApprovingRequestId(req.id);
      setShowAddModal(true);
    } catch {
      alert("Gagal menyetujui pendaftaran.");
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
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manajemen tenant EXAM AA.</p>
        </div>
        <div className="text-[9px] text-slate-400 font-mono bg-slate-50/50 px-2 py-1.5 rounded-lg border border-slate-100 flex flex-col items-end max-w-[150px] leading-tight">
          <span className="text-slate-300 mb-0.5">DB Connected</span>
          <span className="break-all text-right opacity-70">{masterPb.baseUrl.replace('https://', '')}</span>
          <span className="mt-1 font-bold text-slate-400">{schools.length} Records</span>
        </div>
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {tab !== "requests" ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 w-10">
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
                    <th className="px-2 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Institusi</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Alamat Sistem</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Paket</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
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
                    <tr><td colSpan={5} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                        <School size={40} strokeWidth={1.5} />
                        <p className="text-sm font-medium">Belum ada data institusi di sini.</p>
                      </div>
                    </td></tr>
                  ) : filteredSchools.map(school => (
                    <tr key={school.id} className={cn(
                      "hover:bg-slate-50/80 transition-all group border-b border-slate-50 last:border-0",
                      selectedIds.includes(school.id) && "bg-blue-50/40 hover:bg-blue-50/60"
                    )}>
                      <td className="px-5 py-4">
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
                      <td className="px-2 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                            {school.logo_url ? (
                              <img src={school.logo_url} alt={school.name} className="w-full h-full object-contain p-1" />
                            ) : (
                              <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-sm uppercase">
                                {school.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-[14px] leading-tight mb-1 truncate group-hover:text-blue-600 transition-colors">
                              {school.name}
                            </p>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                <Globe size={10} /> {school.contact_email || "no-email@exam.com"}
                              </span>
                              <span className="text-[9px] font-black text-blue-400/80 uppercase tracking-[0.15em] flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-300" /> Aktif Sejak {new Date(school.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <a
                            href={getSchoolUrl(school.slug)}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[11px] font-bold bg-white text-slate-600 px-3 py-1.5 rounded-full w-fit border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all group/link"
                          >
                            <Monitor size={12} className="text-slate-400 group-hover/link:text-blue-500" />
                            {getSchoolDomain(school.slug)}
                          </a>
                          {school.custom_domain && (
                            <a
                              href={`https://${school.custom_domain}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full w-fit border border-emerald-200 hover:border-emerald-300 hover:shadow-sm transition-all group/link"
                              title="Custom Domain Aktif"
                            >
                              <Globe size={11} className="text-emerald-500 group-hover/link:scale-110 transition-transform" />
                              <span className="truncate max-w-[170px]">{school.custom_domain}</span>
                            </a>
                          )}
                          <a
                            href={`${school.pb_url}${school.pb_url.endsWith("/") ? "" : "/"}_/`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 pl-3 text-[10px] text-slate-400 hover:text-blue-500 transition-colors font-medium"
                          >
                            <Server size={11} /> Database Engine
                          </a>
                          <div className="flex items-center gap-1.5 pl-3 pt-0.5">
                            {school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-md" title={`Worker Node: ${school.server_host}`}>
                                <Cpu size={10} className="text-purple-600" /> Worker: {school.server_host}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md" title="Dijalankan di VPS Master">
                                <Server size={10} className="text-slate-400" /> Master Node (Lokal)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "inline-flex items-center justify-center text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wide w-fit",
                              school.plan === "pro" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                school.plan === "ultimate" ? "bg-purple-50 text-purple-600 border-purple-100" :
                                  "bg-slate-50 text-slate-500 border-slate-100"
                            )}>
                              {PLAN_CONFIG[school.plan || "free"]?.label || school.plan || "Free"}
                            </span>
                            <p className="text-[11px] text-slate-400 font-bold">{school.student_quota || 0} Siswa</p>
                          </div>
                          {(() => {
                            const info = getActiveUntilInfo(school.active_until);
                            if (info.isPermanent) {
                              return <span className="text-[10px] text-slate-400 italic">Masa aktif: permanen</span>;
                            }
                            return (
                              <span className={cn(
                                "text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded border w-fit",
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
                      <td className="px-5 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors",
                          school.is_active
                            ? "bg-emerald-50/50 text-emerald-600 border-emerald-100"
                            : "bg-red-50/50 text-red-500 border-red-100"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            school.is_active ? "bg-emerald-500" : "bg-red-500"
                          )} />
                          {school.is_active ? "Sistem Aktif" : "Sistem Off"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {school.active_until && getDiffDays(school.active_until) <= 14 && (
                            <button
                              onClick={() => handleSendRenewalInvoice(school)}
                              disabled={sendingRenewalId === school.id}
                              className="px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs hover:shadow-sm"
                              title="Buat tagihan perpanjangan 1 tahun & siapkan invoice belum bayar"
                            >
                              <Clock size={12} className={sendingRenewalId === school.id ? "animate-spin text-amber-700" : "text-amber-700"} />
                              <span>{sendingRenewalId === school.id ? "Memproses..." : "Kirim Tagihan"}</span>
                            </button>
                          )}
                          <button
                            onClick={() => { setEditSchool(school); setShowAddModal(true); }}
                            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all flex items-center justify-center group/btn"
                            title="Edit"
                          >
                            <Edit size={14} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => toggleActive(school)}
                            className={cn(
                              "w-8 h-8 rounded-full border border-slate-200 bg-white transition-all flex items-center justify-center hover:shadow-md group/btn",
                              school.is_active
                                ? "text-slate-400 hover:text-amber-500 hover:border-amber-200"
                                : "text-slate-400 hover:text-emerald-500 hover:border-emerald-200"
                            )}
                            title={school.is_active ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {school.is_active ? <PowerOff size={14} className="group-hover/btn:scale-110 transition-transform" /> : <Power size={14} className="group-hover/btn:scale-110 transition-transform" />}
                          </button>
                          <button
                            onClick={() => deleteSchool(school)}
                            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 hover:shadow-md transition-all flex items-center justify-center group/btn"
                            title="Hapus"
                          >
                            <Trash2 size={14} className="group-hover/btn:rotate-12 transition-transform" />
                          </button>
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
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm font-bold text-blue-600 text-sm">
                        {school.logo_url ? (
                          <img src={school.logo_url} alt={school.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          school.name[0]
                        )}
                      </div>
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
                      {school.server_host && school.server_host !== "127.0.0.1" && school.server_host !== "localhost" ? (
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

                  {school.active_until && getDiffDays(school.active_until) <= 14 && (
                    <button
                      onClick={() => handleSendRenewalInvoice(school)}
                      disabled={sendingRenewalId === school.id}
                      className="w-full h-8 text-xs font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Clock size={13} className={sendingRenewalId === school.id ? "animate-spin text-amber-700" : "text-amber-700"} />
                      {sendingRenewalId === school.id ? "Memproses..." : "Terbitkan Tagihan Perpanjangan"}
                    </button>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => { setEditSchool(school); setShowAddModal(true); }}
                      className="flex-1 h-8 text-xs font-semibold border border-slate-200 bg-white text-slate-700 rounded-lg flex items-center justify-center gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                      <Edit size={13} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(school)}
                      className={cn(
                        "flex-1 h-8 text-xs font-semibold border bg-white rounded-lg flex items-center justify-center gap-1 transition-all",
                        school.is_active
                          ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      )}
                    >
                      {school.is_active ? <><PowerOff size={13} /> Nonaktif</> : <><Power size={13} /> Aktifkan</>}
                    </button>
                    <button
                      onClick={() => deleteSchool(school)}
                      className="h-8 w-8 border border-red-200 bg-white text-red-500 rounded-lg flex items-center justify-center hover:bg-red-50 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Requests Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 w-10">
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
                    <th className="px-2 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Institusi</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Domain</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Paket & Durasi</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kontak</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
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
                      <td className="px-5 py-3.5">
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
                      <td className="px-2 py-3.5">
                        <p className="font-semibold text-slate-900 text-sm">{req.school_name}</p>
                        <p className="text-xs text-slate-400">{new Date(req.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs font-mono px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                          {getSchoolDomain(req.slug_request)}
                        </code>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          {req.plan === "free" || req.plan?.toLowerCase().includes("trial") || req.plan?.toLowerCase().includes("demo") ? (
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
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-800 font-medium">{req.contact_email}</p>
                        <p className="text-xs text-slate-400">{req.contact_phone || "–"}</p>
                      </td>
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                onClick={() => approveRequest(req)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Check size={13} /> Buat
                              </button>
                              <button
                                onClick={() => rejectRequest(req)}
                                className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                              >
                                <X size={13} /> Tolak
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Selesai</span>
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
                      <p className="font-semibold text-slate-900 text-sm">{req.school_name}</p>
                      <p className="text-xs text-slate-400">{new Date(req.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
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
                    {req.plan === "free" || req.plan?.toLowerCase().includes("trial") || req.plan?.toLowerCase().includes("demo") ? (
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
                  </div>

                  <code className="text-xs font-mono px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md block">
                    {getSchoolDomain(req.slug_request)}
                  </code>
                  <p className="text-xs text-slate-600">{req.contact_email}</p>
                  <div className="flex gap-2">
                    {req.status === "pending" ? (
                      <>
                        <button onClick={() => approveRequest(req)} className="flex-1 h-8 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1">
                          <Check size={13} /> Buat Institusi
                        </button>
                        <button onClick={() => rejectRequest(req)} className="h-8 px-3 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg">
                          Tolak
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 h-8 flex items-center px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendaftaran Selesai</div>
                    )}
                    <button onClick={() => deleteRequest(req)} className="h-8 w-8 border border-slate-200 text-slate-400 rounded-lg flex items-center justify-center hover:text-red-600">
                      <Trash2 size={13} />
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
          }}
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

  // Mode Masa Aktif: "subscription" (berbatas waktu) vs "permanent" (tanpa batas waktu)
  const [expiryType, setExpiryType] = useState<"subscription" | "permanent">(
    isEdit ? (initialDate ? "subscription" : "permanent") : "subscription"
  );
  const [savedDate, setSavedDate] = useState<string>(initialDate || (isEdit ? "" : getTrialDate()));
  const [extendFromCurrent, setExtendFromCurrent] = useState<boolean>(false);
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<"unpaid" | "paid">("unpaid");

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
      if (form.active_until) {
        setSavedDate(form.active_until);
      }
      setForm(prev => ({ ...prev, active_until: "" }));
    } else {
      let targetDate = savedDate;
      if (!targetDate) {
        if (form.plan === "free") {
          targetDate = getTrialDate();
        } else {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          targetDate = `${y}-${m}-${day}`;
        }
      }
      setForm(prev => ({ ...prev, active_until: targetDate }));
    }
  };

  const handleApplyPreset = (days: number) => {
    let baseDate = new Date();
    if (extendFromCurrent && school?.active_until && isSchoolCurrentlyActive) {
      const match = school.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        baseDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      }
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const newDateStr = `${y}-${m}-${day}`;
    setForm(prev => ({ ...prev, active_until: newDateStr }));
    setSavedDate(newDateStr);
  };

  const isPresetActive = (days: number) => {
    if (expiryType !== "subscription" || !form.active_until) return false;
    let baseDate = new Date();
    if (extendFromCurrent && school?.active_until && isSchoolCurrentlyActive) {
      const match = school.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        baseDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      }
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return form.active_until === `${y}-${m}-${day}`;
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
      } else {
        // Jika sebelumnya paket free atau kosong, otomatis berikan default 1 tahun
        if (form.plan === "free" || !nextActiveUntil) {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          nextActiveUntil = `${y}-${m}-${day}`;
          setSavedDate(nextActiveUntil);
        }
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
      setError("Silakan tentukan batas tanggal kedaluwarsa atau pilih opsi Permanen.");
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

    const finalForm = {
      ...form,
      server_host: (form.server_host || "127.0.0.1").trim(),
      active_until: finalActiveUntil,
      custom_domain: cleanCustomDomain,
      pb_url: autoPbUrl,
      student_quota: Number(form.student_quota) || 0
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

        // Jika pendaftar mengambil paket berbayar (cth. Ultimate) tapi status awal belum bayar:
        // Sekolah baru tetap aktif dalam mode Free Trial (50 siswa, 14 hari)
        // sampai invoice resmi dibayarkan.
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

        // Terbitkan invoice perdana dengan tarif resmi landing page
        try {
          const now = new Date();
          const yy = now.getFullYear().toString().slice(2);
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const seq = String(Math.floor(Math.random() * 9000) + 1000);
          const invNum = `INV-${yy}${mm}-${seq}`;

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);

          const isInvoicePaid = isTrial || initialPaymentStatus === "paid";

          const newInvoice = {
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
                : `Tagihan Perdana Paket ${planInfo.planLabel} (${planInfo.periodLabel}) - Menunggu Pembayaran untuk Aktivasi Penuh`,
          };

          await masterPb.collection("invoices").create(newInvoice);
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
    { label: "14 Hari", sub: "Uji Coba", days: 14 },
    { label: "1 Bulan", sub: "30 Hari", days: 30 },
    { label: "3 Bulan", sub: "Triwulan", days: 90 },
    { label: "1 Semester", sub: "6 Bulan", days: 180 },
    { label: "1 Tahun", sub: "12 Bulan", days: 365 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEdit ? "Edit Institusi" : "Buat Institusi Baru"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Konfigurasi lingkungan tenant secara otomatis</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Institusi <span className="text-blue-600">*</span></label>
            <input
              type="text" name="name" value={form.name} onChange={handleChange}
              placeholder="cth. SMP Negeri 1 Jakarta atau Univ. Gajah Mada" required
              className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Varian Sistem</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'school' }))}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                  form.type === 'school'
                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", form.type === 'school' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>
                  <School size={16} />
                </div>
                Sekolah
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'campus' }))}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                  form.type === 'campus'
                    ? "bg-purple-50 border-purple-200 text-purple-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", form.type === 'campus' ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-400")}>
                  <Building2 size={16} />
                </div>
                Kampus
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subdomain <span className="text-blue-600">*</span></label>
              <input
                type="text" name="slug" value={form.slug} onChange={handleChange}
                disabled={isEdit} placeholder="smpn1"
                className={cn(
                  "w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white",
                  isEdit && "opacity-60 cursor-not-allowed bg-slate-50"
                )}
              />
              <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                {form.slug ? getSchoolDomain(form.slug) : `...${getDomainSuffix()}`}
              </p>
              {isEdit && <p className="text-[10px] text-red-500 font-semibold">Tidak bisa diubah</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Admin</label>
              <input
                type="email" name="contact_email" value={form.contact_email} onChange={handleChange}
                placeholder="admin@sekolah.sch.id"
                className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Paket</label>
              <div className="relative">
                <select
                  name="plan" value={form.plan} onChange={handleChange}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none bg-white cursor-pointer"
                >
                  <option value="free">Free Trial (50 Siswa)</option>
                  <option value="basic">Paket Berkembang (250 Siswa)</option>
                  <option value="pro">Paket Lanjutan (500 Siswa)</option>
                  <option value="ultimate">Paket Premium (1000 Siswa)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kuota Siswa</label>
              <input
                type="number" name="student_quota" value={form.student_quota} onChange={handleChange}
                className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white"
              />
            </div>
          </div>

          {/* Status Pembayaran Awal Tagihan Perdana (Hanya saat buat tenant baru non-free) */}
          {!isEdit && form.plan !== "free" && (
            <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-amber-950">
                  Status Pembayaran Tagihan Perdana
                </label>
                <span className={cn(
                  "text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                  initialPaymentStatus === "unpaid"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                )}>
                  {initialPaymentStatus === "unpaid" ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                  {initialPaymentStatus === "unpaid" ? "Menunggu Pembayaran" : "Sudah Dibayar"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setInitialPaymentStatus("unpaid")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    initialPaymentStatus === "unpaid"
                      ? "bg-white border-amber-400 shadow-xs ring-2 ring-amber-400/20"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                      <Clock size={13} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Belum Bayar (Free Trial)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Tenant langsung aktif dengan paket <strong>Free Trial 14 hari (50 siswa)</strong>. Invoice tagihan perdana diterbitkan. Sekolah otomatis di-upgrade ke paket penuh setelah invoice dibayar.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setInitialPaymentStatus("paid")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    initialPaymentStatus === "paid"
                      ? "bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={13} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Sudah Lunas (Paket Penuh)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Pembayaran telah diverifikasi secara manual (transfer/tunai). Tenant langsung aktif dengan paket penuh, kuota {form.student_quota} siswa, dan masa aktif terpilih.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Masa Aktif & Lisensi Tenant */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-800">
                  Masa Aktif & Lisensi Tenant
                </label>
                <span className={cn(
                  "text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                  expiryType === "subscription"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  {expiryType === "subscription" ? <Calendar size={11} className="text-blue-700" /> : <ShieldCheck size={11} className="text-emerald-700" />}
                  {expiryType === "subscription" ? "Berbatas Waktu" : "Permanen"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Pilih jenis lisensi dan batas waktu operasional ujian untuk institusi ini
              </p>
            </div>

            {/* Pilihan Tipe: Berlangganan vs Permanen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleToggleExpiryType("subscription")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all min-h-[58px] focus-visible:ring-2 focus-visible:ring-blue-500",
                  expiryType === "subscription"
                    ? "bg-blue-50/90 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-400"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg flex-shrink-0 mt-0.5",
                  expiryType === "subscription" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">Berbatas Waktu (Langganan)</p>
                  <p className={cn("text-[11px] mt-0.5 leading-snug", expiryType === "subscription" ? "text-blue-800" : "text-slate-500")}>
                    Mempunyai tanggal kedaluwarsa operasional sistem
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleExpiryType("permanent")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all min-h-[58px] focus-visible:ring-2 focus-visible:ring-emerald-500",
                  expiryType === "permanent"
                    ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg flex-shrink-0 mt-0.5",
                  expiryType === "permanent" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">Permanen (Tanpa Batas)</p>
                  <p className={cn("text-[11px] mt-0.5 leading-snug", expiryType === "permanent" ? "text-emerald-800" : "text-slate-500")}>
                    Aktif terus tanpa tanggal kedaluwarsa
                  </p>
                </div>
              </button>
            </div>

            {/* Jika Berbatas Waktu */}
            {expiryType === "subscription" && (
              <div className="space-y-3 pt-1">
                {/* Opsi Perpanjang Jika Sedang Edit dan Masih Aktif */}
                {isEdit && isSchoolCurrentlyActive && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-600 flex-shrink-0" />
                      <span className="text-slate-700 font-medium">Perpanjang dari batas aktif saat ini</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extendFromCurrent}
                        onChange={e => setExtendFromCurrent(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                )}

                {/* Preset Durasi Cepat */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-slate-700">
                      Pilihan Durasi Cepat
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {extendFromCurrent && isEdit && isSchoolCurrentlyActive
                        ? "Dihitung dari akhir masa aktif"
                        : "Dihitung mulai hari ini"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {PRESET_DURATIONS.map(preset => {
                      const active = isPresetActive(preset.days);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleApplyPreset(preset.days)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all min-h-[50px] focus-visible:ring-2 focus-visible:ring-blue-500",
                            active
                              ? "bg-blue-50/90 border-blue-400 text-blue-900 font-bold shadow-xs ring-1 ring-blue-400"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                          )}
                        >
                          <span className="text-xs font-bold leading-tight">{preset.label}</span>
                          <span className={cn("text-[10px] mt-0.5", active ? "text-blue-700 font-semibold" : "text-slate-500")}>
                            {preset.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="active_until_field" className="block text-[11px] font-bold text-slate-700">
                      Atur Tanggal Kedaluwarsa Spesifik
                    </label>
                    <span className="text-[10px] text-slate-500">Berakhir pukul 23:59 WIB</span>
                  </div>
                  <div className="relative">
                    <input
                      id="active_until_field"
                      type="date"
                      name="active_until"
                      value={form.active_until}
                      onChange={e => {
                        setForm(prev => ({ ...prev, active_until: e.target.value }));
                        setSavedDate(e.target.value);
                      }}
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Visual Summary Card */}
                {form.active_until ? (() => {
                  const match = form.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
                  if (!match) return null;
                  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
                  const fullDateFormatted = d.toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  });
                  const target = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
                  const now = new Date();
                  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  let badgeVariant = "active";
                  let badgeLabel = `Aktif (${diffDays} hari lagi)`;
                  let statusDesc = "Layanan ujian dan sinkronisasi data aktif normal hingga tanggal di atas.";

                  if (diffDays < 0) {
                    badgeVariant = "expired";
                    badgeLabel = `Kedaluwarsa (${Math.abs(diffDays)} hari lalu)`;
                    statusDesc = "Tanggal telah lewat. Institusi akan langsung berstatus kedaluwarsa dan pengerjaan ujian dibatasi.";
                  } else if (diffDays === 0) {
                    badgeVariant = "today";
                    badgeLabel = "Berakhir Hari Ini";
                    statusDesc = "Akses operasional institusi akan berakhir malam ini pukul 23:59 WIB.";
                  } else if (diffDays <= 14) {
                    badgeVariant = "warning";
                    badgeLabel = `Sisa ${diffDays} hari lagi`;
                    statusDesc = "Masa aktif hampir habis. Disarankan menyiapkan perpanjangan periode.";
                  }

                  return (
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Clock size={15} className="text-slate-500" />
                          <span className="text-xs font-bold text-slate-800">Ringkasan Masa Aktif</span>
                        </div>
                        <span className={cn(
                          "text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                          badgeVariant === "active" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                          badgeVariant === "warning" && "bg-amber-50 text-amber-900 border-amber-200",
                          badgeVariant === "today" && "bg-orange-50 text-orange-900 border-orange-200",
                          badgeVariant === "expired" && "bg-rose-50 text-rose-900 border-rose-200"
                        )}>
                          {badgeVariant === "active" && <CheckCircle2 size={12} className="text-emerald-700" />}
                          {badgeVariant === "warning" && <Clock size={12} className="text-amber-700" />}
                          {badgeVariant === "today" && <AlertTriangle size={12} className="text-orange-700" />}
                          {badgeVariant === "expired" && <XCircle size={12} className="text-rose-700" />}
                          {badgeLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Berlaku Hingga</p>
                          <p className="font-bold text-slate-900 mt-0.5 leading-snug">{fullDateFormatted}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">Pukul 23:59 WIB</p>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Durasi Waktu</p>
                          <p className="font-bold text-slate-900 mt-0.5 leading-snug">
                            {diffDays > 0 ? `${diffDays} Hari` : diffDays === 0 ? "Hari Terakhir" : "Sudah Berakhir"}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {diffDays === 14 ? "Periode Free Trial" : diffDays === 30 ? "Periode 1 Bulan" : diffDays === 180 ? "Periode 1 Semester" : diffDays === 365 ? "Periode 1 Tahun" : "Periode Kustom"}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                        {statusDesc}
                      </p>
                    </div>
                  );
                })() : (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Tanggal Belum Ditentukan</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">Silakan pilih durasi cepat di atas atau tentukan tanggal berakhir lewat kalender.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Jika Permanen */}
            {expiryType === "permanent" && (
              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">Lisensi Permanen</span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Aktif Selamanya
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Tenant ini tidak memiliki tanggal kedaluwarsa. Layanan dan operasional ujian akan terus aktif tanpa batas waktu, kecuali dinonaktifkan secara manual oleh Superadmin melalui tombol sakelar aktivasi.
                </p>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                  <strong className="text-slate-800 font-semibold">Rekomendasi penggunaan:</strong> Akun internal sekolah binaan, server yayasan, atau institusi mitra dengan kontrak kerja sama seumur hidup.
                </div>
              </div>
            )}
          </div>

          {/* Custom Domain Input */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Custom Domain <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-bold">
                Auto HTTPS / SSL
              </span>
            </div>
            <div className="relative">
              <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                name="custom_domain"
                value={form.custom_domain}
                onChange={handleChange}
                placeholder="cth. cbt.sman1modalbangsa.sch.id"
                className="w-full h-10 border border-slate-200 rounded-xl pl-9 pr-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm bg-white font-mono placeholder:font-sans placeholder:text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Sekolah cukup mengarahkan DNS <strong className="font-semibold text-slate-700">A Record</strong> ke <code className="text-blue-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">64.235.41.108</code> atau <strong className="font-semibold text-slate-700">CNAME</strong> ke <code className="text-blue-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">{form.slug ? `${form.slug}.examku.my.id` : `subdomain${getDomainSuffix()}`}</code>.
            </p>
          </div>

          {/* Server Node Selection (Multi-VPS) */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Lokasi Server Node <span className="text-slate-400 font-normal">(Multi-VPS)</span>
              </label>
              <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full font-bold">
                Isolasi Beban Ujian
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, server_host: "127.0.0.1" }))}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all",
                  (!form.server_host || form.server_host === "127.0.0.1" || form.server_host === "localhost")
                    ? "border-blue-500 bg-blue-50/70 text-blue-900 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Server size={13} className="text-blue-600" />
                  <span>Master VPS</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Lokal (64.235.41.108)</p>
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({
                  ...prev,
                  server_host: prev.server_host && prev.server_host !== "127.0.0.1" && prev.server_host !== "localhost"
                    ? prev.server_host
                    : ""
                }))}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all",
                  (form.server_host && form.server_host !== "127.0.0.1" && form.server_host !== "localhost")
                    ? "border-purple-500 bg-purple-50/70 text-purple-900 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Cpu size={13} className="text-purple-600" />
                  <span>Worker Node</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">VPS Eksternal Terpisah</p>
              </button>
            </div>

            {form.server_host !== "127.0.0.1" && form.server_host !== "localhost" && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  IP Address / Hostname Worker VPS
                </label>
                <div className="relative">
                  <Server size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    name="server_host"
                    value={form.server_host === "127.0.0.1" ? "" : form.server_host}
                    onChange={handleChange}
                    placeholder="cth. 103.123.45.67"
                    className="w-full h-10 border border-purple-200 rounded-xl pl-9 pr-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 shadow-sm bg-white font-mono placeholder:font-sans placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Master Ingress Caddy akan otomatis mem-proxy request API dan database ke IP ini. Pengguna tetap mengakses via domain tanpa kendala CORS dan SSL otomatis aman.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 h-10 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-[2] h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> Memproses...</>
              ) : (
                <><Check size={15} /> {isEdit ? "Simpan" : "Buat Tenant"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
