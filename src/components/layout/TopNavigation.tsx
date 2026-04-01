import { LogOut, Menu, Search, User, Settings, Clock, Bell, ShieldAlert, Unlock, UserX } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useExamData } from "../../context/ExamDataContext";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeToggle } from "../ui/theme-toggle";
import { cn } from "../../lib/utils";
import { database } from "../../lib/firebase";
import { ref, onValue, get, update } from "firebase/database";

const TopNavigation = () => {
  const { user, signOut, usernameFromEmail } = useAuth();
  const { setMobileOpen } = useSidebar();
  const { students, classes } = useExamData();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [lockedAttempts, setLockedAttempts] = useState<any[]>([]);
  const [examRooms, setExamRooms] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = user?.displayName?.trim() || usernameFromEmail(user?.email) || "Pengguna";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
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

  // Listen for LOCKED attempts and Exam Rooms
  useEffect(() => {
    const roomsRef = ref(database, "exam_rooms");
    const unsubRooms = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        setExamRooms(snapshot.val());
      }
    });

    const attemptsRef = ref(database, "attempts");
    const unsubAttempts = onValue(attemptsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const locked: any[] = [];

        // data is { roomId: { nisn: attempt } }
        Object.keys(data).forEach(rid => {
          const roomAttempts = data[rid];
          Object.keys(roomAttempts).forEach(nisn => {
            if (roomAttempts[nisn].status === "LOCKED") {
              locked.push({ id: nisn, nisn, roomId: rid, ...roomAttempts[nisn] });
            }
          });
        });
        setLockedAttempts(locked);
      } else {
        setLockedAttempts([]);
      }
    });

    return () => {
      unsubRooms();
      unsubAttempts();
    };
  }, [students]);

  const handleUnlockStudent = async (nisn: string, roomId: string) => {
    try {
      await update(ref(database, `attempts/${roomId}/${nisn}`), {
        status: "ongoing",
        cheatCount: 0, // Reset cheat count after unlock
      });
    } catch (error) {
      console.error("Gagal membuka kunci student", error);
    }
  };

  const [universalToken, setUniversalToken] = useState<string>("");
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const tokenRef = ref(database, "settings/universal_token");
    const unsub1 = onValue(tokenRef, (snapshot) => {
      if (snapshot.exists()) {
        setUniversalToken(snapshot.val());
      } else {
        setUniversalToken("");
      }
    });

    const tokenUpdatedAtRef = ref(database, "settings/universal_token_updated_at");
    const unsub2 = onValue(tokenUpdatedAtRef, (snapshot) => {
      if (snapshot.exists()) {
        setTokenUpdatedAt(snapshot.val());
      } else {
        setTokenUpdatedAt(null);
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (!tokenUpdatedAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const nextUpdate = tokenUpdatedAt + 5 * 60 * 1000;
      const diff = nextUpdate - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        const rotateToken = async () => {
          try {
            const snap = await get(ref(database, "settings/universal_token_updated_at"));
            const lastFirebaseUpdate = snap.exists() ? snap.val() : 0;
            const nowCheck = Date.now();

            if (nowCheck - lastFirebaseUpdate >= 5 * 60 * 1000) {
              const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
              let token = "";
              for (let i = 0; i < 6; i++) {
                token += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              await update(ref(database, "settings"), {
                universal_token: token,
                universal_token_updated_at: nowCheck
              });
            }
          } catch (e) { }
        };
        rotateToken();
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tokenUpdatedAt]);

  return (
    <header className="flex w-full items-center gap-2 sm:gap-4 border-b bg-card/95 backdrop-blur-sm px-3 sm:px-6 py-2 sm:py-4 shadow-sm shrink-0 relative z-30">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0 touch-manipulation hover:bg-accent"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menu</span>
      </Button>
      <div className="flex-1" />

      {/* Universal Token */}
      {universalToken && (
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-700 dark:text-amber-400 shadow-sm shrink-0">
          <span className="text-xs sm:text-sm font-black font-mono tracking-widest tabular-nums">{universalToken}</span>
          {timeLeft && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-500 opacity-80 border-l pl-1.5 border-amber-200 dark:border-amber-800/40">{timeLeft}</span>}
        </div>
      )}

      {/* Live Clock - Hidden on Mobile */}
      {currentTime && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm shrink-0">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs sm:text-sm font-semibold tabular-nums tracking-wide">{currentTime}</span>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
              isNotifOpen && "bg-slate-100 dark:bg-slate-800"
            )}
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell className={cn("h-5 w-5", lockedAttempts.length > 0 ? "text-red-500 animate-pulse-slow" : "text-slate-500")} />
            {lockedAttempts.length > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
            <span className="sr-only">Notifikasi</span>
          </Button>

          {/* Notif Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-[320px] sm:w-[380px] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 z-[100] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <h3 className="font-bold text-sm">Siswa Terkunci</h3>
                </div>
                <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                  {lockedAttempts.length} Aktif
                </span>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {lockedAttempts.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <Bell className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium tracking-tight">Tidak ada Siswa yang terkunci saat ini.</p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-slate-800">
                    {lockedAttempts.map((item) => {
                      const student = students.find(s => s.nisn === item.nisn);
                      const room = examRooms[item.roomId];
                      const className = classes.find(c => c.id === student?.classId)?.name || "-";

                      return (
                        <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/30">
                              <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{student?.name || "Siswa Tidak Dikenal"}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                <span className="text-[10px] font-medium text-slate-500">{className}</span>
                                <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">{item.nisn}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 truncate">
                                  {room?.room_name || "Ruang Tidak Ditemukan"}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleUnlockStudent(item.nisn, item.roomId)}
                                size="sm"
                                className="w-full mt-3 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-sm shadow-blue-500/20"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                                Buka Kunci Navigasi
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {lockedAttempts.length > 0 && (
                <div className="p-2 border-t bg-slate-50/50 dark:bg-slate-900/40">
                  <p className="text-[9px] text-center text-slate-400 font-medium">Klik buka kunci untuk mengembalikan status Siswa menjadi aktif.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        <div className="hidden text-right md:flex md:flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</span>
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0 hover:bg-transparent touch-manipulation"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
              <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs sm:text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 sm:w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 z-[99999] pointer-events-auto">
              <div className="flex items-center justify-start gap-3 p-3 sm:p-2">
                <Avatar className="h-10 w-10 ring-2 ring-background">
                  <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1 leading-none min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base truncate">{displayName}</p>
                  <p className="truncate text-xs sm:text-sm text-muted-foreground">
                    {user?.email ?? ""}
                  </p>
                </div>
              </div>
              <div className="my-1 h-px bg-muted" />
              <div
                className="relative flex cursor-default select-none items-center rounded-sm px-3 sm:px-2 py-2 sm:py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent touch-manipulation"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Link
                  to="/admin/profile"
                  className="flex items-center cursor-pointer w-full min-h-[44px] sm:min-h-0"
                >
                  <User className="mr-3 sm:mr-2 h-4 w-4" />
                  <span>Profil & Nama</span>
                </Link>
              </div>
              <div
                className="relative flex cursor-default select-none items-center rounded-sm px-3 sm:px-2 py-2 sm:py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent touch-manipulation"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Link
                  to="/admin/change-password"
                  className="flex items-center cursor-pointer w-full min-h-[44px] sm:min-h-0"
                >
                  <Settings className="mr-3 sm:mr-2 h-4 w-4" />
                  <span>Ubah Password</span>
                </Link>
              </div>
              <div className="my-1 h-px bg-muted" />
              <div
                className="relative flex cursor-default select-none items-center rounded-sm px-3 sm:px-2 py-2 sm:py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent cursor-pointer text-red-600 focus:text-red-600 touch-manipulation min-h-[44px] sm:min-h-0"
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleSignOut();
                }}
              >
                <LogOut className="mr-3 sm:mr-2 h-4 w-4" />
                <span>Logout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavigation;


