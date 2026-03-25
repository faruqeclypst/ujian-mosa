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
      <Button 
        variant="outline" 
        size="icon"
        className="h-7 w-7 p-0 rounded-lg border-red-200/60 hover:border-red-300 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" 
        onClick={() => onDelete(user.id, user.displayName)}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
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
