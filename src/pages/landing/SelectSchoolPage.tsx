import { useState, useEffect } from "react";
import { masterPb } from "../../lib/pocketbase";
import { SchoolRecord, useTenant } from "../../context/TenantContext";
import { Search, ChevronRight, Loader2, Sparkles, RefreshCw, LogOut, HardDrive, Server } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
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
 * Deteksi subnet LAN perangkat menggunakan WebRTC ICE candidate.
 * Tidak memerlukan izin apapun — hanya membaca kandidat IP lokal yang dikembalikan browser.
 * Mengembalikan prefix subnet (misal "192.168.1") atau null jika gagal.
 */
function detectLanSubnet(): Promise<string | null> {
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
      }, 800);

      pc.onicecandidate = (e: any) => {
        if (!e || !e.candidate || !e.candidate.candidate) return;
        const m = e.candidate.candidate.match(
          /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}/
        );
        if (m) {
          const prefix = m[1];
          // Hanya simpan IP private (192.168.x, 10.x, 172.16-31.x)
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

const SelectSchoolPage = () => {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningLan, setScanningLan] = useState(false);
  const [search, setSearch] = useState("");
  const { setManualSchool } = useTenant();

  useEffect(() => {
    let isMounted = true;

    const fetchSchools = async () => {
      let masterRecords: SchoolRecord[] = [];
      try {
        masterRecords = await masterPb.collection("schools").getFullList<SchoolRecord>({
          filter: "is_active = true",
          sort: "name",
        });
      } catch (err) {
        console.warn("Master PB fetch error (mungkin mode offline):", err);
      }

      // Deteksi otomatis server lokal di jaringan yang sama (LAN scan)
      // PENTING: Jangan pernah scan ke IP lokal jika app dibuka dari domain publik (PNA Chromium policy)
      const isLocalEnvironment =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          /^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
            window.location.hostname
          ) ||
          Capacitor.isNativePlatform());

      if (isLocalEnvironment) {
        if (isMounted) setScanningLan(true);
        // Kumpulkan kandidat IP yang akan di-probe
        const ipCandidates: string[] = [];

        // 1. Selalu coba localhost terlebih dahulu (untuk dev atau server di perangkat sendiri)
        ipCandidates.push("http://localhost:8090");
        ipCandidates.push("http://127.0.0.1:8090");

        // 2. Jika app dibuka dari IP lokal (browser siswa terhubung ke server proktor),
        //    coba origin saat ini langsung
        if (
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1" &&
          !Capacitor.isNativePlatform()
        ) {
          ipCandidates.push(window.location.origin);
        }

        // 3. Jika berjalan di Android (Capacitor), scan seluruh subnet LAN
        //    untuk menemukan server proktor di jaringan yang sama
        if (Capacitor.isNativePlatform()) {
          try {
            // Dapatkan IP gateway dari RTCPeerConnection (tanpa izin khusus)
            const gatewaySubnet = await detectLanSubnet();
            if (gatewaySubnet) {
              // Scan paralel semua host di subnet (misal 192.168.1.1 - 192.168.1.254)
              const [a, b, c] = gatewaySubnet.split(".");
              for (let i = 1; i <= 254; i++) {
                ipCandidates.push(`http://${a}.${b}.${c}.${i}:8090`);
              }
            }
          } catch (_) {}
        }

        // Probe semua kandidat secara paralel dengan timeout ketat 600ms
        const PROBE_TIMEOUT = 600;
        const probeResults = await Promise.allSettled(
          ipCandidates.map(async (origin) => {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
            try {
              const res = await fetch(`${origin}/api/collections/settings/records?perPage=1`, {
                signal: ctrl.signal,
              });
              clearTimeout(tid);
              if (!res.ok) throw new Error("not ok");
              const data = await res.json();
              return { origin, data };
            } catch {
              clearTimeout(tid);
              throw new Error("unreachable");
            }
          })
        );

        for (const result of probeResults) {
          if (result.status !== "fulfilled") continue;
          const { origin, data } = result.value;

          let localSchoolName = "Server CBT Mandiri (Lokal)";
          let localLogo = "";
          if (data?.items && data.items.length > 0) {
            const s = data.items[0];
            if (s.name) localSchoolName = s.name;
            if (s.logoUrl || s.logo) localLogo = s.logoUrl || s.logo;
          }

          // Jangan duplikat jika sudah ada di masterRecords
          const alreadyExists = masterRecords.some(
            (r) => r.pb_url === origin || r.slug === "local" || isLocalServer(r)
          );
          if (!alreadyExists) {
            const localRecord: SchoolRecord = {
              id: `local_server_${origin.replace(/[^a-z0-9]/gi, "_")}`,
              name: localSchoolName,
              slug: "local",
              pb_url: origin,
              type: "school",
              is_active: true,
              logo_url: localLogo || "/logo-default.png",
              plan: "offline",
            };
            masterRecords = [localRecord, ...masterRecords];
          }
        }
        if (isMounted) setScanningLan(false);
      }


      // Filter sekolah berstatus Lokal Server:
      // Hanya tampilkan jika server lokal tersebut AKTIF dan BISA DIHUBUNGI dari perangkat saat ini.
      // Jika siswa memakai paket data (tidak terkoneksi ke jaringan server lokal tersebut), sekolah lokal tidak akan dimunculkan!
      const verifiedSchools: SchoolRecord[] = [];
      for (const record of masterRecords) {
        if (isLocalServer(record)) {
          // Jika server lokal terdeteksi di localhost/LAN atau memiliki pb_url lokal
          if (record.id.startsWith("local_server_")) {
            verifiedSchools.push(record);
          } else if (record.pb_url) {
            try {
              const probeCtrl = new AbortController();
              const probeTimeout = setTimeout(() => probeCtrl.abort(), 800);
              const res = await fetch(`${record.pb_url}/api/collections/settings/records?perPage=1`, {
                signal: probeCtrl.signal,
              });
              clearTimeout(probeTimeout);
              if (res.ok) {
                verifiedSchools.push(record);
              }
            } catch {
              // Server lokal tidak terjangkau (misal siswa pakai paket data atau server mati) -> JANGAN TAMPILKAN
            }
          }
        } else {
          // Sekolah online selalu ditampilkan
          verifiedSchools.push(record);
        }
      }

      if (isMounted) {
        setSchools(verifiedSchools);
        setLoading(false);
      }
    };

    fetchSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSchools = schools.filter((s) => {
    const q = search.toLowerCase();
    const isLocal = isLocalServer(s);
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (isLocal && (q.includes("lokal") || q.includes("local") || q.includes("offline") || q.includes("mandiri"))) ||
      (!isLocal && (q.includes("online") || q.includes("vps") || q.includes("cloud")))
    );
  });

  const handleSelect = (school: SchoolRecord) => {
    if (Capacitor.isNativePlatform()) {
      if (isLocalServer(school) && school.pb_url) {
        localStorage.setItem("local_server_url", school.pb_url);
      }
      setManualSchool(school);
    } else {
      // Pada Web Browser:
      if (isLocalServer(school) && school.pb_url) {
        localStorage.setItem("local_server_url", school.pb_url);
        window.location.href = `${school.pb_url}/exam`;
      } else {
        const mainDomain = (import.meta.env.VITE_MAIN_DOMAIN || "examku.my.id").toLowerCase();
        localStorage.removeItem("selected_school_slug");
        window.location.href = `https://${school.slug}.${mainDomain}/exam`;
      }
    }
  };

  return (
    <div className="h-screen bg-[#fdfdfd] flex flex-col relative font-sans overflow-hidden">
      {/* Dev Back to Landing Button */}
      {window.location.hostname === 'localhost' && !Capacitor.isNativePlatform() && (
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
          >
            Back to Landing
          </button>
        </div>
      )}
      {/* Premium Pristine Ambient Background */}
      <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] bg-slate-200/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-blue-50/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Luxury Minimalist Header Section */}
      <div className="pt-20 pb-10 px-8 relative z-10 max-w-md mx-auto w-full">
        <div className="flex items-center gap-6 mb-2">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, x: -20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full scale-150" />
            <img src="/logo-default.webp" alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain relative z-10 drop-shadow-sm" onError={(e) => { (e.target as HTMLImageElement).src = "/logo-default.png"; }} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1"
          >
            <h1 className="text-[1.65rem] font-bold text-slate-800 tracking-tight leading-none mb-1 font-display">
              Computer Based <span className="text-blue-600 font-black italic">Test</span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-slate-400 text-[9.5px] font-semibold uppercase tracking-[0.3em] mt-2 font-sans opacity-60"
            >
              Pilih Sekolah / Kampus Anda!
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Search Bar - Pristine Glass Pill */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="px-6 relative z-10 mb-8 w-full max-w-md mx-auto"
      >
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-20">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" strokeWidth={2.5} />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-6 py-4 rounded-full bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] outline-none text-slate-800 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 border border-white/80 transition-all z-10 relative"
            placeholder="Cari nama sekolah atau status (online / lokal)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {/* List Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex-1 px-6 pb-28 overflow-y-auto overscroll-y-contain relative z-10 w-full max-w-md mx-auto scrollbar-hidden"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 font-medium tracking-wide">Mencari Server...</p>
            {scanningLan && (
              <p className="text-slate-400 text-xs mt-2 animate-pulse">Memindai jaringan lokal...</p>
            )}
          </div>
        ) : filteredSchools.length > 0 ? (
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {filteredSchools.map((school, index) => {
                const isLocal = isLocalServer(school);
                return (
                  <motion.button
                    key={school.id}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSelect(school)}
                    className={
                      isLocal
                        ? "w-full bg-gradient-to-r from-emerald-50/60 via-white/90 to-emerald-50/20 backdrop-blur-2xl border border-emerald-200/90 hover:border-emerald-400 rounded-[1.75rem] p-4 flex items-center justify-between shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:shadow-[0_15px_35px_rgba(16,185,129,0.14)] transition-all duration-300 text-left group"
                        : "w-full bg-white/70 backdrop-blur-2xl border border-white hover:border-blue-200 rounded-[1.75rem] p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(37,99,235,0.08)] transition-all duration-300 text-left group"
                    }
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Brand Image (No Wrapper) */}
                      <img
                        src={
                          school.logo_url
                            ? school.logo_url.startsWith("http")
                              ? school.logo_url
                              : masterPb.files.getUrl(school as any, school.logo_url)
                            : "/logo-default.webp"
                        }
                        alt={school.name}
                        className="w-14 h-14 shrink-0 object-contain relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/logo-default.png";
                        }}
                      />
                      {/* Brand Text Wrapper */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div
                          className={`font-bold text-slate-800 text-[0.95rem] leading-snug line-clamp-2 px-1 transition-colors ${
                            isLocal ? "group-hover:text-emerald-700" : "group-hover:text-blue-600"
                          }`}
                        >
                          {school.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 px-1">
                          <span className="relative flex h-2.5 w-2.5">
                            <span
                              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                isLocal ? "bg-emerald-400" : "bg-blue-400"
                              }`}
                            ></span>
                            <span
                              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                isLocal ? "bg-emerald-500" : "bg-blue-500"
                              }`}
                            ></span>
                          </span>
                          {isLocal ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.68rem] font-black tracking-wider uppercase bg-emerald-100/90 text-emerald-800 border border-emerald-300/70 shadow-xs">
                              <HardDrive className="w-3 h-3 text-emerald-600" />
                              Lokal Server
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.68rem] font-bold tracking-wider uppercase bg-blue-50/80 text-blue-700 border border-blue-200/60">
                              <Server className="w-3 h-3 text-blue-500" />
                              Online Server
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Action Button Indicator */}
                    <div
                      className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ring-1 ${
                        isLocal
                          ? "bg-emerald-100/70 group-hover:bg-emerald-600 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-emerald-500/20"
                          : "bg-slate-50/80 group-hover:bg-blue-600 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] ring-black/5"
                      }`}
                    >
                      <ChevronRight
                        className={`w-5 h-5 transition-colors ${
                          isLocal
                            ? "text-emerald-600 group-hover:text-white"
                            : "text-slate-400 group-hover:text-white"
                        }`}
                        strokeWidth={3}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-blue-50/50">
              <Search className="w-8 h-8 text-blue-400" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Tidak Ditemukan</h3>
            <p className="text-slate-500 text-[13px] font-medium leading-relaxed px-4">
              Kami tidak dapat menemukan sekolah tersebut. Pastikan ejaan sudah benar.
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Elegant Fade Footer */}
      <div className="fixed bottom-0 left-0 w-full text-center pb-8 pt-20 flex-shrink-0 bg-gradient-to-t from-[#fdfdfd] via-[#fdfdfd]/90 to-transparent pointer-events-none z-20">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
          CBT by Alfaruq Asri
        </p>
        <p className="text-[9px] font-bold text-slate-300 tracking-widest mt-1">
          {APP_DISPLAY_VERSION}
        </p>
      </div>
    </div>
  );
};

export default SelectSchoolPage;
