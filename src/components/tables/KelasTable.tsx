import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { ClassData } from "../../types/piket";

interface KelasTableProps {
  classes: ClassData[];
  onEdit: (cls: ClassData) => void;
  onDelete: (cls: ClassData) => void;
}

const KelasTable = ({ classes, onEdit, onDelete }: KelasTableProps) => {
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
      <Button variant="secondary" size="sm" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900" onClick={() => onEdit(cls)}>
        Edit
      </Button>
      <Button variant="destructive" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => onDelete(cls)}>
        Hapus
      </Button>
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

export default KelasTable;
