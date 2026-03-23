import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { SubjectData } from "../../types/piket";

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
      <Button variant="secondary" size="sm" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900" onClick={() => onEdit(mapel)}>
        Edit
      </Button>
      <Button variant="destructive" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => onDelete(mapel)}>
        Hapus
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
