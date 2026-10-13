import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

let cachedAppId: string | null = null;

/**
 * Ambil application ID dari native app.
 * - examku.alfaprojects.com = EXAM AA (utama, online)
 * - examku.alfaprojects.com.browser = EXAM AA Browser (custom URL browser)
 * - examku.alfaprojects.com.local = EXAMKU Local (offline)
 * Di web browser biasa, return null.
 */
export async function getAppId(): Promise<string | null> {
  if (cachedAppId !== null) return cachedAppId;
  if (!Capacitor.isNativePlatform()) {
    cachedAppId = null;
    return null;
  }
  try {
    const info = await App.getInfo();
    cachedAppId = info.id || null;
  } catch {
    cachedAppId = null;
  }
  return cachedAppId;
}

/** Versi sinkron — pakai setelah getAppId() pernah dipanggil, fallback ke null. */
export function getCachedAppId(): string | null {
  return cachedAppId;
}

export const APP_IDS = {
  main: "examku.alfaprojects.com",
  browser: "examku.alfaprojects.com.browser",
  local: "examku.alfaprojects.com.local",
} as const;

export function isMainApp(appId: string | null): boolean {
  return appId === APP_IDS.main;
}

export function isBrowserApp(appId: string | null): boolean {
  return appId === APP_IDS.browser;
}

export function isLocalApp(appId: string | null): boolean {
  return appId === APP_IDS.local;
}
