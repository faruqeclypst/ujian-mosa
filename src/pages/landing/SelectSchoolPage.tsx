import { useState, useEffect, useCallback } from "react";
import { masterPb } from "../../lib/pocketbase";
import { SchoolRecord, useTenant } from "../../context/TenantContext";
import {
  Search,
  ChevronRight,
  Loader2,
  HardDrive,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  X,
  Clock,
  Laptop,
  CheckCircle2,
  Server,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { APP_DISPLAY_VERSION } from "../../utils/version";

export const isLocalServer = (school: SchoolRecord): boolean => {
  if (!school) return false;
  if (school.slug === "local" || school.id === "local_server" || school.id.startsWith("local_server_")) return true;

  const plan = (school.plan || "").toLowerCase();
  if (plan === "offline" || plan === "local" || plan === "lokal" || plan === "mandiri") return true;

  const serverType = ((school as any).server_type || "").toLowerCase();
  if (serverType === "local" || serverType === "lokal" || serverType === "offline") return true;

  const status = ((school as any).status || "").toLowerCase();
  if (status === "lokal" || status === "local" || status === "offline") return true;

  const pbUrl = (school.pb_url || "").toLowerCase();
  if (
    pbUrl.includes("localhost") ||
    pbUrl.includes("127.0.0.1") ||
    /https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/.test(pbUrl)
  ) {
    return true;
  }

  const host = (school.server_host || "").trim().toLowerCase();
  if (/^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host)) {
    return true;
  }

  const name = (school.name || "").toLowerCase();
  if (name.includes("(lokal server)") || name.includes("(server lokal)") || name.includes("(offline)")) {
    return true;
  }

  return false;
};

/**
 * Deteksi subnet LAN perangkat menggunakan Android Bridge atau WebRTC ICE candidate.
 */
async function detectLanSubnet(): Promise<string | null> {
  // 1. Coba dari Native Android Bridge jika tersedia
  try {
    const nativeBridge = (window as any).AndroidExam;
    if (nativeBridge && typeof nativeBridge.getDeviceIpAddress === "function") {
      const nativeIp = nativeBridge.getDeviceIpAddress();
      if (nativeIp && typeof nativeIp === "string") {
        const parts = nativeIp.trim().split(".");
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }
  } catch {}

  // 2. WebRTC ICE candidate fallback
  return new Promise((resolve) => {
    try {
      const RTCPeerConnection =
        (window as any).RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve(null);
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");

      const found = new Set<string>();
      const timeout = setTimeout(() => {
        pc.close();
        resolve(found.size > 0 ? [...found][0] : null);
      }, 700);

      pc.onicecandidate = (e: any) => {
        if (!e || !e.candidate || !e.candidate.candidate) return;
        const m = e.candidate.candidate.match(
          /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}/
        );
        if (m) {
          const prefix = m[1];
          if (
            prefix.startsWith("192.168.") ||
            prefix.startsWith("10.") ||
            /^172\.(1[6-9]|2\d|3[01])$/.test(prefix)
          ) {
            found.add(prefix);
          }
        }
      };

      pc.createOffer()
        .then((offer: any) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          pc.close();
          resolve(null);
        });
    } catch {
      resolve(null);
    }
  });
}

const normalizeUrl = (raw: string): string => {
  let clean = raw.trim();
  if (!clean) return "";
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "http://" + clean;
  }
  return clean.replace(/\/+$/, "");
};

interface DetectedServer {
  origin: string;
  name: string;
  logoUrl?: string;
  lastSeen: number;
}

interface RecentServer {
  origin: string;
  name: string;
  timestamp: number;
}

