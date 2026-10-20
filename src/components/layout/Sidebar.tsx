import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Settings,
  Users,
  UserCog,
  LayoutTemplate,
  BookOpen,
  ShieldAlert,
  GraduationCap,
  Award,
  ChevronDown,
  ChevronsUpDown,
  BarChart2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wifi,
  Zap,
  Download,
  ShieldCheck,
  GitBranch,
  Database,
  Terminal,
  CheckSquare,
} from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Logo from "./logo";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { masterPb } from "../../lib/pocketbase";
import { Skeleton } from "../ui/skeleton";

const SidebarSkeleton = ({ isCollapsed }: { isCollapsed: boolean }) => {
  return (
    <aside className={cn(
      "hidden lg:flex h-full flex-col bg-white dark:bg-[#0c0d0e] border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out z-20",
      isCollapsed ? "w-[64px]" : "w-[240px]"
    )}>
      <div className="flex h-[52px] items-center px-4 border-b border-neutral-200 dark:border-neutral-800">
        <Skeleton className="h-8 w-8 rounded-md" />
        {!isCollapsed && <Skeleton className="h-5 w-24 rounded ml-3" />}
      </div>
      <div className="flex-1 py-4 space-y-3 px-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
            {!isCollapsed && <Skeleton className="h-4 flex-1 rounded" />}
          </div>
        ))}
      </div>
    </aside>
  );
};

