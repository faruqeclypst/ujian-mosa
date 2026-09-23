import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, LogOut, X, MoreHorizontal, ShieldAlert } from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";

const CheatAlert = registerPlugin<any>("CheatAlert");

const CapacitorOverlay = () => {
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [dialogType, setDialogType] = useState<"none" | "refresh" | "exit">("none");
  const [isExitingApp, setIsExitingApp] = useState(false);
  const [isKickedOverlay, setIsKickedOverlay] = useState(false);

  // Simple drag implementation
  const fabRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragState.current = {
      isDragging: true,
      startX: touch.clientX - position.x,
      startY: touch.clientY - position.y,
      offsetX: position.x,
      offsetY: position.y,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current.isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragState.current.startX;
    const newY = touch.clientY - dragState.current.startY;
    setPosition({ x: newX, y: newY });
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragState.current.isDragging = false;
  }, []);

  useEffect(() => {
    // Only show on Android native platform
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      setIsCapacitor(true);
      try {
        CheatAlert.stopAlarm();
      } catch (e) {}
    }

    // Block back button
    const backListener = App.addListener("backButton", () => {});

    // Sembunyikan FAB jika siswa di-kick karena double login
    const handleStudentKicked = () => {
      setIsKickedOverlay(true);
      setShowMenu(false);
      setDialogType("none");
    };
    window.addEventListener("app:studentKicked", handleStudentKicked);

    return () => {
      backListener.then((l) => l.remove());
      window.removeEventListener("app:studentKicked", handleStudentKicked);
    };
  }, []);

  const isExcludedRoute =
    window.location.pathname.startsWith("/admin") ||
    window.location.pathname.startsWith("/superadmin");

  if (!isCapacitor || isExcludedRoute || isKickedOverlay) return null;

  const handleRefresh = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await CheatAlert.stopAlarm();
        } catch (e) {}
      }
    } catch (e) {}
    window.location.reload();
  };

  const handleExitApp = async () => {
    setIsExitingApp(true);
    try {
      // Hapus sesi student saat exit aplikasi agar saat dibuka kembali wajib login ulang
      try {
        sessionStorage.removeItem("student_session_active");
        sessionStorage.removeItem("student_session_id");
        localStorage.removeItem("student_session_id");
      } catch (_) {}

      if (Capacitor.isNativePlatform()) {
        try {
          await CheatAlert.stopAlarm();
          await CheatAlert.exitApp();
          return;
        } catch (e) {
          console.warn("CheatAlert.exitApp error:", e);
        }
        await App.exitApp();
      } else {
        setDialogType("none");
        window.close();
      }
    } catch (e) {
      console.error("Exit system failed:", e);
      try {
        await App.exitApp();
      } catch (_) {}
    } finally {
      setIsExitingApp(false);
    }
  };

  return (
    <>
      {/* Draggable Menu Toggle */}
      <div
        ref={fabRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="fixed bottom-24 right-5 flex flex-col items-center gap-2.5 z-[9990] pointer-events-auto select-none print:hidden touch-none"
      >
        {showMenu && (
          <div className="flex flex-col gap-2.5 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Refresh Button */}
            <button
              onClick={() => {
                handleRefresh();
                setShowMenu(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl border border-emerald-400 active:scale-90 transition-transform"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>

            {/* Exit Button */}
            <button
              onClick={() => {
                setDialogType("exit");
                setShowMenu(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-xl border border-rose-400 active:scale-90 transition-transform"
              title="Exit"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-2xl border active:scale-90 transition-transform ${
            showMenu
              ? "bg-slate-900 border-slate-700 text-white"
              : "bg-emerald-500 border-emerald-400 text-white"
          }`}
        >
          {showMenu ? <X size={20} /> : <MoreHorizontal size={20} />}
        </button>
      </div>

      {dialogType !== "none" && (
        <div
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/60 pointer-events-auto touch-auto"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-[320px] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 pointer-events-auto">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              {dialogType === "refresh" ? (
                <RefreshCw className="text-blue-500 w-6 h-6" />
              ) : (
                <ShieldAlert className="text-rose-500 w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-bold text-center mb-1.5 text-slate-900 dark:text-white">
              {dialogType === "refresh" ? "Muat Ulang Halaman?" : "Keluar Dari Aplikasi?"}
            </h3>

            <p className="text-center text-slate-500 dark:text-slate-400 text-xs mb-5 leading-relaxed">
              {dialogType === "refresh"
                ? "Seluruh progres jawaban yang belum tersimpan mungkin akan hilang."
                : "Apakah Anda yakin ingin keluar dari aplikasi ujian?"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isExitingApp}
                onClick={() => setDialogType("none")}
                className="w-full py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                Tidak
              </button>
              <button
                type="button"
                disabled={isExitingApp}
                onClick={dialogType === "refresh" ? handleRefresh : handleExitApp}
                className={`w-full py-3 rounded-xl font-bold text-white text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 ${
                  dialogType === "refresh" ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isExitingApp ? "Keluar..." : "Ya"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CapacitorOverlay;
