import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  Settings,
  LogOut,
  Database,
  Globe,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Dashboard", sublabel: "Seluruh Tenant", icon: LayoutDashboard, path: "/superadmin" },
  { label: "Infrastruktur", sublabel: "Status & Latensi", icon: Database, path: "/superadmin/infra" },
  { label: "Statistik", sublabel: "Analitik Server", icon: Globe, path: "/superadmin/analytics" },
  { label: "Pengaturan", sublabel: "Akun & Keamanan", icon: Settings, path: "/superadmin/settings" },
];

const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    masterPb.authStore.clear();
    navigate("/superadmin/login");
  };

  React.useEffect(() => {
    const validateSession = async () => {
      if (!masterPb.authStore.isValid) {
        handleLogout();
        return;
      }
      try {
        await masterPb.collection("super_admins").authRefresh();
      } catch (err) {
        handleLogout();
      }
    };
    validateSession();
  }, [location.pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const adminName = masterPb.authStore.model?.name || masterPb.authStore.model?.email || "Super Admin";
  const adminInitial = adminName.charAt(0).toUpperCase();

  const currentPage = navItems.find(item => item.path === location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 flex flex-col z-50 shadow-xl transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/30">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-slate-900 leading-none">EXAM AA</h1>
                <p className="text-[10px] font-semibold text-blue-600 tracking-widest uppercase mt-0.5">Super Admin</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu Utama</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-blue-600 rounded-r-full" />
                )}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                  isActive ? "bg-blue-100" : "bg-slate-100 group-hover:bg-slate-200"
                )}>
                  <item.icon size={16} className={isActive ? "text-blue-600" : "text-slate-500"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold leading-none mb-0.5", isActive ? "text-blue-700" : "text-slate-700")}>{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.sublabel}</p>
                </div>
                {isActive && <ChevronRight size={14} className="text-blue-400 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100">
          {/* Admin info */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {adminInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{adminName}</p>
              <p className="text-[10px] text-slate-400">Super Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
              <LogOut size={16} className="text-slate-500 group-hover:text-red-500 transition-colors" />
            </div>
            <span className="text-sm font-semibold">Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72 min-h-screen flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400 text-sm hidden sm:block">EXAM AA</span>
              <ChevronRight size={14} className="text-slate-300 hidden sm:block" />
              <span className="font-semibold text-slate-800 text-sm truncate">
                {currentPage?.label || "Super Admin"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sistem Online
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {adminInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
