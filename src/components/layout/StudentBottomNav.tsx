import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, FileText, User } from "lucide-react";
import { cn } from "../../lib/utils";

interface StudentBottomNavProps {
  activeTab: "home" | "history" | "profile";
  onTabChange?: (tab: "home" | "history" | "profile") => void;
}

export const StudentBottomNav: React.FC<StudentBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const navigate = useNavigate();

  const handleNav = (tab: "home" | "history" | "profile") => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      if (tab === "home") navigate("/exam");
      else if (tab === "history") navigate("/exam?tab=history");
      else if (tab === "profile") navigate("/exam/profile");
    }
  };

  const navItems = [
    { key: "home" as const, label: "Ujian", icon: Home },
    { key: "history" as const, label: "Riwayat", icon: FileText },
    { key: "profile" as const, label: "Profil", icon: User },
  ];

  return (
    <nav
      aria-label="Navigasi Siswa"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-200/80 dark:border-neutral-800 lg:hidden px-3 py-1.5 shadow-lg shadow-neutral-900/5 select-none"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNav(item.key)}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer active:scale-95 min-h-[48px]",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium"
              )}
            >
              <div
                className={cn(
                  "px-4 py-1 rounded-full transition-all flex items-center justify-center",
                  isActive
                    ? "bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
                    : "bg-transparent"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform", isActive ? "scale-105" : "")} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default StudentBottomNav;