const SelectSchoolPage = () => {
  // Tab pilihan server: 'online' | 'local'
  const [activeTab, setActiveTab] = useState<"online" | "local">("online");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloudReachable, setCloudReachable] = useState(true);
  const [scanningLan, setScanningLan] = useState(false);
  const [search, setSearch] = useState("");

  // Server Lokal State
  const [detectedServers, setDetectedServers] = useState<DetectedServer[]>([]);
  const [recentServers, setRecentServers] = useState<RecentServer[]>(() => {
    try {
      const raw = localStorage.getItem("exam_recent_local_servers");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Modal Hubungkan Server Lokal untuk Sekolah Tertentu
  const [schoolForLocalModal, setSchoolForLocalModal] = useState<SchoolRecord | null>(null);
  const [inputLocalIp, setInputLocalIp] = useState("");
  const [isConnectingLocal, setIsConnectingLocal] = useState(false);
  const [localConnectError, setLocalConnectError] = useState<string | null>(null);

  const { setManualSchool } = useTenant();

  // Simpan riwayat server lokal
  const saveRecentServer = (origin: string, name: string) => {
    try {
      const raw = localStorage.getItem("exam_recent_local_servers");
      let list: RecentServer[] = raw ? JSON.parse(raw) : [];
      list = list.filter((item) => item.origin !== origin);
      list.unshift({ origin, name, timestamp: Date.now() });
      list = list.slice(0, 6);
      localStorage.setItem("exam_recent_local_servers", JSON.stringify(list));
      setRecentServers(list);
    } catch {}
  };

  // Uji koneksi ke IP lokal proktor
  const probeLocalServer = async (url: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const cleanUrl = normalizeUrl(url);
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 2500);

      let isHealthy = false;
      try {
        const healthRes = await fetch(`${cleanUrl}/api/health`, { signal: ctrl.signal });
        if (healthRes.ok || healthRes.status === 200) {
          isHealthy = true;
        }
      } catch {}

      try {
        const res = await fetch(`${cleanUrl}/api/collections/settings/records?perPage=1`, {
          signal: ctrl.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          return { success: true, data };
        }
      } catch {}

      clearTimeout(timeoutId);
      if (isHealthy) {
        return { success: true, data: {} };
      }

      return {
        success: false,
        error: "Tidak dapat menghubungi server lokal di alamat tersebut. Pastikan IP dan port (contoh :8090) sudah benar, dan Windows Firewall di server tidak memblokir.",
      };
    } catch {
      return {
        success: false,
        error: "Tidak dapat menghubungi server lokal. Pastikan Wi-Fi terhubung ke jaringan server lab proktor.",
      };
    }
  };

  // Scan LAN untuk auto-discovery server lokal
  const runLanScan = useCallback(async () => {
    setScanningLan(true);
    const candidateSet = new Set<string>();

    candidateSet.add("http://localhost:8090");
    candidateSet.add("http://127.0.0.1:8090");

    if (
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1" &&
      !Capacitor.isNativePlatform()
    ) {
      candidateSet.add(window.location.origin);
    }

    recentServers.forEach((s) => candidateSet.add(s.origin));

    try {
      const gatewaySubnet = await detectLanSubnet();
      if (gatewaySubnet) {
        const [a, b, c] = gatewaySubnet.split(".");
        const priorityHosts = [1, 100, 2, 3, 4, 5, 10, 50, 101, 150, 200, 254];
        for (const i of priorityHosts) {
          candidateSet.add(`http://${a}.${b}.${c}.${i}:8090`);
        }
        for (let i = 1; i <= 254; i++) {
          candidateSet.add(`http://${a}.${b}.${c}.${i}:8090`);
        }
      } else {
        const commonSubnets = ["192.168.1", "192.168.0", "192.168.100", "192.168.43", "192.168.8", "10.0.0"];
        for (const sub of commonSubnets) {
          for (const host of [1, 100, 2, 10, 50, 200]) {
            candidateSet.add(`http://${sub}.${host}:8090`);
          }
        }
      }
    } catch {}

    const ipCandidates = Array.from(candidateSet);
    const found: DetectedServer[] = [];
    const PROBE_TIMEOUT = 1200;

    const BATCH_SIZE = 20;
    for (let i = 0; i < ipCandidates.length; i += BATCH_SIZE) {
      const batch = ipCandidates.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (origin) => {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
          try {
            let isAlive = false;
            try {
              const hRes = await fetch(`${origin}/api/health`, { signal: ctrl.signal });
              if (hRes.ok || hRes.status === 200) isAlive = true;
            } catch {}

            let sName = "Server CBT Lab";
            let sLogo = "";
            try {
              const res = await fetch(`${origin}/api/collections/settings/records?perPage=1`, {
                signal: ctrl.signal,
              });
              if (res.ok) {
                const data = await res.json();
                if (data?.items && data.items.length > 0) {
                  const item = data.items[0];
                  if (item.name) sName = item.name;
                  if (item.logoUrl || item.logo) sLogo = item.logoUrl || item.logo;
                }
                isAlive = true;
              }
            } catch {}

            clearTimeout(tid);

            if (isAlive) {
              found.push({
                origin,
                name: sName,
                logoUrl: sLogo,
                lastSeen: Date.now(),
              });
            }
          } catch {
            clearTimeout(tid);
          }
        })
      );

      if (found.length > 0) {
        setDetectedServers([...found]);
      }
    }

    setDetectedServers([...found]);
    setScanningLan(false);
  }, [recentServers]);

  // Fetch daftar sekolah dari Master PB (Cloud)
  useEffect(() => {
    let isMounted = true;

    const fetchSchools = async () => {
      let masterRecords: SchoolRecord[] = [];
      let isCloudOk = true;

      try {
        masterRecords = await masterPb.collection("schools").getFullList<SchoolRecord>({
          filter: "is_active = true",
          sort: "name",
        });
        // Cache master schools di localStorage agar saat perangkat offline (di lab), daftar tetap bisa diakses!
        try {
          localStorage.setItem("cached_master_schools", JSON.stringify(masterRecords));
        } catch {}
      } catch (err) {
        console.warn("Master PB fetch error (mode offline):", err);
        isCloudOk = false;
        // Ambil fallback dari cache
        try {
          const cached = localStorage.getItem("cached_master_schools");
          if (cached) {
            masterRecords = JSON.parse(cached);
          }
        } catch {}
      }

      if (isMounted) {
        setSchools(masterRecords);
        setCloudReachable(isCloudOk);
        setLoading(false);
        // Jika server cloud tidak terjangkau (misal siswa di Wi-Fi offline lab), otomatis arahkan ke tab Local Server
        if (!isCloudOk && masterRecords.length === 0) {
          setActiveTab("local");
        }
      }
    };

    fetchSchools();
    runLanScan();

    return () => {
      isMounted = false;
    };
  }, [runLanScan]);

  // Handler hubungkan ke Online Server
  const handleConnectOnline = (school: SchoolRecord) => {
    if (Capacitor.isNativePlatform()) {
      setManualSchool(school);
    } else {
      const mainDomain = (import.meta.env.VITE_MAIN_DOMAIN || "examku.my.id").toLowerCase();
      localStorage.removeItem("selected_school_slug");
      window.location.href = `https://${school.slug}.${mainDomain}/exam`;
    }
  };

  // Handler buka modal hubungkan ke Local Server untuk sekolah tertentu
  const handleOpenLocalModal = (school?: SchoolRecord) => {
    setSchoolForLocalModal(school || null);
    const savedIp = school
      ? localStorage.getItem(`local_server_url_${school.id}`) || localStorage.getItem("local_server_url") || ""
      : localStorage.getItem("local_server_url") || "";

    setInputLocalIp(savedIp || (detectedServers[0]?.origin || "http://192.168.1."));
    setLocalConnectError(null);
  };

  // Handler submit eksekusi koneksi ke Local Server
  const handleExecuteConnectLocal = async (targetUrl: string, schoolTarget?: SchoolRecord | null) => {
    const cleanUrl = normalizeUrl(targetUrl);
    if (!cleanUrl) {
      setLocalConnectError("Silakan masukkan alamat IP server lokal proktor.");
      return;
    }

    setIsConnectingLocal(true);
    setLocalConnectError(null);

    const probe = await probeLocalServer(cleanUrl);
    if (!probe.success) {
      setIsConnectingLocal(false);
      setLocalConnectError(probe.error || "Gagal menghubungi server lokal di alamat tersebut.");
      return;
    }

    let schoolName = schoolTarget ? schoolTarget.name : "Server CBT Mandiri (Lokal)";
    let logoUrl = schoolTarget ? schoolTarget.logo_url : "";

    if (probe.data?.items && probe.data.items.length > 0) {
      const s = probe.data.items[0];
      if (!schoolTarget && s.name) schoolName = s.name;
      if (!logoUrl && (s.logoUrl || s.logo)) logoUrl = s.logoUrl || s.logo;
    }

    saveRecentServer(cleanUrl, schoolName);

    const localRecord: SchoolRecord = {
      id: schoolTarget ? `local_${schoolTarget.id}` : `local_server_${cleanUrl.replace(/[^a-z0-9]/gi, "_")}`,
      name: schoolName,
      slug: "local",
      pb_url: cleanUrl,
      type: schoolTarget?.type || "school",
      is_active: true,
      logo_url: logoUrl || "/logo-default.webp",
      plan: "offline",
    };

    localStorage.setItem("local_server_url", cleanUrl);
    if (schoolTarget) {
      localStorage.setItem(`local_server_url_${schoolTarget.id}`, cleanUrl);
    }

    setIsConnectingLocal(false);
    setSchoolForLocalModal(null);

    if (Capacitor.isNativePlatform()) {
      setManualSchool(localRecord);
    } else {
      window.location.href = `${cleanUrl}/exam`;
    }
  };

  const filteredSchools = schools.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q) || (s.npsn && s.npsn.includes(q));
  });

  return (
    <div className="h-screen bg-[#f8fafc] dark:bg-[#070b13] flex flex-col relative font-sans overflow-hidden select-none">
      {/* Dev Back to Landing Button */}
      {window.location.hostname === "localhost" && !Capacitor.isNativePlatform() && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-600 transition-all shadow-sm"
          >
            Landing
          </button>
        </div>
      )}

      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Section */}
      <div className="pt-12 sm:pt-14 pb-4 px-6 relative z-10 max-w-md mx-auto w-full flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center p-2.5 relative flex-shrink-0"
          >
            <img
              src="/logo-default.webp"
              alt="Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo-default.png";
              }}
            />
          </motion.div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Pilih Unit Sekolah
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate mt-0.5">
              Pilih server ujian yang digunakan sekolah Anda
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB TOGGLE: ONLINE SERVER VS LOCAL SERVER               */}
        {/* ======================================================== */}
        <div className="bg-slate-200/70 dark:bg-slate-900/70 p-1 rounded-2xl flex items-center gap-1 border border-slate-300/40 dark:border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("online")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === "online"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.01]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Globe size={16} />
            <span>Online Server</span>
            {schools.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  activeTab === "online"
                    ? "bg-blue-500/40 text-white"
                    : "bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {schools.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === "local"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25 scale-[1.01]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <HardDrive size={16} />
            <span>Local Server</span>
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                activeTab === "local"
                  ? "bg-emerald-500/40 text-white"
                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              LAN / Lab
            </span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-6 pb-28 pt-2 relative z-10 max-w-md mx-auto w-full scrollbar-hidden">
        {/* ======================================================== */}
        {/* TAB 1: ONLINE SERVER                                     */}
        {/* ======================================================== */}
        {activeTab === "online" && (
          <div className="flex flex-col gap-4">
            {/* Warning jika cloud tidak terjangkau (misal saat di Wi-Fi offline lab) */}
            {!cloudReachable && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs"
              >
                <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Server Cloud Tidak Terjangkau
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                    Perangkat Anda mungkin terhubung ke Wi-Fi offline sekolah tanpa akses internet.
                  </p>
                  <button
                    onClick={() => setActiveTab("local")}
                    className="mt-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                  >
                    <HardDrive size={13} />
                    <span>Beralih ke Local Server</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Search Input */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-bold text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs outline-none"
                placeholder="Cari nama sekolah atau NPSN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* List Sekolah */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-9 h-9 text-blue-500 animate-spin mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Memuat unit sekolah...</p>
              </div>
            ) : filteredSchools.length > 0 ? (
              <div className="flex flex-col gap-3">
                <AnimatePresence>
                  {filteredSchools.map((school, index) => {
                    return (
                      <motion.div
                        key={school.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
                      >
                        {/* Header Item: Logo + Info */}
                        <div className="flex items-center gap-3.5">
                          <img
                            src={
                              school.logo_url
                                ? school.logo_url.startsWith("http")
                                  ? school.logo_url
                                  : masterPb.files.getUrl(school as any, school.logo_url)
                                : "/logo-default.webp"
                            }
                            alt={school.name}
                            className="w-12 h-12 shrink-0 object-contain rounded-xl bg-slate-50 dark:bg-slate-800/80 p-1 border border-slate-100 dark:border-slate-800 drop-shadow-xs"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/logo-default.png";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                              {school.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              {school.npsn && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  NPSN: {school.npsn}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Cloud Aktif
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Button: Masuk Ujian */}
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => handleConnectOnline(school)}
                            className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            title="Masuk ke portal ujian sekolah"
                          >
                            <Globe size={14} />
                            <span>Masuk Ujian</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Sekolah Tidak Ditemukan</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xs mb-4">
                  Cari dengan kata kunci lain, atau gunakan menu <strong>Local Server</strong> jika berada di lab ujian.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("local")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-xs"
                >
                  <HardDrive size={14} />
                  <span>Buka Menu Local Server</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: LOCAL SERVER (OFFLINE / LAB)                      */}
        {/* ======================================================== */}
        {activeTab === "local" && (
          <div className="flex flex-col gap-4">
            {/* Kartu 1: Server Lokal Terdeteksi di Wi-Fi */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Terdeteksi di Jaringan Wi-Fi
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={scanningLan}
                  onClick={runLanScan}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={11} className={scanningLan ? "animate-spin" : ""} />
                  <span>{scanningLan ? "Memindai..." : "Pindai Ulang"}</span>
                </button>
              </div>

              {scanningLan && detectedServers.length === 0 ? (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span>Mendeteksi server proktor di jaringan LAN...</span>
                </div>
              ) : detectedServers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {detectedServers.map((srv, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Laptop size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {srv.name}
                          </p>
                          <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                            {srv.origin}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExecuteConnectLocal(srv.origin, null)}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all shrink-0 flex items-center gap-1"
                      >
                        <span>Masuk</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                    Belum menemukan server lokal otomatis. Silakan masukkan alamat IP server proktor di bawah ini.
                  </p>
                </div>
              )}
            </div>

            {/* Kartu 2: Input Manual IP Server Proktor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Server size={14} className="text-blue-500" />
                  <span>Masukkan IP Server Proktor</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ketikkan alamat IP server lokal yang tertera di papan tulis atau diberikan proktor lab
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={inputLocalIp}
                  onChange={(e) => {
                    setInputLocalIp(e.target.value);
                    setLocalConnectError(null);
                  }}
                  placeholder="Contoh: http://192.168.1.100:8090"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                />

                {/* Shortcut Preset Tombol Port */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Preset:</span>
                  {[":8090", ":80", "192.168.1.", "localhost:8090"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (preset.startsWith(":")) {
                          const base = inputLocalIp.split(":")[0] || "http://192.168.1.100";
                          setInputLocalIp(base + preset);
                        } else {
                          setInputLocalIp(preset.startsWith("http") ? preset : "http://" + preset);
                        }
                      }}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-mono font-bold transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {localConnectError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-300">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{localConnectError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isConnectingLocal}
                onClick={() => handleExecuteConnectLocal(inputLocalIp, null)}
                className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-50"
              >
                {isConnectingLocal ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Menghubungkan ke Server Lokal...</span>
                  </>
                ) : (
                  <>
                    <HardDrive size={16} />
                    <span>Hubungkan ke Server Lokal</span>
                  </>
                )}
              </button>

              {/* Tips Bantuan Jaringan Lokal */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-bold text-[11px]">Server belum terhubung?</p>
                  <ul className="list-disc pl-3.5 mt-1 space-y-0.5 text-[10.5px] opacity-90">
                    <li>Pastikan server proktor aktif (jalankan <code className="font-mono bg-amber-100/60 dark:bg-amber-900/60 px-1 py-0.2 rounded">jalankan-server.bat</code>).</li>
                    <li>Periksa <b>Windows Firewall</b> di laptop server (izinkan port 8090 atau ubah profil Wi-Fi ke Private).</li>
                    <li>Pastikan router Wi-Fi tidak mengaktifkan fitur <b>AP Isolation</b>.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Kartu 3: Riwayat Server Lokal */}
            {recentServers.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Clock size={14} />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Riwayat Server Lokal
                  </h4>
                </div>
                <div className="flex flex-col gap-1.5">
                  {recentServers.map((srv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputLocalIp(srv.origin);
                        handleExecuteConnectLocal(srv.origin, null);
                      }}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between text-left transition-colors group"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                          {srv.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{srv.origin}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: HUBUNGKAN SERVER LOKAL UNTUK SEKOLAH SPESIFIK     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {schoolForLocalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 relative"
            >
              <button
                type="button"
                onClick={() => setSchoolForLocalModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full"
              >
                <X size={18} />
              </button>

              {/* Header Modal */}
              <div className="flex items-center gap-3 pr-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 shrink-0">
                  <HardDrive size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {schoolForLocalModal.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full mt-0.5">
                    Mode Local Server (Lab)
                  </span>
                </div>
              </div>

              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                Gunakan mode ini jika Anda sedang berada di lab komputer sekolah dan ujian berjalan di server lokal proktor.
              </p>

              {/* Jika ada server terdeteksi di LAN */}
              {detectedServers.length > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                      Terdeteksi di Jaringan Wi-Fi:
                    </p>
                    <p className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 truncate">
                      {detectedServers[0].origin}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInputLocalIp(detectedServers[0].origin);
                      handleExecuteConnectLocal(detectedServers[0].origin, schoolForLocalModal);
                    }}
                    className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs shrink-0"
                  >
                    Gunakan
                  </button>
                </div>
              )}

              {/* Form Input IP */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alamat IP Server Proktor
                </label>
                <input
                  type="text"
                  value={inputLocalIp}
                  onChange={(e) => {
                    setInputLocalIp(e.target.value);
                    setLocalConnectError(null);
                  }}
                  placeholder="Contoh: http://192.168.1.100:8090"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {localConnectError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{localConnectError}</span>
                </div>
              )}

              {/* Tombol Aksi Modal */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isConnectingLocal}
                  onClick={() => setSchoolForLocalModal(null)}
                  className="w-full py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isConnectingLocal}
                  onClick={() => handleExecuteConnectLocal(inputLocalIp, schoolForLocalModal)}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  {isConnectingLocal ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Hubungkan</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Version Info */}
      <div className="fixed bottom-0 left-0 w-full text-center pb-4 pt-8 bg-gradient-to-t from-[#f8fafc] dark:from-[#070b13] via-[#f8fafc]/90 dark:via-[#070b13]/90 to-transparent pointer-events-none z-20">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">
          CBT by Alfaruq Asri • {APP_DISPLAY_VERSION}
        </p>
      </div>
    </div>
  );
};

export default SelectSchoolPage;
