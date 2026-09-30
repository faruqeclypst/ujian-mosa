import { useState, useEffect } from "react";

/**
 * Status koneksi jaringan nyata (bukan asumsi).
 * Dipakai untuk mengisi field `isOnline` pada attempts agar panel Monitoring
 * pengawas menampilkan kondisi sebenarnya, bukan selalu "Online".
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Nilai boolean aman untuk disimpan ke server.
 * Gunakan ini alih-alih hardcode `isOnline: true`.
 */
export function getOnlineFlag(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * Delay acak (jitter) untuk menyebarkan beban tulis serentak.
 *
 * MASALAH: ketika jaringan pulih, semua perangkat mengirim antrean offline
 * pada detik yang sama. Dengan 500–1000 siswa di satu WiFi, ini menciptakan
 * "retry storm" yang mengunci SQLite PocketBase (SQLITE_BUSY).
 *
 * SOLUSI: acak waktu kirim dalam rentang [minMs, maxMs).
 */
export function syncJitter(minMs = 1000, maxMs = 30000): number {
  return minMs + Math.floor(Math.random() * Math.max(0, maxMs - minMs));
}
