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
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/30 dark:border-green-800/40 h-7 text-xs rounded-lg" 
        onClick={() => onEdit(cls)}
      >
        Edit
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:border-green-800/40 h-7 text-xs rounded-lg" 
        onClick={() => onDelete(cls)}
      >
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
