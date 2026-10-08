/**
 * Storage Service
 * All R2 operations go through Cloudflare Worker — no AWS SDK / credentials in frontend.
 */

import PocketBase from "pocketbase";
import { compressImage } from "./imageCompression";

// Fallback bawaan (sesuai cloudflare-worker/README.md) agar upload tetap jalan
// walau env lupa di-set saat build. Ini endpoint publik, bukan kredensial.
// Env tetap diprioritaskan bila di-set.
const DEFAULT_R2_WORKER_URL = "https://examku-worker.faruq-blogger.workers.dev";
const DEFAULT_R2_PUBLIC_BASE_URL = "https://assets.examku.my.id";

export const getR2WorkerUrl = (): string =>
  ((import.meta.env.VITE_R2_WORKER_URL as string | undefined) || DEFAULT_R2_WORKER_URL).replace(/\/$/, "");

export const getR2PublicBaseUrl = (): string =>
  ((import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined) || DEFAULT_R2_PUBLIC_BASE_URL).replace(/\/$/, "");

const workerUrl = getR2WorkerUrl();
const publicBaseUrl = getR2PublicBaseUrl();

export interface UploadResult {
  key: string;
  url: string;
}

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const getMimeTypeFromExtension = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    pdf: "application/pdf",
  };
  return (ext && mimeMap[ext]) || "application/octet-stream";
};

async function calculateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  } catch {
    return Date.now().toString(36);
  }
}

async function uploadViaWorker(folder: string, file: File): Promise<UploadResult> {
  if (!workerUrl) {
    throw new Error("VITE_R2_WORKER_URL is not configured. Cannot upload without a backend worker.");
  }

  // Deduplikasi Berkas (Content-Addressable Storage):
  // Menghasilkan nama unik berdasarkan hash konten agar berkas identik tidak terduplikasi di Cloudflare R2
  const hash = await calculateFileHash(file);
  const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
  const rawBaseName = file.name.replace(/\.[^/.]+$/, "");
  const safeBaseName = sanitizeFileName(rawBaseName).slice(0, 36) || "media";
  const key = `${folder}/${hash}-${safeBaseName}.${ext}`;

  const formData = new FormData();
  formData.append("key", key);
  formData.append("file", file, `${safeBaseName}.${ext}`);
  formData.append("contentType", file.type || getMimeTypeFromExtension(file.name));

  const response = await fetch(`${workerUrl}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Upload failed: ${errText}`);
  }

  // Selalu konstruksi URL dari VITE_R2_PUBLIC_BASE_URL agar tidak bergantung pada konfigurasi Worker
  const base = (publicBaseUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/${key}` : key;
  return { key, url };
}

export const isOfflineEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    /^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(host) ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    window.location.port === "8090" ||
    localStorage.getItem("tenant_school_plan") === "offline"
  );
};

export async function deleteImageFromStorage(key: string): Promise<void> {
  if (isOfflineEnvironment() || !key || key.startsWith("offline-") || key.startsWith("data:")) return;
  if (!workerUrl) return;
  try {
    await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  } catch (e) {
    console.warn("Delete via worker failed", e);
  }
}

export async function deleteImagesFromStorage(keys: string[]): Promise<void> {
  if (isOfflineEnvironment() || keys.length === 0 || !workerUrl) return;
  const filteredKeys = keys.filter(k => k && !k.startsWith("offline-") && !k.startsWith("data:"));
  if (filteredKeys.length === 0) return;
  // Kirim paralel, maksimal 10 sekaligus agar tidak membebani Worker
  const chunkSize = 10;
  for (let i = 0; i < filteredKeys.length; i += chunkSize) {
    const chunk = filteredKeys.slice(i, i + chunkSize);
    await Promise.allSettled(chunk.map(key => deleteImageFromStorage(key)));
  }
}

/**
 * Proteksi Multi-Tenant:
 * Dalam sistem SaaS dengan bucket penyimpanan bersama (shared storage), file gambar
 * dapat digunakan lintas sekolah akibat fitur clone, pemulihan backup, atau bank soal bersama.
 * Penghapusan fisik file dari bucket dinonaktifkan di level tenant agar penghapusan soal
 * di satu sekolah tidak merusak gambar di sekolah lain.
 * Pembersihan file yatim (orphan) dilakukan secara terpusat melalui panel Super Admin.
 */
export async function safeDeleteImage(
  _url: string,
  _pb: PocketBase,
  _excludeQuestionId?: string
): Promise<void> {
  return;
}

/**
 * Batch version of safeDeleteImage.
 */
export async function safeDeleteImages(
  urls: string[],
  pb: PocketBase,
  excludeQuestionId?: string
): Promise<void> {
  if (urls.length === 0) return;
  await Promise.allSettled(urls.map(url => safeDeleteImage(url, pb, excludeQuestionId)));
}

export async function uploadInventoryImage(folder: string, file: File): Promise<UploadResult> {
  let fileToUpload = file;
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml" && file.type !== "image/gif") {
    try {
      fileToUpload = await compressImage(file);
    } catch {
      fileToUpload = file;
    }
  }

  // 🛑 MODE OFFLINE: JANGAN PERNAH MASUK KE CLOUDFLARE R2!
  // Gambar disimpan sebagai WebP Data URL terkompresi langsung di database lokal SQLite,
  // sehingga server mandiri dan lab LAN tetap dapat membuka gambar tanpa internet sama sekali.
  if (isOfflineEnvironment()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          key: `offline-${Date.now()}`,
          url: reader.result as string
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileToUpload);
    });
  }

  return uploadViaWorker(folder, fileToUpload);
}

export async function uploadFixedAssetImage(folder: string, file: File): Promise<UploadResult> {
  let fileToUpload = file;
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml" && file.type !== "image/gif") {
    try {
      fileToUpload = await compressImage(file);
    } catch {
      fileToUpload = file;
    }
  }

  if (isOfflineEnvironment()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          key: `offline-${Date.now()}`,
          url: reader.result as string
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileToUpload);
    });
  }

  return uploadViaWorker(folder, fileToUpload);
}
