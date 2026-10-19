import React, { useState, useEffect } from "react";
import { useTenant } from "../../context/TenantContext";
import { verifyOfflineLicense, VerificationResult } from "../../utils/offlineLicenseHelper";
import { OfflineActivationGate } from "./OfflineActivationGate";
import LoadingScreen from "../layout/LoadingScreen";

export const OfflineServerGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { school, pb, loading, refreshSchool } = useTenant();
  const [checking, setChecking] = useState(true);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [licenseCode, setLicenseCode] = useState<string | null>(null);

  const isLocal = school?.id === "local_server" || school?.slug === "local" || (school?.id ? school.id.startsWith("local_server") : false);

  const checkLicense = async () => {
    // Hanya berlaku ketika sistem berjalan di server lokal mandiri (offline)
    if (!isLocal) {
      setChecking(false);
      return;
    }

    setChecking(true);
    let code = school?.offline_license || null;
    const effectiveOrigin = (school?.pb_url || pb?.baseUrl || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
    let isBlocked = false;
    let blockReason = "";

    // 1. Selalu periksa endpoint resmi /api/offline-license (mengeksekusi remote kill-switch & cek status perangkat)
    if (effectiveOrigin) {
      try {
        const resp = await fetch(`${effectiveOrigin}/api/offline-license`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.license) {
            code = data.license;
          }
          if (data.isRevoked || data.isDeviceMismatch || data.active === false) {
            isBlocked = true;
            blockReason = data.revocation_message || "Lisensi Server Offline telah dicabut atau dinonaktifkan oleh Administrator Pusat.";
          }
        }
      } catch (err) {
        console.warn("Gagal membaca dari /api/offline-license:", err);
      }
    }

    // 2. Cek status lokal dari konteks sekolah
    if (!isBlocked && (school?.offline_license_status === "revoked" || school?.offline_license_status === "deleted")) {
      isBlocked = true;
      blockReason = "Lisensi Server Offline telah dinonaktifkan oleh Administrator Pusat. Database bank soal dan data siswa tetap aman.";
    }

    if (isBlocked) {
      setVerification({
        valid: false,
        message: blockReason
      });
      setLicenseCode(code);
      setChecking(false);
      return;
    }

    // 3. Coba baca dari tabel settings database server secara langsung jika belum ada kode
    if (!code && effectiveOrigin) {
      try {
        const resp = await fetch(`${effectiveOrigin}/api/collections/settings/records?limit=1`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.items && data.items.length > 0 && data.items[0].offline_license) {
            code = data.items[0].offline_license;
            const itemStat = (data.items[0].offline_license_status || "active").toLowerCase();
            if (itemStat === "revoked" || itemStat === "deleted") {
              setVerification({
                valid: false,
                message: "Lisensi Server Offline telah dinonaktifkan oleh Administrator Pusat."
              });
              setLicenseCode(code);
              setChecking(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Gagal membaca offline_license via direct server fetch:", err);
      }
    }

    // 4. Coba baca via SDK PocketBase jika masih belum ada
    if (!code && pb) {
      try {
        const res = await pb.collection("settings").getList(1, 1);
        if (res.items.length > 0 && (res.items[0] as any).offline_license) {
          code = (res.items[0] as any).offline_license;
        }
      } catch (err) {
        console.warn("Gagal membaca offline_license dari settings lokal:", err);
      }
    }

    if (!code) {
      setVerification({
        valid: false,
        message: "Server ini berjalan dalam mode offline lokal dan memerlukan konfirmasi izin resmi dari Super Admin."
      });
      setLicenseCode(null);
      setChecking(false);
      return;
    }

    const res = await verifyOfflineLicense(code);
    if (res.valid) {
      if (typeof window !== "undefined") {
        try { localStorage.setItem("exam_offline_license", code); } catch {}
      }
    } else {
      if (typeof window !== "undefined") {
        try { localStorage.removeItem("exam_offline_license"); } catch {}
      }
    }

    setVerification(res);
    setLicenseCode(code);
    setChecking(false);
  };

  useEffect(() => {
    if (!loading) {
      checkLicense();
    }
  }, [school?.id, school?.offline_license, loading]);

  // Jika bukan server lokal offline mandiri, langsung lewati tanpa proteksi offline
  if (!isLocal) {
    return <>{children}</>;
  }

  if (checking) {
    return <LoadingScreen />;
  }

  // Jika lisensi belum ada, salah tanda tangan, atau sudah kadaluarsa
  if (!verification?.valid) {
    return (
      <OfflineActivationGate
        pb={pb}
        currentLicense={licenseCode}
        expiredReason={verification?.message}
        onActivated={async () => {
          await checkLicense();
          await refreshSchool();
        }}
      />
    );
  }

  return <>{children}</>;
};

export default OfflineServerGuard;
