import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { ClassData } from "../../types/exam";
import { Edit, Trash } from "lucide-react";

interface ClassTableProps {
  classes: ClassData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (cls: ClassData) => void;
  onDelete: (cls: ClassData) => void;
}

const ClassTable = ({ 
  classes, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete 
}: ClassTableProps) => {
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(classes.map(c => c.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = classes.slice(start, end + 1).map(c => c.id);
      
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

  const isAllSelected = classes.length > 0 && classes.every(c => selectedIds.includes(c.id));

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
      render: (_: any, item: ClassData, index?: number) => (
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
    { key: "name", label: "Nama Kelas", sortable: true },
  ];

  const renderActions = (cls: ClassData) => (
    <div className="flex justify-end gap-2">
      <button 
        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
        onClick={() => onEdit(cls)}
        title="Edit Kelas"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button 
        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
        onClick={() => onDelete(cls)}
        title="Hapus Kelas"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Kelas</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={classes}
          columns={columns}
          searchPlaceholder="Cari kelas..."
          actions={renderActions}
          emptyMessage="Belum ada data kelas."
        />
      </CardContent>
    </Card>
  );
};

export default ClassTable;


