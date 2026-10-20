import { useState, useMemo } from "react";
import { NeonTable, type NeonTableColumn } from "../ui/NeonTable";
import type { StudentData, ClassData } from "../../types/exam";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { Edit, Trash, Sparkles, KeyRound, ClipboardList, Printer, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

interface StudentTableProps {
  students: StudentData[];
  classes: ClassData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (student: StudentData) => void;
  onDelete: (student: StudentData) => void;
  onResetPassword?: (student: StudentData) => void;
  onViewInterest?: (student: StudentData) => void;
  onViewScores?: (student: StudentData) => void;
  onPrintExamCard?: (student: StudentData) => void;
  filterActions?: React.ReactNode;
  customActions?: (student: StudentData) => React.ReactNode;
  // ── Mode server-side ──
  serverSide?: boolean;
  serverTotalItems?: number;
  serverCurrentPage?: number;
  serverPageSize?: number;
  onServerPageChange?: (page: number) => void;
  onServerPageSizeChange?: (size: number) => void;
  serverSearchTerm?: string;
  onServerSearchChange?: (term: string) => void;
  serverSortColumn?: string | null;
  serverSortDirection?: "asc" | "desc";
  onServerSortChange?: (column: string, direction: "asc" | "desc") => void;
  tableLoading?: boolean;
  activeKey?: string;
  onRowClick?: (student: StudentData) => void;
}

export const StudentTable = ({ 
  students, 
  classes,
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  onResetPassword,
  onViewInterest,
  onViewScores,
  onPrintExamCard,
  filterActions,
  customActions,
  title,
  serverSide = false,
  serverTotalItems,
  serverCurrentPage = 1,
  serverPageSize = 50,
  onServerPageChange,
  onServerPageSizeChange,
  serverSearchTerm,
  onServerSearchChange,
  tableLoading = false,
  activeKey,
  onRowClick,
}: StudentTableProps & { title?: string }) => {
  const { terminology } = useTenant();
  const { role } = useAuth();
  const displayTitle = title || `Daftar ${terminology.student}`;

  const [localSearch, setLocalSearch] = useState("");

  const filteredStudents = useMemo(() => {
    if (serverSide) return students;
    if (!localSearch.trim()) return students;
    const q = localSearch.toLowerCase();
    return students.filter(s => 
      s.name?.toLowerCase().includes(q) ||
      s.nisn?.toLowerCase().includes(q) ||
      s.examNumber?.toLowerCase().includes(q)
    );
  }, [students, serverSide, localSearch]);

  const columns: NeonTableColumn<StudentData>[] = useMemo(() => [
    {
      key: "index",
      header: "#",
      width: "40px",
      align: "center",
      render: (_item, index) => (
        <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {index + 1}
        </span>
      ),
    },
    { 
      key: "name", 
      header: `Nama ${terminology.student} & Identitas`, 
      className: "min-w-[200px]",
      render: (student) => {
        const initials = (student.name || "S").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar className="h-7 w-7 border border-neutral-200 dark:border-neutral-800 shrink-0">
              {student.photo && <AvatarImage src={student.photo} alt={student.name} className="object-cover" />}
              <AvatarFallback className={cn(
                "text-white text-[10px] font-bold font-mono",
                student.gender === "L" ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-rose-400 to-pink-600"
              )}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span 
                className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate hover:underline cursor-pointer"
                onClick={() => onEdit(student)}
                title={`Edit data ${student.name}`}
              >
                {student.name}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  @{student.nisn || "---"}
                </span>
                {student.examNumber && student.examNumber !== student.nisn && (
                  <>
                    <span>•</span>
                    <span>No: {student.examNumber}</span>
                  </>
                )}
                {(student.birthPlace || student.birthDate) && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[140px]">
                      {[student.birthPlace, student.birthDate].filter(Boolean).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    { 
      key: "classId", 
      header: terminology.class, 
      className: "w-36",
      render: (student) => {
        const cls = classes.find(c => c.id === student.classId);
        const clsName = cls?.name || (student.classId === "ALUMNI" ? "Alumni" : `Tanpa ${terminology.class}`);
        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              {clsName}
            </span>
            {(student.room || student.session) && (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                {[student.room, student.session].filter(Boolean).join(" • ")}
              </span>
            )}
          </div>
        );
      }
    },
    { 
      key: "gender", 
      header: "L/P", 
      width: "50px",
      align: "center",
      render: (student) => (
        <span className={cn(
          "inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold font-mono border",
          student.gender === "L" 
            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20" 
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
        )}>
          {student.gender || "-"}
        </span>
      )
    },
    {
      key: "hasChangedPassword",
      header: "Password",
      width: "110px",
      render: (student) => {
        const hasChanged = student.hasChangedPassword;
        const isResetReq = !!student.resetRequested;
        return (
          <div className="flex items-center">
            {isResetReq ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
                Minta Reset
              </span>
            ) : hasChanged ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Diubah
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Default
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "actions",
      header: "Aksi",
      width: "100px",
      align: "right",
      render: (student) => {
        if (customActions) return customActions(student);
        return (
          <div className="flex justify-end items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {role === "admin" && (
              <button 
                type="button"
                className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                onClick={() => onEdit(student)}
                title={`Edit data ${terminology.student}`}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}

            {role === "admin" && onResetPassword && (
              <button 
                type="button"
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center border transition-colors shadow-2xs cursor-pointer",
                  student.resetRequested
                    ? "bg-rose-50 border-rose-300 text-rose-600 animate-pulse dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400"
                    : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
                onClick={() => onResetPassword(student)}
                title={student.resetRequested ? "Siswa meminta reset! Klik untuk reset password" : `Reset Password ${terminology.student} (12345678)`}
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  title="Menu Lainnya"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                {onPrintExamCard && (
                  <DropdownMenuItem
                    onClick={() => onPrintExamCard(student)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <Printer className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Cetak Kartu Ujian</span>
                  </DropdownMenuItem>
                )}
                {onViewScores && (
                  <DropdownMenuItem
                    onClick={() => onViewScores(student)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Lihat Rekap Nilai</span>
                  </DropdownMenuItem>
                )}
                {onViewInterest && (
                  <DropdownMenuItem
                    onClick={() => onViewInterest(student)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Bakat & Minat</span>
                  </DropdownMenuItem>
                )}
                {role === "admin" && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem
                      onClick={() => onDelete(student)}
                      className="text-xs cursor-pointer gap-2 py-1.5 text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      <span>Hapus {terminology.student}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ], [terminology, classes, role, customActions, onPrintExamCard, onViewScores, onViewInterest, onEdit, onResetPassword, onDelete]);

  return (
    <NeonTable<StudentData>
      data={filteredStudents}
      columns={columns}
      keyExtractor={(s) => s.id}
      selectable
      selectedKeys={selectedIds}
      onSelectionChange={onSelectChange}
      isLoading={tableLoading}
      searchValue={serverSide ? (serverSearchTerm || "") : localSearch}
      onSearchChange={serverSide ? (onServerSearchChange || (() => {})) : setLocalSearch}
      searchPlaceholder={`Cari nama ${terminology.student.toLowerCase()} atau NISN...`}
      filterSlot={filterActions}
      compact
      title={displayTitle}
      subtitle={`Kelola data dan status akun login ${terminology.student.toLowerCase()}.`}
      activeKey={activeKey}
      onRowClick={onRowClick}
      pagination
      serverSide={serverSide}
      totalCount={serverSide ? serverTotalItems : undefined}
      currentPage={serverSide ? serverCurrentPage : undefined}
      pageSize={serverSide ? serverPageSize : 50}
      pageSizeOptions={[25, 50, 100]}
      onPageChange={serverSide ? onServerPageChange : undefined}
      onPageSizeChange={serverSide ? onServerPageSizeChange : undefined}
      emptyTitle={`Belum ada data ${terminology.student.toLowerCase()}`}
      emptySubtitle={`Tambahkan data ${terminology.student.toLowerCase()} baru atau import dari file Excel.`}
    />
  );
};

export default StudentTable;
