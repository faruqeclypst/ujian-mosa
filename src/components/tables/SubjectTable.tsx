import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { SubjectData } from "../../types/exam";
import { Edit, Trash } from "lucide-react";

interface SubjectTableProps {
  subjects: SubjectData[];
  onEdit: (subject: SubjectData) => void;
  onDelete: (subject: SubjectData) => void;
}

const SubjectTable = ({ subjects, onEdit, onDelete }: SubjectTableProps) => {
  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    { key: "name", label: "Mata Pelajaran", sortable: true },
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
      <CardHeader>
        <CardTitle className="text-base font-semibold">Data Mata Pelajaran</CardTitle>
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
