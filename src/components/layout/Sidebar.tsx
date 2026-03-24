import { NavLink } from "react-router-dom";
import {
  ClipboardList,
  Home,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Settings,
  CalendarCheck,
  Users,
  LayoutTemplate,
  BookOpen,
  ShieldAlert,
  GraduationCap,
  Award,
  ChevronDown
} from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Logo from "./logo";
import AppGuide from "../guide/AppGuide";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";

const navigation = [
  { to: "/admin", label: "Dashboard", icon: Home, badge: null },
  { 
    label: "Ujian", 
    icon: ClipboardList, 
    badge: null,
    children: [
      { to: "/admin/bank-soal", label: "Bank Soal", icon: BookOpen },
      { to: "/admin/ruang-ujian", label: "Ruang Ujian", icon: ClipboardList }
    ]
  },
  { 
    label: "Master Data", 
    icon: LayoutTemplate, 
    badge: null,
    children: [
      { to: "/admin/kelas", label: "Data Kelas", icon: LayoutTemplate },
      { to: "/admin/mapel", label: "Data Mapel", icon: LayoutTemplate },
      { to: "/admin/guru", label: "Data Guru", icon: Users },
      { to: "/admin/siswa", label: "Data Siswa", icon: GraduationCap },
      { to: "/admin/alumni", label: "Data Alumni", icon: Award }
    ]
  },
  { 
    label: "Sistem", 
    icon: Settings, 
    badge: null,
    children: [
      { to: "/admin/kelola-akun", label: "Kelola Akun", icon: ShieldAlert },
      { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings }
    ]
  }
];

// Remove the old interface since we're using context now

