import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Teacher } from "../../types/piket";

interface GuruTableProps {
  teachers: Teacher[];
  onEdit: (t: Teacher) => void;
  onDelete: (t: Teacher) => void;
}

const GuruTable = ({ teachers, onEdit, onDelete }: GuruTableProps) => {
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
      <Button variant="secondary" size="sm" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900" onClick={() => onEdit(teacher)}>
        Edit
      </Button>
      <Button variant="destructive" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => onDelete(teacher)}>
        Hapus
      </Button>
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

export default GuruTable;
