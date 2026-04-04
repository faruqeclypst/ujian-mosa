import React, { useState, useEffect } from "react";
import pb from "../../lib/pocketbase";

const Logo = () => {
  const [profile, setProfile] = useState({ name: "E-Ujian", logoUrl: "" });
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    // Fungsi untuk mengambil data settings dari PocketBase
    const fetchSettings = async () => {
      try {
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1
        });

        if (records.length > 0) {
          const data = records[0];
          setProfile({ 
            name: data.name || "E-Ujian", 
            logoUrl: data.logoUrl || data.logo || "" 
          });
          setLogoError(false);
        }
      } catch (err) {
        console.error("Gagal memuat logo sidebar:", err);
      }
    };

    fetchSettings();

    // Subscribe ke perubahan data secara realtime di PocketBase
    pb.collection("settings").subscribe("*", (e) => {
      if (e.action === "update" || e.action === "create") {
        setProfile({ 
          name: e.record.name || "E-Ujian", 
          logoUrl: e.record.logoUrl || e.record.logo || "" 
        });
        setLogoError(false);
      }
    });

    return () => {
      pb.collection("settings").unsubscribe("*");
    };
  }, []);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="relative flex-shrink-0">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center overflow-hidden">
          {profile.logoUrl && !logoError ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="h-full w-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <img
              src="https://cdn-icons-png.flaticon.com/512/2913/2913965.png"
              alt="Logo Default"
              className="h-full w-full object-contain opacity-50"
            />
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"></div>
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base sm:text-lg font-bold text-foreground leading-none">E-Ujian</h1>
          <div className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded shrink-0">
            v2.0
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5 sm:mt-1 font-medium truncate">
          {profile.name}
        </p>
      </div>
    </div>
  );
};

export default Logo;
