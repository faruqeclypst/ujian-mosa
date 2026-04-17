import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Check, X, Edit, Power, PowerOff,
  School, Clock, Users, RefreshCw,
  Search, Trash2, Monitor, Zap, Server, ChevronDown
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
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

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"schools" | "requests">("schools");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [requests, setRequests] = useState<SchoolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const toggleActive = async (school: SchoolRecord) => {
    try {
      await masterPb.collection("schools").update(school.id, { is_active: !school.is_active });
      loadData();
    } catch (err) {
      alert("Gagal mengubah status sekolah.");
    }
  };

  const deleteSchool = async (school: SchoolRecord) => {
    if (!confirm(`Hapus sekolah ${school.name} secara TOTAL dari server? Seluruh file dan database akan hilang permanen!`)) return;
    try {
      await masterPb.collection("schools").delete(school.id);
      loadData();
    } catch (err) {
      alert("Gagal menghapus sekolah.");
    }
  };

  const approveRequest = async (req: SchoolRequest) => {
    try {
      await masterPb.collection("school_requests").update(req.id, { status: "approved" });
      loadData();
      setTab("schools");
      setEditSchool({
        id: "", name: req.school_name, slug: req.slug_request,
        pb_url: "", is_active: true, contact_email: req.contact_email,
        created: new Date().toISOString()
      });
      setShowAddModal(true);
    } catch (err) {
      alert("Gagal menyetujui pendaftaran.");
    }
  };

  const rejectRequest = async (req: SchoolRequest) => {
    if (!confirm(`Tolak pendaftaran dari ${req.school_name}?`)) return;
    try {
      await masterPb.collection("school_requests").update(req.id, { status: "rejected" });
      loadData();
    } catch (err) {
      alert("Gagal menolak pendaftaran.");
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const activeCount = schools.filter(s => s.is_active).length;

  return (
    <SuperAdminLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
            Dashboard Utama
          </h2>
          <p className="text-slate-500 font-medium text-sm">Monitoring dan manajemen infrastruktur tenant E-Ujian.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-1 flex shadow-sm">
            <button
              onClick={() => setTab("schools")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tab === "schools" ? "bg-white text-blue-700 shadow border-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Instansi Aktif
            </button>
            <button
              onClick={() => setTab("requests")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${tab === "requests" ? "bg-white text-blue-700 shadow border-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Pendaftaran {pendingCount > 0 && <span className="flex w-2 h-2 bg-red-500 rounded-full" />}
            </button>
          </div>
          <button
            onClick={() => { setEditSchool(null); setShowAddModal(true); }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          >
            <Plus size={18} /> Tambah Sekolah
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Instansi Aktif", value: activeCount, icon: Zap, color: "bg-amber-100 text-amber-600 border-amber-200" },
          { label: "Total Sekolah", value: schools.length, icon: School, color: "bg-blue-100 text-blue-600 border-blue-200" },
          { label: "Menunggu Persetujuan", value: pendingCount, icon: Clock, color: "bg-indigo-100 text-indigo-600 border-indigo-200" },
          { label: "Total Pendaftar", value: requests.length, icon: Users, color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.color} border`}>
              <stat.icon size={24} />
            </div>
            <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Main Table Interface */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900">{tab === "schools" ? "Daftar Sekolah Tersedia" : "Pendaftaran Masuk"}</h3>
            <button
              onClick={loadData}
              className={`p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-all bg-white shadow-sm ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw size={14} className="text-slate-600" />
            </button>
          </div>

          <div className="relative group w-full max-w-sm">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama sekolah atau subdomain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === "schools" ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4">Identitas Sekolah</th>
                  <th className="px-6 py-4">Alamat Sistem</th>
                  <th className="px-6 py-4">Kuota & Paket</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center"><div className="flex items-center justify-center gap-2 text-slate-500 font-semibold"><RefreshCw size={18} className="animate-spin" /> Memuat data...</div></td></tr>
                ) : filteredSchools.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-500 font-semibold">Tidak ada data sekolah yang ditemukan.</td></tr>
                ) : filteredSchools.map(school => (
                  <tr key={school.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center font-black text-blue-600 text-xl border border-blue-100">
                          {school.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm mb-0.5">{school.name}</p>
                          <p className="text-slate-500 text-xs font-medium">{school.contact_email || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 w-fit">
                          <Monitor size={14} className="text-slate-500" />
                          {school.slug}.alfaruqasri.my.id
                        </div>
                        <a
                          href={`${school.pb_url}${school.pb_url.endsWith("/") ? "" : "/"}_/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-semibold ml-1"
                        >
                          <Server size={12} />
                          Backend/Database
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2 max-w-[140px]">
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${school.plan === 'pro' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>{school.plan || 'Free'}</span>
                          <span className="text-[10px] font-bold text-slate-500">{school.student_quota || 100} Siswa</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${school.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${school.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {school.is_active ? "Aktif" : "Nonaktif"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditSchool(school); setShowAddModal(true); }}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all shadow-sm"
                          title="Edit Sekolah"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => toggleActive(school)}
                          className={`p-2 bg-white border border-slate-200 rounded-lg transition-all shadow-sm ${school.is_active
                              ? "text-slate-600 hover:text-amber-600 hover:bg-amber-50"
                              : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          title={school.is_active ? "Nonaktifkan" : "Aktifkan"}
                        >
                          {school.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                        <button
                          onClick={() => deleteSchool(school)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm"
                          title="Hapus Permanen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4">Nama Sekolah</th>
                  <th className="px-6 py-4">Usulan Domain</th>
                  <th className="px-6 py-4">Kontak</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-500 font-semibold">Belum ada pendaftaran baru.</td></tr>
                ) : requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm mb-0.5">{req.school_name}</p>
                      <p className="text-slate-500 text-xs font-medium">{new Date(req.created).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                        {req.slug_request}.alfaruqasri.my.id
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-700 font-semibold">{req.contact_email}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{req.contact_phone || "-"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 border ${req.status === "pending" ? "bg-amber-50 text-amber-600 border-amber-200"
                          : req.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'pending' ? 'bg-amber-500' : req.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : "Ditolak"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => approveRequest(req)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
                          >
                            <Check size={14} /> Buat
                          </button>
                          <button
                            onClick={() => rejectRequest(req)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all shadow-sm flex items-center gap-1"
                          >
                            <X size={14} /> Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Deployment Modal */}
      {showAddModal && (
        <AddEditSchoolModal
          school={editSchool}
          onClose={() => { setShowAddModal(false); setEditSchool(null); }}
          onSaved={() => { setShowAddModal(false); setEditSchool(null); loadData(); }}
        />
      )}
    </SuperAdminLayout>
  );
};

// ============================================================
// Enhanced Deployment Modal
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
      setError("Nama institusi dan sub domain wajib diisi.");
      return;
    }

    const autoPbUrl = `https://${form.slug}.alfaruqasri.my.id`;
    const finalForm = {
      ...form,
      pb_url: autoPbUrl,
      student_quota: Number(form.student_quota) || 0
    };

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl p-8 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isEdit ? "Edit Konfigurasi Institusi" : "Buat Institusi Baru"}</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Sistem akan secara otomatis menyiapkan environment</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl font-medium flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Institusi</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="cth. SMP Negeri 1 Jakarta"
                className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Subdomain URL</label>
                <input
                  type="text"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  disabled={isEdit}
                  placeholder="smpn1"
                  className={`w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm ${isEdit ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
                />
                <p className="text-[11px] font-medium text-slate-500 mt-1.5 break-all">
                  {form.slug || '...'}.alfaruqasri.my.id
                  {isEdit && <span className="block mt-1 text-red-500 font-bold italic">Subdomain tidak dapat diubah setelah instalasi.</span>}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Administrator</label>
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={handleChange}
                  placeholder="admin@sekolah.sch.id"
                  className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilihan Paket</label>
                <div className="relative">
                  <select
                    name="plan"
                    value={form.plan}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-sm cursor-pointer"
                  >
                    <option value="free">Free (50 Siswa)</option>
                    <option value="basic">Basic (250 Siswa)</option>
                    <option value="pro">Pro (500 Siswa)</option>
                    <option value="ultimate" disabled>Ultimate (1000 Siswa) - Segera</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Maksimal Kuota Siswa</label>
                <input
                  type="number"
                  name="student_quota"
                  value={form.student_quota}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 bg-white border border-slate-300 text-slate-700 rounded-xl py-3.5 text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Sedang Memproses...
                </>
              ) : (
                <>
                  <Check size={18} /> {isEdit ? "Simpan Perubahan" : "Eksekusi & Buat Tenant"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
