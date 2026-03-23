import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { StudentData } from "../../types/piket";

interface SiswaTableProps {
  students: Array<StudentData & { className?: string }>;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (student: StudentData) => void;
  onDelete: (student: StudentData) => void;
  filterActions?: React.ReactNode;
  customActions?: (student: StudentData) => React.ReactNode;
}

const SiswaTable = ({ 
  students, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  filterActions,
  customActions
}: SiswaTableProps) => {

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(students.map((s) => s.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter((item) => item !== id));
    }
  };

  const isAllSelected = students.length > 0 && selectedIds.length === students.length;

  const columns = [
    {
      key: "selection",
      label: "",
      render: (_: any, item: StudentData & { className?: string }) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => handleSelectOne(item.id, e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
        />
      ),
      className: "w-[40px] text-center",
    },
    {
      key: "index",
      label: "No",
      render: (_: any, __: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
    },
    { key: "nisn", label: "NISN", sortable: true },
    { key: "name", label: "Nama Siswa", sortable: true },
    { 
      key: "gender", 
      label: "L/P", 
      sortable: true,
      render: (v: string) => (v === "L" ? "Laki-laki" : "Perempuan")
    },
    { key: "className", label: "Kelas", sortable: true },
  ];

  const renderActions = (student: StudentData) => (
    customActions ? customActions(student) : (
      <div className="flex justify-end gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900" 
          onClick={() => onEdit(student)}
        >
          Edit
        </Button>
        <Button 
          variant="destructive" 
          size="sm" 
          className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" 
          onClick={() => onDelete(student)}
        >
          Hapus
        </Button>
      </div>
    )
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Data Siswa</CardTitle>
        {students.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="selectAll"
              checked={isAllSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="selectAll" className="text-sm text-muted-foreground cursor-pointer">
              Pilih Semua
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <DataTable
          data={students}
          columns={columns}
          searchPlaceholder="Cari siswa..."
          actions={renderActions}
          emptyMessage="Belum ada data siswa."
          filterActions={filterActions}
        />
      </CardContent>
    </Card>
  );
};

export default SiswaTable;
