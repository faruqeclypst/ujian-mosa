import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Check, X, Edit, Power, PowerOff,
  School, Clock, Users, RefreshCw,
  Search, Trash2, Monitor, Zap, Server, ChevronDown,
  Building2, Globe
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";

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
  created: string;
}

interface SchoolRequest {
  id: string;
  school_name: string;
  slug_request: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  status: "pending" | "approved" | "rejected";
  created: string;
}

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: "Free Trial", color: "bg-slate-100 text-slate-600 border-slate-200" },
  basic: { label: "Berkembang", color: "bg-blue-50 text-blue-700 border-blue-200" },
  pro: { label: "Lanjutan", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ultimate: { label: "Premium", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "requests">("all");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [requests, setRequests] = useState<SchoolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: "danger" | "warning" | "success";
  } | null>(null);

  useEffect(() => {
    if (!masterPb.authStore.isValid) {
      navigate("/superadmin/login");
    }
  }, [navigate]);

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
          loadData();
          setConfirmData(null);
        } catch {
          alert("Gagal mengubah status sekolah.");
        }
      }
    });
  };

  const deleteSchool = (school: SchoolRecord) => {
    setConfirmData({
      title: "Hapus Institusi Permanen?",
      message: `Hapus sekolah ${school.name} secara TOTAL? Seluruh data kuesioner, bank soal, dan hasil ujian akan hilang selamanya dan tidak bisa dikembalikan!`,
      type: "danger",
      onConfirm: async () => {
        try {
          await masterPb.collection("schools").delete(school.id);
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
      setEditSchool({
        id: "", name: req.school_name, slug: req.slug_request,
        pb_url: "", is_active: true, contact_email: req.contact_email,
        created: new Date().toISOString(),
        type: 'school'
      });
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

          {/* Add */}
          <button
            onClick={() => { setEditSchool(null); setShowAddModal(true); }}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Tambah</span>
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
                        <div className="flex flex-col gap-2">
                          <a
                            href={`https://${school.slug}.alfaruqasri.my.id`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[11px] font-bold bg-white text-slate-600 px-3 py-1.5 rounded-full w-fit border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all group/link"
                          >
                            <Monitor size={12} className="text-slate-400 group-hover/link:text-blue-500" />
                            {school.slug}.alfaruqasri.my.id
                          </a>
                          <a
                            href={`${school.pb_url}${school.pb_url.endsWith("/") ? "" : "/"}_/`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 pl-3 text-[10px] text-slate-400 hover:text-blue-500 transition-colors font-medium"
                          >
                            <Server size={11} /> Database Engine
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={cn(
                            "inline-flex items-center justify-center text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wide w-fit",
                            school.plan === "pro" ? "bg-amber-50 text-amber-600 border-amber-100" :
                              school.plan === "ultimate" ? "bg-purple-50 text-purple-600 border-purple-100" :
                                "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {school.plan || "Free"}
                          </span>
                          <p className="text-[11px] text-slate-400 font-bold pl-1">{school.student_quota || 0} Siswa</p>
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

                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", PLAN_CONFIG[school.plan || "free"]?.color)}>
                      {PLAN_CONFIG[school.plan || "free"]?.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{school.student_quota || 100} Siswa</span>
                  </div>

                  <a
                    href={`https://${school.slug}.alfaruqasri.my.id`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Globe size={11} />
                    {school.slug}.alfaruqasri.my.id
                  </a>

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
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kontak</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">Belum ada pendaftaran.</td></tr>
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
                          {req.slug_request}.alfaruqasri.my.id
                        </code>
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
                  <code className="text-xs font-mono px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md block">
                    {req.slug_request}.alfaruqasri.my.id
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
          {tab !== "requests"
            ? `${filteredSchools.length} sekolah ${tab === "all" ? "terdaftar" : tab === "active" ? "aktif" : "nonaktif"}`
            : `${requests.length} pendaftaran`}
        </span>
      </div>

      {/* Modal */}
      {showAddModal && (
        <AddEditSchoolModal
          school={editSchool}
          onClose={() => { setShowAddModal(false); setEditSchool(null); }}
          onSaved={() => { setShowAddModal(false); setEditSchool(null); loadData(); }}
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
  const [form, setForm] = useState({
    name: school?.name || "",
    slug: school?.slug || "",
    pb_url: school?.pb_url || "",
    type: school?.type || "school",
    contact_email: school?.contact_email || "",
    student_quota: school?.student_quota || 50,
    plan: school?.plan || "free",
    is_active: school?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === "plan") {
      let autoQuota = form.student_quota;
      if (value === "free") autoQuota = 50;
      else if (value === "basic") autoQuota = 250;
      else if (value === "pro") autoQuota = 500;
      else if (value === "ultimate") autoQuota = 1000;
      setForm(prev => ({ ...prev, plan: value, student_quota: autoQuota }));
      return;
    }
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked
        : type === "number" ? (value === "" ? "" : Number(value))
          : name === "slug" ? value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-")
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
    const autoPbUrl = `https://${form.slug}.alfaruqasri.my.id`;
    const finalForm = { ...form, pb_url: autoPbUrl, student_quota: Number(form.student_quota) || 0 };
    setLoading(true);
    try {
      if (isEdit) {
        await masterPb.collection("schools").update(school!.id, finalForm);
      } else {
        await masterPb.collection("schools").create(finalForm);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

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
                {form.slug || "..."}.alfaruqasri.my.id
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