const Sidebar = () => {
  const [showGuide, setShowGuide] = React.useState(false);
  const { user, role, usernameFromEmail } = useAuth(); // <--- added role
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredNavigation = React.useMemo(() => {
    return navigation; // No more role filter for piket
  }, []);

  const displayName = user?.displayName?.trim() || usernameFromEmail(user?.email) || "Pengguna";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "PG";

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
        "hidden lg:flex h-full flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-slate-200/60 dark:border-slate-700/60 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-in-out z-20",
        // Width transitions - responsive widths
        isCollapsed ? "w-16 lg:w-16" : "w-64 md:w-72 lg:w-80"
      )}>
        {/* Header with logo and collapse toggle */}
        <div className={cn(
          "flex h-20 items-center justify-between relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
          isCollapsed ? "px-3" : "px-3 sm:px-4 md:px-5 lg:px-6"
        )}>
          <div className={cn(
            "flex items-center transition-all duration-300 min-w-0",
            isCollapsed && "md:opacity-0 md:w-0 md:overflow-hidden"
          )}>
            <Logo />
          </div>

          {/* Desktop collapse toggle */}
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

          {/* Decorative line */}
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-600 to-transparent"></div>
        </div>
        {/* Navigation */}
        <nav className={cn("flex-1 py-3 sm:py-4 md:py-6 space-y-2", isCollapsed ? "px-2" : "px-3 sm:px-4 md:px-5 lg:px-6")}>
          <div className={cn(
            "transition-all duration-300",
            isCollapsed ? "lg:hidden" : "mb-3 sm:mb-4 md:mb-6"
          )}>
            <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 mb-2 sm:mb-3 md:mb-4">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex-shrink-0"></div>
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                Navigation
              </h3>
              <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent"></div>
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
                          "flex items-center justify-center rounded-xl p-2 sm:p-2.5 h-10 w-10 sm:h-12 sm:w-12 mx-auto cursor-pointer transition-all duration-300 group-hover:scale-105",
                          "text-slate-600 dark:text-slate-300 hover:text-white hover:bg-gradient-to-br hover:from-blue-400 hover:to-indigo-500 dark:hover:from-blue-500 dark:hover:to-indigo-600 hover:shadow-lg"
                        )}
                      >
                        <item.icon className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110" />
                      </div>
                    ) : (
                      <NavLink to={item.to ?? "#"} end>
                        {({ isActive }) => (
                          <div
                            className={cn(
                              "flex items-center justify-center rounded-xl p-2 sm:p-2.5 h-10 w-10 sm:h-12 sm:w-12 mx-auto transition-all duration-300 group-hover:scale-105",
                              isActive
                                ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                                : "text-slate-600 dark:text-slate-300 hover:text-white hover:bg-gradient-to-br hover:from-blue-400 hover:to-indigo-500 dark:hover:from-blue-500 dark:hover:to-indigo-600 hover:shadow-lg"
                            )}
                          >
                            <item.icon className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110" />
                          </div>
                        )}
                      </NavLink>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:block hidden p-2 space-y-1 bg-white dark:bg-slate-800 border rounded-lg shadow-md">
                    <p className="font-bold border-b pb-1 mb-1 text-[11px] text-slate-800 dark:text-slate-200">{item.label}</p>
                    {hasChildren && item.children!.map(child => (
                       <NavLink to={child.to} key={child.to} className="block text-xs px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
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
                  <div
                    onClick={() => toggleSubmenu(item.label)}
                    className={cn(
                      "group relative flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 mx-1 text-sm font-medium transition-all duration-300 cursor-pointer text-slate-600 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:text-slate-800 dark:hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-400 group-hover:to-indigo-500 dark:group-hover:from-blue-500 dark:group-hover:to-indigo-600 group-hover:text-white transition-all duration-300 shrink-0 group-hover:scale-110"
                    )}>
                      <item.icon className="h-4 w-4 transition-transform" />
                    </div>
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="truncate font-medium">{item.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-400 group-hover:text-slate-600", isMenuExpanded && "rotate-180")} />
                    </div>
                  </div>

                  {isMenuExpanded && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                      {item.children!.map(child => (
                        <NavLink key={child.to} to={child.to} onClick={closeMobile} end>
                          {({ isActive }) => (
                            <div className={cn(
                              "group relative flex items-center gap-3 rounded-md px-3 py-1.5 ml-6 mr-1 text-xs font-medium transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
                              isActive
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 shadow-sm border border-blue-200/50 dark:border-blue-600/30"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            )}>
                              <div className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
                                isActive ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400 group-hover:bg-blue-500 group-hover:text-white"
                              )}>
                                <child.icon className="h-3 w-3" />
                              </div>
                              <span className="truncate">{child.label}</span>
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
              <NavLink key={item.to} to={item.to ?? "#"} onClick={closeMobile} end>
                {({ isActive }) => (
                  <div className={cn(
                    "group relative flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 mx-1 text-sm font-medium transition-all duration-300 hover:translate-x-1",
                    isActive
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-200 shadow-lg border border-blue-200/50 dark:border-blue-600/30"
                      : "text-slate-600 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:text-slate-800 dark:hover:text-white"
                  )}>
                    <div className={cn(
                      "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-all duration-300 shrink-0 group-hover:scale-110",
                      isActive
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                        : "bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-400 group-hover:to-indigo-500 dark:group-hover:from-blue-500 dark:group-hover:to-indigo-600 group-hover:text-white"
                    )}>
                      <item.icon className="h-4 w-4 transition-transform" />
                    </div>
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                    {isActive && (
                      <div className="absolute left-0 top-1 sm:top-1.5 bottom-1 sm:bottom-1.5 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full" />
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={cn("mt-auto py-3 sm:py-4 md:py-6 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border-t border-slate-200/60 dark:border-slate-700/60", isCollapsed ? "px-2" : "px-3 sm:px-4 md:px-5 lg:px-6")}>
          <div className="space-y-3">
            {/* Settings Link */}


            {/* Help Button */}
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => setShowGuide(true)}
                    className="w-10 h-10 sm:w-12 sm:h-12 p-0 mx-auto flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-105 text-slate-600 dark:text-slate-300 hover:text-white hover:bg-gradient-to-br hover:from-blue-400 hover:to-indigo-500 dark:hover:from-blue-500 dark:hover:to-indigo-600 hover:shadow-lg"
                  >
                    <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 transition-transform hover:scale-110" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:block hidden">
                  <p>Panduan Aplikasi</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setShowGuide(true)}
                className="group relative flex items-center gap-4 rounded-xl px-4 py-3 mx-1 text-sm font-medium transition-all duration-300 hover:translate-x-1 text-slate-600 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:text-slate-800 dark:hover:text-white w-full justify-start"
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0 group-hover:scale-110",
                  "bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-400 group-hover:to-indigo-500 dark:group-hover:from-blue-500 dark:group-hover:to-indigo-600 group-hover:text-white"
                )}>
                  <HelpCircle className="h-4 w-4 transition-transform" />
                </div>
                <span className="truncate font-medium">Panduan Aplikasi</span>
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile/Tablet Sidebar */}
      {isMobileOpen && (
        <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 sm:w-72 flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-slate-200/60 dark:border-slate-700/60 shadow-2xl backdrop-blur-sm lg:hidden">
          {/* Header with logo and close toggle */}
          <div className="flex h-20 items-center justify-between px-3 sm:px-4 md:px-5 relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <div className="flex items-center min-w-0 flex-1">
              <Logo />
            </div>

            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group"
              onClick={closeMobile}
            >
              <X className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="sr-only">Close menu</span>
            </Button>

            {/* Decorative line */}
            <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-600 to-transparent"></div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 sm:px-4 md:px-5 py-3 sm:py-4 md:py-6 space-y-2">
            <div className="mb-3 sm:mb-4 md:mb-6">
              <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 mb-2 sm:mb-3 md:mb-4">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex-shrink-0"></div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                  Navigation
                </h3>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent"></div>
              </div>
            </div>

            {filteredNavigation.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isMenuExpanded = !!expandedMenus[item.label];

              if (hasChildren) {
                return (
                  <div key={item.label} className="space-y-1">
                    <div
                      onClick={() => toggleSubmenu(item.label)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 cursor-pointer text-slate-600 dark:text-slate-200"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-400", isMenuExpanded && "rotate-180")} />
                      </div>
                    </div>

                    {isMenuExpanded && (
                      <div className="space-y-1 pl-4 border-l ml-6 border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-1">
                        {item.children!.map((child) => (
                          <NavLink key={child.to} to={child.to} onClick={closeMobile} end>
                            {({ isActive }) => (
                              <div className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                                isActive 
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" 
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                              )}>
                                <child.icon className="h-3.5 w-3.5" />
                                <span className="truncate">{child.label}</span>
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
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
                      isActive
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-800/30"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                    )}>
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors shrink-0",
                        isActive ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{item.label}</span>
                      </div>
                      
                      {isActive && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-blue-600 rounded-r" />
                      )}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 mt-auto">
            <Separator className="mb-4" />

            <div className="space-y-2">
              {/* Settings Link */}


              {/* Help Button */}
              <Button
                variant="ghost"
                onClick={() => {
                  setShowGuide(true);
                  closeMobile();
                }}
                className="w-full h-10 justify-start gap-3 px-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 shrink-0">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <span className="truncate">Panduan Aplikasi</span>
              </Button>
            </div>
          </div>
        </aside>
      )}

      <AppGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </TooltipProvider>
  );
};

export default Sidebar;
