import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  KeyRound,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Download,
  Printer,
  ShieldCheck,
  Lock,
  LockOpen,
  User,
  GraduationCap,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useToast } from "../../components/ui/toast";
import {
  NeonPageHeader,
  NeonTable,
  type NeonTableColumn,
  NeonFilterPopover,
  NeonFilterField,
  NeonFilterSelect,
  NeonStatGrid,
  NeonStatCard,
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorEmpty,
  NeonBadge,
  NeonButton,
} from "../../components/ui";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import BatchProgressDialog from "../../components/dialogs/BatchProgressDialog";
import { cn } from "../../lib/utils";
import type { StudentData } from "../../types/exam";

const StudentCredentialsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const { terminology, school } = useTenant();
  const {
    students,
    classes,
    loading,
    regenerateExamCredentials,
    regenerateExamCredentialsBatch,
    resetStudentPassword,
    resetStudentPasswordBatch,
  } = useExamData();

  // ── Local State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClassId, setFilterClassId] = useState<string>(
    () => searchParams.get("classId") || "ALL"
  );
  const [filterPasswordStatus, setFilterPasswordStatus] = useState<"ALL" | "DEFAULT" | "CHANGED" | "SESSION">("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  // Toggle reveal password global atau per baris
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dialog & Batch Progress
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: "danger" | "warning" | "info" | "success";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    title: string;
    current: number;
    total: number;
    message: string;
    errorCount: number;
  }>({
    isOpen: false,
    title: "",
    current: 0,
    total: 0,
    message: "",
    errorCount: 0,
  });

  const showAlert = (
    title: string,
    message: string,
    type: "danger" | "warning" | "info" | "success" = "info",
    onConfirm?: () => void
  ) => {
    setDialogConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Filtered Students ──
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Filter Kelas
    if (filterClassId === "NONE") {
      result = result.filter((s) => !s.classId);
    } else if (filterClassId !== "ALL") {
      result = result.filter((s) => s.classId === filterClassId);
    }

    // Filter Status Password
    if (filterPasswordStatus === "DEFAULT") {
      result = result.filter((s) => !s.hasChangedPassword);
    } else if (filterPasswordStatus === "CHANGED") {
      result = result.filter((s) => s.hasChangedPassword);
    } else if (filterPasswordStatus === "SESSION") {
      result = result.filter((s) => Boolean(s.examPassword));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.nisn && s.nisn.toLowerCase().includes(q)) ||
          ((s as any).username && String((s as any).username).toLowerCase().includes(q)) ||
          (s.examUsername && s.examUsername.toLowerCase().includes(q))
      );
    }

    return result;
  }, [students, filterClassId, filterPasswordStatus, searchQuery]);

  // Siswa yang diinspeksi
  const inspectedStudent = useMemo(() => {
    if (!inspectedStudentId) return filteredStudents[0] || null;
    return students.find((s) => s.id === inspectedStudentId) || filteredStudents[0] || null;
  }, [students, inspectedStudentId, filteredStudents]);

  // ── Statistik Ringkas ──
  const stats = useMemo(() => {
    const total = students.length;
    const withSession = students.filter((s) => Boolean(s.examPassword)).length;
    const isDefault = students.filter((s) => !s.hasChangedPassword).length;
    const isChanged = students.filter((s) => s.hasChangedPassword).length;

    return { total, withSession, isDefault, isChanged };
  }, [students]);

  // ── Handlers: Single Action ──
  const handleSingleRegenerate = async (student: StudentData) => {
    showAlert(
      "Buat Kredensial Sesi Baru",
      `Buat sandi sesi ujian baru untuk ${student.name}? Sandi lama sesi ini akan diganti acak baru.`,
      "warning",
      async () => {
        try {
          const creds = await regenerateExamCredentials(student.id);
          showAlert(
            "Kredensial Berhasil Dibuat",
            `Username: ${creds.examUsername}\nPassword Sesi: ${creds.examPassword}\n\nKredensial ini langsung aktif dan siswa dapat login tanpa mengubah password akun utamanya.`,
            "success"
          );
        } catch (err: any) {
          showAlert("Gagal", err.message || "Gagal membuat kredensial.", "danger");
        }
      }
    );
  };

  const handleSingleResetPassword = async (student: StudentData) => {
    showAlert(
      "Reset Sandi Akun Siswa",
      `Kembalikan password ${student.name} ke default "12345678"? Tindakan ini akan mengosongkan status ubah password.`,
      "warning",
      async () => {
        try {
          await resetStudentPassword(student.id);
          showAlert("Sandi Direset", `Password untuk ${student.name} berhasil dikembalikan ke default "12345678".`, "success");
        } catch (err: any) {
          showAlert("Gagal", err.message || "Gagal mereset password.", "danger");
        }
      }
    );
  };

  // ── Handlers: Batch Actions ──
  const handleBatchRegenerate = () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : filteredStudents.map((s) => s.id);
    if (targetIds.length === 0) return;

    const labelCount = selectedIds.length > 0 ? `${selectedIds.length} siswa terpilih` : `seluruh ${targetIds.length} siswa di filter aktif`;

    showAlert(
      "Acak Sandi Sesi Serentak",
      `Generate sandi sesi ujian baru untuk ${labelCount}? Seluruh siswa terpilih akan menerima sandi acak baru yang langsung tersinkronkan ke kartu ujian.`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          title: "Membuat Kredensial Sesi Ujian Massal",
          current: 0,
          total: targetIds.length,
          message: "Menyiapkan sandi acak di server...",
          errorCount: 0,
        });

        try {
          await regenerateExamCredentialsBatch(targetIds, "TU", (curr, tot) => {
            setBatchProgress((prev) => ({
              ...prev,
              current: curr,
              total: tot,
              message: `Memproses ${curr} dari ${tot} siswa...`,
            }));
          });

          setBatchProgress((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds([]);
          showAlert(
            "Berhasil",
            `Kredensial sesi ujian untuk ${targetIds.length} ${terminology.student.toLowerCase()} berhasil dibuat dan disimpan.`,
            "success"
          );
        } catch (err: any) {
          setBatchProgress((prev) => ({ ...prev, isOpen: false }));
          showAlert("Gagal", err.message || "Terjadi kendala saat memproses sandi sesi.", "danger");
        }
      }
    );
  };

  const handleBatchResetPassword = () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : filteredStudents.map((s) => s.id);
    if (targetIds.length === 0) return;

    const labelCount = selectedIds.length > 0 ? `${selectedIds.length} siswa terpilih` : `seluruh ${targetIds.length} siswa di filter aktif`;

    showAlert(
      "Reset Sandi Akun Massal",
      `Kembalikan password ${labelCount} ke default "12345678"?`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          title: "Mereset Password Siswa Massal",
          current: 0,
          total: targetIds.length,
          message: "Mereset ke default 12345678...",
          errorCount: 0,
        });

        try {
          await resetStudentPasswordBatch(targetIds, (current, total) => {
            setBatchProgress((prev) => ({ ...prev, current, total }));
          });
          setBatchProgress((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds([]);
          showAlert("Berhasil", `Password untuk ${targetIds.length} siswa berhasil dikembalikan ke default 12345678.`, "success");
        } catch (err: any) {
          setBatchProgress((prev) => ({ ...prev, isOpen: false }));
          showAlert("Gagal", err.message || "Gagal mereset password.", "danger");
        }
      }
    );
  };

  // ── Ekspor Excel Kredensial ──
  const handleExportExcel = () => {
    const dataToExport = selectedIds.length > 0
      ? students.filter((s) => selectedIds.includes(s.id))
      : filteredStudents;

    if (dataToExport.length === 0) {
      showAlert("Peringatan", "Tidak ada data siswa untuk diekspor.", "warning");
      return;
    }

    const rows = dataToExport.map((s, idx) => {
      const cls = classes.find((c) => c.id === s.classId);
      const effectiveUsername = s.examUsername || (s as any).username || s.nisn;
      const effectivePassword = s.examPassword || "12345678";

      return {
        "No": idx + 1,
        "Nama Siswa": s.name,
        "NISN": s.nisn || "-",
        "Kelas": cls?.name || "Tanpa Kelas",
        "Username CBT": effectiveUsername,
        "Sandi Sesi Ujian": effectivePassword,
        "Status Sandi": s.hasChangedPassword ? "Sudah Diubah Siswa" : "Sandi Default (12345678)",
        "Sesi Dibuat": s.examPassword ? "Ya" : "Belum",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Styling Header
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kredensial Siswa");

    const schoolSlug = school?.slug || "sekolah";
    const classNameLabel = filterClassId !== "ALL" ? classes.find(c => c.id === filterClassId)?.name || "kelas" : "semua-kelas";
    XLSX.writeFile(workbook, `Kredensial_Siswa_${schoolSlug}_${classNameLabel}.xlsx`);
  };

  // ── Tabel Columns Definition ──
  const columns: NeonTableColumn<StudentData>[] = useMemo(
    () => [
      {
        key: "identity",
        header: `Nama ${terminology.student} & NISN`,
        className: "w-[36%] min-w-[200px]",
        render: (student) => {
          const initials = (student.name || "S")
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div className="flex items-center gap-2.5 py-1 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none border",
                  student.gender === "P"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40"
                    : "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/40"
                )}
              >
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-[13px] leading-tight">
                  {student.name}
                </span>
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                  NISN: {student.nisn || "-"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "class",
        header: terminology.class,
        className: "w-[16%] min-w-[90px]",
        render: (student) => {
          const cls = classes.find((c) => c.id === student.classId);
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {cls?.name || "Tanpa Kelas"}
            </span>
          );
        },
      },
      {
        key: "username",
        header: "Username CBT",
        className: "w-[18%] min-w-[120px]",
        render: (student) => {
          const uName = student.examUsername || (student as any).username || student.nisn || "-";
          const isCopied = copiedKey === `u_${student.id}`;

          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-200/60 dark:border-neutral-700/60">
                {uName}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(uName, `u_${student.id}`);
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title="Salin Username"
              >
                {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          );
        },
      },
      {
        key: "password",
        header: "Sandi Sesi Ujian",
        className: "w-[18%] min-w-[120px]",
        render: (student) => {
          const pWord = student.examPassword || "12345678";
          const isRevealed = Boolean(revealedIds[student.id]);
          const isCopied = copiedKey === `p_${student.id}`;

          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                {isRevealed ? pWord : "••••••"}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReveal(student.id);
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title={isRevealed ? "Sembunyikan" : "Tampilkan Sandi"}
              >
                {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(pWord, `p_${student.id}`);
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title="Salin Sandi"
              >
                {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status Sandi",
        className: "w-[12%] min-w-[100px]",
        render: (student) => {
          if (student.hasChangedPassword) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Diubah
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <LockOpen className="h-3 w-3 text-amber-500" />
              Default
            </span>
          );
        },
      },
    ],
    [classes, terminology, copiedKey, revealedIds]
  );

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ── 1. Header Halaman ── */}
        <NeonPageHeader
          bordered
          title="Kredensial & Sandi Sesi Ujian"
          subtitle="Kelola username CBT, generate sandi sesi acak serentak per kelas, reset sandi, dan ekspor daftar akun login."
          badge={
            <NeonBadge variant="emerald">
              Keamanan CBT
            </NeonBadge>
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <NeonButton
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                iconOnly={false}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
              </NeonButton>

              <NeonButton
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/admin/cetak-kartu?classId=${filterClassId !== "ALL" ? filterClassId : ""}`)}
              >
                <Printer className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Cetak Kartu Ujian</span>
              </NeonButton>

              {role === "admin" && (
                <NeonButton
                  variant="primary"
                  size="sm"
                  onClick={handleBatchRegenerate}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate Sandi Sesi</span>
                </NeonButton>
              )}
            </div>
          }
        />

        {/* ── 2. Top Stats Strip (4 Kartu Ringkas) ── */}
        <NeonStatGrid cols={4}>
          <NeonStatCard
            label="Total Akun Siswa"
            value={stats.total}
            subText="Terdaftar di sistem CBT"
            icon={User}
          />
          <NeonStatCard
            label="Sandi Sesi Aktif"
            value={stats.withSession}
            subText="Siap login sesi ujian"
            icon={KeyRound}
          />
          <NeonStatCard
            label="Sandi Default (12345678)"
            value={stats.isDefault}
            subText="Belum diubah oleh siswa"
            icon={LockOpen}
          />
          <NeonStatCard
            label="Sandi Diubah Siswa"
            value={stats.isChanged}
            subText="Password mandiri akun siswa"
            icon={ShieldCheck}
          />
        </NeonStatGrid>

        {/* ── 3. Layout Grid: Tabel Kredensial + Inspector Samping ── */}
        <div className="flex flex-col xl:flex-row items-start gap-6">

          {/* Area Tabel Utama */}
          <div className="flex-1 w-full min-w-0">
            <NeonTable<StudentData>
              data={filteredStudents}
              columns={columns}
              keyExtractor={(s) => s.id}
              selectable
              selectedKeys={selectedIds}
              onSelectionChange={setSelectedIds}
              isLoading={loading}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={`Cari nama ${terminology.student.toLowerCase()}, NISN, atau username ujian...`}
              filterSlot={
                <NeonFilterPopover
                  title="Filter Kredensial"
                  activeCount={
                    (filterClassId !== "ALL" ? 1 : 0) +
                    (filterPasswordStatus !== "ALL" ? 1 : 0)
                  }
                  onReset={() => {
                    setFilterClassId("ALL");
                    setFilterPasswordStatus("ALL");
                  }}
                >
                  {/* Filter Kelas */}
                  <NeonFilterField label={terminology.class}>
                    <NeonFilterSelect
                      value={filterClassId}
                      onChange={(e) => setFilterClassId(e.target.value)}
                    >
                      <option value="ALL">Semua {terminology.class}</option>
                      <option value="NONE">Tanpa {terminology.class}</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </NeonFilterSelect>
                  </NeonFilterField>

                  {/* Filter Status Password */}
                  <NeonFilterField label="Status Sandi">
                    <NeonFilterSelect
                      value={filterPasswordStatus}
                      onChange={(e) => setFilterPasswordStatus(e.target.value as any)}
                    >
                      <option value="ALL">Semua Status Sandi</option>
                      <option value="SESSION">Sandi Sesi Ter-generate</option>
                      <option value="DEFAULT">Sandi Default (Belum Diubah)</option>
                      <option value="CHANGED">Sandi Sudah Diubah Siswa</option>
                    </NeonFilterSelect>
                  </NeonFilterField>
                </NeonFilterPopover>
              }
              batchActions={
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {selectedIds.length} siswa dipilih:
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchRegenerate}
                    className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Acak Sandi Sesi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchResetPassword}
                    className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Download className="h-3 w-3" />
                    <span>Ekspor Terpilih</span>
                  </button>
                </div>
              }
              compact
              tableLayout="fixed"
              title="Daftar Akun & Kredensial Siswa"
              subtitle="Klik baris siswa untuk melihat detail parameter login di panel sebelah kanan."
              activeKey={inspectedStudent?.id}
              onRowClick={(student) => setInspectedStudentId(student.id)}
              pagination
              pageSize={50}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>

          {/* ── 4. Inspector Panel Samping ── */}
          <NeonInspector>
            <InspectorSection>
              <InspectorHeader
                title="Detail Kredensial"
                icon={KeyRound}
                badge={inspectedStudent ? "Terpilih" : "Ringkasan"}
              />

              {inspectedStudent ? (
                <div className="space-y-3 text-xs">
                  {/* Identitas Siswa */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/20 text-xs shrink-0">
                      {inspectedStudent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate text-[13px]">
                        {inspectedStudent.name}
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                        NISN: {inspectedStudent.nisn || "-"}
                      </div>
                    </div>
                  </div>

                  <InspectorGrid>
                    <InspectorField
                      label={terminology.class}
                      value={classes.find((c) => c.id === inspectedStudent.classId)?.name || "-"}
                    />
                    <InspectorField
                      label="Status Akun"
                      value={
                        inspectedStudent.hasChangedPassword ? (
                          <span className="text-emerald-600 font-semibold">Sandi Diubah</span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Sandi Default</span>
                        )
                      }
                    />
                  </InspectorGrid>

                  {/* Kredensial Box */}
                  <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Username CBT</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {inspectedStudent.examUsername || (inspectedStudent as any).username || inspectedStudent.nisn || "-"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(inspectedStudent.examUsername || inspectedStudent.nisn, "inspected_user")}
                          className="p-1 hover:text-neutral-900 dark:hover:text-white"
                          title="Salin Username"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-200/50 dark:border-neutral-800/80 pt-2">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Sandi Sesi</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {inspectedStudent.examPassword || "12345678"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(inspectedStudent.examPassword || "12345678", "inspected_pass")}
                          className="p-1 hover:text-neutral-900 dark:hover:text-white"
                          title="Salin Sandi"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Inspector Buttons */}
                  <InspectorActions>
                    <div className="grid grid-cols-2 gap-1.5">
                      <InspectorButton
                        variant="primary"
                        icon={Sparkles}
                        onClick={() => handleSingleRegenerate(inspectedStudent)}
                        title="Acak Sandi Sesi Ujian"
                      >
                        Acak Sandi
                      </InspectorButton>

                      <InspectorButton
                        variant="secondary"
                        icon={RotateCcw}
                        onClick={() => handleSingleResetPassword(inspectedStudent)}
                        title="Reset Sandi ke Default 12345678"
                      >
                        Reset Sandi
                      </InspectorButton>

                      <InspectorButton
                        variant="secondary"
                        icon={Printer}
                        onClick={() => navigate(`/admin/cetak-kartu?studentId=${inspectedStudent.id}`)}
                        title="Buka Cetak Kartu Ujian Siswa Ini"
                      >
                        Kartu Ujian
                      </InspectorButton>

                      <InspectorButton
                        variant="secondary"
                        icon={Copy}
                        onClick={() => {
                          const u = inspectedStudent.examUsername || inspectedStudent.nisn;
                          const p = inspectedStudent.examPassword || "12345678";
                          handleCopy(`Nama: ${inspectedStudent.name}\nUsername: ${u}\nPassword: ${p}`, "inspected_all");
                        }}
                        title="Salin Data Login Lengkap"
                      >
                        Salin Akun
                      </InspectorButton>
                    </div>
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty message="Pilih salah satu siswa untuk melihat kredensial." />
              )}
            </InspectorSection>
          </NeonInspector>

        </div>
      </div>

      {/* Confirmation & Progress Dialogs */}
      <ConfirmationDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={dialogConfig.onConfirm || (() => {})}
        title={dialogConfig.title}
        description={dialogConfig.message}
        type={dialogConfig.type}
      />

      <BatchProgressDialog
        progress={batchProgress}
      />
    </div>
  );
};

export default StudentCredentialsPage;
