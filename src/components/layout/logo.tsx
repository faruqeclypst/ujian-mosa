import React, { useState, useEffect } from "react";
import { useTenant } from "../../context/TenantContext";
import { APP_DISPLAY_VERSION } from "../../utils/version";

interface LogoProps {
  isCollapsed?: boolean;
}

const Logo = ({ isCollapsed = false }: LogoProps) => {
  const { pb, school } = useTenant();
  const [profile, setProfile] = useState({ name: school?.name || "EXAMKU", logoUrl: "" });
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!pb) return;

    const fetchSettings = async () => {
      try {
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1,
        });

        if (records.length > 0) {
          const data = records[0];
          let logoUrl = data.logoUrl || data.logo || "";

          if (logoUrl && !logoUrl.startsWith("http") && !logoUrl.startsWith("data:")) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }

          setProfile({
            name: data.name && data.name !== "EXAMKU" ? data.name : (school?.name || "EXAMKU"),
            logoUrl: logoUrl,
          });
          setLogoError(false);
        }
      } catch (err) {
        console.error("Gagal memuat logo sidebar:", err);
      }
    };

    fetchSettings();

    const unsubscribe = pb.collection("settings").subscribe("*", (e) => {
      if (e.action === "update" || e.action === "create") {
        let logoUrl = e.record.logoUrl || e.record.logo || "";

        if (logoUrl && !logoUrl.startsWith("http") && !logoUrl.startsWith("data:")) {
          logoUrl = pb.files.getUrl(e.record, logoUrl);
        }

        setProfile({
          name: e.record.name && e.record.name !== "EXAMKU" ? e.record.name : (school?.name || "EXAMKU"),
          logoUrl: logoUrl,
        });
        setLogoError(false);
      }
    });

    return () => {
      unsubscribe.then((unsub) => unsub());
    };
  }, [pb, school]);

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center select-none" title={`EXAMKU ${APP_DISPLAY_VERSION} - ${profile.name}`}>
        <div className="h-7 w-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
          {profile.logoUrl && !logoError ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="h-full w-full object-contain p-0.5 bg-white dark:bg-neutral-900"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="font-black text-[11px] tracking-tight">EK</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 min-w-0 select-none overflow-hidden">
      {/* Brand Icon */}
      <div className="h-6 w-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
        {profile.logoUrl && !logoError ? (
          <img
            src={profile.logoUrl}
            alt="Logo"
            className="h-full w-full object-contain p-0.5 bg-white dark:bg-neutral-900"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="font-black text-[11px] tracking-tight">EK</span>
        )}
      </div>

      {/* Brand Name & Version Badge */}
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        <span className="text-sm font-black tracking-wider text-neutral-900 dark:text-neutral-100 uppercase truncate">
          EXAMKU
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded font-medium border border-neutral-200/50 dark:border-neutral-700/50 shrink-0">
          {APP_DISPLAY_VERSION}
        </span>
      </div>
    </div>
  );
};

export default Logo;
