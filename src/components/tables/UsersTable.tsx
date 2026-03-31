import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2 } from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "gurupiket";
  createdAt: number;
}

interface UsersTableProps {
  users: AppUser[];
  onDelete: (id: string, name: string) => void;
}

const UsersTable = ({ users, onDelete }: UsersTableProps) => {
  const columns = [
    {
      key: "displayName",
      label: "Nama Pengguna",
      sortable: true,
      className: "text-left"
    },
    {
      key: "username",
      label: "Username",
      sortable: true,
      render: (v: string) => <code className="text-slate-600 dark:text-slate-400 font-mono text-sm">{v}</code>,
    },
    {
      key: "role",
      label: "Peran / Akses",
      sortable: true,
      render: (v: string) => (
        <Badge variant={v === "admin" ? "default" : "secondary"}>
          {v === "admin" ? "Admin" : "Guru / Pengawas"}
        </Badge>
      ),
    },
  ];

  const renderActions = (user: AppUser) => (
    <div className="flex justify-end gap-1.5 item-center">
      <button 
        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40" 
        onClick={() => onDelete(user.id, user.displayName)}
        title="Hapus Akun"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Daftar Akun Pengguna</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          data={users}
          columns={columns}
          searchPlaceholder="Cari nama atau username..."
          actions={renderActions}
          emptyMessage="Belum ada data akun."
        />
      </CardContent>
    </Card>
  );
};

export default UsersTable;
