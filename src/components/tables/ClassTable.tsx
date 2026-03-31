import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { ClassData } from "../../types/exam";
import { Edit, Trash } from "lucide-react";

interface ClassTableProps {
  classes: ClassData[];
  onEdit: (cls: ClassData) => void;
  onDelete: (cls: ClassData) => void;
}

const ClassTable = ({ classes, onEdit, onDelete }: ClassTableProps) => {
  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
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
      <CardHeader>
        <CardTitle className="text-base font-semibold">Data Kelas</CardTitle>
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


