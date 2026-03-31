import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Teacher } from "../../types/exam";
import { Edit, Trash } from "lucide-react";

interface TeacherTableProps {
  teachers: Teacher[];
  onEdit: (t: Teacher) => void;
  onDelete: (t: Teacher) => void;
}

const TeacherTable = ({ teachers, onEdit, onDelete }: TeacherTableProps) => {
  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "name",
      label: "Nama Guru",
      sortable: true,
      render: (v: string, item: Teacher) => (
        <span className="font-medium text-slate-900 dark:text-white">
          {item.name} {item.code ? <span className="text-slate-400 text-xs font-normal">({item.code})</span> : ""}
        </span>
      ),
    },
    {
      key: "subjects",
      label: "Mapel Utama",
      sortable: false,
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value || []).map((m, idx) => (
            <Badge key={idx} variant="secondary">
              {m}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  const renderActions = (teacher: Teacher) => (
    <div className="flex justify-end gap-2">
      <button 
        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
        onClick={() => onEdit(teacher)}
        title="Edit Guru"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button 
        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
        onClick={() => onDelete(teacher)}
        title="Hapus Guru"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Data Guru</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={teachers}
          columns={columns}
          searchPlaceholder="Cari nama atau kode guru..."
          actions={renderActions}
          emptyMessage="Belum ada data guru."
        />
      </CardContent>
    </Card>
  );
};

export default TeacherTable;


