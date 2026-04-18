import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { SubjectData } from "../../types/exam";
import { Edit, Trash, BookOpen } from "lucide-react";

interface SubjectTableProps {
  subjects: SubjectData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (subject: SubjectData) => void;
  onDelete: (subject: SubjectData) => void;
}

const SubjectTable = ({ 
  subjects, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete 
}: SubjectTableProps) => {
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(subjects.map(s => s.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = subjects.slice(start, end + 1).map(s => s.id);
      
      newSelectedIds = Array.from(new Set([...newSelectedIds, ...idsInRange]));
    } else {
      if (checked) {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      } else {
        newSelectedIds = newSelectedIds.filter((item) => item !== id);
      }
    }

    onSelectChange(newSelectedIds);
    setLastSelectedIndex(index);
  };

  const isAllSelected = subjects.length > 0 && subjects.every(s => selectedIds.includes(s.id));

  const columns = [
    {
      key: "selection",
      label: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
        />
      ),
      render: (_: any, item: SubjectData, index?: number) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => handleSelectOne(item.id, e.target.checked, index ?? 0, e)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
        />
      ),
      className: "w-[40px] text-center",
    },
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
    },
    { 
      key: "name", 
      label: "Mata Pelajaran", 
      sortable: true,
      render: (name: string) => (
        <span className="font-bold text-slate-700 dark:text-slate-200">{name}</span>
      )
    },
  ];

  const renderActions = (subject: SubjectData) => (
    <div className="flex justify-end gap-2">
      <button 
        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
        onClick={() => onEdit(subject)}
        title="Edit Mapel"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button 
        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
        onClick={() => onDelete(subject)}
        title="Hapus Mapel"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Mata Pelajaran</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={subjects}
          columns={columns}
          searchPlaceholder="Cari mapel..."
          actions={renderActions}
          emptyMessage="Belum ada data mata pelajaran."
        />
      </CardContent>
    </Card>
  );
};

export default SubjectTable;
