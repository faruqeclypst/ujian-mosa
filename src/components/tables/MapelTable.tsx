import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { SubjectData } from "../../types/piket";
import { Edit, Trash } from "lucide-react";

interface MapelTableProps {
  mapels: SubjectData[];
  onEdit: (mapel: SubjectData) => void;
  onDelete: (mapel: SubjectData) => void;
}

const MapelTable = ({ mapels, onEdit, onDelete }: MapelTableProps) => {
  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    { key: "name", label: "Mata Pelajaran", sortable: true },
  ];

  const renderActions = (mapel: SubjectData) => (
    <div className="flex justify-end gap-2">
      <Button 
        variant="secondary" 
        size="sm" 
        className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/30 dark:border-green-800/40 h-7 text-xs rounded-lg" 
        onClick={() => onEdit(mapel)}
      >
        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
      </Button>
      <Button 
        variant="secondary" 
        size="sm" 
        className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:border-green-800/40 h-7 text-xs rounded-lg" 
        onClick={() => onDelete(mapel)}
      >
        <Trash className="h-3.5 w-3.5 mr-1" /> Hapus
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Data Mata Pelajaran</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={mapels}
          columns={columns}
          searchPlaceholder="Cari mapel..."
          actions={renderActions}
          emptyMessage="Belum ada data mata pelajaran."
        />
      </CardContent>
    </Card>
  );
};

export default MapelTable;
