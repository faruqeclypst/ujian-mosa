import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Plus,
  Trash2,
  ArrowLeftRight,
  Check,
  Filter,
  ChevronDown,
  Loader2,
  Users2,
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  Sparkles,
  KeyRound,
  BarChart2,
  ShieldCheck,
  Printer,
  Camera,
  MoreHorizontal,
  User,
  GraduationCap,
  Edit,
  Trash,
  Info,
  ClipboardList
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorEmpty,
} from "../components/ui/NeonInspector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "../components/ui/dialog";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { downloadStudentImportTemplate, exportStudentToExcel, exportStudentLoginsToExcel, parseStudentImportExcel, exportAllStudentScores } from "../lib/studentExcel";
import type { StudentData } from "../types/exam";
import { StudentForm, StudentFormValues } from "../components/forms/StudentForm";
import { StudentTable } from "../components/tables/StudentTable";
import StudentInterestDialog from "../components/dialogs/StudentInterestDialog";
import StudentScoresDialog from "../components/dialogs/StudentScoresDialog";
import BatchClassMoveDialog from "../components/dialogs/BatchClassMoveDialog";
import ResetStudentPasswordDialog from "../components/dialogs/ResetStudentPasswordDialog";
import BatchProgressDialog from "../components/dialogs/BatchProgressDialog";
import PrintExamCardsDialog from "../components/dialogs/PrintExamCardsDialog";
import BatchStudentPhotoDialog from "../components/dialogs/BatchStudentPhotoDialog";
import { NeonStatGrid, NeonStatCard } from "../components/ui/NeonStats";

let studentTableCache: {
  rows: StudentData[];
  total: number;
} | null = null;

const StudentsPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { school, terminology, pb, subscriptionStatus } = useTenant();
  const { students, classes, loading, createStudent, updateStudent, deleteStudent, resetStudentPassword, resetStudentPasswordBatch } = useExamData();

  const isOffline = school?.plan === "offline" || school?.id === "local_server";
  const quota = isOffline ? 999999 : (subscriptionStatus?.effectiveQuota || school?.student_quota || (school?.plan === "free" ? 50 : 250));
  const planName = isOffline ? "Offline Mandiri" : (school?.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : "Free");
  // Total siswa dari server (diisi fetch tabel); fallback ke context saat belum load
  const [tableTotal, setTableTotal] = useState<number | null>(() => studentTableCache?.total ?? null);
  const studentCount = tableTotal ?? students.length;
  const quotaUsedPercent = isOffline ? 0 : Math.min(100, Math.round((studentCount / Math.max(1, quota)) * 100));
  const isQuotaFull = isOffline ? false : studentCount >= quota;
  const isQuotaWarning = isOffline ? false : quotaUsedPercent >= 80;
  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";

  // Filter kelas (dipakai tabel server-side & dialog) — dideklarasikan di sini
  // agar bisa dipakai oleh buildStudentFilter di bawah.
  const [filterClassId, setFilterClassId] = useState<string>("ALL");

  // ── Server-side pagination untuk tabel siswa ──
  // Tabel TIDAK menunggu context memuat 10k siswa; fetch 50/page langsung dari server.
  const STUDENT_PAGE_SIZE = 50;
  const STUDENT_LIST_FIELDS =
    "id,username,name,email,emailVisibility,verified,classId,gender,birthPlace,birthDate,examNumber,room,session,photo,hasChangedPassword,resetRequested,created,updated";
  const STUDENT_SORT_MAP: Record<string, string> = {
    nisn: "username",
    name: "name",
    gender: "gender",
    classId: "classId",
    hasChangedPassword: "hasChangedPassword",
  };
  const mapStudentRow = (i: any): StudentData => ({
    ...i,
    id: i.id,
    nisn: i.username || i.nisn,
    gender: i.gender || "L",
    classId: i.classId || i.classid || i.class_id,
    hasChangedPassword: i.hasChangedPassword || false,
    photo: i.photo || "",
    birthPlace: i.birthPlace || "",
    birthDate: i.birthDate || "",
    room: i.room || "",
    session: i.session || "",
    examNumber: i.examNumber || "",
    resetRequested: i.resetRequested || "",
  } as StudentData);

  const [tablePage, setTablePage] = useState(1);
  const [tableSearchInput, setTableSearchInput] = useState("");
  const [tableSearch, setTableSearch] = useState(""); // debounced
  const [tableSort, setTableSort] = useState<{ column: string; direction: "asc" | "desc" }>({ column: "name", direction: "asc" });
  const [tableRows, setTableRows] = useState<StudentData[]>(() => studentTableCache?.rows || []);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableLoadedOnce, setTableLoadedOnce] = useState(() => !studentTableCache);

  // Debounce search 400ms agar tidak spam request per ketikan;
  // sekalian reset ke halaman 1 (dibatch dalam satu render -> 1x fetch)
  useEffect(() => {
    const t = setTimeout(() => { setTableSearch(tableSearchInput); setTablePage(1); }, 400);
    return () => clearTimeout(t);
  }, [tableSearchInput]);

  const buildStudentFilter = useCallback(() => {
    const parts: string[] = [`classId != "ALUMNI"`];
    if (filterClassId === "NONE") {
      const validIds = classes.map(c => c.id).filter(Boolean);
      if (validIds.length > 0) {
        parts.push(`(${validIds.map(id => `classId != "${id}"`).join(" && ")})`);
      }
    } else if (filterClassId !== "ALL") {
      parts.push(`classId = "${filterClassId}"`);
    }
    if (tableSearch) {
      const q = tableSearch.replace(/"/g, "").slice(0, 64);
      if (q) parts.push(`(name ~ "${q}" || username ~ "${q}")`);
    }
    return parts.join(" && ");
  }, [filterClassId, classes, tableSearch]);

  const fetchIdRef = useRef(0);
  const fetchStudentTable = useCallback(async () => {
    if (!pb) return;
    const fid = ++fetchIdRef.current;
    setTableLoading(true);
    try {
      const sortField = STUDENT_SORT_MAP[tableSort.column] || tableSort.column;
      const res = await pb.collection("students").getList(tablePage, STUDENT_PAGE_SIZE, {
        sort: (tableSort.direction === "desc" ? "-" : "") + sortField,
        filter: buildStudentFilter(),
        fields: STUDENT_LIST_FIELDS,
      });
      const mappedRows = res.items.map(mapStudentRow);
      setTableRows(mappedRows);
      setTableTotal(res.totalItems);
      setTableLoadedOnce(true);
      if (tablePage === 1 && filterClassId === "ALL" && !tableSearch) {
        studentTableCache = {
          rows: mappedRows,
          total: res.totalItems,
        };
      }
    } catch (err) {
      console.error("Gagal memuat daftar siswa:", err);
    } finally {
      if (fetchIdRef.current === fid) setTableLoading(false);
    }
  }, [pb, tablePage, buildStudentFilter, tableSort]);

  // Kembali ke halaman 1 saat filter kelas berubah (search dihandle debounce di atas)
  const handleFilterClassChange = useCallback((v: string) => {
    setFilterClassId(v);
    setTablePage(1);
  }, []);

  useEffect(() => { fetchStudentTable(); }, [fetchStudentTable]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingScores, setIsExportingScores] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [studentForInterest, setStudentForInterest] = useState<StudentData | null>(null);

  const [scoresDialogOpen, setScoresDialogOpen] = useState(false);
  const [studentForScores, setStudentForScores] = useState<StudentData | null>(null);

  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [printCardsOpen, setPrintCardsOpen] = useState(false);
  const [singleStudentForCard, setSingleStudentForCard] = useState<StudentData | null>(null);
  const [isBatchPhotoOpen, setIsBatchPhotoOpen] = useState(false);

  // ── Inspector State & Memo ──
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  const inspectedStudent = useMemo(() => {
    if (inspectedStudentId) {
      const found = tableRows.find(s => s.id === inspectedStudentId);
      if (found) return found;
    }
    return tableRows[0] || null;
  }, [inspectedStudentId, tableRows]);

  const inspectedStudentClass = useMemo(() => {
    if (!inspectedStudent?.classId) return null;
    return classes.find(c => c.id === inspectedStudent.classId);
  }, [inspectedStudent, classes]);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "danger" | "warning" | "info";
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    message: string;
    title: string;
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: "Proses Data",
  });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setAlertDialog({ isOpen: true, title, description, type, onConfirm, showCancel, confirmLabel });
  };

  // ── "Pilih Semua" lintas halaman (server-side pagination) ──
  // Header checkbox tabel hanya mencakup 50 baris yang tampil; tombol ini
  // mengambil SEMUA id siswa yang sesuai filter aktif (hanya field id, ringan).
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [selectAllActive, setSelectAllActive] = useState(false);

  const handleSelectAllFiltered = useCallback(async () => {
    if (!pb) return;
    setSelectAllLoading(true);
    try {
      const recs = await pb.collection("students").getFullList({
        filter: buildStudentFilter(),
        fields: "id",
      });
      setSelectedIds(recs.map((r: any) => r.id));
      setSelectAllActive(true);
    } catch (err) {
      console.error("Gagal memilih semua siswa:", err);
      showAlert("Gagal", "Tidak dapat memuat daftar siswa. Coba lagi.", "danger");
    } finally {
      setSelectAllLoading(false);
    }
  }, [pb, buildStudentFilter]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectAllActive(false);
  }, []);

  // Interaksi manual di tabel (centang per baris / header) membatalkan status "pilih semua"
  const handleTableSelectChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setSelectAllActive(false);
  }, []);

  // Filter/search berubah -> himpunan "semua" tidak lagi valid, reset statusnya
  useEffect(() => {
    setSelectAllActive(false);
  }, [filterClassId, tableSearch, classes]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedStudent(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (student: StudentData) => {
    setDialogMode("edit");
    setSelectedStudent(student);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (student: StudentData) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const handleViewInterest = (student: StudentData) => {
    setStudentForInterest(student);
    setInterestDialogOpen(true);
  };

  const handleViewScores = (student: StudentData) => {
    setStudentForScores(student);
    setScoresDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedStudent(null);
  };

  const handleSubmitStudent = async (values: StudentFormValues) => {
    const quota = school?.student_quota || 250;
    const planName = school?.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : "Free";

    // Cek Batasan Kuota Hanya Jika Menambah Siswa Baru (Bypass jika offline)
    if (dialogMode === "create" && !isOffline) {
      if (studentCount >= quota) {
        return showAlert(
          "Batas Kuota Tercapai",
          `Penambahan tidak dapat diproses. ${terminology.school} Anda telah mencapai batas maksimal kuota (${studentCount}/${quota} ${terminology.student}) pada paket ${planName}. Silakan tingkatkan paket langganan Anda untuk menambah kapasitas.`,
          "warning",
          () => navigate("/admin/invoice"),
          true,
          "Upgrade Paket Sekarang"
        );
      }
    }

    try {
      if (dialogMode === "edit" && selectedStudent) {
        await updateStudent(selectedStudent.id, values);
      } else {
        await createStudent(values);
      }
      closeDialog();
      fetchStudentTable();
    } catch (error) {
      console.error(`Gagal menyimpan data ${terminology.student.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menyimpan data ${terminology.student.toLowerCase()}.`, "danger");
    }
  };

  const handleResetPassword = async (student: StudentData) => {
    showAlert(
      "Reset Password",
      `Apakah Anda yakin ingin mereset password ${terminology.student.toLowerCase()} ${student.name} menjadi default (12345678)? ${terminology.student} akan diminta mengganti password saat login berikutnya.`,
      "warning",
      async () => {
        try {
          await resetStudentPassword(student.id);
          showAlert("Berhasil", `Password ${terminology.student.toLowerCase()} ${student.name} berhasil direset menjadi 12345678.`, "success");
        } catch (error: any) {
          console.error("Gagal mereset password", error);
          const errorMsg = error.data?.message || error.message || `Gagal mereset password ${terminology.student.toLowerCase()}.`;
          showAlert("Gagal", `Gagal mereset password ${terminology.student.toLowerCase()}: ${errorMsg}. Pastikan field 'hasChangedPassword' sudah ada di PocketBase dan Rules Update mengizinkan Admin.`, "danger");
        }
      },
      true,
      "Ya, Reset"
    );
  };

  const handleBatchResetPassword = () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Reset Password ${terminology.student} Terpilih`,
      `Apakah Anda yakin ingin mereset password ${selectedIds.length} ${terminology.student.toLowerCase()} terpilih ke default (12345678)?`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan reset password...",
          title: `Reset Password ${terminology.student} Terpilih`
        });

        try {
          await resetStudentPasswordBatch(selectedIds, (current, total) => {
            setBatchProgress(prev => ({
              ...prev,
              current,
              message: `Mereset password ${terminology.student.toLowerCase()} (${current}/${total})`
            }));
          });
          const count = selectedIds.length;
          setSelectedIds([]);
          showAlert("Berhasil", `Password ${count} ${terminology.student.toLowerCase()} terpilih berhasil direset menjadi 12345678.`, "success");
        } catch (error: any) {
          console.error("Gagal reset password massal", error);
          showAlert("Gagal", error.message || `Gagal mereset password ${terminology.student.toLowerCase()}.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
          fetchStudentTable();
        }
      },
      true,
      "Ya, Reset"
    );
  };

  const handleResetClassPassword = async (classId: string) => {
    if (!pb) return;
    const targetClass = classes.find(c => c.id === classId);
    // Ambil ID siswa kelas ini on-demand (tidak menunggu context 10k)
    let studentIds: string[] = [];
    try {
      const res = await pb.collection("students").getFullList({
        filter: `classId = "${classId}"`,
        fields: "id",
      });
      studentIds = res.map((r: any) => r.id);
    } catch (err) {
      console.error("Gagal mengambil data siswa kelas:", err);
      return showAlert("Gagal", "Gagal mengambil data siswa kelas.", "danger");
    }

    if (studentIds.length === 0) {
      return showAlert("Informasi", `Tidak ada data ${terminology.student.toLowerCase()} di ${terminology.class.toLowerCase()} ${targetClass?.name || ""}.`, "info");
    }

    showAlert(
      `Reset Password ${terminology.class}`,
      `Apakah Anda yakin ingin mereset password ${studentIds.length} ${terminology.student.toLowerCase()} di ${terminology.class.toLowerCase()} ${targetClass?.name || ""} menjadi default (12345678)?`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: studentIds.length,
          current: 0,
          message: `Menyiapkan reset password ${targetClass?.name}...`,
          title: `Reset Password ${terminology.class} ${targetClass?.name}`
        });

        try {
          await resetStudentPasswordBatch(studentIds, (current, total) => {
            setBatchProgress(prev => ({
              ...prev,
              current,
              message: `Mereset password ${terminology.student.toLowerCase()} (${current}/${total})`
            }));
          });
          showAlert("Berhasil", `Password ${studentIds.length} ${terminology.student.toLowerCase()} di ${terminology.class.toLowerCase()} ${targetClass?.name} berhasil direset menjadi 12345678.`, "success");
        } catch (error: any) {
          console.error("Gagal reset password kelas", error);
          showAlert("Gagal", error.message || `Gagal mereset password ${terminology.student.toLowerCase()} kelas.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
          fetchStudentTable();
        }
      },
      true,
      "Ya, Reset Kelas"
    );
  };

  const handleResetAllStudentsPassword = async () => {
    if (!pb) return;
    // Ambil ID semua siswa aktif on-demand (tidak menunggu context 10k)
    let studentIds: string[] = [];
    try {
      const res = await pb.collection("students").getFullList({
        filter: `classId != "ALUMNI"`,
        fields: "id",
      });
      studentIds = res.map((r: any) => r.id);
    } catch (err) {
      console.error("Gagal mengambil data siswa:", err);
      return showAlert("Gagal", "Gagal mengambil data siswa.", "danger");
    }

    if (studentIds.length === 0) {
      return showAlert("Informasi", `Tidak ada ${terminology.student.toLowerCase()} aktif untuk direset.`, "info");
    }

    showAlert(
      `Reset Password SELURUH ${terminology.student}`,
      `⚠️ PERHATIAN! Apakah Anda YAKIN ingin mereset password SELURUH ${studentIds.length} ${terminology.student.toLowerCase()} menjadi default (12345678)?`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: studentIds.length,
          current: 0,
          message: "Menyiapkan reset password seluruh siswa...",
          title: `Reset Password Semua ${terminology.student}`
        });

        try {
          await resetStudentPasswordBatch(studentIds, (current, total) => {
            setBatchProgress(prev => ({
              ...prev,
              current,
              message: `Mereset password ${terminology.student.toLowerCase()} (${current}/${total})`
            }));
          });
          showAlert("Berhasil", `Password SELURUH ${studentIds.length} ${terminology.student.toLowerCase()} berhasil direset menjadi 12345678.`, "success");
        } catch (error: any) {
          console.error("Gagal reset password semua siswa", error);
          showAlert("Gagal", error.message || `Gagal mereset password seluruh ${terminology.student.toLowerCase()}.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
          fetchStudentTable();
        }
      },
      true,
      "Ya, Reset Semua"
    );
  };

  const handleExecuteResetModal = () => {
    setIsResetModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
      // Jika baris terakhir di halaman ini dihapus, mundur ke halaman sebelumnya
      if (tableRows.length <= 1 && tablePage > 1) {
        setTablePage(tablePage - 1);
      } else {
        fetchStudentTable();
      }
    } catch (error) {
      console.error("Gagal menghapus siswa:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleImportStudents = async (file: File) => {
    setIsImporting(true);
    try {
      const { results, skipped } = await parseStudentImportExcel(file, classes);

      if (results.length === 0 && skipped.length === 0) {
        return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      }

      // Pisahkan data yang baru vs data yang sudah ada (untuk update/sinkronisasi profil)
      const existingStudentMap = new Map<string, StudentData>();
      students.forEach(s => {
        if (s.nisn) existingStudentMap.set(String(s.nisn).trim(), s);
        if ((s as any).username) existingStudentMap.set(String((s as any).username).trim(), s);
      });

      const toCreate: typeof results = [];
      const toUpdate: { student: StudentData; row: (typeof results)[0] }[] = [];

      for (const row of results) {
        const found = existingStudentMap.get(String(row.nisn).trim());
        if (found) {
          toUpdate.push({ student: found, row });
        } else {
          toCreate.push(row);
        }
      }

      if (toCreate.length === 0 && toUpdate.length === 0 && skipped.length === 0) {
        return showAlert("Batal", "Tidak ada baris data siswa yang dapat diproses.", "warning");
      }

      // Validasi Kapasitas Kuota SaaS (Hanya dihitung untuk siswa baru)
      if (!isOffline && studentCount + toCreate.length > quota) {
        return showAlert(
          "Melebihi Kuota Langganan",
          `Gagal mengimpor data. Anda mencoba menambahkan ${toCreate.length} ${terminology.student.toLowerCase()} baru, tapi sisa kuota paket ${planName} Anda tinggal ${Math.max(0, quota - studentCount)} ${terminology.student.toLowerCase()} (Batas maksimal: ${quota}). Silakan sesuaikan file Excel Anda atau tingkatkan paket langganan institusi.`,
          "danger",
          () => navigate("/admin/invoice"),
          true,
          "Upgrade Paket Sekarang"
        );
      }

      const totalOperations = toCreate.length + toUpdate.length;
      setBatchProgress({
        isOpen: true,
        total: totalOperations,
        current: 0,
        message: "Memulai proses import & sinkronisasi data...",
        title: `Import & Update ${terminology.student}`
      });

      const failures: string[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      // 1. Eksekusi Batch Update untuk siswa lama yang sudah terdaftar
      const chunkSize = 10;
      for (let i = 0; i < toUpdate.length; i += chunkSize) {
        const chunk = toUpdate.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            const updatePayload: any = {};
            if (item.row.name) updatePayload.name = item.row.name;
            if (item.row.classId) updatePayload.classId = item.row.classId;
            if (item.row.gender) updatePayload.gender = item.row.gender;
            if (item.row.birthPlace !== undefined) updatePayload.birthPlace = item.row.birthPlace;
            if (item.row.birthDate !== undefined) updatePayload.birthDate = item.row.birthDate;
            if (item.row.room !== undefined) updatePayload.room = item.row.room;
            if (item.row.session !== undefined) updatePayload.session = item.row.session;
            if (item.row.examNumber !== undefined) updatePayload.examNumber = item.row.examNumber;

            await updateStudent(item.student.id, updatePayload);
            updatedCount++;
          } catch (err: any) {
            console.error(`Gagal update profil ${item.row.name} (${item.row.nisn}):`, err);
            failures.push(`Update: ${item.row.name} (${item.row.nisn}) - ${err.message || "Error Database"}`);
          }
        }));

        const currentProcessed = Math.min(i + chunkSize, toUpdate.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Memperbarui profil ${currentProcessed}/${totalOperations}...`
        }));
      }

      // 2. Eksekusi Create untuk siswa baru
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (row) => {
          try {
            await createStudent({
              nisn: String(row.nisn),
              name: row.name,
              gender: row.gender,
              classId: row.classId,
              birthPlace: (row as any).birthPlace || "",
              birthDate: (row as any).birthDate || "",
              room: (row as any).room || "",
              session: (row as any).session || "",
              examNumber: (row as any).examNumber || "",
            });
            createdCount++;
          } catch (err: any) {
            console.error(`Gagal import ${terminology.student.toLowerCase()} baru ${row.nisn}:`, err);
            failures.push(`Baru: ${row.name} (${row.nisn}) - ${err.message || "Error Database"}`);
          }
        }));

        const currentProcessed = toUpdate.length + Math.min(i + chunkSize, toCreate.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Menambahkan siswa baru ${currentProcessed}/${totalOperations}...`
        }));
      }

      let message = `Sinkronisasi Excel Berhasil:`;
      if (updatedCount > 0) {
        message += `\n• ${updatedCount} ${terminology.student.toLowerCase()} lama berhasil diperbarui data profilnya (Jenis Kelamin, Tempat/Tgl Lahir, Ruang/Sesi).`;
      }
      if (createdCount > 0) {
        message += `\n• ${createdCount} ${terminology.student.toLowerCase()} baru berhasil ditambahkan ke database.`;
      }

      if (skipped.length > 0) {
        const uniqueSkipped = Array.from(new Set(skipped.map(s => s.className)));
        message += `\n\n⚠️ ${skipped.length} baris dilewati karena Nama Kelas [${uniqueSkipped.join(", ")}] tidak ditemukan.`;
      }

      if (failures.length > 0) {
        message += `\n\n❌ ${failures.length} data gagal disimpan ke database:\n- ${failures.slice(0, 5).join("\n- ")}${failures.length > 5 ? "\n...dan " + (failures.length - 5) + " lainnya" : ""}`;
      }

      showAlert("Hasil Import & Sinkronisasi", message, (skipped.length > 0 || failures.length > 0) ? "warning" : "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || `Gagal mengimport data ${terminology.student}.`, "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
      fetchStudentTable();
    }
  };

  // Ambil SEMUA siswa sesuai filter tabel saat ini (untuk export) — on demand, field ringan.
  const fetchAllFilteredStudents = useCallback(async (): Promise<StudentData[]> => {
    if (!pb) return [];
    const res = await pb.collection("students").getFullList({
      sort: "name",
      filter: buildStudentFilter(),
      fields: STUDENT_LIST_FIELDS,
    });
    return res.map(mapStudentRow);
  }, [pb, buildStudentFilter]);

  const handleExportStudents = async () => {
    const all = await fetchAllFilteredStudents();
    exportStudentToExcel({ students: all, classes, filename: `data-${terminology.student.toLowerCase()}.xlsx`, terminology });
  };

  const handleExportStudentLogins = async () => {
    const all = await fetchAllFilteredStudents();
    exportStudentLoginsToExcel({ students: all, classes, filename: `data-login-${terminology.student.toLowerCase()}.xlsx`, terminology });
  };

  const handleExportAllScores = async () => {
    if (!pb) return;
    setIsExportingScores(true);
    try {
      const all = await fetchAllFilteredStudents();
      await exportAllStudentScores({
        pb,
        students: all,
        classes,
        terminology,
        filename: `rekap-nilai-semua-${terminology.student.toLowerCase()}.xlsx`,
      });
    } catch (err: any) {
      showAlert("Gagal Export", err.message || "Gagal mengekspor data nilai.", "danger");
    } finally {
      setIsExportingScores(false);
    }
  };

  const defaultValues = useMemo(() =>
    selectedStudent ? {
      nisn: selectedStudent.nisn,
      name: selectedStudent.name,
      gender: selectedStudent.gender,
      classId: selectedStudent.classId,
      photo: selectedStudent.photo || "",
      birthPlace: selectedStudent.birthPlace || "",
      birthDate: selectedStudent.birthDate || "",
      room: selectedStudent.room || "",
      session: selectedStudent.session || "",
      examNumber: selectedStudent.examNumber || "",
    } : { 
      nisn: "", 
      name: "", 
      gender: "L" as const, 
      classId: "",
      photo: "",
      birthPlace: "",
      birthDate: "",
      room: "",
      session: "",
      examNumber: "",
    },
    [selectedStudent]);

  const { updateStudentClassBatch, deleteStudentsBatch } = useExamData();

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleBatchUpdateClass = async () => {
    if (!targetClassId || selectedIds.length === 0) return;
    setIsBatchOpen(false);

    setBatchProgress({
      isOpen: true,
      total: selectedIds.length,
      current: 0,
      message: "Menyiapkan pemindahan kelas...",
      title: `{terminology.class} Pindah Massal`
    });

    try {
      const chunkSize = 10;
      for (let i = 0; i < selectedIds.length; i += chunkSize) {
        const chunk = selectedIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => updateStudent(id, { classId: targetClassId })));

        const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Memindahkan ${terminology.student.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
        }));
      }
      setSelectedIds([]);
      setTargetClassId("");
    } catch (error) {
      console.error("Gagal memindahkan siswa", error);
      showAlert("Gagal", `Gagal memindahkan ${terminology.student.toLowerCase()}.`, "danger");
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
      fetchStudentTable();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Hapus ${terminology.student} Massal`,
      `Apakah Anda yakin ingin menghapus {selectedIds.length} {terminology.student.toLowerCase()} terpilih?`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan penghapusan...",
          title: `Hapus ${terminology.student} Massal`
        });

        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await deleteStudentsBatch(chunk);

            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Menghapus data ${terminology.student.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal menghapus siswa massal", error);
          showAlert("Gagal", `Gagal menghapus ${terminology.student.toLowerCase()} massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
          fetchStudentTable();
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const handleMoveToAlumni = () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Pindahkan ke Alumni`,
      `Pindahkan ${selectedIds.length} ${terminology.student.toLowerCase()} terpilih ke status Alumni?`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Memproses...",
          title: `Luluskan ${terminology.student}`
        });

        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => updateStudent(id, { classId: "ALUMNI" })));

            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Memproses ${terminology.student.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal memindahkan ke alumni", error);
          showAlert("Gagal", "Gagal memindahkan ke alumni.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
          fetchStudentTable();
        }
      },
      true,
      "Ya, Pindahkan"
    );
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <input
        id="student-import-input"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportStudents(file);
          }
          e.target.value = "";
        }}
      />
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Daftar {terminology.student}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">{schoolSlug}</span>
              <span>/</span>
              <span className="text-neutral-500 dark:text-neutral-400">master-data</span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">student</span>
            </div>
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-2.5">
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </>
            ) : (
              <>
                {selectedIds.length > 0 && role === "admin" && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Users2 className="h-3.5 w-3.5" />
                          <span>Aksi ({selectedIds.length})</span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2.5 py-1.5 text-left">Opsi Massal</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => setTimeout(() => setIsBatchOpen(true), 150)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <ArrowLeftRight className="h-4 w-4 text-orange-600 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Pindah {terminology.class}</span>
                            <span className="text-[10px] text-neutral-400">Pindahkan ke {terminology.class.toLowerCase()} lain</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setTimeout(handleMoveToAlumni, 150)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Luluskan (Alumni)</span>
                            <span className="text-[10px] text-neutral-400">Pindahkan ke daftar alumni</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setTimeout(handleBatchResetPassword, 150)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Reset Password</span>
                            <span className="text-[10px] text-neutral-400">Reset {selectedIds.length} terpilih</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setSingleStudentForCard(null);
                            setPrintCardsOpen(true);
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <Printer className="h-4 w-4 text-sky-600 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Cetak Kartu ({selectedIds.length})</span>
                            <span className="text-[10px] text-neutral-400">Kartu ujian terpilih</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />

                        <DropdownMenuItem
                          onClick={() => setTimeout(handleBatchDelete, 150)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold">Hapus Terpilih</span>
                            <span className="text-[10px] opacity-70">Hapus permanen {selectedIds.length} data</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      onClick={handleBatchDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus ({selectedIds.length})</span>
                    </Button>
                  </div>
                )}

                {role === "admin" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>Opsi Data</span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2.5 py-1.5 text-left">Kelola {terminology.student}</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        onClick={() => {
                          const input = document.getElementById("student-import-input") as HTMLInputElement;
                          if (input) input.click();
                        }}
                      >
                        <Upload className="h-4 w-4 text-indigo-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {isImporting ? "Mengimport..." : "Import dari Excel"}
                          </span>
                          <span className="text-[10px] text-neutral-400">Unggah file data aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportStudents()}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Download className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export ke Excel</span>
                          <span className="text-[10px] text-neutral-400">Unduh data aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportStudentLogins()}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export Akun Login</span>
                          <span className="text-[10px] text-neutral-400">Username & password</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsResetModalOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <KeyRound className="h-4 w-4 text-rose-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Reset Password Massal</span>
                          <span className="text-[10px] text-neutral-400">Per kelas atau seluruh siswa</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                      <DropdownMenuItem
                        onClick={isExportingScores ? undefined : handleExportAllScores}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          isExportingScores && "opacity-50 pointer-events-none"
                        )}
                      >
                        {isExportingScores ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" /> : <BarChart2 className="h-4 w-4 text-blue-600 shrink-0" />}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {isExportingScores ? "Mengekspor..." : "Export Nilai per Mapel"}
                          </span>
                          <span className="text-[10px] text-neutral-400">Rekap nilai siswa</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSingleStudentForCard(null);
                          setPrintCardsOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Printer className="h-4 w-4 text-sky-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Cetak Kartu Ujian</span>
                          <span className="text-[10px] text-neutral-400">Format ANBK / TKA</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsBatchPhotoOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Camera className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Upload Foto Massal</span>
                          <span className="text-[10px] text-neutral-400">File ZIP / NISN</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => downloadStudentImportTemplate(terminology)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-neutral-500 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Unduh Template</span>
                          <span className="text-[10px] text-neutral-400">Format import Excel</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {role === "admin" && (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={handleCreateClick}
                        size="sm"
                        className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah {terminology.student}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
                      <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-white">
                          {dialogMode === "edit" ? `Edit Data ${terminology.student}` : `Tambah Data ${terminology.student}`}
                        </DialogTitle>
                      </DialogHeader>
                      <StudentForm
                        classes={classes}
                        defaultValues={defaultValues}
                        onSubmit={handleSubmitStudent}
                        submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                        onCancel={() => setIsDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Top Stats Strip (4 Kartu Ringkas) ── */}
        <NeonStatGrid cols={4}>
          <NeonStatCard
            label={`Total ${terminology.student} Aktif`}
            value={studentCount.toLocaleString("id-ID")}
            unit="siswa"
            subText={isOffline ? "Server mandiri offline" : `Kuota: ${quota.toLocaleString("id-ID")} siswa`}
            isLoading={loading}
          />
          <NeonStatCard
            label={`Total ${terminology.class}`}
            value={String(classes.length)}
            unit="kelas"
            subText="Kelompok rombel aktif"
            isLoading={loading}
          />
          <NeonStatCard
            label="Kapasitas Kuota"
            value={isOffline ? "100%" : `${quotaUsedPercent}%`}
            unit={isOffline ? "mandiri" : "terpakai"}
            subText={isOffline ? "Unlimited tanpa batas" : `${Math.max(0, quota - studentCount).toLocaleString("id-ID")} slot tersisa`}
            isLoading={loading}
          />
          <NeonStatCard
            label={`Siswa per ${terminology.class}`}
            value={classes.length > 0 ? String(Math.round(studentCount / classes.length)) : "0"}
            unit="rata-rata"
            subText="Distribusi per rombel"
            isLoading={loading}
          />
        </NeonStatGrid>

        {/* Mobile: baris tombol ringkas — 1 tombol primary + menu ⋯ */}
        <div className="flex sm:hidden items-center gap-2 w-full">
          {loading ? (
            <>
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 w-10 rounded-lg" />
            </>
          ) : (
            <>
              {role === "admin" && (
                <Button
                  onClick={handleCreateClick}
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah {terminology.student}</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-9 px-0 rounded-lg border-neutral-200 dark:border-neutral-750" aria-label="Menu aksi">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2.5 py-1.5 text-left">Menu Aksi</DropdownMenuLabel>
                  {role === "admin" && (
                    <>
                      <DropdownMenuItem
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        onClick={() => {
                          const input = document.getElementById("student-import-input") as HTMLInputElement;
                          if (input) input.click();
                        }}
                      >
                        <Upload className="h-4 w-4 text-indigo-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {isImporting ? "Mengimport..." : "Import dari Excel"}
                          </span>
                          <span className="text-[10px] text-neutral-400">Unggah file data aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportStudents()}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Download className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export ke Excel</span>
                          <span className="text-[10px] text-neutral-400">Unduh data aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportStudentLogins()}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export Akun Login</span>
                          <span className="text-[10px] text-neutral-400">Username & password</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => downloadStudentImportTemplate(terminology)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-neutral-500 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Unduh Template</span>
                          <span className="text-[10px] text-neutral-400">Format file import Excel</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                      <DropdownMenuItem
                        onClick={isExportingScores ? undefined : handleExportAllScores}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          isExportingScores && "opacity-50 pointer-events-none"
                        )}
                      >
                        {isExportingScores ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" /> : <BarChart2 className="h-4 w-4 text-blue-600 shrink-0" />}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {isExportingScores ? "Mengekspor..." : "Export Nilai per Mapel"}
                          </span>
                          <span className="text-[10px] text-neutral-400">Rekap nilai siswa</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                      <DropdownMenuItem
                        onClick={() => setIsBatchPhotoOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Camera className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Upload Foto Massal</span>
                          <span className="text-[10px] text-neutral-400">File ZIP / NISN</span>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setSingleStudentForCard(null);
                      setPrintCardsOpen(true);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Printer className="h-4 w-4 text-sky-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Cetak Kartu Ujian</span>
                      <span className="text-[10px] text-neutral-400">Format ANBK / TKA</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

      {/* ── Indikator Kuota Siswa ── */}
      {isOffline ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                Server Mandiri Offline: Tanpa Batas Kuota {terminology.student}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Saat ini terdapat <strong>{studentCount}</strong> {terminology.student.toLowerCase()} terdaftar. Anda dapat menambahkan data siswa sebanyak kapasitas server lokal.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs self-start sm:self-auto">
            Unlimited Siswa
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all text-xs shadow-xs",
          isQuotaFull
            ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
            : isQuotaWarning
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
              : "bg-card border-slate-200/60 dark:border-slate-800/40 text-slate-700 dark:text-slate-300"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white">
                  Kapasitas Kuota {terminology.student}: {studentCount} / {quota} Terdaftar
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                  isQuotaFull
                    ? "bg-rose-200/80 border-rose-300 text-rose-800 dark:bg-rose-900/60 dark:border-rose-800 dark:text-rose-200"
                    : isQuotaWarning
                      ? "bg-amber-200/80 border-amber-300 text-amber-800 dark:bg-amber-900/60 dark:border-amber-800 dark:text-amber-200"
                      : "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300"
                )}>
                  {quotaUsedPercent}% Terpakai
                </span>
                {school?.plan === "free" && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold">
                    Free Trial (Maks. 50)
                  </span>
                )}
              </div>
              <div className="w-56 sm:w-80 h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    isQuotaFull ? "bg-rose-600" : isQuotaWarning ? "bg-amber-500" : "bg-blue-600"
                  )}
                  style={{ width: `${quotaUsedPercent}%` }}
                />
              </div>
            </div>
          </div>

          {role === "admin" && (
            <button
              onClick={() => navigate("/admin/invoice")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs transition shadow-xs self-start sm:self-auto flex items-center gap-1.5 flex-shrink-0",
                isQuotaFull || isQuotaWarning
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
              )}
            >
              <Sparkles size={13} />
              <span>{isQuotaFull ? "Upgrade Kuota Sekarang" : "Tingkatkan Kuota"}</span>
            </button>
          )}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 px-4 py-2.5 text-xs text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold text-neutral-800 dark:text-neutral-100">
            {selectAllActive
              ? `${selectedIds.length.toLocaleString("id-ID")} siswa terpilih (semua sesuai filter)`
              : `${selectedIds.length} siswa terpilih di halaman ini`}
          </span>
          <div className="flex items-center gap-2">
            {!selectAllActive && (
              <button
                onClick={handleSelectAllFiltered}
                disabled={selectAllLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition-all cursor-pointer shadow-xs"
              >
                {selectAllLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>
                  {selectAllLoading
                    ? "Memuat..."
                    : `Pilih semua ${(tableTotal ?? 0).toLocaleString("id-ID")} siswa`}
                </span>
              </button>
            )}
            <button
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all cursor-pointer"
            >
              Batalkan pilihan
            </button>
          </div>
        </div>
      )}

        {/* ── Main Content Grid: Table + Right Inspector ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0 space-y-6">
            <StudentTable
              students={tableRows}
              classes={classes}
              selectedIds={selectedIds}
              onSelectChange={handleTableSelectChange}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onResetPassword={role === "admin" ? handleResetPassword : undefined}
              onViewInterest={handleViewInterest}
              onViewScores={handleViewScores}
              onPrintExamCard={(student) => {
                setSingleStudentForCard(student);
                setPrintCardsOpen(true);
              }}
              serverSide
              serverTotalItems={tableTotal ?? 0}
              serverCurrentPage={tablePage}
              serverPageSize={STUDENT_PAGE_SIZE}
              onServerPageChange={setTablePage}
              serverSearchTerm={tableSearchInput}
              onServerSearchChange={setTableSearchInput}
              serverSortColumn={tableSort.column}
              serverSortDirection={tableSort.direction}
              onServerSortChange={(column, direction) => { setTableSort({ column, direction }); setTablePage(1); }}
              tableLoading={!tableLoadedOnce ? (loading || tableLoading) : tableLoading}
              activeKey={inspectedStudent?.id}
              onRowClick={(student) => setInspectedStudentId(student.id)}
              filterActions={
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider hidden sm:inline">{terminology.class}:</span>
                  <select
                    value={filterClassId}
                    onChange={(e) => handleFilterClassChange(e.target.value)}
                    className="h-8 min-w-[140px] text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    <option value="ALL">Semua {terminology.class}</option>
                    <option value="NONE">Tanpa {terminology.class}</option>
                    <optgroup label={`Daftar ${terminology.class}`}>
                      {sortedClasses.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              }
            />
          </div>

          {/* ── Right Sidebar / Inspector Panel ── */}
          <NeonInspector>
            <InspectorSection>
              <InspectorHeader
                title={`Detail ${terminology.student}`}
                icon={User}
                badge={inspectedStudent ? "Terpilih" : "Ringkasan"}
              />

              {inspectedStudent ? (
                <div className="space-y-3.5 text-xs">
                  {/* Student Profile Card */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border",
                      inspectedStudent.gender === "P"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    )}>
                      {inspectedStudent.name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {inspectedStudent.name}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                        NISN: {inspectedStudent.nisn}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {inspectedStudentClass?.name || "Tanpa Rombel"}
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                          inspectedStudent.gender === "P"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        )}>
                          {inspectedStudent.gender === "P" ? "Perempuan" : "Laki-laki"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <InspectorGrid>
                    <InspectorField
                      label="No. Peserta"
                      value={inspectedStudent.examNumber || inspectedStudent.nisn || "-"}
                    />
                    <InspectorField
                      label="Tempat, Tgl Lahir"
                      value={
                        inspectedStudent.birthPlace || inspectedStudent.birthDate
                          ? `${inspectedStudent.birthPlace || "-"}, ${inspectedStudent.birthDate || "-"}`
                          : "-"
                      }
                    />
                  </InspectorGrid>

                  <InspectorField label="Status Sandi Akun">
                    {inspectedStudent.resetRequested ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Minta Reset Sandi
                      </span>
                    ) : inspectedStudent.hasChangedPassword ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Sudah Diubah Siswa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Default (12345678)
                      </span>
                    )}
                  </InspectorField>

                  <InspectorActions>
                    {role === "admin" && (
                      <InspectorButton
                        variant="primary"
                        icon={Edit}
                        onClick={() => handleEditClick(inspectedStudent)}
                      >
                        Edit {terminology.student}
                      </InspectorButton>
                    )}
                    {role === "admin" && (
                      <InspectorButton
                        variant="secondary"
                        icon={KeyRound}
                        onClick={() => handleResetPassword(inspectedStudent)}
                      >
                        Reset Password
                      </InspectorButton>
                    )}
                    <InspectorButton
                      variant="secondary"
                      icon={Printer}
                      onClick={() => {
                        setSingleStudentForCard(inspectedStudent);
                        setPrintCardsOpen(true);
                      }}
                    >
                      Cetak Kartu Ujian
                    </InspectorButton>
                    <InspectorButton
                      variant="secondary"
                      icon={BarChart2}
                      onClick={() => handleViewScores(inspectedStudent)}
                    >
                      Lihat Nilai Ujian
                    </InspectorButton>
                    <InspectorButton
                      variant="secondary"
                      icon={ClipboardList}
                      onClick={() => handleViewInterest(inspectedStudent)}
                    >
                      Bakat & Minat
                    </InspectorButton>
                    {role === "admin" && (
                      <InspectorButton
                        variant="danger"
                        icon={Trash}
                        onClick={() => handleDeleteClick(inspectedStudent)}
                      >
                        Hapus {terminology.student}
                      </InspectorButton>
                    )}
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty
                  icon={User}
                  title={`Pilih ${terminology.student}`}
                  description={`Klik salah satu baris ${terminology.student.toLowerCase()} di tabel untuk melihat profil lengkap, status password, dan aksi langsung.`}
                />
              )}
            </InspectorSection>

            <InspectorSection divided>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/40 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Tips Pengelolaan Siswa</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Username default siswa adalah NISN. Sandi awal: <code className="text-emerald-600 dark:text-emerald-400 font-mono">12345678</code>. Siswa dapat langsung mengikuti ujian setelah ruang diaktifkan.
                </p>
              </div>
            </InspectorSection>
          </NeonInspector>
        </div>

      <ConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        type="danger"
        title={`Hapus ${terminology.student}`}
        description={`Apakah Anda yakin ingin menghapus data ${terminology.student.toLowerCase()} "${studentToDelete?.name || ""}"? Riwayat ujian ${terminology.student.toLowerCase()} ini juga mungkin tidak akan terbaca dengan benar.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        onConfirm={() => {
          if (alertDialog.onConfirm) alertDialog.onConfirm();
          setAlertDialog({ ...alertDialog, isOpen: false });
        }}
        title={alertDialog.title}
        description={alertDialog.description}
        type={alertDialog.type}
        confirmLabel={alertDialog.confirmLabel || "OK"}
        showCancel={alertDialog.showCancel}
      />

      <BatchClassMoveDialog
        isOpen={isBatchOpen}
        onOpenChange={setIsBatchOpen}
        selectedCount={selectedIds.length}
        classes={sortedClasses}
        targetClassId={targetClassId}
        onTargetClassChange={setTargetClassId}
        onSubmit={handleBatchUpdateClass}
      />

      <ResetStudentPasswordDialog
        isOpen={isResetModalOpen}
        onOpenChange={setIsResetModalOpen}
        selectedCount={selectedIds.length}
        classes={sortedClasses}
        students={students}
        onConfirmReset={(scope, selectedClassId) => {
          if (scope === "selected") {
            handleBatchResetPassword();
          } else if (scope === "class" && selectedClassId) {
            handleResetClassPassword(selectedClassId);
          } else if (scope === "all") {
            handleResetAllStudentsPassword();
          }
        }}
      />

      <BatchProgressDialog progress={batchProgress} />

      <StudentInterestDialog
        isOpen={interestDialogOpen}
        onClose={() => {
          setInterestDialogOpen(false);
          setStudentForInterest(null);
        }}
        studentId={studentForInterest?.id || ""}
        studentName={studentForInterest?.name || ""}
      />

      <StudentScoresDialog
        isOpen={scoresDialogOpen}
        onClose={() => {
          setScoresDialogOpen(false);
          setStudentForScores(null);
        }}
        studentId={studentForScores?.id || ""}
        studentName={studentForScores?.name || ""}
      />

      <PrintExamCardsDialog
        isOpen={printCardsOpen}
        onClose={() => {
          setPrintCardsOpen(false);
          setSingleStudentForCard(null);
        }}
        students={students}
        classes={classes}
        selectedStudentIds={singleStudentForCard ? [singleStudentForCard.id] : selectedIds}
        filterClassId={filterClassId}
      />

      <BatchStudentPhotoDialog
        isOpen={isBatchPhotoOpen}
        onClose={() => setIsBatchPhotoOpen(false)}
        students={students}
        classes={classes}
        onUpdateStudent={updateStudent}
        onSuccess={(count) => {
          showAlert(
            "Foto Diperbarui",
            `Berhasil memasang ${count} pas foto siswa ke database. Foto siap dicetak di Kartu Ujian.`,
            "success"
          );
          fetchStudentTable();
        }}
      />
      </div>
    </div>
  );
};

export default StudentsPage;

