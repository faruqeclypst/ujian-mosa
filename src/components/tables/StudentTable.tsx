import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { StudentData, ClassData } from "../../types/exam";
import { Edit, Trash } from "lucide-react";

interface StudentTableProps {
  students: StudentData[];
  classes: ClassData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (student: StudentData) => void;
  onDelete: (student: StudentData) => void;
  filterActions?: React.ReactNode;
  customActions?: (student: StudentData) => React.ReactNode;
}

const StudentTable = ({ 
  students, 
  classes,
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  filterActions,
  customActions
}: StudentTableProps) => {

  const handleSelectAll = (checked: boolean) => {
    const currentIds = students.map((s) => s.id);
    if (checked) {
      const merged = Array.from(new Set([...selectedIds, ...currentIds]));
      onSelectChange(merged);
    } else {
      onSelectChange(selectedIds.filter((id) => !currentIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter((item) => item !== id));
    }
  };

  const isAllSelected = students.length > 0 && students.every(s => selectedIds.includes(s.id));

  const columns = [
    {
      key: "selection",
      label: "",
      render: (_: any, item: StudentData) => (
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
    { key: "gender", label: "L/P", className: "w-[60px] text-center" },
    { 
      key: "classId", 
      label: "Kelas", 
      sortable: true,
      render: (classId: string) => classes.find(c => c.id === classId)?.name || "Tanpa Kelas"
    },
  ];

  const renderActions = (student: StudentData) => (
    customActions ? customActions(student) : (
      <div className="flex justify-end gap-2">
        <button 
          className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
          onClick={() => onEdit(student)}
          title="Edit Siswa"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button 
          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
          onClick={() => onDelete(student)}
          title="Hapus Siswa"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
    )
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
        <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Daftar Siswa</CardTitle>
        {students.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="selectAll"
              checked={isAllSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="selectAll" className="text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
              Pilih Semua
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <DataTable
          data={students}
          columns={columns}
          searchPlaceholder="Cari Siswa..."
          actions={renderActions}
          emptyMessage="Belum ada data Siswa."
          filterActions={filterActions}
        />
      </CardContent>
    </Card>
  );
};

export default StudentTable;

