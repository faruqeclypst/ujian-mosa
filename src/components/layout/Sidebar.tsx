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
  Award
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
  { to: "/admin/bank-soal", label: "Bank Soal", icon: BookOpen, badge: null },
  { to: "/admin/ruang-ujian", label: "Ruang Ujian", icon: ClipboardList, badge: null },
  { to: "/admin/mapel", label: "Data Mapel", icon: LayoutTemplate, badge: null }, 
  { to: "/admin/guru", label: "Data Guru", icon: Users, badge: null },
  { to: "/admin/siswa", label: "Data Siswa", icon: GraduationCap, badge: null },
  { to: "/admin/alumni", label: "Data Alumni", icon: Award, badge: null },
  { to: "/admin/kelas", label: "Data Kelas", icon: LayoutTemplate, badge: null },
  { to: "/admin/kelola-akun", label: "Kelola Akun", icon: ShieldAlert, badge: null },
];

// Remove the old interface since we're using context now

const Sidebar = () => {
  const [showGuide, setShowGuide] = React.useState(false);
  const { user, role, usernameFromEmail } = useAuth(); // <--- added role
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();

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
        "hidden lg:flex h-full flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-slate-200/60 dark:border-slate-700/60 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-in-out",
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
        <nav className={cn("flex-1 py-3 sm:py-4 md:py-6 space-y-2", isCollapsed ? "px-2" : "px-3 sm:px-4 md:px-5 lg:px-6") }>
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
            if (isCollapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink to={item.to} end>
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
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:block hidden">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            const NavItem = ({ isActive }: { isActive: boolean }) => (
              <div className={cn(
                "group relative flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 mx-1 text-sm font-medium transition-all duration-300 hover:translate-x-1",
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-200 shadow-lg border border-blue-200/50 dark:border-blue-600/30"
                  : "text-slate-600 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:text-slate-800 dark:hover:text-white"
              )}>
                <div className={cn(
                  "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0 group-hover:scale-110",
                  isActive
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                    : "bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-400 group-hover:to-indigo-500 dark:group-hover:from-blue-500 dark:group-hover:to-indigo-600 group-hover:text-white"
                )}>
                  <item.icon className="h-4 w-4 transition-transform" />
                </div>

                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate font-medium">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto text-xs bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 dark:from-orange-900/30 dark:to-orange-800/30 dark:text-orange-300 border-0 shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </div>

                {isActive && (
                  <div className="absolute left-0 top-1.5 sm:top-2 bottom-1.5 sm:bottom-2 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full" />
                )}
              </div>
            );
            
            return (
              <NavLink key={item.to} to={item.to} end>
                {({ isActive }) => <NavItem isActive={isActive} />}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={cn("mt-auto py-3 sm:py-4 md:py-6 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border-t border-slate-200/60 dark:border-slate-700/60", isCollapsed ? "px-2" : "px-3 sm:px-4 md:px-5 lg:px-6") }>
          <div className="space-y-3">
            {/* Settings Link */}
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink to="/admin/change-password">
                    {({ isActive }) => (
                      <div
                        className={cn(
                          "flex items-center justify-center rounded-xl p-2 sm:p-2.5 h-10 w-10 sm:h-12 sm:w-12 mx-auto transition-all duration-300 group-hover:scale-105",
                          isActive
                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                            : "text-slate-600 dark:text-slate-300 hover:text-white hover:bg-gradient-to-br hover:from-blue-400 hover:to-indigo-500 dark:hover:from-blue-500 dark:hover:to-indigo-600 hover:shadow-lg"
                        )}
                      >
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    )}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:block hidden">
                  <p>Ubah Password</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <NavLink
                to="/admin/change-password"
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-4 rounded-xl px-4 py-3 mx-1 text-sm font-medium transition-all duration-300 hover:translate-x-1",
                    isActive
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-200 shadow-lg border border-blue-200/50 dark:border-blue-600/30"
                      : "text-slate-600 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:text-slate-800 dark:hover:text-white"
                  )
                }
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0 group-hover:scale-110",
                  "bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-400 group-hover:to-indigo-500 dark:group-hover:from-blue-500 dark:group-hover:to-indigo-600 group-hover:text-white"
                )}>
                  <Settings className="h-4 w-4 transition-transform" />
                </div>
                <span className="truncate">Ubah Password</span>
              </NavLink>
            )}

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
            
            {filteredNavigation.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={closeMobile} end>
                {({ isActive }) => (
                  <div className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-accent/50",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors shrink-0",
                      isActive ? "bg-primary/20" : "bg-muted/50 group-hover:bg-accent"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex flex-1 items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    
                    {isActive && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r" />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 mt-auto">
            <Separator className="mb-4" />
            
            <div className="space-y-2">
              {/* Settings Link */}
              <NavLink
                to="/admin/change-password"
                onClick={closeMobile}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-accent/50",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 group-hover:bg-accent shrink-0">
                  <Settings className="h-4 w-4" />
                </div>
                <span className="truncate">Ubah Password</span>
              </NavLink>

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