const Sidebar = () => {
  const { role, loading } = useAuth();
  const location = useLocation();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const { terminology, school, subscriptionStatus } = useTenant();
  const examData = useExamData();
  const [unpaidCount, setUnpaidCount] = React.useState<number>(0);
  const [accountStatus, setAccountStatus] = React.useState<{
    type: "trial" | "unpaid" | "paid" | "overdue";
    label: string;
    sublabel: string;
    badgeColor: string;
    badgeBg: string;
    badgeBorder: string;
  }>({
    type: "paid",
    label: "Paket Ultimate",
    sublabel: "Akses Uji Coba",
    badgeColor: "text-emerald-700 dark:text-emerald-400",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeBorder: "border-emerald-200 dark:border-emerald-800/60",
  });

  const [isMasterDataOpen, setIsMasterDataOpen] = React.useState<boolean>(() => {
    return ["/admin/student", "/admin/classes", "/admin/subjects", "/admin/teachers", "/admin/alumni"].some(p => window.location.pathname.startsWith(p));
  });

  React.useEffect(() => {
    const isMasterRoute = ["/admin/student", "/admin/classes", "/admin/subjects", "/admin/teachers", "/admin/alumni"].some(p => location.pathname.startsWith(p));
    if (isMasterRoute) {
      setIsMasterDataOpen(true);
    }
  }, [location.pathname]);

  const [showAgentCard, setShowAgentCard] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("examku_sidebar_card_dismissed") !== "true";
    } catch {
      return true;
    }
  });

  const handleDismissCard = () => {
    setShowAgentCard(false);
    try {
      localStorage.setItem("examku_sidebar_card_dismissed", "true");
    } catch { }
  };

  React.useEffect(() => {
    if (!school) return;
    let isMounted = true;

    const checkInvoices = async () => {
      try {
        const schoolId = String(school.id || "").trim();
        const schoolSlug = String(school.slug || "").trim().toLowerCase();
        const result = await masterPb.collection("invoices").getList<any>(1, 20);
        const records = result.items.filter((r: any) => {
          const rId = String(r.school_id || "").trim();
          const rSlug = String(r.school_slug || "").trim().toLowerCase();
          return rId === schoolId || rSlug === schoolSlug;
        });

        if (!isMounted) return;

        const isOverdue = (inv: any) => {
          if (inv.status !== "unpaid") return false;
          if (!inv.due_date) return false;
          return new Date(inv.due_date) < new Date();
        };

        const unpaid = records.filter((i: any) => i.status === "unpaid" && !isOverdue(i));
        const overdue = records.filter((i: any) => i.status === "overdue" || (i.status === "unpaid" && isOverdue(i)));
        const paid = records.filter((i: any) => i.status === "paid");

        const totalUnpaid = unpaid.length + overdue.length;
        setUnpaidCount(totalUnpaid);

        const planName = school.plan
          ? (school.plan === "ultimate" ? "Paket Ultimate" : school.plan.charAt(0).toUpperCase() + school.plan.slice(1))
          : "Paket Ultimate";

        if (overdue.length > 0) {
          setAccountStatus({
            type: "overdue",
            label: "Jatuh Tempo",
            sublabel: `${overdue.length} tagihan belum dibayar`,
            badgeColor: "text-red-700 dark:text-red-300",
            badgeBg: "bg-red-50 dark:bg-red-950/40",
            badgeBorder: "border-red-200 dark:border-red-800/60",
          });
        } else if (unpaid.length > 0) {
          setAccountStatus({
            type: "unpaid",
            label: "Belum Bayar",
            sublabel: `${unpaid.length} tagihan aktif`,
            badgeColor: "text-amber-800 dark:text-amber-300",
            badgeBg: "bg-amber-50 dark:bg-amber-950/40",
            badgeBorder: "border-amber-200 dark:border-amber-800/60",
          });
        } else {
          setAccountStatus({
            type: "paid",
            label: planName,
            sublabel: "Akses Ujian Aktif",
            badgeColor: "text-emerald-700 dark:text-emerald-400",
            badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
            badgeBorder: "border-emerald-200 dark:border-emerald-800/60",
          });
        }
      } catch (err) {
        console.error("Gagal memeriksa status invoice:", err);
      }
    };

    checkInvoices();
    return () => { isMounted = false; };
  }, [school]);

  // Route Prefetch
  const prefetchRoute = React.useCallback((to: string) => {
    switch (to) {
      case "/admin/bank-soal":
        import("../../pages/admin/ExamsPage");
        break;
      case "/admin/ruang-ujian":
        import("../../pages/admin/ExamRoomsPage");
        break;
      case "/admin/classes":
        import("../../pages/ClassesPage");
        break;
      case "/admin/student":
        import("../../pages/StudentsPage");
        break;
      default:
        break;
    }
  }, []);

  // Primary Nav Items matching Neon Console
  const primaryNav = React.useMemo(() => [
    { to: "/admin", label: "Overview", icon: Home, count: null },
    { to: "/admin/ruang-ujian", label: "Ruang Ujian", icon: GitBranch, count: examData.roomsCount },
    { to: "/admin/bank-soal", label: "Bank Soal", icon: BookOpen, count: examData.examsCount },
    { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, count: null },
  ], [examData.roomsCount, examData.examsCount]);

  // Secondary Nav Items (Core Services & Settings)
  const secondaryNav = React.useMemo(() => [
    { to: "/admin/status-server", label: "CBT Server", icon: Database },
    { to: "/admin/kelola-akun", label: "Kelola Akun", icon: UserCog },
    { to: "/admin/invoice", label: "Invoice & Lisensi", icon: FileText, badge: unpaidCount > 0 ? "Tagihan" : null },
  ], [unpaidCount]);

  // Master Data Submenu (Data Siswa, Kelas, Mapel, Guru, Alumni)
  const masterDataChildren = React.useMemo(() => [
    { to: "/admin/student", label: `Data ${terminology.student}`, count: examData.students.length },
    { to: "/admin/classes", label: `Data ${terminology.class}`, count: examData.classes.length },
    { to: "/admin/subjects", label: `Data ${terminology.subject}`, count: examData.subjects.length },
    { to: "/admin/teachers", label: `Data ${terminology.teacher}`, count: examData.teachers.length },
    { to: "/admin/alumni", label: "Data Alumni", count: null },
  ], [terminology, examData.students.length, examData.classes.length, examData.subjects.length, examData.teachers.length]);

  if (loading) return <SidebarSkeleton isCollapsed={isCollapsed} />;

  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";

  return (
    <TooltipProvider>
      {/* Mobile/Tablet Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* ── Desktop Sidebar Frame ── */}
      <aside className={cn(
        "hidden lg:flex h-full flex-col bg-white dark:bg-[#0c0d0e] border-r border-neutral-200 dark:border-neutral-800 transition-all duration-200 ease-in-out z-20 shrink-0",
        isCollapsed ? "w-[64px]" : "w-[240px]"
      )}>
        {/* 1. Header with Logo (Matching Neon Console height 52px) */}
        <div className={cn(
          "flex h-[52px] items-center border-b border-neutral-200 dark:border-neutral-800 shrink-0",
          isCollapsed ? "px-2 justify-center" : "px-4"
        )}>
          <div className={cn(
            "flex items-center min-w-0 flex-1",
            isCollapsed && "justify-center"
          )}>
            <Logo />
          </div>
        </div>

        {/* 2. Branch & Connect Box (Matching Neon Console 2-line selector) */}
        {!isCollapsed ? (
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2 shrink-0">
            {/* Project / Tenant & Branch Selector */}
            <div className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-850/60 border border-neutral-200/60 dark:border-neutral-800 transition-colors select-none">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate leading-tight">
                {schoolSlug || "modalbangsa"}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GitBranch className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    production
                  </span>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </div>
            </div>

            {/* Connect Button */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("connect-trigger-btn");
                if (el) el.click();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors shadow-2xs cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Connect</span>
            </button>
          </div>
        ) : (
          <div className="py-2.5 flex flex-col items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("connect-trigger-btn");
                    if (el) el.click();
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold text-xs">Connect — Parameter CBT</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* 3. Navigation List (Compact & Clean) */}
        <nav className={cn(
          "flex-1 overflow-y-auto py-3 space-y-1 text-xs",
          "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800",
          isCollapsed ? "px-2" : "px-2.5"
        )}>
          {/* Primary Nav List */}
          {primaryNav.map((item) => {
            if (isCollapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      onMouseEnter={() => prefetchRoute(item.to)}
                      end={item.to === "/admin"}
                    >
                      {({ isActive }) => (
                        <div className={cn(
                          "flex items-center justify-center h-8 w-8 mx-auto rounded-md transition-colors",
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                      )}
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-semibold text-xs">{item.label}</p>
                    {item.count !== null && <p className="text-[10px] text-neutral-400">{item.count} data</p>}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => prefetchRoute(item.to)}
                end={item.to === "/admin"}
              >
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors group select-none",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/70 dark:hover:bg-neutral-850/60 font-medium"
                  )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                      )} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.count !== null && (
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded font-normal">
                        {item.count}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* Section Divider */}
          <div className="pt-2 pb-1">
            <div className="h-px bg-neutral-200/80 dark:bg-neutral-800 my-1 mx-1" />
            {!isCollapsed && (
              <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-2 pt-1 pb-0.5">
                Layanan &amp; Data
              </p>
            )}
          </div>

          {/* Secondary Nav Items */}
          {secondaryNav.map((item) => {
            if (isCollapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink to={item.to}>
                      {({ isActive }) => (
                        <div className={cn(
                          "flex items-center justify-center h-8 w-8 mx-auto rounded-md transition-colors",
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                      )}
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-semibold text-xs">{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors group select-none",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/70 dark:hover:bg-neutral-850/60 font-medium"
                  )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                      )} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-200/50 dark:border-amber-800/40">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* Master Data Collapsible Submenu */}
          {!isCollapsed ? (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setIsMasterDataOpen(!isMasterDataOpen)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/70 dark:hover:bg-neutral-850/60 transition-colors font-medium group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutTemplate className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 shrink-0" />
                  <span className="truncate">Master Data</span>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-neutral-400 transition-transform duration-200", isMasterDataOpen && "rotate-180")} />
              </button>

              {isMasterDataOpen && (
                <div className="pl-6 pr-1 space-y-0.5 py-1 border-l border-neutral-200 dark:border-neutral-800 ml-3.5">
                  {masterDataChildren.map((child) => (
                    <NavLink key={child.to} to={child.to} onMouseEnter={() => prefetchRoute(child.to)}>
                      {({ isActive }) => (
                        <div className={cn(
                          "flex items-center justify-between px-2 py-1 rounded text-xs transition-colors",
                          isActive
                            ? "text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/60 dark:bg-emerald-950/30"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100/50"
                        )}>
                          <span className="truncate">{child.label}</span>
                          {child.count !== null && (
                            <span className="text-[10px] font-mono text-neutral-400">
                              {child.count}
                            </span>
                          )}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink to="/admin/classes">
                  {({ isActive }) => (
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 mx-auto rounded-md transition-colors",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}>
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold text-xs">Master Data</p>
              </TooltipContent>
            </Tooltip>
          )}

        </nav>

        {/* 4. Bottom Footer (Matching Neon Console Feedback, Onboarding Card, Collapse) */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-2.5 space-y-1 bg-white dark:bg-[#0c0d0e] shrink-0 mt-auto">
          {/* Feedback & Panduan */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/admin/panduan"
                  className="flex items-center justify-center h-8 w-8 mx-auto rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold text-xs">Feedback &amp; Panduan</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/admin/panduan"
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
            >
              <HelpCircle className="h-4 w-4 text-neutral-400" />
              <span>Feedback &amp; Panduan</span>
            </NavLink>
          )}

          {/* Neon-Style Onboarding Card: Exambro Siswa */}
          {!isCollapsed && showAgentCard && (
            <div className="relative rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40 p-2.5 my-1.5 text-xs">
              <button
                type="button"
                onClick={handleDismissCard}
                className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-0.5 rounded transition-colors"
                title="Tutup info"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 pr-4">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Exambro Siswa</span>
              </div>
              <div className="flex items-center gap-2 my-1 text-neutral-400">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <Wifi className="h-3 w-3 text-blue-500" />
                <Terminal className="h-3 w-3 text-neutral-400" />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                Proteksi ujian anti-curang kiosk mode aktif untuk seluruh peserta.
              </p>
              <a
                href="/download/exambro.apk"
                target="_blank"
                rel="noreferrer"
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 rounded transition-colors shadow-2xs"
              >
                <Download className="h-3 w-3 text-neutral-500" />
                <span>Unduh APK Siswa</span>
              </a>
            </div>
          )}

          {/* Collapse Menu Toggle Button */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="flex items-center justify-center h-8 w-8 mx-auto rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold text-xs">Perluas Menu</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none text-left cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-400" />
              <span>Collapse menu</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-white dark:bg-[#0c0d0e] border-r border-neutral-200 dark:border-neutral-800 shadow-2xl lg:hidden animate-in slide-in-from-left duration-200">
          <div className="flex h-[52px] items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
            <Logo />
            <button
              type="button"
              onClick={closeMobile}
              className="h-8 w-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate leading-tight">
                {schoolSlug || "modalbangsa"}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GitBranch className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    production
                  </span>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                closeMobile();
                const el = document.getElementById("connect-trigger-btn");
                if (el) el.click();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Connect</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={closeMobile} end={item.to === "/admin"}>
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}>
                    <div className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== null && (
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded">
                        {item.count}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}

            <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />

            {secondaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={closeMobile}>
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}>
                    <div className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}
    </TooltipProvider>
  );
};

export default Sidebar;
