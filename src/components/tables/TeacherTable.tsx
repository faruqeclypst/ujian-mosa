import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import type { Teacher } from "../../types/exam";
import { Edit, Trash, KeyRound, User } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { useTenant } from "../../context/TenantContext";

interface TeacherTableProps {
  teachers: Teacher[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
  onResetPassword: (teacherId: string) => void;
}

const TeacherTable = ({ 
  teachers, 
  selectedIds, 
  onSelectChange, 
  onEdit, 
  onDelete,
  onResetPassword
}: TeacherTableProps) => {
  const { terminology } = useTenant();
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(teachers.map(t => t.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = teachers.slice(start, end + 1).map(t => t.id);
      
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

  const isAllSelected = teachers.length > 0 && teachers.every(t => selectedIds.includes(t.id));

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
      render: (_: any, item: Teacher, index?: number) => (
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
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
    },
    { 
      key: "code", 
      label: "Kode",
      className: "w-[100px] text-left",
      render: (code: string) => (
        <span className="inline-flex items-center justify-start px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black tracking-widest border border-slate-200/50 dark:border-slate-700/50">
          {code || "???"}
        </span>
      )
    },
    { 
      key: "name", 
      label: `Nama ${terminology.teacher}`, 
      sortable: true,
      render: (name: string, teacher: Teacher) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-[10px] font-bold">
              {(name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-bold text-slate-700 dark:text-slate-200 leading-tight">{name}</span>
            <span className="text-[11px] text-slate-400 font-medium">@{teacher.username}</span>
          </div>
        </div>
      )
    },
    { 
      key: "subjects", 
      label: terminology.subject, 
      render: (subjects: string[]) => (
        <div className="flex flex-wrap gap-1.5">
          {(!subjects || subjects.length === 0) ? (
            <span className="text-slate-300 dark:text-slate-700 italic text-[10px]">Belum diatur</span>
          ) : (
            subjects.map((sub, i) => (
              <Badge key={i} variant="secondary" className="bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-800/30 text-[10px] font-bold px-2 py-0 border rounded-md">
                {sub}
              </Badge>
            ))
          )}
        </div>
      )
    },

  ];

  const renderActions = (teacher: Teacher) => (
    <div className="flex justify-end gap-2">
      <button 
        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
        onClick={() => onEdit(teacher)}
        title={`Edit ${terminology.teacher}`}
      >
        <Edit className="h-4 w-4" />
      </button>
      <button 
        className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40"
        onClick={() => onResetPassword(teacher.id)}
        title={`Reset Password ${terminology.teacher}`}
      >
        <KeyRound className="h-4 w-4" />
      </button>
      <button 
        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
        onClick={() => onDelete(teacher)}
        title={`Hapus ${terminology.teacher}`}
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar {terminology.teacher}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={teachers}
          columns={columns}
          searchPlaceholder={`Cari ${terminology.teacher.toLowerCase()}...`}
          actions={renderActions}
          emptyMessage={`Belum ada data ${terminology.teacher.toLowerCase()}.`}
        />
      </CardContent>
    </Card>
  );
};

export default TeacherTable;


