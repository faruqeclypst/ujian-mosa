import { LogOut, Menu, Search, User, Settings, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>(""); // <--- added
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header className="flex w-full items-center gap-3 sm:gap-4 border-b bg-card/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 shadow-sm shrink-0 relative z-30">
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-700 dark:text-amber-400 shadow-sm">
          {/* <span className="text-[10px] font-bold uppercase tracking-wider">Token</span> */}
          <span className="text-xs sm:text-sm font-black font-mono tracking-widest tabular-nums">{universalToken}</span>
          {timeLeft && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-500 opacity-80 border-l pl-1.5 border-amber-200 dark:border-amber-800/40">{timeLeft}</span>}
        </div>
      )}

      {/* Live Clock */}
      {currentTime && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs sm:text-sm font-semibold tabular-nums tracking-wide">{currentTime}</span>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
