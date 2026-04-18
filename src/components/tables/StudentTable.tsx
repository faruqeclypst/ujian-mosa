import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { StudentData, ClassData } from "../../types/exam";
import { useAuth } from "../../context/AuthContext";
import { Edit, Trash, Sparkles, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface StudentTableProps {
  students: StudentData[];
  classes: ClassData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (student: StudentData) => void;
  onDelete: (student: StudentData) => void;
  onResetPassword?: (student: StudentData) => void;
  onViewInterest?: (student: StudentData) => void;
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
  onResetPassword,
  onViewInterest,
  filterActions,
  customActions,
  title = "Daftar Siswa"
}: StudentTableProps & { title?: string }) => {

  const handleSelectAll = (checked: boolean) => {
    const currentIds = students.map((s) => s.id);
    if (checked) {
      const merged = Array.from(new Set([...selectedIds, ...currentIds]));
      onSelectChange(merged);
    } else {
      onSelectChange(selectedIds.filter((id) => !currentIds.includes(id)));
    }
  };

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = students.slice(start, end + 1).map(s => s.id);
      
      // Merge with existing selections
      newSelectedIds = Array.from(new Set([...newSelectedIds, ...idsInRange]));
    } else {
      if (checked) {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      } else {
        newSelectedIds = newSelectedIds.filter((item) => item !== id);
      }
    }

    onSelectChange(newSelectedIds);
    setLastSelectedIndex(index);
  };

  const isAllSelected = students.length > 0 && students.every(s => selectedIds.includes(s.id));

  const columns = [
    {
      key: "selection",
      label: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
        />
      ),
      render: (_: any, item: StudentData, index?: number) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => handleSelectOne(item.id, e.target.checked, index ?? 0, e)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
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
    { 
      key: "nisn", 
      label: "NISN", 
      sortable: true,
      className: "w-[120px] text-left",
      render: (nisn: string) => (
        <span className="inline-flex items-center justify-start px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black tracking-widest border border-slate-200/50 dark:border-slate-700/50">
          {nisn || "???"}
        </span>
      )
    },
    { 
      key: "name", 
      label: "Nama Siswa", 
      sortable: true,
      render: (name: string, student: StudentData) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
            <AvatarFallback className={cn(
              "text-white text-[10px] font-bold",
              student.gender === "L" ? "bg-gradient-to-br from-blue-500 to-cyan-600" : "bg-gradient-to-br from-rose-400 to-pink-600"
            )}>
              {(name || "S").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-bold text-slate-700 dark:text-slate-200 leading-tight">{name}</span>
            <span className="text-[11px] text-slate-400 font-medium">@{student.nisn}</span>
          </div>
        </div>
      )
    },
    { 
      key: "gender", 
      label: "L/P", 
      className: "w-[60px] text-center",
      render: (gender: string) => (
        <Badge variant="outline" className={cn(
          "w-7 h-7 flex items-center justify-center p-0 rounded-full font-black text-[10px]",
          gender === "L" ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400" : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
        )}>
          {gender}
        </Badge>
      )
    },
    { 
      key: "classId", 
      label: "Kelas", 
      sortable: true,
      render: (classId: string) => {
        const cls = classes.find(c => c.id === classId);
        return (
          <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent text-[10px] font-bold px-2 py-0.5">
            {cls?.name || "Tanpa Kelas"}
          </Badge>
        );
      }
    },
  ];

  const { role } = useAuth();

  const renderActions = (student: StudentData) => (
    customActions ? customActions(student) : (
      <div className="flex justify-end gap-2">
        {onViewInterest && (
          <button 
            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40"
            onClick={() => onViewInterest(student)}
            title="Lihat Bakat Minat"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
        {role === "admin" && (
          <>
            <button 
              className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
              onClick={() => onEdit(student)}
              title="Edit Siswa"
            >
              <Edit className="h-4 w-4" />
            </button>
            {role === "admin" && onResetPassword && (
              <button 
                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40"
                onClick={() => onResetPassword(student)}
                title="Reset Password ke Default (12345678)"
              >
                <KeyRound className="h-4 w-4" />
              </button>
            )}
            <button 
              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
              onClick={() => onDelete(student)}
              title="Hapus Siswa"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    )
  );

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</CardTitle>
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

