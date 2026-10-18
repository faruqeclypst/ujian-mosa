import { ReactNode, Suspense } from "react";
import { Outlet, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";
import { useSidebar } from "../../context/SidebarContext";
import { useTenant } from "../../context/TenantContext";
import { cn } from "../../lib/utils";

interface InventoryLayoutProps {
  children?: ReactNode;
}

const InventoryLayout = ({ children }: InventoryLayoutProps) => {
  const { isCollapsed } = useSidebar();
  const { subscriptionStatus } = useTenant();
  const isSuspended = !!subscriptionStatus?.isSuspended;

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-foreground relative">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out">
        <TopNavigation />
        {isSuspended && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-medium">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Layanan ditangguhkan sementara — hanya halaman Invoice &amp; Pengaturan yang dapat diakses.{" "}
              <Link to="/admin/invoice" className="underline font-bold hover:text-amber-900 dark:hover:text-amber-100">
                Perpanjang layanan
              </Link>{" "}
              untuk membuka semua fitur.
            </span>
          </div>
        )}
        <main
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden relative",
            isCollapsed ? "p-3 sm:p-4 lg:p-6" : "p-3 sm:p-4 lg:p-5"
          )}
          style={{ zIndex: 1 }}
        >
          <div className="w-full mx-auto transition-all duration-200 ease-in-out">
            <Suspense fallback={null}>
              {children ?? <Outlet />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InventoryLayout;
