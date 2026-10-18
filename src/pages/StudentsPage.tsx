import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  MoreHorizontal
} from "lucide-react";
import { cn } from "../lib/utils";
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

  // Filter kelas (dipakai tabel server-side & dialog) — dideklarasikan di sini
  // agar bisa dipakai oleh buildStudentFilter di bawah.
  const [filterClassId, setFilterClassId] = useState<string>("ALL");

  // ── Server-side pagination untuk tabel siswa ──
  // Tabel TIDAK menunggu context memuat 10k siswa; fetch 50/page langsung dari server.
  const STUDENT_PAGE_SIZE = 50;
  const STUDENT_LIST_FIELDS =
    "id,username,name,email,emailVisibility,verified,classId,gender,birthPlace,birthDate,examNumber,room,session,photo,hasChangedPassword,created,updated";
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
    <>
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
      <div className="space-y-5">
        <div className="relative z-30 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
            Manajemen {terminology.student} Aktif
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar {terminology.student} aktif dan penempatan {terminology.class.toLowerCase()}.</p>
        </div>
        <div className="hidden sm:flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {loading ? (
            <>
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </>
          ) : (
            <>
              {selectedIds.length > 0 && role === "admin" && (
                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border dark:border-indigo-800/40 text-white h-9 text-xs rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        <Users2 className="mr-1.5 h-3.5 w-3.5" />
                        Aksi ({selectedIds.length})
                        <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2">Opsi Massal</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => setTimeout(() => setIsBatchOpen(true), 150)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ArrowLeftRight className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Pindah {terminology.class}</span>
                          <span className="text-[10px] text-slate-400 mt-1">Pindahkan ke {terminology.class.toLowerCase()} lain</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setTimeout(handleMoveToAlumni, 150)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Check className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Luluskan (Alumni)</span>
                          <span className="text-[10px] text-slate-400 mt-1">Pindahkan ke daftar alumni</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setTimeout(handleBatchResetPassword, 150)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <KeyRound className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Reset Password</span>
                          <span className="text-[10px] text-slate-400 mt-1">Reset password {selectedIds.length} {terminology.student.toLowerCase()} terpilih</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          setSingleStudentForCard(null);
                          setPrintCardsOpen(true);
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Printer className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Cetak Kartu ({selectedIds.length})</span>
                          <span className="text-[10px] text-slate-400 mt-1">Cetak kartu ujian ANBK {selectedIds.length} siswa terpilih</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="default"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/40 text-white h-9 text-xs rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all font-bold"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Hapus ({selectedIds.length})
                  </Button>
                </div>
              )}

              {role === "admin" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="softSuccess" size="sm" className="rounded-xl font-bold shadow-sm transition-all h-9 px-3.5">
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                      Opsi Data
                      <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Kelola {terminology.student}</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      onClick={() => {
                        const input = document.getElementById("student-import-input") as HTMLInputElement;
                        if (input) {
                          input.click();
                        }
                      }}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                          {isImporting ? "Mengimport..." : "Import dari Excel"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Unggah file data {terminology.student.toLowerCase()} aktif</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExportStudents()}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Download className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export ke Excel</span>
                        <span className="text-[10px] text-slate-400 mt-1">Unduh data {terminology.student.toLowerCase()} aktif</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExportStudentLogins()}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export Akun Login</span>
                        <span className="text-[10px] text-slate-400 mt-1">Unduh username & password {terminology.student.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setIsResetModalOpen(true);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Reset Password Massal</span>
                        <span className="text-[10px] text-slate-400 mt-1">Reset password per kelas atau seluruh {terminology.student.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                    <DropdownMenuItem
                      onClick={isExportingScores ? undefined : handleExportAllScores}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group ${isExportingScores ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {isExportingScores ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart2 className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                          {isExportingScores ? "Mengekspor..." : "Export Nilai per Mapel"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Rekap nilai semua {terminology.student.toLowerCase()} per mata pelajaran & ruang</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                    <DropdownMenuItem
                      onClick={() => {
                        setSingleStudentForCard(null);
                        setPrintCardsOpen(true);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Printer className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Cetak Kartu Ujian (ANBK)</span>
                        <span className="text-[10px] text-slate-400 mt-1">Format kartu login resmi ANBK / TKA</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsBatchPhotoOpen(true)}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Upload Foto Massal</span>
                        <span className="text-[10px] text-slate-400 mt-1">Unggah pas foto banyak siswa via ZIP / file NISN</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => downloadStudentImportTemplate(terminology)}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Unduh Template</span>
                        <span className="text-[10px] text-slate-400 mt-1">Format file import Excel {terminology.student.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {role === "admin" && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleCreateClick} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 active:bg-blue-50 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/30 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Tambah {terminology.student}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? `Edit Data ${terminology.student}` : `Tambah Data ${terminology.student}`}</DialogTitle>
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

        {/* Mobile: baris tombol ringkas — 1 tombol primary + menu ⋯ */}
        <div className="flex sm:hidden items-center gap-2 w-full">
          {loading ? (
            <>
              <Skeleton className="h-9 flex-1 rounded-2xl" />
              <Skeleton className="h-9 w-11 rounded-2xl" />
            </>
          ) : (
            <>
              {role === "admin" && (
                <Button
                  onClick={handleCreateClick}
                  size="sm"
                  className="flex-1 rounded-2xl bg-blue-50 hover:bg-blue-100 active:bg-blue-50 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/30 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Tambah {terminology.student}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-2xl h-9 w-11 px-0" aria-label="Menu aksi">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Menu Aksi</DropdownMenuLabel>
                  {role === "admin" && (
                    <>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                        onClick={() => {
                          const input = document.getElementById("student-import-input") as HTMLInputElement;
                          if (input) {
                            input.click();
                          }
                        }}
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                            {isImporting ? "Mengimport..." : "Import dari Excel"}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">Unggah file data {terminology.student.toLowerCase()} aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportStudents()}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Download className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export ke Excel</span>
                          <span className="text-[10px] text-slate-400 mt-1">Unduh data {terminology.student.toLowerCase()} aktif</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => downloadStudentImportTemplate(terminology)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Unduh Template</span>
                          <span className="text-[10px] text-slate-400 mt-1">Format file import Excel {terminology.student.toLowerCase()}</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                      <DropdownMenuItem
                        onClick={isExportingScores ? undefined : handleExportAllScores}
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group ${isExportingScores ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          {isExportingScores ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart2 className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                            {isExportingScores ? "Mengekspor..." : "Export Nilai per Mapel"}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">Rekap nilai semua {terminology.student.toLowerCase()} per mata pelajaran & ruang</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                      <DropdownMenuItem
                        onClick={() => setIsBatchPhotoOpen(true)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Camera className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Upload Foto Massal</span>
                          <span className="text-[10px] text-slate-400 mt-1">Unggah pas foto banyak siswa via ZIP / file NISN</span>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setSingleStudentForCard(null);
                      setPrintCardsOpen(true);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Printer className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Cetak Kartu Ujian</span>
                      <span className="text-[10px] text-slate-400 mt-1">Format kartu login resmi ANBK / TKA</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
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

      {(!tableLoadedOnce && (loading || tableLoading)) ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Daftar {terminology.student}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-[40px] text-center">
                      <div className="h-4 w-4 border border-slate-300 rounded mx-auto" />
                    </TableHead>
                    <TableHead className="w-[60px] text-center">No</TableHead>
                    <TableHead>{terminology.id}</TableHead>
                    <TableHead>Nama {terminology.student}</TableHead>
                    <TableHead className="w-[60px] text-center">L/P</TableHead>
                    <TableHead>{terminology.class}</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-800/40 dark:bg-blue-950/30">
              <span className="font-semibold text-blue-800 dark:text-blue-300">
                {selectAllActive
                  ? `${selectedIds.length.toLocaleString("id-ID")} siswa terpilih (semua yang sesuai filter)`
                  : `${selectedIds.length} siswa terpilih di halaman ini`}
              </span>
              <div className="flex items-center gap-2">
                {!selectAllActive && (
                  <button
                    onClick={handleSelectAllFiltered}
                    disabled={selectAllLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-95"
                  >
                    {selectAllLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {selectAllLoading
                      ? "Memuat..."
                      : `Pilih semua ${(tableTotal ?? 0).toLocaleString("id-ID")} siswa`}
                  </button>
                )}
                <button
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-blue-100 dark:text-slate-300 dark:hover:bg-blue-900/40 transition-all"
                >
                  Batalkan pilihan
                </button>
              </div>
            </div>
          )}
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
          tableLoading={tableLoading}
          filterActions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">{terminology.class}:</span>
              <select
                value={filterClassId}
                onChange={(e) => handleFilterClassChange(e.target.value)}
                className="h-9 min-w-[140px] rounded-xl border border-slate-200 bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer dark:border-slate-800"
              >
                <option value="ALL">Semua {terminology.class}</option>
                <option value="NONE">Tanpa {terminology.class}</option>
                <optgroup label={`Daftar {terminology.class}`}>
                  {sortedClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          }
        />
        </>
      )}

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
    </>
  );
};

export default StudentsPage;

