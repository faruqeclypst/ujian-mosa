import React from "react";
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Database,
  Globe
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { masterPb } from "../../lib/pocketbase";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    masterPb.authStore.clear();
    navigate("/superadmin/login");
  };

  const navItems = [
    { label: "Dashboard Institusi", icon: LayoutDashboard, path: "/superadmin" },
    { label: "Status Infrastruktur", icon: Database, path: "/superadmin/infra" },
    { label: "Statistik Server", icon: Globe, path: "/superadmin/analytics" },
    { label: "Pengaturan Utama", icon: Settings, path: "/superadmin/settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-50 shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl shadow-sm flex items-center justify-center">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900">E-Ujian</h1>
            <p className="text-xs font-semibold text-slate-500">Super Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon size={20} className={`${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"} transition-colors`} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-left font-bold group"
          >
            <LogOut size={20} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            <span className="text-sm">Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64 min-h-screen relative overflow-x-hidden">
        <div className="relative p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;
