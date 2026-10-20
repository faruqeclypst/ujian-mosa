import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
  Edit2,
  Mail,
  Loader2,
  User as UserIcon,
  ShieldCheck,
  Key,
  CheckCircle2,
  Lock,
  Calendar,
  Sparkles,
  Users
} from "lucide-react";

import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { NeonTabs, type NeonTabItem } from "../components/ui/NeonTabs";
import { NeonTable, type NeonTableColumn } from "../components/ui/NeonTable";
import { NeonBadge } from "../components/ui/NeonBadge";
import {
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorEmpty,
  InspectorCard,
} from "../components/ui/NeonInspector";

import { cn } from "../lib/utils";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: "admin" | "teacher" | "student";
  hasChangedPassword?: boolean;
  created?: string;
  updated?: string;
}

const UsersPage = () => {
  const { pb, terminology, school } = useTenant();
  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";
  const { user: currentUser, role: currentRole } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "teacher" | "student">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);

  // Dialog State: Create / Edit User
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "admin" as "admin" | "teacher",
  });
  const [formError, setFormError] = useState("");

  // Dialog State: Delete
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    user: AppUser | null;
    isBatch: boolean;
    isLoading: boolean;
  }>({
    isOpen: false,
    user: null,
    isBatch: false,
    isLoading: false,
  });

  // Dialog State: Reset Password
  const [resetDialog, setResetDialog] = useState<{
    isOpen: boolean;
    user: AppUser | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    user: null,
    isLoading: false,
  });

  const fetchUsers = useCallback(async () => {
    if (!pb) return;
    try {
      setLoading(true);
      const records = await pb.collection("users").getFullList({
        sort: "-created",
      });
      setUsers(records.map(r => ({
        id: r.id,
        email: r.email || "",
        username: r.username || "",
        name: r.name || "Tanpa Nama",
        role: (r.role as any) || "student",
        hasChangedPassword: Boolean(r.hasChangedPassword),
        created: r.created,
        updated: r.updated,
      })));
    } catch (err) {
      console.error("Error fetching users:", err);
      addToast({
        type: "error",
        title: "Gagal Memuat Akun",
        description: "Tidak dapat mengambil daftar akun dari server."
      });
    } finally {
      setLoading(false);
    }
  }, [pb, addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Statistics
  const stats = useMemo(() => {
    const adminCount = users.filter(u => u.role === "admin").length;
    const teacherCount = users.filter(u => u.role === "teacher").length;
    const studentCount = users.filter(u => u.role === "student").length;
    return {
      total: users.length,
      adminCount,
      teacherCount,
      studentCount,
    };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    let list = users;
    if (activeTab !== "all") {
      list = list.filter(u => u.role === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, activeTab, search]);

  // Active inspected user for NeonInspector
  const inspectedUser = useMemo(() => {
    if (inspectedUserId) {
      const found = filteredUsers.find(u => u.id === inspectedUserId);
      if (found) return found;
    }
    return filteredUsers[0] || null;
  }, [inspectedUserId, filteredUsers]);

  // Handle Create User
  const handleCreateAdmin = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setFormData({ email: "", password: "", name: "", role: "admin" });
    setFormError("");
    setIsDialogOpen(true);
  };

  // Handle Edit User
  const handleEditClick = useCallback((user: AppUser) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      password: "",
      name: user.name || "",
      role: (user.role === "teacher" ? "teacher" : "admin"),
    });
    setFormError("");
    setIsDialogOpen(true);
  }, []);

  // Save User (Create / Edit)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if ((dialogMode === "create" && !formData.password) || !formData.name.trim()) {
      setFormError("Nama lengkap dan kata sandi awal wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        role: formData.role,
      };

      if (dialogMode === "edit" && selectedUser) {
        if (formData.password) {
          payload.password = formData.password;
          payload.passwordConfirm = formData.password;
        }
        if (formData.email !== selectedUser.email) {
          payload.email = formData.email ? formData.email.trim() : "";
        }
        if (!pb) return;
        await pb.collection("users").update(selectedUser.id, payload);
      } else {
        const defaultPass = formData.password || "12345678";
        payload.password = defaultPass;
        payload.passwordConfirm = defaultPass;
        if (formData.email) {
          payload.email = formData.email.trim();
          payload.emailVisibility = true;
          const emailPrefix = formData.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
          payload.username = emailPrefix + Math.floor(Math.random() * 1000);
        } else {
          const namePrefix = formData.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          payload.username = namePrefix + Math.floor(Math.random() * 9999);
        }
        payload.hasChangedPassword = false;

        if (!pb) return;
        await pb.collection("users").create(payload);
      }

      setIsDialogOpen(false);
      await fetchUsers();
      addToast({
        type: "success",
        title: "Berhasil",
        description: `Akun ${formData.name} berhasil ${dialogMode === "edit" ? "diperbarui" : "didaftarkan"}!`
      });
    } catch (err: any) {
      console.error("Error saving user:", err);
      setFormError(err.message || "Gagal menyimpan akun.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reset Password Dialog
  const handleOpenResetDialog = useCallback((user: AppUser) => {
    setResetDialog({
      isOpen: true,
      user,
      isLoading: false,
    });
  }, []);

  // Confirm Reset Password to Default 12345678
  const handleConfirmResetPassword = async () => {
    if (!resetDialog.user || !pb) return;
    setResetDialog(prev => ({ ...prev, isLoading: true }));
    try {
      await pb.collection("users").update(resetDialog.user.id, {
        password: "12345678",
        passwordConfirm: "12345678",
        hasChangedPassword: false,
      });

      addToast({
        type: "success",
        title: "Sandi Direset",
        description: `Kata sandi untuk ${resetDialog.user.name} berhasil dikembalikan ke 12345678.`
      });

      setResetDialog({ isOpen: false, user: null, isLoading: false });
      await fetchUsers();
    } catch (err: any) {
      console.error("Error resetting password:", err);
      addToast({
        type: "error",
        title: "Gagal Reset Sandi",
        description: err.message || "Terjadi kesalahan saat mereset kata sandi."
      });
      setResetDialog(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Open Single Delete Dialog
  const handleOpenDeleteDialog = useCallback((user: AppUser) => {
    if (user.id === currentUser?.id) {
      addToast({
        type: "error",
        title: "Akses Ditolak",
        description: "Anda tidak dapat menghapus akun administrator yang sedang aktif digunakan."
      });
      return;
    }
    setDeleteDialog({
      isOpen: true,
      user,
      isBatch: false,
      isLoading: false,
    });
  }, [currentUser?.id, addToast]);

  // Open Batch Delete Dialog
  const handleOpenBatchDeleteDialog = () => {
    const toDelete = selectedIds.filter(id => id !== currentUser?.id);
    if (toDelete.length === 0) {
      addToast({
        type: "warning",
        title: "Pilihan Tidak Valid",
        description: "Tidak ada akun lain yang dapat dihapus dari pilihan Anda."
      });
      return;
    }
    setDeleteDialog({
      isOpen: true,
      user: null,
      isBatch: true,
      isLoading: false,
    });
  };

  // Confirm Delete (Single or Batch)
  const handleConfirmDelete = async () => {
    if (!pb) return;
    setDeleteDialog(prev => ({ ...prev, isLoading: true }));

    try {
      if (deleteDialog.isBatch) {
        const toDelete = selectedIds.filter(id => id !== currentUser?.id);
        for (const id of toDelete) {
          await pb.collection("users").delete(id);
        }
        setSelectedIds([]);
        addToast({
          type: "success",
          title: "Berhasil",
          description: `${toDelete.length} akun terpilih berhasil dihapus.`
        });
      } else if (deleteDialog.user) {
        await pb.collection("users").delete(deleteDialog.user.id);
        addToast({
          type: "success",
          title: "Berhasil",
          description: `Akun ${deleteDialog.user.name} berhasil dihapus.`
        });
      }

      setDeleteDialog({ isOpen: false, user: null, isBatch: false, isLoading: false });
      await fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      addToast({
        type: "error",
        title: "Gagal Menghapus",
        description: err.message || "Terjadi kendala saat menghapus akun pengguna."
      });
      setDeleteDialog(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Role Badge Helper
  const getRoleBadge = (role: AppUser["role"]) => {
    switch (role) {
      case "admin":
        return <NeonBadge variant="emerald" pulse>Administrator</NeonBadge>;
      case "teacher":
        return <NeonBadge variant="sky">{terminology.teacher}</NeonBadge>;
      case "student":
        return <NeonBadge variant="neutral">{terminology.student}</NeonBadge>;
      default:
        return <NeonBadge variant="neutral">{role}</NeonBadge>;
    }
  };

  // Table Columns (Clean & Compact)
  const neonColumns: NeonTableColumn<AppUser>[] = useMemo(() => [
    {
      key: "index",
      header: "#",
      width: "44px",
      align: "center",
      render: (_item, i) => (
        <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {i + 1}
        </span>
      ),
    },
    {
      key: "name",
      header: "Pengguna & Akun",
      render: (u) => {
        const roleInitialColor =
          u.role === "admin"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : u.role === "teacher"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";

        return (
          <div className="flex items-center gap-3 py-1">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border", roleInitialColor)}>
              {u.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                {u.name}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className="font-mono">@{u.username || "pengguna"}</span>
                {u.email && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-700">•</span>
                    <span className="truncate max-w-[180px]">{u.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: "role",
      header: "Hak Akses",
      width: "140px",
      render: (u) => getRoleBadge(u.role)
    },
    {
      key: "passwordStatus",
      header: "Sandi",
      width: "110px",
      render: (u) => (
        u.hasChangedPassword ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Diubah
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
            Bawaan
          </span>
        )
      )
    },
    {
      key: "created",
      header: "Terdaftar",
      width: "120px",
      render: (u) => (
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {u.created ? new Date(u.created).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
        </span>
      )
    },
    {
      key: "actions",
      header: "Aksi",
      width: "100px",
      align: "right",
      render: (u) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex justify-end items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => handleEditClick(u)}
              title="Edit Akun"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 transition-colors shadow-2xs cursor-pointer"
              onClick={() => handleOpenResetDialog(u)}
              title="Reset Sandi ke 12345678"
            >
              <Key className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={isSelf}
              className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center border transition-colors shadow-2xs",
                isSelf
                  ? "opacity-30 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400"
                  : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer"
              )}
              onClick={() => handleOpenDeleteDialog(u)}
              title={isSelf ? "Tidak bisa menghapus akun sendiri" : "Hapus Akun"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
    }
  ], [currentUser?.id, handleEditClick, handleOpenResetDialog, handleOpenDeleteDialog, terminology]);

  // Tab Items for NeonTabs
  const tabs: NeonTabItem<"all" | "admin" | "teacher" | "student">[] = useMemo(() => [
    {
      id: "all",
      label: "Semua Akun",
      count: stats.total,
    },
    {
      id: "admin",
      label: "Administrator",
      count: stats.adminCount,
      indicator: stats.adminCount > 0,
    },
    {
      id: "teacher",
      label: terminology.teacher,
      count: stats.teacherCount,
    },
    {
      id: "student",
      label: terminology.student,
      count: stats.studentCount,
    },
  ], [stats, terminology]);

  // Access Guard
  if (currentRole !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Akses Ditolak</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mt-1">
          Halaman kelola akun hanya dapat diakses oleh administrator sistem sekolah.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
      {/* ── Main 2-Column Responsive Grid (Full Height Alignment with Inspector) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ═══════════════════════════════════════════════════════════════
            LEFT / MAIN CONTENT COLUMN
           ═══════════════════════════════════════════════════════════════ */}
        <div className="min-w-0 space-y-5">

          {/* 1. Header Bar: Title, Breadcrumbs & Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                Kelola Akun Pengguna
              </h1>
              {/* Breadcrumb line matching Neon Console */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                  Overview
                </Link>
                <span>/</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {schoolSlug}
                </span>
                <span>/</span>
                <span className="text-neutral-500 dark:text-neutral-400">pengaturan</span>
                <span>/</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                  kelola-akun
                </span>
              </div>
            </div>

            {/* Top Right Action: Admin Baru */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleCreateAdmin}
                size="sm"
                className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Admin Baru</span>
              </Button>
            </div>
          </div>

          {/* 2. Sleek Horizontal Tabs: Semua, Administrator, Guru, Siswa */}
          <NeonTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={tabs}
            countFormat="parens"
          />

          {/* 3. Main Neon Table */}
          <NeonTable<AppUser>
            data={filteredUsers}
            columns={neonColumns}
            keyExtractor={(u) => u.id}
            isLoading={loading}
            compact
            selectable
            selectedKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari nama, username, atau email akun..."
            title="Daftar Akun Pengguna"
            subtitle={`Menampilkan ${filteredUsers.length} akun sesuai kriteria.`}
            pagination
            pageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
            activeKey={inspectedUser?.id}
            onRowClick={(u) => setInspectedUserId(u.id)}
            emptyTitle="Belum ada akun ditemukan"
            emptySubtitle="Tidak ada akun yang sesuai dengan kata kunci pencarian atau tab filter Anda."
            batchActions={
              <button
                type="button"
                onClick={handleOpenBatchDeleteDialog}
                className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Hapus Akun Terpilih</span>
              </button>
            }
          />

        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT SIDEBAR / INSPECTOR PANEL (Sticky & Aligned from Top)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonInspector isSticky>
          <InspectorSection>
            <InspectorHeader
              title="Detail Akun"
              icon={UserCog}
              badge={inspectedUser ? "Terpilih" : "Ringkasan"}
            />

            {inspectedUser ? (
              <div className="space-y-3 text-xs">
                {/* User Profile Card */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border",
                    inspectedUser.role === "admin"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : inspectedUser.role === "teacher"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                  )}>
                    {inspectedUser.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {inspectedUser.name}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                      @{inspectedUser.username || "pengguna"}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {getRoleBadge(inspectedUser.role)}
                    </div>
                  </div>
                </div>

                <InspectorGrid>
                  <InspectorField
                    label="ID Record"
                    value={inspectedUser.id.slice(0, 10)}
                    mono
                  />
                  <InspectorField
                    label="Hak Akses"
                    value={
                      inspectedUser.role === "admin"
                        ? "Administrator"
                        : inspectedUser.role === "teacher"
                          ? terminology.teacher
                          : terminology.student
                    }
                  />
                </InspectorGrid>

                <InspectorField
                  label="Email Login"
                  value={inspectedUser.email || "-"}
                />

                <InspectorField label="Status Sandi">
                  {inspectedUser.hasChangedPassword ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Kata sandi sudah diubah</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                      <span>Sandi bawaan sistem (12345678)</span>
                    </div>
                  )}
                </InspectorField>

                {inspectedUser.created && (
                  <InspectorField
                    label="Tanggal Terdaftar"
                    value={new Date(inspectedUser.created).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  />
                )}

                <InspectorActions>
                  <InspectorButton
                    variant="primary"
                    icon={Edit2}
                    onClick={() => handleEditClick(inspectedUser)}
                  >
                    Edit Data Akun
                  </InspectorButton>
                  <InspectorButton
                    variant="secondary"
                    icon={Key}
                    onClick={() => handleOpenResetDialog(inspectedUser)}
                  >
                    Reset Sandi Default
                  </InspectorButton>
                  <InspectorButton
                    variant="danger"
                    icon={Trash2}
                    disabled={inspectedUser.id === currentUser?.id}
                    onClick={() => handleOpenDeleteDialog(inspectedUser)}
                  >
                    Hapus Akun
                  </InspectorButton>
                </InspectorActions>
              </div>
            ) : (
              <InspectorEmpty
                icon={UserCog}
                title="Pilih Akun Pengguna"
                description="Klik salah satu baris akun di tabel untuk melihat profil lengkap, status kata sandi, atau mengatur akses."
              />
            )}
          </InspectorSection>

          {/* Security Tip Box */}
          <InspectorSection divided>
            <InspectorCard
              title="Keamanan Kata Sandi"
              icon={ShieldCheck}
              description="Kata sandi default untuk akun baru atau hasil reset adalah 12345678. Pengguna disarankan langsung mengganti sandi setelah login pertama kali."
            />
          </InspectorSection>
        </NeonInspector>

      </div>

      {/* ── Create / Edit User Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0f1115] border border-neutral-200 dark:border-neutral-800 rounded-xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <UserCog className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {dialogMode === "create" ? "Tambah Akun Baru" : "Edit Akun Pengguna"}
                </DialogTitle>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {dialogMode === "create" ? "Daftarkan akun administrator atau guru baru" : "Perbarui informasi akun dan kata sandi"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="p-5 space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <FormField id="role" label="Role / Hak Akses">
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="admin">Administrator (Akses Penuh)</option>
                <option value="teacher">{terminology.teacher} (Akses Guru & Nilai)</option>
              </select>
            </FormField>

            <FormField id="name" label="Nama Lengkap">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`Contoh: Nama ${formData.role === "admin" ? "Administrator" : terminology.teacher}`}
                required
                className="h-9 text-xs"
              />
            </FormField>

            <FormField id="email" label="Email Login (Opsional)">
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@sekolah.sch.id"
                className="h-9 text-xs"
              />
            </FormField>

            <FormField
              id="password"
              label={dialogMode === "edit" ? "Kata Sandi Baru (Opsional)" : "Kata Sandi Awal"}
            >
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={dialogMode === "edit" ? "Kosongkan jika tidak ingin mengubah" : "Minimal 8 karakter (default: 12345678)"}
                className="h-9 text-xs"
              />
            </FormField>

            <DialogFooter className="pt-3 border-t border-neutral-100 dark:border-neutral-800 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Akun"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        type="danger"
        title={deleteDialog.isBatch ? "Hapus Akun Massal" : "Hapus Akun Pengguna"}
        description={
          deleteDialog.isBatch
            ? `Apakah Anda yakin ingin menghapus ${selectedIds.filter(id => id !== currentUser?.id).length} akun terpilih? Tindakan ini tidak dapat dibatalkan.`
            : `Apakah Anda yakin ingin menghapus akun "${deleteDialog.user?.name}"? Pengguna tidak akan dapat login kembali.`
        }
        confirmLabel={deleteDialog.isBatch ? "Hapus Semua Terpilih" : "Hapus Akun"}
        isLoading={deleteDialog.isLoading}
      />

      {/* ── Reset Password Confirmation Dialog ── */}
      <ConfirmationDialog
        isOpen={resetDialog.isOpen}
        onClose={() => setResetDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmResetPassword}
        type="warning"
        title="Reset Kata Sandi"
        description={`Apakah Anda yakin ingin mengembalikan kata sandi akun "${resetDialog.user?.name}" ke kata sandi bawaan (12345678)?`}
        confirmLabel="Reset ke 12345678"
        isLoading={resetDialog.isLoading}
      />

    </div>
  );
};

export default UsersPage;
