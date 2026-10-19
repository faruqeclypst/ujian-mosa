/**
 * Hard Reload & Cache-Busting Utility
 * 
 * Memaksa browser melakukan pembaruan penuh (bypass disk & memory cache):
 * 1. Menghapus CacheStorage API jika didukung browser
 * 2. Unregister Service Workers aktif (jika ada)
 * 3. Menambahkan timestamp cache-buster (?_reload=...) ke URL agar request HTML fresh
 * 4. Menyediakan helper pembersih parameter URL setelah reload selesai
 */

export async function forceHardReload(): Promise<void> {
  // 1. Bersihkan CacheStorage API
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
  } catch (err) {
    console.warn("Gagal mengosongkan CacheStorage:", err);
  }

  // 2. Unregister Service Workers
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (err) {
    console.warn("Gagal unregister ServiceWorker:", err);
  }

  // 3. Force navigate dengan parameter cache buster
  try {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_reload", Date.now().toString());
      window.location.replace(url.toString());
      return;
    }
  } catch {
    // fallback jika parsing URL gagal
  }

  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Membersihkan parameter _reload dari URL setelah browser selesai me-load halaman
 */
export function cleanupReloadQueryParam(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_reload")) {
      url.searchParams.delete("_reload");
      const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (_) {
    // Silent ignore
  }
}
