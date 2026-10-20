import { useState, useMemo } from "react";
import { NeonTable, type NeonTableColumn } from "../ui/NeonTable";
import type { SubjectData } from "../../types/exam";
import { Edit, Trash, BookOpen } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

interface SubjectTableProps {
  subjects: SubjectData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (subject: SubjectData) => void;
  onDelete: (subject: SubjectData) => void;
  isLoading?: boolean;
  activeKey?: string;
  onRowClick?: (subject: SubjectData) => void;
}

export const SubjectTable = ({ 
  subjects, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  isLoading,
  activeKey,
  onRowClick
}: SubjectTableProps) => {
  const { terminology } = useTenant();
  const [search, setSearch] = useState("");

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter(s => s.name.toLowerCase().includes(q));
  }, [subjects, search]);

  const columns: NeonTableColumn<SubjectData>[] = useMemo(() => [
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
      header: `Nama ${terminology.subject} & Kurikulum`,
      className: "min-w-[220px]",
      render: (subject) => (
        <div className="flex items-center gap-2.5 py-0.5">
          <div className="h-7 w-7 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span 
              className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate hover:underline cursor-pointer"
              onClick={() => onEdit(subject)}
              title={`Edit data ${subject.name}`}
            >
              {subject.name}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Kurikulum Aktif
              </span>
              <span>•</span>
              <span>Mata Pelajaran Ujian</span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      className: "hidden sm:table-cell w-36",
      headerClassName: "hidden sm:table-cell w-36",
      render: () => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          Tersinkron
        </span>
      )
    },
    {
      key: "actions",
      header: "Aksi",
      width: "90px",
      align: "right",
      render: (subject) => (
        <div className="flex justify-end items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            onClick={() => onEdit(subject)}
            title={`Edit ${terminology.subject}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button 
            type="button"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors shadow-2xs cursor-pointer"
            onClick={() => onDelete(subject)}
            title={`Hapus ${terminology.subject}`}
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ], [terminology, onEdit, onDelete]);

  return (
    <NeonTable<SubjectData>
      data={filteredSubjects}
      columns={columns}
      keyExtractor={(s) => s.id}
      compact
      selectable
      selectedKeys={selectedIds}
      onSelectionChange={onSelectChange}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={`Cari ${terminology.subject.toLowerCase()}...`}
      title={`Daftar ${terminology.subject}`}
      subtitle={`Kurikulum mata pelajaran aktif yang diujikan.`}
      activeKey={activeKey}
      onRowClick={onRowClick}
      pagination
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyTitle={`Belum ada data ${terminology.subject.toLowerCase()}`}
      emptySubtitle={`Tambahkan mata pelajaran baru dengan klik tombol Tambah ${terminology.subject} di atas.`}
      isLoading={isLoading}
    />
  );
};

export default SubjectTable;
