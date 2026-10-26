import { useState, useMemo } from "react";
import { NeonTable, type NeonTableColumn } from "../ui/NeonTable";
import type { Teacher } from "../../types/exam";
import { Edit, Trash, KeyRound, Mail, Phone, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTenant } from "../../context/TenantContext";

interface TeacherTableProps {
  teachers: Teacher[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
  onResetPassword: (teacherId: string) => void;
  isLoading?: boolean;
  activeKey?: string;
  onRowClick?: (teacher: Teacher) => void;
}

export const TeacherTable = ({ 
  teachers, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  onResetPassword,
  isLoading,
  activeKey,
  onRowClick
}: TeacherTableProps) => {
  const { terminology } = useTenant();
  const [search, setSearch] = useState("");

  const filteredTeachers = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.toLowerCase();
    return teachers.filter(t => 
      t.name?.toLowerCase().includes(q) || 
      (t.username && t.username.toLowerCase().includes(q)) ||
      (t.code && t.code.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  }, [teachers, search]);

  const columns: NeonTableColumn<Teacher>[] = useMemo(() => [
    { 
      key: "name", 
      header: `Nama ${terminology.teacher} & Identitas`, 
      className: "min-w-0",
      render: (teacher) => {
        const initials = teacher.code || (teacher.name || "G").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar className="h-7 w-7 border border-neutral-200 dark:border-neutral-800 shrink-0">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold font-mono">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span 
                className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate hover:underline cursor-pointer"
                onClick={() => onEdit(teacher)}
                title={`Edit data ${teacher.name}`}
              >
                {teacher.name}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5 min-w-0">
                <span className="font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  @{teacher.username || teacher.code || "guru"}
                </span>
                <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">•</span>
                <span className="hidden sm:inline">Kode: {teacher.code || "-"}</span>
                {teacher.subjects && teacher.subjects.length > 0 && (
                  <span className="sm:hidden font-sans text-neutral-600 dark:text-neutral-300 truncate max-w-[120px]">
                    • {teacher.subjects.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    { 
      key: "contact",
      header: "Kontak",
      className: "hidden md:table-cell w-48",
      headerClassName: "hidden md:table-cell w-48",
      render: (teacher) => (
        <div className="flex flex-col gap-0.5 py-0.5 font-mono text-[11px]">
          {teacher.email ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <Mail className="h-3 w-3 shrink-0 text-neutral-400" />
              <span className="truncate max-w-[170px]">{teacher.email}</span>
            </span>
          ) : null}
          {teacher.phone ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
              <span>{teacher.phone}</span>
            </span>
          ) : null}
          {!teacher.email && !teacher.phone && (
            <span className="text-neutral-400 dark:text-neutral-600 italic text-[11px]">-</span>
          )}
        </div>
      )
    },
    { 
      key: "subjects", 
      header: terminology.subject, 
      className: "hidden sm:table-cell w-52",
      headerClassName: "hidden sm:table-cell w-52",
      render: (teacher) => {
        const subjects = teacher.subjects || [];
        if (subjects.length === 0) {
          return <span className="text-neutral-400 dark:text-neutral-500 italic text-xs">Belum diatur</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 py-0.5">
            {subjects.map((sub, i) => (
              <span 
                key={i} 
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-300"
              >
                {sub}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: "actions",
      header: "Aksi",
      className: "w-20 sm:w-28 text-right shrink-0",
      headerClassName: "w-20 sm:w-28 text-right shrink-0",
      align: "right",
      render: (teacher) => (
        <div className="flex justify-end items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            onClick={() => onEdit(teacher)}
            title={`Edit ${terminology.teacher}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button 
            type="button"
            className="hidden sm:flex h-7 w-7 rounded-md items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            onClick={() => onResetPassword(teacher.id)}
            title={`Reset Password ${terminology.teacher}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                title="Menu Lainnya"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
              <DropdownMenuItem
                onClick={() => onEdit(teacher)}
                className="text-xs cursor-pointer gap-2 py-1.5"
              >
                <Edit className="h-3.5 w-3.5 text-neutral-500" />
                <span>Edit Data {terminology.teacher}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onResetPassword(teacher.id)}
                className="text-xs cursor-pointer gap-2 py-1.5"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                <span>Reset Password</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
              <DropdownMenuItem
                onClick={() => onDelete(teacher)}
                className="text-xs cursor-pointer gap-2 py-1.5 text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
              >
                <Trash className="h-3.5 w-3.5" />
                <span>Hapus {terminology.teacher}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ], [terminology, onEdit, onDelete, onResetPassword]);

  return (
    <NeonTable<Teacher>
      data={filteredTeachers}
      columns={columns}
      keyExtractor={(t) => t.id}
      compact
      selectable
      selectedKeys={selectedIds}
      onSelectionChange={onSelectChange}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={`Cari nama ${terminology.teacher.toLowerCase()}, kode, atau username...`}
      title={`Daftar ${terminology.teacher}`}
      subtitle={`Tenaga pendidik terdaftar dengan akses pembuatan soal dan monitoring.`}
      activeKey={activeKey}
      onRowClick={onRowClick}
      pagination
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyTitle={`Belum ada data ${terminology.teacher.toLowerCase()}`}
      emptySubtitle={`Tambahkan guru baru dengan klik tombol Tambah ${terminology.teacher} di atas.`}
      isLoading={isLoading}
    />
  );
};

export default TeacherTable;
