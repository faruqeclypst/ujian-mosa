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

  const checkLicense = async () => {
    // Hanya berlaku ketika sistem berjalan di server lokal mandiri (offline)
    if (school?.id !== "local_server") {
      setChecking(false);
      return;
    }

    setChecking(true);
    let code = school?.offline_license || null;

    // 1. Coba baca dari dedicated endpoint /api/offline-license jika belum ada
    if (!code) {
      try {
        const resp = await fetch(`${window.location.origin}/api/offline-license`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.license) {
            code = data.license;
          }
        }
      } catch (err) {
        console.warn("Gagal membaca dari /api/offline-license:", err);
      }
    }

    // 2. Coba baca dari tabel settings database server secara langsung
    if (!code) {
      try {
        const resp = await fetch(`${window.location.origin}/api/collections/settings/records?limit=1`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.items && data.items.length > 0 && data.items[0].offline_license) {
            code = data.items[0].offline_license;
          }
        }
      } catch (err) {
        console.warn("Gagal membaca offline_license via direct server fetch:", err);
      }
    }

    // 3. Coba baca via SDK PocketBase
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

    // Catatan: Jangan gunakan fallback localStorage global agar PocketBase yang berbeda
    // pada port yang sama (localhost:8090) tidak saling tercemar lisensi/sekolah lama.

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
      // Jika kode dari localStorage ternyata tidak valid, bersihkan cache lokal
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
  if (school?.id !== "local_server") {
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
