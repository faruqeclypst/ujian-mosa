import { LogOut, Menu, Search, User, Settings, Clock, Bell, ShieldAlert, Unlock, UserX, Sun, Moon, Monitor, Sparkles, KeyRound, Check, X, Loader2, Rocket, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useExamData } from "../../context/ExamDataContext";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../ui/toast";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import ChangePasswordModal from "../dialogs/ChangePasswordModal";
import AISettingsModal from "../dialogs/AISettingsModal";

const TopNavigation = () => {
  const { user, role, signOut, usernameFromEmail } = useAuth();
  const { setMobileOpen } = useSidebar();
  const { school, pb, terminology } = useTenant();
  const { theme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isCPModalOpen, setIsCPModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"profile" | "password">("profile");
  const [lockedAttempts, setLockedAttempts] = useState<any[]>([]);
  const [examRooms, setExamRooms] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState<string>("");
  const [notifTab, setNotifTab] = useState<"locked" | "reset">("locked");
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const displayName = (user as any)?.name || (user as any)?.username || usernameFromEmail(user?.email) || "Pengguna";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part: string) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "PG";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Gagal keluar", error);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen for LOCKED attempts and Exam Rooms from PocketBase
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        if (!pb) return;
        // Fetch Exam Rooms for names mapping
        const rooms = await pb.collection('exam_rooms').getFullList();
        if (!isMounted) return;
        const roomsMap: Record<string, any> = {};
        rooms.forEach((r: any) => { roomsMap[r.id] = r; });
        setExamRooms(roomsMap);

        // Fetch Locked Attempts
        const locked = await pb.collection('attempts').getFullList({
          filter: 'status = "LOCKED"',
          expand: 'studentId'
        });
        
        if (!isMounted) return;
        setLockedAttempts(locked.map((a: any) => ({
          id: a.id,
          nisn: a.expand?.studentId?.nisn || a.nisn || "N/A",
          studentId: a.studentId || a.student_id,
          roomId: a.examRoomId || a.exam_room_id,
          status: a.status,
          expand: a.expand
        })));
      } catch (e) {}
    };

    fetchInitialData();

    if (!pb) return;
    // Subscribe to Exam Rooms
    const unsubRooms = pb.collection('exam_rooms').subscribe("*", (e) => {
      if (!isMounted) return;
      if (e.action === "delete") {
        setExamRooms(prev => {
          const next = { ...prev };
          delete next[e.record.id];
          return next;
        });
      } else {
        setExamRooms(prev => ({ ...prev, [e.record.id]: e.record }));
      }
    });

    // Subscribe to Attempts - ONLY update if status is LOCKED or changing from LOCKED
    const unsubAttempts = pb.collection('attempts').subscribe("*", (e) => {
      if (!isMounted) return;
      
      const record = e.record as any;
      const isLocked = record.status === "LOCKED";
      
      setLockedAttempts(prev => {
        const exists = prev.find(a => a.id === record.id);
        
        if (e.action === "delete" || !isLocked) {
          if (exists) return prev.filter(a => a.id !== record.id);
          return prev;
        }
        
        // It's LOCKED and (create or update)
        const mapped = {
          id: record.id,
          nisn: record.expand?.studentId?.nisn || record.nisn || "N/A",
          studentId: record.studentId || record.student_id,
          roomId: record.examRoomId || record.exam_room_id,
          status: record.status,
          expand: record.expand
        };

        if (exists) {
          return prev.map(a => a.id === record.id ? mapped : a);
        }
        return [mapped, ...prev];
      });
    });

    return () => {
      isMounted = false;
      unsubRooms.then(un => un());
      unsubAttempts.then(un => un());
    };
  }, []);

  const handleUnlockStudent = async (attId: string) => {
    if (!pb) return;
    try {
      await pb.collection('attempts').update(attId, {
        status: "ongoing",
      });
    } catch (error) {
      console.error("Gagal membuka kunci student", error);
    }
  };

  const {
    teachers,
    students,
    classes,
    universalToken,
    timeLeft,
    resetStudentPassword,
    dismissResetRequest,
    resetStudentPasswordBatch,
  } = useExamData();
  const { addToast } = useToast();

  const handleCopyToken = async () => {
    if (!universalToken) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(universalToken);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = universalToken;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1800);
    } catch {
      // Gagal menyalin (misal diblokir browser)
    }
  };

  const resetRequests = useMemo(() => {
    return (students || []).filter((s) => !!s.resetRequested);
  }, [students]);

  const totalNotifications = lockedAttempts.length + resetRequests.length;

  // Beralih otomatis ke tab yang memiliki notifikasi aktif saat dibuka
  useEffect(() => {
    if (isNotifOpen) {
      if (lockedAttempts.length === 0 && resetRequests.length > 0) {
        setNotifTab("reset");
      } else if (lockedAttempts.length > 0 && resetRequests.length === 0) {
        setNotifTab("locked");
      }
    }
  }, [isNotifOpen, lockedAttempts.length, resetRequests.length]);

  const handleApproveReset = async (st: any) => {
    if (role !== "admin") return;
    setResettingId(st.id);
    try {
      await resetStudentPassword(st.id);
      addToast({
        title: "Password Berhasil Direset",
        description: `Password untuk ${st.name} (${st.nisn}) berhasil direset ke 12345678.`,
        type: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Mereset Password",
        description: err.message || "Terjadi kesalahan saat mereset password.",
        type: "error",
      });
    } finally {
      setResettingId(null);
    }
  };

  const handleDismissReset = async (st: any) => {
    if (role !== "admin") return;
    try {
      await dismissResetRequest(st.id);
      addToast({
        title: "Permintaan Dihapus",
        description: `Permintaan reset password untuk ${st.name} telah diabaikan.`,
        type: "info",
      });
    } catch (err: any) {
      console.error("Gagal menghapus permintaan reset:", err);
    }
  };

  const handleResetAll = async () => {
    if (role !== "admin" || resetRequests.length === 0) return;
    setIsResettingAll(true);
    try {
      const ids = resetRequests.map((r) => r.id);
      await resetStudentPasswordBatch(ids);
      addToast({
        title: "Semua Password Direset",
        description: `${ids.length} password siswa berhasil direset ke 12345678.`,
        type: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Mereset",
        description: err.message || "Terjadi kesalahan saat mereset password siswa.",
        type: "error",
      });
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <header className="flex w-full items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-[#0c0d0e]/95 backdrop-blur-xs px-3 sm:px-6 shrink-0 relative z-30 h-[52px]">
      {/* Left: Mobile Toggle & Project Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 touch-manipulation hover:bg-neutral-100 dark:hover:bg-neutral-800 h-8 w-8 rounded-md"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Menu</span>
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200 select-none">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {school?.slug || "ppdb"}
          </span>
          <span className="text-neutral-400">/</span>
          <span className="font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
            production
            <ChevronDown className="h-3 w-3 text-neutral-400" />
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Link
          to="/admin/invoice"
          className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700/80 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs select-none"
        >
          <Rocket className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
          <span>Upgrade</span>
        </Link>

        {/* Universal Token (Neon Console Badge - Click to Copy) */}
        {!universalToken && useExamData().loading ? (
          <Skeleton className="h-7 w-20 rounded-md hidden sm:block" />
        ) : universalToken && (
          <button
            type="button"
            onClick={handleCopyToken}
            title={copiedToken ? "Tersalin!" : "Klik untuk menyalin token ujian aktif"}
            aria-label={`Salin token ujian ${universalToken}`}
            className={cn(
              "group relative flex items-center gap-1.5 h-7 px-2.5 bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 hover:border-amber-400/50 dark:hover:border-amber-500/50 rounded-md text-neutral-800 dark:text-neutral-200 select-none shadow-2xs shrink-0 cursor-pointer transition-all active:scale-95 focus:outline-hidden",
              copiedToken && "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60"
            )}
          >
            {copiedToken ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in duration-150" />
            ) : (
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <span
              className={cn(
                "text-xs font-mono font-bold tracking-wider transition-colors",
                copiedToken ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              )}
            >
              {universalToken}
            </span>
            {timeLeft && (
              <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700 pl-1.5">
                {timeLeft}
              </span>
            )}
          </button>
        )}

        {/* Live Clock (Neon Console Clean Time) */}
        {!currentTime ? (
          <Skeleton className="h-7 w-16 rounded-md hidden sm:block" />
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 h-7 px-2 text-xs font-mono text-neutral-500 dark:text-neutral-400 select-none shrink-0">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span className="tabular-nums">{currentTime}</span>
          </div>
        )}

        {/* Notification Bell (Neon Style) */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={cn(
              "relative h-7 w-7 rounded-md flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer",
              isNotifOpen && "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            )}
            title="Notifikasi"
          >
            <Bell className={cn("h-3.5 w-3.5", totalNotifications > 0 ? "text-red-500 animate-pulse-slow" : "text-neutral-500")} />
            {totalNotifications > 0 && (
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
            )}
            <span className="sr-only">Notifikasi</span>
          </button>

          {/* Notif Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 z-[100] overflow-hidden">
              {/* Segmented Header Tabs */}
              <div className="p-2 border-b flex items-center gap-1.5 bg-slate-50/70 dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={() => setNotifTab("locked")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[36px]",
                    notifTab === "locked"
                      ? "bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-xs border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Terkunci</span>
                  {lockedAttempts.length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 px-1.5 py-0.2 rounded-full font-bold">
                      {lockedAttempts.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setNotifTab("reset")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[36px]",
                    notifTab === "reset"
                      ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Reset Password</span>
                  {resetRequests.length > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                      {resetRequests.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {notifTab === "locked" ? (
                  lockedAttempts.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <ShieldAlert className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium tracking-tight">Tidak ada {terminology.student} yang terkunci saat ini.</p>
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-slate-800">
                      {lockedAttempts.map((a) => {
                        const room = examRooms[a.roomId];

                        return (
                          <div key={a.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/30">
                                <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {a.expand?.studentId?.name || students.find(s => s.id === a.studentId)?.name || `${terminology.student} Tidak Dikenal`}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {classes.find(c => c.id === (a.expand?.studentId?.classId || students.find(s => s.id === a.studentId)?.classId))?.name || "-"}
                                  </span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                    {a.nisn !== "N/A" ? a.nisn : (students.find(s => s.id === a.studentId)?.nisn || "-")}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 truncate">
                                    {room?.room_name || room?.title || "Ruang Ujian"}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => role === "admin" && handleUnlockStudent(a.id)}
                                  size="sm"
                                  disabled={role !== "admin"}
                                  className="w-full mt-3 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={role !== "admin" ? "Hanya admin yang dapat membuka kunci" : "Buka kunci siswa"}
                                >
                                  <Unlock className="h-3.5 w-3.5" />
                                  {role === "admin" ? "Buka Kunci Navigasi" : "Hanya Admin"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  resetRequests.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <KeyRound className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium tracking-tight">Tidak ada permintaan reset password saat ini.</p>
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-slate-800">
                      {resetRequests.map((st) => {
                        const studentClass = classes.find((c) => c.id === st.classId)?.name || "-";
                        let timeStr = "";
                        if (st.resetRequested) {
                          try {
                            const d = new Date(st.resetRequested);
                            timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                          } catch (_) {}
                        }

                        const isThisResetting = resettingId === st.id;

                        return (
                          <div key={st.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400">
                                <KeyRound className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                    {st.name}
                                  </p>
                                  {timeStr && (
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      {timeStr}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {studentClass}
                                  </span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                    {st.nisn}
                                  </span>
                                </div>

                                <div className="mt-2.5 flex items-center gap-1.5">
                                  <Button
                                    onClick={() => handleApproveReset(st)}
                                    size="sm"
                                    disabled={role !== "admin" || isThisResetting}
                                    className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold gap-1 shadow-sm disabled:opacity-50"
                                    title="Reset password siswa ini menjadi 12345678"
                                  >
                                    {isThisResetting ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    <span>Reset ke 12345678</span>
                                  </Button>

                                  <Button
                                    onClick={() => handleDismissReset(st)}
                                    size="sm"
                                    variant="ghost"
                                    disabled={role !== "admin"}
                                    className="h-8 px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg text-xs"
                                    title="Abaikan permintaan reset ini"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {notifTab === "locked" && lockedAttempts.length > 0 && (
                <div className="p-2.5 border-t bg-slate-50/50 dark:bg-slate-900/40">
                  <p className="text-[10px] text-center text-slate-400 font-medium font-bold">
                    Klik buka kunci untuk mengembalikan status {terminology.student} menjadi aktif.
                  </p>
                </div>
              )}

              {notifTab === "reset" && resetRequests.length > 0 && (
                <div className="p-2.5 border-t bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Password akan diubah menjadi <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">12345678</strong>.
                  </p>
                  {resetRequests.length > 1 && role === "admin" && (
                    <Button
                      onClick={handleResetAll}
                      size="sm"
                      disabled={isResettingAll}
                      className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shrink-0 gap-1"
                    >
                      {isResettingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span>Reset Semua ({resetRequests.length})</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Dropdown Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 h-7 px-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-colors select-none cursor-pointer"
          >
            <Avatar className="h-5 w-5 rounded-full ring-1 ring-neutral-200/80 dark:ring-neutral-700/80">
              <AvatarImage src={(user as any)?.avatar || undefined} alt={displayName} />
              <AvatarFallback className="bg-red-600 text-white text-[10px] font-bold">
                {initials[0]}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-xs text-neutral-800 dark:text-neutral-200 truncate max-w-[100px]">
              {displayName}
            </span>
            <ChevronDown className="h-3 w-3 text-neutral-400" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[280px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xl animate-in fade-in-0 zoom-in-95 z-[99999] pointer-events-auto overflow-hidden">
              {/* Header Profile Info */}
              <div className="flex items-center justify-start gap-3 p-4 bg-slate-50/50 dark:bg-transparent">
                <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-800 shadow-sm">
                  <AvatarImage src={(user as any)?.avatar || undefined} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5 min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="truncate text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                    {teachers.find(t => t.id === (user as any)?.teacherId)?.subjects || user?.email || ""}
                  </p>
                </div>
              </div>
              
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              
              {/* Profile Dropdown Plan Badge */}
              <div className="p-3 bg-amber-50/50 dark:bg-[#1e1b12]">
                <div className="flex flex-col rounded-lg border border-amber-200/50 dark:border-amber-900/40 bg-white dark:bg-black/20 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest leading-none">
                      {school?.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : "Free"} Plan
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded leading-none">
                      {students.length}/{school?.student_quota || 50} {terminology.student}
                    </span>
                  </div>
                  <div className="pt-2.5 mt-0.5 border-t border-amber-100 dark:border-amber-900/30 flex flex-col gap-1 text-[10px] text-amber-900/70 dark:text-amber-500/80 font-medium">
                    <span>Info Upgrade Hubungi:</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold block truncate">Alfaruq Asri, S.Pd., Gr</span>
                    <span className="font-bold truncate">0853-5990-7696</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              {/* Tampilan (Theme Segmented Control) */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2.5">
                  Tampilan
                </p>
                <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 rounded-lg p-1 border border-slate-200/50 dark:border-slate-800/80">
                  <button
                    onClick={() => setTheme("light")}
                    aria-label="Mode Terang"
                    className={cn(
                      "flex-1 flex justify-center items-center min-h-[36px] py-1.5 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      theme === "light" 
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:text-white" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    aria-label="Mode Sistem"
                    className={cn(
                      "flex-1 flex justify-center items-center min-h-[36px] py-1.5 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      theme === "system" 
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:text-white" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    aria-label="Mode Gelap"
                    className={cn(
                      "flex-1 flex justify-center items-center min-h-[36px] py-1.5 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      theme === "dark" 
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:text-white" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    <Moon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              
              <div className="p-1.5">
                <button
                  className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setModalTab("profile");
                    setIsCPModalOpen(true);
                  }}
                >
                  <User className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>Profil & Nama</span>
                </button>

                <button
                  className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsAIModalOpen(true);
                  }}
                >
                  <Sparkles className="mr-3 h-4 w-4 text-blue-500 dark:text-blue-400" />
                  <span>Pengaturan AI</span>
                </button>
                
                <button
                  className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setModalTab("password");
                    setIsCPModalOpen(true);
                  }}
                >
                  <Settings className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>Ubah Password</span>
                </button>
              </div>
              
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              
              <div className="p-1.5 bg-slate-50/50 dark:bg-transparent">
                <button
                  className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleSignOut();
                  }}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Profile & Password Change Modal */}
      <ChangePasswordModal 
        isOpen={isCPModalOpen} 
        onClose={() => setIsCPModalOpen(false)} 
        defaultTab={modalTab}
      />

      {/* Dedicated AI Configuration Modal */}
      <AISettingsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />
    </header>
  );
};

export default TopNavigation;


