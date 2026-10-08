import { NavLink } from "react-router-dom";
import {
  ClipboardList,
  Home,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Settings,
  Users,
  LayoutTemplate,
  BookOpen,
  ShieldAlert,
  GraduationCap,
  Award,
  ChevronDown,
  BarChart2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Activity,
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
      "hidden lg:flex h-full flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-slate-200/60 dark:border-slate-700/60 shadow-2xl transition-all duration-300 ease-in-out z-20",
      isCollapsed ? "w-16 lg:w-16" : "w-64 md:w-72 lg:w-80"
    )}>
      <div className={cn(
        "flex h-20 items-center justify-between px-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
        isCollapsed && "px-3"
      )}>
        <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
        {!isCollapsed && <Skeleton className="h-6 w-32 rounded-md" />}
      </div>
      <div className="flex-1 py-6 space-y-8 px-6">
        <div className="space-y-4">
          {!isCollapsed && <Skeleton className="h-3 w-20 rounded-md" />}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              {!isCollapsed && <Skeleton className="h-6 flex-1 rounded-md" />}
            </div>
          ))}
        </div>
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
           {!isCollapsed && <Skeleton className="h-3 w-24 rounded-md" />}
           {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              {!isCollapsed && <Skeleton className="h-6 flex-1 rounded-md" />}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

const Sidebar = () => {
  const { role, loading } = useAuth();
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
    type: "trial",
    label: "Demo / Trial",
    sublabel: "Akses Uji Coba",
    badgeColor: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeBorder: "border-blue-200 dark:border-blue-800/60",
  });

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
          ? (school.plan.charAt(0).toUpperCase() + school.plan.slice(1))
          : "Trial";

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
        } else if (paid.length > 0) {
          setAccountStatus({
            type: "paid",
            label: "Lunas / Aktif",
            sublabel: `Paket ${planName}`,
            badgeColor: "text-emerald-700 dark:text-emerald-300",
            badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
            badgeBorder: "border-emerald-200 dark:border-emerald-800/60",
          });
        } else {
          setAccountStatus({
            type: "trial",
            label: school.plan && school.plan !== "free" && school.plan !== "trial" ? `Paket ${planName}` : "Demo / Trial",
            sublabel: "Akses Uji Coba",
            badgeColor: "text-blue-700 dark:text-blue-300",
            badgeBg: "bg-blue-50 dark:bg-blue-950/40",
            badgeBorder: "border-blue-200 dark:border-blue-800/60",
          });
        }
      } catch (err) {
        console.error("Gagal memeriksa status akun:", err);
      }
    };

    checkInvoices();
    return () => { isMounted = false; };
  }, [school]);

  const navigation = React.useMemo(() => [
    { to: "/admin", label: "Dashboard", icon: Home, badge: null },
    { 
      label: "Ujian", 
      icon: ClipboardList, 
      badge: null,
      children: [
        { to: "/admin/bank-soal", label: "Bank Soal", icon: BookOpen },
        { to: "/admin/ruang-ujian", label: "Ruang Ujian", icon: ClipboardList },
        { to: "/admin/analisis-butir-soal", label: "Analisis Butir Soal", icon: BarChart2 }
      ]
    },
    { 
      label: "Master Data", 
      icon: LayoutTemplate, 
      badge: null,
      children: [
        { to: "/admin/classes", label: `Data ${terminology.class}`, icon: LayoutTemplate },
        { to: "/admin/subjects", label: `Data ${terminology.subject}`, icon: LayoutTemplate },
        { to: "/admin/teachers", label: `Data ${terminology.teacher}`, icon: Users },
        { to: "/admin/student", label: `Data ${terminology.student}`, icon: GraduationCap },
        { to: "/admin/alumni", label: "Data Alumni", icon: Award }
      ]
    },
    { 
      label: "Sistem", 
      icon: Settings, 
      badge: unpaidCount > 0 ? `${unpaidCount}` : null,
      children: [
        { to: "/admin/invoice", label: "Invoice", icon: FileText, badge: unpaidCount > 0 ? "Belum Bayar" : null },
        { to: "/admin/kelola-akun", label: "Kelola Akun", icon: ShieldAlert },
        { to: "/admin/status-server", label: "Status Server", icon: Activity },
        { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings }
      ]
    },
    { to: "/admin/panduan", label: "Panduan", icon: HelpCircle, badge: null }
  ], [terminology, unpaidCount]);
  
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>(() => 
    navigation.reduce((acc, item) => {
      if (item.children) acc[item.label] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredNavigation = React.useMemo(() => {
    // Sekolah ditangguhkan: admin hanya boleh membuka Invoice & Pengaturan
    // (untuk perpanjangan layanan). Fitur lain disembunyikan total.
    if (subscriptionStatus?.isSuspended) {
      return [
        {
          label: "Sistem",
          icon: Settings,
          badge: unpaidCount > 0 ? `${unpaidCount}` : null,
          children: [
            { to: "/admin/invoice", label: "Invoice", icon: FileText, badge: unpaidCount > 0 ? "Belum Bayar" : null },
            { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, badge: null },
          ],
        },
      ];
    }

    if (role === "admin") return navigation;
    
    // Default/Teacher role: Filter out System, but allow Master Data -> Data Siswa only
    return navigation
      .filter(item => item.label !== "Sistem")
      .map(item => {
        if (item.label === "Master Data") {
          return {
            ...item,
            children: item.children?.filter(child => child.label === `Data ${terminology.student}`)
          };
        }
        return item;
      })
      .filter(item => item.label !== "Master Data" || (item.children && item.children.length > 0));
  }, [role, navigation, terminology, subscriptionStatus, unpaidCount]);

  if (loading) return <SidebarSkeleton isCollapsed={isCollapsed} />;

  return (
    <TooltipProvider>
      {/* Mobile/Tablet backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex h-full flex-col bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 ease-in-out z-20 shadow-sm",
        isCollapsed ? "w-[72px]" : "w-[290px] md:w-[310px] lg:w-[320px]"
      )}>
        {/* Header with logo and collapse toggle */}
        <div className={cn(
          "flex h-[72px] items-center justify-between relative bg-white dark:bg-[#0B1120]",
          isCollapsed ? "px-3" : "px-4 md:px-5 lg:px-6"
        )}>
          <div className={cn(
            "flex items-center transition-all duration-300 min-w-0",
            isCollapsed && "md:opacity-0 md:w-0 md:overflow-hidden"
          )}>
            <Logo />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-9 w-9 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 group-hover:scale-110 transition-transform" />
            ) : (
              <ChevronLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>

          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-600 to-transparent"></div>
        </div>

        <nav className={cn(
          "flex-1 overflow-y-auto py-4 sm:py-6 space-y-1.5", 
          "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full",
          isCollapsed ? "px-3" : "px-4 md:px-5"
        )}>
          <div className={cn(
            "transition-all duration-300",
            isCollapsed ? "lg:hidden" : "mb-4 md:mb-6"
          )}>
            <div className="flex items-center gap-3 px-3 py-1 mb-2">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                Menu Utama
              </h3>
            </div>
          </div>

          {filteredNavigation.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isMenuExpanded = !!expandedMenus[item.label];

            if (isCollapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    {hasChildren ? (
                      <div
                        onClick={() => toggleCollapsed()}
                        className={cn(
                          "flex items-center justify-center rounded-xl h-12 w-12 mx-auto cursor-pointer transition-all duration-200 group relative",
                          "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                        {item.badge && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0B1120]" />
                        )}
                      </div>
                    ) : (
                      <NavLink to={item.to ?? "#"} end>
                        {({ isActive }) => (
                          <div
                            className={cn(
                              "flex items-center justify-center rounded-xl h-12 w-12 mx-auto transition-all duration-200 group relative",
                              isActive
                                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                          >
                            <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive && "scale-110")} />
                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />}
                          </div>
                        )}
                      </NavLink>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="block p-2 space-y-1 bg-slate-900 border-none rounded-lg shadow-xl text-white">
                    <p className="font-bold border-b border-slate-700 pb-1.5 mb-1.5 text-xs px-1">{item.label}</p>
                    {hasChildren && item.children!.map(child => (
                       <NavLink to={child.to} key={child.to} className="block text-[11px] px-2 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 font-medium transition-colors">
                          {child.label}
                       </NavLink>
                    ))}
                  </TooltipContent>
                </Tooltip>
              );
            }

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSubmenu(item.label)}
                    className={cn(
                      "w-full text-left group relative flex items-center gap-3.5 rounded-xl px-3 py-3 mx-1 text-sm font-semibold transition-all duration-200 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] transition-transform text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400" />
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="truncate">{item.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-400", isMenuExpanded && "rotate-180")} />
                    </div>
                  </button>

                  {isMenuExpanded && (
                    <div className="space-y-1 py-1 animate-in slide-in-from-top-1 duration-200 relative before:absolute before:left-[21px] before:top-0 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                      {item.children!.map(child => {
                        const getCount = (label: string) => {
                          if (label === `Data ${terminology.teacher}`) return examData.teachers.length;
                          if (label === `Data ${terminology.class}`) return examData.classes.length;
                          if (label === `Data ${terminology.subject}`) return examData.subjects.length;
                          if (label === `Data ${terminology.student}`) return examData.students.length;
                          if (label === "Bank Soal") return examData.examsCount;
                          if (label === "Ruang Ujian") return examData.roomsCount;
                          return null;
                        };
                        const count = getCount(child.label);

                        return (
                          <NavLink key={child.to} to={child.to} onClick={closeMobile} end>
                            {({ isActive }) => (
                              <div className={cn(
                                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 ml-[36px] mr-1 text-[13px] font-semibold transition-all duration-200",
                                isActive
                                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 relative"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                              )}>
                                {isActive && (
                                  <div className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-600 rounded-full" />
                                )}
                                <span className="truncate flex-1">{child.label}</span>
                                {child.label === "Invoice" && unpaidCount > 0 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                    Belum Bayar
                                  </span>
                                ) : (
                                  count !== null && !isCollapsed && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                      {count}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink key={item.to} to={item.to ?? "#"} onClick={closeMobile} end>
                {({ isActive }) => (
                  <div className={cn(
                    "group relative flex items-center gap-3.5 rounded-xl px-3 py-3 mx-1 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200"
                  )}>
                    <item.icon className={cn("h-[18px] w-[18px] transition-transform", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400")} />
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="truncate flex-1">{item.label}</span>
                      {(() => {
                        const getCount = (label: string) => {
                          switch(label) {
                            case "Bank Soal": return examData.examsCount;
                            case "Ruang Ujian": return examData.roomsCount;
                            default: return null;
                          }
                        };
                        const count = getCount(item.label);
                        return count !== null && !isCollapsed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            {count}
                          </span>
                        );
                      })()}
                    </div>
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer: Account Status */}
        {isCollapsed ? (
          <div className="p-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/admin/invoice"
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition border shadow-xs",
                    accountStatus.badgeBg, accountStatus.badgeBorder, accountStatus.badgeColor
                  )}
                >
                  {accountStatus.type === "paid" ? (
                    <CheckCircle2 size={16} />
                  ) : accountStatus.type === "unpaid" || accountStatus.type === "overdue" ? (
                    <AlertCircle size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold text-xs">{accountStatus.label}</p>
                <p className="text-[11px] text-slate-400">{accountStatus.sublabel}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1526] p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status Akun</span>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                  accountStatus.badgeBg, accountStatus.badgeColor, accountStatus.badgeBorder
                )}>
                  {accountStatus.label}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {school?.name || "Institusi"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {accountStatus.sublabel}
              </p>

              {unpaidCount > 0 ? (
                <NavLink
                  to="/admin/invoice"
                  className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 transition"
                >
                  <span>Bayar Tagihan ({unpaidCount})</span>
                  <ChevronRight size={13} />
                </NavLink>
              ) : (
                <NavLink
                  to="/admin/invoice"
                  className="mt-2.5 flex items-center justify-between w-full py-1 px-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  <span>Lihat Riwayat Tagihan</span>
                  <ChevronRight size={12} />
                </NavLink>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Mobile/Tablet Sidebar */}
      {isMobileOpen && (
        <aside className="fixed left-0 top-0 z-50 flex h-screen w-[290px] sm:w-[310px] flex-col bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/80 shadow-2xl lg:hidden">
          {/* Header with logo and close toggle */}
          <div className="flex h-[72px] items-center justify-between px-4 sm:px-5 relative bg-white dark:bg-[#0B1120]">
            <div className="flex items-center min-w-0 flex-1">
              <Logo />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] h-11 w-11 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={closeMobile}
            >
              <X className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span className="sr-only">Close menu</span>
            </Button>

            <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-600 to-transparent"></div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4 sm:py-6 space-y-1.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            <div className="mb-4">
              <div className="flex items-center gap-3 px-3 py-1 mb-2">
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                  Menu Utama
                </h3>
              </div>
            </div>

            {filteredNavigation.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isMenuExpanded = !!expandedMenus[item.label];

              if (hasChildren) {
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSubmenu(item.label)}
                      className={cn(
                        "w-full text-left group relative flex items-center gap-3.5 rounded-xl px-3 py-3 mx-1 text-sm font-semibold transition-all duration-200 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] transition-transform text-slate-400 dark:text-slate-500" />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-400", isMenuExpanded && "rotate-180")} />
                      </div>
                    </button>

                    {isMenuExpanded && (
                      <div className="space-y-1 py-1 relative before:absolute before:left-[21px] before:top-0 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800 animate-in slide-in-from-top-1">
                        {item.children!.map((child) => (
                          <NavLink key={child.to} to={child.to} onClick={closeMobile} end>
                            {({ isActive }) => (
                              <div className={cn(
                                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 ml-[36px] mr-1 text-[13px] font-semibold transition-all duration-200",
                                isActive 
                                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 relative" 
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                              )}>
                                {isActive && (
                                  <div className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-600 rounded-full" />
                                )}
                                <span className="truncate flex-1">{child.label}</span>
                                {child.label === "Invoice" && unpaidCount > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                    Belum Bayar
                                  </span>
                                )}
                              </div>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink key={item.label} to={item.to ?? "#"} onClick={closeMobile} end>
                  {({ isActive }) => (
                    <div className={cn(
                      "group relative flex items-center gap-3.5 rounded-xl px-3 py-3 mx-1 text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200"
                    )}>
                      <item.icon className={cn("h-[18px] w-[18px] transition-transform", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")} />
                      
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{item.label}</span>
                      </div>
                      
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />
                      )}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Mobile Sidebar Footer: Account Status */}
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1526] p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status Akun</span>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                  accountStatus.badgeBg, accountStatus.badgeColor, accountStatus.badgeBorder
                )}>
                  {accountStatus.label}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {school?.name || "Institusi"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {accountStatus.sublabel}
              </p>

              {unpaidCount > 0 ? (
                <NavLink
                  to="/admin/invoice"
                  onClick={closeMobile}
                  className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 transition"
                >
                  <span>Bayar Tagihan ({unpaidCount})</span>
                  <ChevronRight size={13} />
                </NavLink>
              ) : (
                <NavLink
                  to="/admin/invoice"
                  onClick={closeMobile}
                  className="mt-2.5 flex items-center justify-between w-full py-1 px-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  <span>Lihat Riwayat Tagihan</span>
                  <ChevronRight size={12} />
                </NavLink>
              )}
            </div>
          </div>
        </aside>
      )}
    </TooltipProvider>
  );
};

export default Sidebar;
