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
  FileText,
  BookOpen,
  KeyRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Dashboard", sublabel: "Seluruh Tenant", icon: LayoutDashboard, path: "/superadmin" },
  { label: "Lisensi Offline", sublabel: "Server Mandiri CBT", icon: KeyRound, path: "/superadmin/offline-licenses" },
  { label: "Infrastruktur", sublabel: "Status & Latensi", icon: Database, path: "/superadmin/infra" },
  { label: "Statistik", sublabel: "Analitik Server", icon: Globe, path: "/superadmin/analytics" },
  { label: "Invoice", sublabel: "Tagihan & Pembayaran", icon: FileText, path: "/superadmin/invoice" },
  { label: "Pengaturan", sublabel: "Akun & Keamanan", icon: Settings, path: "/superadmin/settings" },
];

// Item bantuan — selalu di paling bawah sidebar
const helpItems = [
  { label: "Panduan Multi-VPS", sublabel: "Manual Worker Node", icon: BookOpen, path: "/superadmin/multi-vps-docs" },
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

  const currentPage = [...navItems, ...helpItems].find(item => item.path === location.pathname);

  // Quick mobile navigation items (top 4 destinations)
  const mobileNavItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/superadmin" },
    { label: "Lisensi", icon: KeyRound, path: "/superadmin/offline-licenses" },
    { label: "Infra", icon: Database, path: "/superadmin/infra" },
    { label: "Invoice", icon: FileText, path: "/superadmin/invoice" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[82vw] max-w-[290px] lg:w-72 bg-white border-r border-slate-200 flex flex-col z-50 shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header with New Official Logo */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shadow-2xs shrink-0">
              <img
                src="/logo-default.webp"
                onError={(e) => { (e.target as HTMLImageElement).src = "/logo-default.png"; }}
                alt="Examku Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-slate-900 leading-none tracking-tight">EXAMKU</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 leading-none">
                  CBT
                </span>
              </div>
              <p className="text-[10px] font-bold text-blue-600 tracking-wider uppercase mt-1">Super Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu Navigasi</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
                )}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                )}>
                  <item.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs sm:text-sm font-semibold leading-tight", isActive ? "text-blue-700" : "text-slate-800")}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.sublabel}</p>
                </div>
                {isActive && <ChevronRight size={14} className="text-blue-400 shrink-0" />}
              </Link>
            );
          })}

          {/* Bantuan — selalu di paling bawah */}
          <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bantuan</p>
          {helpItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-purple-50 text-purple-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-purple-600 rounded-r-full" />
                )}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                )}>
                  <item.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs sm:text-sm font-semibold leading-tight", isActive ? "text-purple-700" : "text-slate-800")}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.sublabel}</p>
                </div>
                {isActive && <ChevronRight size={14} className="text-purple-400 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              {adminInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{adminName}</p>
              <p className="text-[10px] text-slate-400">Super Administrator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 min-h-[44px] rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
              <LogOut size={15} className="text-slate-500 group-hover:text-red-600 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-semibold">Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-72 min-h-screen flex flex-col flex-1 min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 sm:h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Buka navigasi super admin"
                className="lg:hidden min-w-[44px] min-h-[44px] -ml-2 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <Menu size={22} />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 sm:hidden">
                  <img
                    src="/logo-default.webp"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/logo-default.png"; }}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-400 text-xs font-semibold hidden sm:inline">Examku CBT</span>
                  <ChevronRight size={13} className="text-slate-300 hidden sm:inline" />
                  <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                    {currentPage?.label || "Super Admin"}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sistem Online
              </div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                {adminInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content with safe-area spacing for mobile bottom bar */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Reflowed for Phone Users) ── */}
      <nav
        aria-label="Navigasi cepat ponsel"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around"
      >
        {mobileNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "min-w-[56px] min-h-[48px] py-1 px-2 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all",
                isActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <div className={cn(
                "p-1 rounded-lg transition-colors",
                isActive ? "bg-blue-50 text-blue-600" : "text-slate-500"
              )}>
                <item.icon size={18} />
              </div>
              <span className="text-[10px] tracking-tight leading-none truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu / Drawer trigger button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="min-w-[56px] min-h-[48px] py-1 px-2 flex flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 hover:text-slate-800 transition-all"
        >
          <div className="p-1 rounded-lg text-slate-500">
            <Menu size={18} />
          </div>
          <span className="text-[10px] tracking-tight leading-none">Menu</span>
        </button>
      </nav>
    </div>
  );
};

export default SuperAdminLayout;

