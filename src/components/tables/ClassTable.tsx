import { useState, useMemo } from "react";
import { NeonTable, type NeonTableColumn } from "../ui/NeonTable";
import type { ClassData } from "../../types/exam";
import { Edit, Trash, KeyRound, GraduationCap, MoreHorizontal, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ClassTableProps {
  classes: ClassData[];
  studentCounts?: Record<string, number>;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (cls: ClassData) => void;
  onDelete: (cls: ClassData) => void;
  onResetPassword?: (cls: ClassData) => void;
  isLoading?: boolean;
  activeKey?: string;
  onRowClick?: (cls: ClassData) => void;
}

export const ClassTable = ({ 
  classes, 
  studentCounts = {},
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  onResetPassword,
  isLoading,
  activeKey,
  onRowClick
}: ClassTableProps) => {
  const [search, setSearch] = useState("");

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter(c => c.name.toLowerCase().includes(q));
  }, [classes, search]);

  const columns: NeonTableColumn<ClassData>[] = useMemo(() => [
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
      header: "Nama Rombongan Belajar (Kelas)",
      className: "min-w-[220px]",
      render: (cls) => {
        const count = studentCounts[cls.id] || 0;
        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span 
                className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate hover:underline cursor-pointer"
                onClick={() => onEdit(cls)}
                title={`Edit data ${cls.name}`}
              >
                {cls.name}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {count} siswa
                </span>
                <span>•</span>
                <span>Rombel aktif</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: "student_count",
      header: "Jumlah Siswa",
      className: "hidden sm:table-cell w-36",
      headerClassName: "hidden sm:table-cell w-36",
      render: (cls) => {
        const count = studentCounts[cls.id] || 0;
        return (
          <div className="flex items-center gap-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 font-mono">
            <Users className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <span>{count} peserta didik</span>
          </div>
        );
      }
    },
    {
      key: "actions",
      header: "Aksi",
      width: "100px",
      align: "right",
      render: (cls) => (
        <div className="flex justify-end items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            onClick={() => onEdit(cls)}
            title="Edit Kelas"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>

          {onResetPassword && (
            <button 
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => onResetPassword(cls)}
              title="Reset Password Siswa Kelas Ini (12345678)"
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
              <DropdownMenuItem
                onClick={() => onEdit(cls)}
                className="text-xs cursor-pointer gap-2 py-1.5"
              >
                <Edit className="h-3.5 w-3.5 text-neutral-500" />
                <span>Edit Nama Kelas</span>
              </DropdownMenuItem>
              {onResetPassword && (
                <DropdownMenuItem
                  onClick={() => onResetPassword(cls)}
                  className="text-xs cursor-pointer gap-2 py-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                  <span>Reset Password Kelas</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
              <DropdownMenuItem
                onClick={() => onDelete(cls)}
                className="text-xs cursor-pointer gap-2 py-1.5 text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
              >
                <Trash className="h-3.5 w-3.5" />
                <span>Hapus Kelas</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ], [studentCounts, onResetPassword, onEdit, onDelete]);

  return (
    <NeonTable<ClassData>
      data={filteredClasses}
      columns={columns}
      keyExtractor={(c) => c.id}
      compact
      selectable
      selectedKeys={selectedIds}
      onSelectionChange={onSelectChange}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari kelas..."
      title="Daftar Kelas"
      subtitle="Kelompok rombongan belajar peserta didik aktif."
      activeKey={activeKey}
      onRowClick={onRowClick}
      pagination
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyTitle="Belum ada data kelas"
      emptySubtitle="Tambahkan rombel kelas baru dengan klik tombol Tambah Kelas di atas."
      isLoading={isLoading}
    />
  );
};

export default ClassTable;
