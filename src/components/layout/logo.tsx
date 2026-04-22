import React, { useState, useEffect } from "react";
import { useTenant } from "../../context/TenantContext";

const Logo = () => {
  const { pb, school } = useTenant();
  const [profile, setProfile] = useState({ name: "EXAM AA", logoUrl: "" });
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!pb) return;

    // Fungsi untuk mengambil data settings dari PocketBase
    const fetchSettings = async () => {
      try {
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1
        });

        if (records.length > 0) {
          const data = records[0];
          let logoUrl = data.logoUrl || data.logo || "";

          if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }

          setProfile({
            name: data.name || "EXAM AA",
            logoUrl: logoUrl
          });
          setLogoError(false);
        }
      } catch (err) {
        console.error("Gagal memuat logo sidebar:", err);
      }
    };

    fetchSettings();

    // Subscribe ke perubahan data secara realtime di PocketBase
    const unsubscribe = pb.collection("settings").subscribe("*", (e) => {
      if (e.action === "update" || e.action === "create") {
        let logoUrl = e.record.logoUrl || e.record.logo || "";

        if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
          logoUrl = pb.files.getUrl(e.record, logoUrl);
        }

        setProfile({
          name: e.record.name || "EXAM AA",
          logoUrl: logoUrl
        });
        setLogoError(false);
      }
    });

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [pb]);

  return (
    <div className="flex items-center gap-3.5 group cursor-default min-w-0 w-full overflow-hidden">
      {/* Logo Container with Premium Styling */}
      <div className="relative shrink-0">
        <div className="h-11 w-11 sm:h-[48px] sm:w-[48px] transition-all duration-300 group-hover:scale-110 flex items-center justify-center">
          {profile.logoUrl && !logoError ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="h-full w-full object-contain drop-shadow-sm"
              onError={() => setLogoError(true)}
            />
          ) : (
            <img
              src="/logo-default.png"
              alt="Logo Default"
              className="h-full w-full object-contain"
            />
          )}
        </div>
        {/* Refined Online Badge */}
        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 rounded-full border-[2.5px] border-white dark:border-[#0B1120] shadow-sm animate-pulse-slow"></div>
      </div>

      {/* Brand Text Identity */}
      <div className="flex flex-col min-w-0 justify-center flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest uppercase opacity-90 shrink-0">
            EXAM AA
          </span>
          <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black rounded-md border border-blue-100/50 dark:border-blue-500/20 shrink-0">
            v3.1
          </span>
        </div>
        <div className="min-w-0 pr-1">
          <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 dark:text-slate-400 leading-tight line-clamp-2 tracking-tight">
            {profile.name}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Logo;
