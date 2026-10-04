import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  KeyRound,
  ShieldCheck,
  Search,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Calendar,
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Trash2,
  ExternalLink,
  Server,
  FileCode,
  Download,
  Eye,
  ChevronRight,
  Filter,
  Globe,
  ChevronDown
} from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { OfflineLicenseModal, AvailableSchoolItem } from "../../components/dialogs/OfflineLicenseModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "../../components/ui/dialog";

export interface OfflineLicenseRecord {
  id: string;
  school_name: string;
  slug: string;
  npsn?: string;
  license_code: string;
  version?: string;
  valid_until: string;
  max_students?: number;
  issued_at?: string;
  notes?: string;
  status?: "active" | "revoked" | "expired" | string;
  contact_person?: string;
  contact_phone?: string;
  created: string;
  updated: string;
}

type FilterStatus = "all" | "active" | "expiring_soon" | "expired";
type SortOption = "newest_issued" | "nearest_expiry" | "name_asc";

const SchoolAvatar = ({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) => {
  const [error, setError] = useState(false);
  const initial = (name || "S").trim()[0]?.toUpperCase() || "S";

  if (logoUrl && !error) {
    return (
      <div className={cn("w-11 h-11 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200", className)}>
        <img
          src={logoUrl}
          alt=""
          className="w-full h-full object-contain p-0.5"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  // Consistent colorful initial based on name string hash
  const colors = [
    "bg-purple-50 border-purple-200/70 text-purple-700",
    "bg-blue-50 border-blue-200/70 text-blue-700",
    "bg-indigo-50 border-indigo-200/70 text-indigo-700",
    "bg-emerald-50 border-emerald-200/70 text-emerald-700",
    "bg-amber-50 border-amber-200/70 text-amber-700",
  ];
  const charSum = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = colors[charSum % colors.length];

  return (
    <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center font-black text-sm uppercase shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200", colorClass, className)}>
      {initial}
    </div>
  );
};

export default function SuperAdminOfflineLicensesPage() {
  const { addToast } = useToast();

  const [licenses, setLicenses] = useState<OfflineLicenseRecord[]>([]);
  const [schools, setSchools] = useState<AvailableSchoolItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest_issued");

  // Modal Penerbitan Lisensi
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchoolForModal, setSelectedSchoolForModal] = useState<AvailableSchoolItem | null>(null);

  // Modal Detail Kode Lisensi Penuh
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeLicenseDetail, setActiveLicenseDetail] = useState<OfflineLicenseRecord | null>(null);

  // Modal Konfirmasi Hapus
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<OfflineLicenseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State feedback copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ambil daftar lisensi dari PocketBase Master
  const fetchLicenses = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const records = await masterPb
        .collection("offline_licenses")
        .getFullList<OfflineLicenseRecord>({
          sort: "-issued_at",
          requestKey: null
        });
      setLicenses(records || []);
    } catch (err: any) {
      console.error("Gagal mengambil data lisensi offline:", err);
      setError(err?.message || "Gagal memuat data dari database master.");
      addToast({
        title: "Koneksi Terganggu",
        description: "Gagal mengambil daftar lisensi offline dari server pusat.",
        type: "error"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  const [schoolLogoMap, setSchoolLogoMap] = useState<Record<string, string>>({});

  // Ambil daftar sekolah yang terdaftar di database untuk pilihan penerbitan dan avatar
  const fetchSchools = useCallback(async () => {
    try {
      const records = await masterPb
        .collection("schools")
        .getFullList<{ id: string; name: string; slug: string; contact_phone?: string; active_until?: string; logo?: string }>({
          sort: "name",
          fields: "id,name,slug,contact_phone,active_until,logo",
          requestKey: null
        });
      const mapped: AvailableSchoolItem[] = records.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        contact_phone: r.contact_phone,
        active_until: r.active_until
      }));
      setSchools(mapped);

      const logoMap: Record<string, string> = {};
      records.forEach((r) => {
        if (r.slug && r.logo) {
          logoMap[r.slug] = masterPb.files.getUrl(r, r.logo);
        }
      });
      setSchoolLogoMap(logoMap);
    } catch (err) {
      console.warn("Gagal mengambil daftar sekolah pendukung:", err);
    }
  }, []);

  useEffect(() => {
    fetchLicenses();
    fetchSchools();
  }, [fetchLicenses, fetchSchools]);

  // Format tanggal Indonesia
  const formatDateIndonesia = (dateStr?: string) => {
    if (!dateStr) return "Tidak tercatat";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Format tanggal dan jam lengkap
  const formatDateTimeIndonesia = (dateStr?: string) => {
    if (!dateStr) return "Tidak tercatat";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const tgl = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(d);
      const jam = String(d.getHours()).padStart(2, "0");
      const menit = String(d.getMinutes()).padStart(2, "0");
      return `${tgl}, ${jam}:${menit} WIB`;
    } catch {
      return dateStr;
    }
  };

  // Waktu relatif (misal: "2 jam lalu", "3 hari lalu")
  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return "Baru saja";
      if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
      const days = Math.floor(diff / 86400);
      if (days === 1) return "Kemarin";
      if (days < 30) return `${days} hari lalu`;
      return `${Math.floor(days / 30)} bulan lalu`;
    } catch {
      return "";
    }
  };

  // Hitung sisa hari dari valid_until
  const getExpiryDetails = (validUntilStr?: string) => {
    if (!validUntilStr) {
      return { days: 0, isExpired: true, isExpiringSoon: false, text: "Batas waktu tidak ditentukan" };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(validUntilStr);
    expiry.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        days: diffDays,
        isExpired: true,
        isExpiringSoon: false,
        text: `Kadaluarsa ${Math.abs(diffDays)} hari lalu`
      };
    }
    if (diffDays === 0) {
      return {
        days: 0,
        isExpired: false,
        isExpiringSoon: true,
        text: "Berakhir hari ini"
      };
    }
    if (diffDays <= 14) {
      return {
        days: diffDays,
        isExpired: false,
        isExpiringSoon: true,
        text: `Sisa ${diffDays} hari lagi`
      };
    }
    return {
      days: diffDays,
      isExpired: false,
      isExpiringSoon: false,
      text: `Sisa ${diffDays} hari`
    };
  };

  // Statistik Ringkasan
  const stats = useMemo(() => {
    let total = licenses.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;

    licenses.forEach((lic) => {
      const exp = getExpiryDetails(lic.valid_until);
      if (lic.status === "revoked" || exp.isExpired) {
        expired++;
      } else if (exp.isExpiringSoon) {
        expiringSoon++;
        active++;
      } else {
        active++;
      }
    });

    return { total, active, expiringSoon, expired };
  }, [licenses]);

  // Data Terfilter dan Terurut
  const filteredLicenses = useMemo(() => {
    return licenses
      .filter((item) => {
        // Filter Pencarian
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          item.school_name.toLowerCase().includes(q) ||
          item.slug.toLowerCase().includes(q) ||
          (item.npsn && item.npsn.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q));

        if (!matchesQuery) return false;

        // Filter Status
        const exp = getExpiryDetails(item.valid_until);
        const isItemExpired = item.status === "revoked" || exp.isExpired;

        if (filterStatus === "active") {
          return !isItemExpired;
        }
        if (filterStatus === "expiring_soon") {
          return !isItemExpired && exp.isExpiringSoon;
        }
        if (filterStatus === "expired") {
          return isItemExpired;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "newest_issued") {
          const tA = new Date(a.issued_at || a.created).getTime();
          const tB = new Date(b.issued_at || b.created).getTime();
          return tB - tA;
        }
        if (sortOption === "nearest_expiry") {
          const tA = new Date(a.valid_until).getTime();
          const tB = new Date(b.valid_until).getTime();
          return tA - tB;
        }
        if (sortOption === "name_asc") {
          return a.school_name.localeCompare(b.school_name);
        }
        return 0;
      });
  }, [licenses, searchQuery, filterStatus, sortOption]);

  // Aksi Salin Kode Lisensi
  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    addToast({
      title: "Kode Lisensi Tersalin",
      description: "Kode lisensi telah disalin ke clipboard.",
      type: "success"
    });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Aksi Download file .key
  const handleDownloadKey = (schoolSlug: string, code: string) => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `license_${schoolSlug}.key`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Aksi Buka WhatsApp Proktor
  const handleSendWA = (license: OfflineLicenseRecord) => {
    const phone = (license.contact_phone || "").replace(/\D/g, "");
    let phoneParam = "";
    if (phone) {
      phoneParam = phone.startsWith("0") ? `62${phone.slice(1)}` : phone;
    }

    const text = `Halo Bapak/Ibu Proktor *${license.school_name}*,\n\nBerikut adalah *Kode Lisensi Izin Server Mandiri (EXAM AA Offline CBT)* resmi dari Super Admin:\n\n*Sekolah:* ${license.school_name}\n*Subdomain:* ${license.slug}.examku.my.id\n*Masa Aktif Server:* Sampai dengan ${license.valid_until}\n*Kapasitas Siswa:* Tanpa Batas Kuota (Mandiri)\n*Keperluan:* ${license.notes || "Izin Ujian Mandiri"}\n\n*Kode Lisensi Resmi (RSA-2048):*\n\`\`\`${license.license_code}\`\`\`\n\n*Langkah Aktivasi di Server Sekolah:*\n1. Buka browser pada komputer server lokal proktor.\n2. Buka menu Pengaturan atau halaman Aktivasi Izin Offline.\n3. Masukkan kode lisensi di atas dan simpan.\n\nSemoga kegiatan ujian berjalan tertib dan lancar.`;

    const targetUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(targetUrl, "_blank");
  };

  // Buka Modal Penerbitan Ulang / Perpanjangan
  const handleOpenRenewModal = (lic: OfflineLicenseRecord) => {
    setSelectedSchoolForModal({
      name: lic.school_name,
      slug: lic.slug,
      contact_phone: lic.contact_phone,
      active_until: lic.valid_until
    });
    setModalOpen(true);
  };

  // Buka Modal Penerbitan Baru Bebas
  const handleOpenCreateNewModal = () => {
    setSelectedSchoolForModal(null);
    setModalOpen(true);
  };

  // Buka Detail Kode
  const handleOpenDetailModal = (lic: OfflineLicenseRecord) => {
    setActiveLicenseDetail(lic);
    setDetailModalOpen(true);
  };

  // Buka Konfirmasi Hapus
  const handleOpenDeleteConfirm = (lic: OfflineLicenseRecord) => {
    setItemToDelete(lic);
    setDeleteConfirmOpen(true);
  };

  // Eksekusi Hapus Rekor
  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await masterPb.collection("offline_licenses").delete(itemToDelete.id);
      addToast({
        title: "Lisensi Dihapus",
        description: `Rekor lisensi ${itemToDelete.school_name} berhasil dihapus dari database pusat.`,
        type: "success"
      });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      fetchLicenses(true);
    } catch (err: any) {
      addToast({
        title: "Gagal Menghapus",
        description: err?.message || "Terjadi kesalahan saat menghapus rekor lisensi.",
        type: "error"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header Halaman */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                Server Mandiri CBT
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={12} /> RSA-2048 Asimetris
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Manajemen Lisensi Server Offline
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Kelola izin operasional server lokal CBT mandiri proktor untuk sekolah yang memerlukan pelaksanaan ujian tanpa ketergantungan internet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://examku.my.id/downloads/offline-update.zip"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-2xs"
              title="Unduh berkas pembaruan server offline proktor (offline-update.zip)"
            >
              <Download size={14} className="text-purple-600" />
              <span>Unduh Berkas Offline</span>
            </a>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLicenses(true)}
              disabled={isRefreshing || isLoading}
              className="min-h-[42px] px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
              <span>Segarkan</span>
            </Button>

            <Button
              onClick={handleOpenCreateNewModal}
              className="min-h-[42px] px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Plus size={16} />
              <span>Terbitkan Lisensi Baru</span>
            </Button>
          </div>
        </div>

        {/* 4 Kartu Statistik */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Lisensi Terbit</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tercatat di Master VPS</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <KeyRound size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Server Aktif</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.active}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Izin masa berlaku sah</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mendekati Batas</p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.expiringSoon}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Sisa 14 hari ke bawah</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kadaluarsa / Dicabut</p>
              <p className="text-2xl font-black text-rose-600 mt-0.5">{stats.expired}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Perlu perpanjangan</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <XCircle size={20} />
            </div>
          </div>
        </div>

        {/* Filter Bar & Pencarian Terpadu */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-1">
          {/* Filter Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl overflow-x-auto scrollbar-none border border-slate-200/70 shadow-2xs">
            <button
              onClick={() => setFilterStatus("all")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterStatus === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterStatus === "active"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Aktif ({stats.active})
            </button>
            <button
              onClick={() => setFilterStatus("expiring_soon")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterStatus === "expiring_soon"
                  ? "bg-white text-amber-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Segera Berakhir ({stats.expiringSoon})
            </button>
            <button
              onClick={() => setFilterStatus("expired")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterStatus === "expired"
                  ? "bg-white text-rose-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Kadaluarsa ({stats.expired})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2.5 md:ml-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari sekolah, NPSN, subdomain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3.5 rounded-2xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 shadow-2xs transition-all"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="h-10 pl-3.5 pr-8 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 shadow-2xs appearance-none cursor-pointer"
              >
                <option value="newest_issued">Penerbitan Terbaru</option>
                <option value="nearest_expiry">Batas Terdekat</option>
                <option value="name_asc">Nama Sekolah (A-Z)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tabel Data (Desktop) & Card List (Mobile) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Memuat data lisensi offline...</p>
              <p className="text-xs text-slate-400 mt-1">Mengambil rekor dari Master VPS</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Gagal Memuat Lisensi</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLicenses()}
                className="mt-4 rounded-xl text-xs font-bold"
              >
                Coba Lagi
              </Button>
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <KeyRound size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak Ada Lisensi Ditemukan</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery || filterStatus !== "all"
                  ? "Tidak ada data lisensi yang sesuai dengan kriteria filter atau pencarian Anda."
                  : "Belum ada sekolah yang memiliki lisensi server offline. Klik tombol di atas untuk menerbitkan izin pertama."}
              </p>
              {searchQuery || filterStatus !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  Reset Filter
                </Button>
              ) : (
                <Button
                  onClick={handleOpenCreateNewModal}
                  className="mt-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                >
                  + Terbitkan Lisensi Pertama
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[940px]">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[220px]">Sekolah & Domain</th>
                      <th className="py-3.5 px-4 min-w-[130px]">Status & Mesin</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Masa Berlaku</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Kode Lisensi</th>
                      <th className="py-3.5 px-4 min-w-[130px]">Keperluan</th>
                      <th className="py-3.5 px-4 text-right min-w-[150px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLicenses.map((lic) => {
                      const exp = getExpiryDetails(lic.valid_until);
                      const isExpired = lic.status === "revoked" || exp.isExpired;
                      const isCopied = copiedId === lic.id;

                      return (
                        <tr key={lic.id} className="hover:bg-slate-50/70 transition-all group border-b border-slate-100/90 last:border-0">
                          {/* Nama Sekolah, Avatar, & Subdomain */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <SchoolAvatar
                                name={lic.school_name}
                                logoUrl={schoolLogoMap[lic.slug]}
                                className="w-10 h-10 text-sm shadow-2xs"
                              />
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm tracking-tight leading-snug group-hover:text-purple-700 transition-colors truncate max-w-[210px]">
                                  {lic.school_name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`https://${lic.slug}.examku.my.id`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono font-medium text-slate-500 hover:text-purple-600 transition-colors inline-flex items-center gap-1.5"
                                    title={`Buka https://${lic.slug}.examku.my.id`}
                                  >
                                    <Globe size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[160px]">{lic.slug}.examku.my.id</span>
                                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </a>
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {lic.npsn && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600 font-semibold border border-slate-200/70">
                                      NPSN: {lic.npsn}
                                    </span>
                                  )}
                                  {lic.contact_phone && (
                                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]" title={`Kontak: ${lic.contact_phone}`}>
                                      {lic.contact_phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status & Kriptografi */}
                          <td className="py-4 px-4">
                            <div className="space-y-1.5">
                              <div>
                                {isExpired ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Kadaluarsa
                                  </span>
                                ) : exp.isExpiringSoon ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Segera Berakhir
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Aktif Sah
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                                <ShieldCheck size={12} className="text-purple-600 shrink-0" />
                                <span>{lic.version === "v2" ? "RSA-2048 Asimetris" : "SHA-256 Legasi"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Masa Berlaku & Terbit */}
                          <td className="py-4 px-4">
                            <div>
                              <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                                {formatDateIndonesia(lic.valid_until)}
                              </span>
                              <div className="mt-1">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-2xs",
                                    isExpired
                                      ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                      : exp.isExpiringSoon
                                      ? "bg-amber-50 text-amber-800 border border-amber-200/80"
                                      : "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                                  )}
                                >
                                  <Clock size={10} className="shrink-0" />
                                  <span>{exp.text}</span>
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Terbit {formatDateIndonesia(lic.issued_at || lic.created)}
                              </p>
                            </div>
                          </td>

                          {/* Potongan Kode Lisensi */}
                          <td className="py-4 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 px-2.5 py-1.5 rounded-xl shadow-2xs group-hover:border-purple-200 transition-colors">
                              <KeyRound size={12} className="text-purple-600 shrink-0" />
                              <code className="text-xs font-mono font-bold text-slate-700 select-all truncate max-w-[100px]" title={lic.license_code}>
                                {lic.license_code}
                              </code>
                              <button
                                onClick={() => handleCopyCode(lic.id, lic.license_code)}
                                title="Salin Kode Lisensi"
                                className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-purple-600 transition-colors shrink-0"
                              >
                                {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>

                          {/* Catatan / Keperluan */}
                          <td className="py-4 px-4">
                            <div className="text-xs text-slate-600 max-w-[150px] leading-relaxed line-clamp-2" title={lic.notes || "Izin Resmi Ujian Offline CBT"}>
                              {lic.notes || <span className="text-slate-400 italic">Izin Resmi Ujian CBT</span>}
                            </div>
                          </td>

                          {/* Tombol Aksi */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Tombol Perpanjang */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRenewModal(lic)}
                                className="h-8 px-2.5 rounded-xl text-xs font-bold border-purple-200 text-purple-700 bg-purple-50/70 hover:bg-purple-100 hover:text-purple-800 transition-all shadow-2xs whitespace-nowrap flex items-center gap-1 shrink-0"
                              >
                                <Calendar size={12} />
                                <span>Perpanjang</span>
                              </Button>

                              {/* Action Buttons Toolbar */}
                              <div className="inline-flex items-center p-0.5 bg-slate-100/90 border border-slate-200/90 rounded-xl shadow-2xs shrink-0">
                                <button
                                  onClick={() => handleOpenDetailModal(lic)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-purple-600 hover:bg-white hover:shadow-2xs transition-all"
                                  title="Detail Lisensi & QR"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleSendWA(lic)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-white hover:shadow-2xs transition-all"
                                  title="Kirim ke WhatsApp Proktor"
                                >
                                  <MessageCircle size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteConfirm(lic)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white hover:shadow-2xs transition-all"
                                  title="Hapus Lisensi"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredLicenses.map((lic) => {
                  const exp = getExpiryDetails(lic.valid_until);
                  const isExpired = lic.status === "revoked" || exp.isExpired;
                  const isCopied = copiedId === lic.id;

                  return (
                    <div key={lic.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <SchoolAvatar
                          name={lic.school_name}
                          logoUrl={schoolLogoMap[lic.slug]}
                          className="w-11 h-11 text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{lic.school_name}</h4>
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                Kadaluarsa
                              </span>
                            ) : exp.isExpiringSoon ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                Segera Berakhir
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                Aktif Sah
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-purple-600 mt-0.5 truncate">{lic.slug}.examku.my.id</p>
                          {lic.npsn && (
                            <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600 font-semibold border border-slate-200/60">
                              NPSN: {lic.npsn}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Key Diterbitkan</span>
                          <span className="font-semibold text-slate-800 text-[11px] block mt-0.5">
                            {formatDateIndonesia(lic.issued_at || lic.created)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {getRelativeTime(lic.issued_at || lic.created)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Aktif Sampai</span>
                          <span className="font-bold text-slate-900 text-[11px] block mt-0.5">
                            {formatDateIndonesia(lic.valid_until)}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold block",
                              isExpired ? "text-rose-600" : exp.isExpiringSoon ? "text-amber-600" : "text-emerald-600"
                            )}
                          >
                            {exp.text}
                          </span>
                        </div>
                      </div>

                      {/* License Token snippet on mobile */}
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <KeyRound size={12} className="text-purple-600 shrink-0" />
                          <code className="text-xs font-mono font-bold text-slate-700 truncate select-all">
                            {lic.license_code}
                          </code>
                        </div>
                        <button
                          onClick={() => handleCopyCode(lic.id, lic.license_code)}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-purple-600 shrink-0 ml-2 shadow-2xs flex items-center gap-1"
                        >
                          {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{isCopied ? "Disalin" : "Salin"}</span>
                        </button>
                      </div>

                      {/* Action buttons on mobile */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetailModal(lic)}
                          className="min-h-[38px] rounded-xl text-xs font-bold text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>Detail</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSendWA(lic)}
                          className="min-h-[38px] rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <MessageCircle size={13} />
                          <span>Kirim WA</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenRenewModal(lic)}
                          className="min-h-[38px] rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Calendar size={13} />
                          <span>Perpanjang</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Terbitkan / Perpanjang Lisensi */}
      <OfflineLicenseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        school={selectedSchoolForModal}
        availableSchools={schools}
        onSuccess={() => {
          fetchLicenses(true);
        }}
      />

      {/* Modal Detail Lisensi Lengkap */}
      {activeLicenseDetail && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-xl rounded-[2rem] p-6 border border-slate-200 shadow-2xl bg-white">
            <DialogHeader className="pb-3 border-b border-slate-100">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                  <KeyRound size={16} />
                </div>
                Rincian Kode Lisensi Offline CBT
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Informasi digital dan tanda tangan kriptografis untuk server proktor lokal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sekolah</span>
                  <p className="font-bold text-slate-900">{activeLicenseDetail.school_name}</p>
                  <p className="text-[11px] font-mono text-purple-600">{activeLicenseDetail.slug}.examku.my.id</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Batas Masa Berlaku</span>
                  <p className="font-bold text-slate-900">{formatDateIndonesia(activeLicenseDetail.valid_until)}</p>
                  <p className="text-[11px] font-bold text-emerald-600">
                    {getExpiryDetails(activeLicenseDetail.valid_until).text}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Waktu Penerbitan</span>
                  <p className="font-semibold text-slate-700">
                    {formatDateTimeIndonesia(activeLicenseDetail.issued_at || activeLicenseDetail.created)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Format Kriptografi</span>
                  <p className="font-semibold text-purple-700 flex items-center gap-1">
                    <ShieldCheck size={13} /> RSA-2048 Asimetris (v2)
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  String Kode Lisensi Resmi
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={activeLicenseDetail.license_code}
                  className="w-full p-2.5 rounded-xl border border-purple-200 bg-purple-50/30 font-mono text-[11px] text-slate-800 select-all resize-none outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Box Download Paket Offline CDN */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-purple-900">Tautan Berkas Pembaruan Server Offline</p>
                  <p className="text-[10px] text-purple-700/80 truncate font-mono mt-0.5">https://examku.my.id/downloads/offline-update.zip</p>
                </div>
                <a
                  href="https://examku.my.id/downloads/offline-update.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-bold flex items-center gap-1 shadow-2xs shrink-0 transition-colors"
                >
                  <Download size={12} />
                  <span>Unduh ZIP</span>
                </a>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleCopyCode(activeLicenseDetail.id, activeLicenseDetail.license_code)}
                  className="flex-1 h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5"
                >
                  <Copy size={13} /> Salin Kode Lisensi
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadKey(activeLicenseDetail.slug, activeLicenseDetail.license_code)}
                  className="h-9 px-3 rounded-xl text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5"
                >
                  <Download size={13} /> Unduh Berkas .key
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleSendWA(activeLicenseDetail)}
                  className="h-9 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <MessageCircle size={13} /> Kirim WhatsApp
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Konfirmasi Hapus */}
      {itemToDelete && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-md rounded-[2rem] p-6 border border-slate-200 shadow-2xl bg-white">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Trash2 size={16} />
                </div>
                Hapus Rekor Lisensi Offline?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Tindakan ini akan menghapus riwayat izin lisensi dari database Master VPS.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl my-3 text-xs text-rose-800">
              <p className="font-bold">{itemToDelete.school_name}</p>
              <p className="font-mono text-[11px] text-rose-600 mt-0.5">{itemToDelete.slug}.examku.my.id</p>
              <p className="text-[11px] text-slate-600 mt-2">
                Server lokal sekolah yang menggunakan kode ini akan tetap memvalidasi selama kunci tersimpan di PC lokal proktor, namun riwayat pencatatan di dashboard Super Admin akan dihapus.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl text-xs font-bold"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Rekor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </SuperAdminLayout>
  );
}
