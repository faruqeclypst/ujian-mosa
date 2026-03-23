import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";
import { useSidebar } from "../../context/SidebarContext";
import { cn } from "../../lib/utils";

interface InventoryLayoutProps {
  children?: ReactNode;
}

const InventoryLayout = ({ children }: InventoryLayoutProps) => {
  const location = useLocation();
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-foreground relative">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out">
        <TopNavigation />
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden relative",
            isCollapsed ? "p-3 sm:p-4 lg:p-8" : "p-3 sm:p-4 lg:p-6"
          )}
          style={{ zIndex: 1 }}
        >
          <div className={cn(
            "w-full mx-auto transition-all duration-300 ease-in-out",
            isCollapsed ? "max-w-none" : "max-w-7xl"
          )}>
            {children ?? <Outlet />}
          </div>
        </motion.main>
      </div>
    </div>
  );
};

export default InventoryLayout;
