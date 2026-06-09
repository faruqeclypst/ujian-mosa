/**
 * Storage Service
 * All R2 operations go through Cloudflare Worker — no AWS SDK / credentials in frontend.
 */

import PocketBase from "pocketbase";

const workerUrl = import.meta.env.VITE_R2_WORKER_URL as string | undefined;
const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined;

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

async function uploadViaWorker(folder: string, file: File): Promise<UploadResult> {
  if (!workerUrl) {
    throw new Error("VITE_R2_WORKER_URL is not configured. Cannot upload without a backend worker.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeFileName(file.name);
  const key = `${folder}/${timestamp}-${safeName}`;

  const formData = new FormData();
  formData.append("key", key);
  formData.append("file", file, safeName);
  formData.append("contentType", file.type || getMimeTypeFromExtension(file.name));

  const response = await fetch(`${workerUrl}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Upload failed: ${errText}`);
  }

  // Selalu konstruksi URL dari VITE_R2_PUBLIC_BASE_URL — jangan percaya URL dari Worker
  // supaya tidak bergantung pada konfigurasi Worker
  const base = (publicBaseUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/${key}` : key;
  return { key, url };
}

export async function deleteImageFromStorage(key: string): Promise<void> {
  if (!workerUrl || !key) return;
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
  if (keys.length === 0 || !workerUrl) return;
  // Kirim paralel, maksimal 10 sekaligus agar tidak flood Worker
  const chunkSize = 10;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    await Promise.allSettled(chunk.map(key => deleteImageFromStorage(key)));
  }
}

/**
 * Hapus file dari bucket HANYA jika tidak ada soal lain yang masih pakai URL tersebut.
 * Cek referensi di semua soal kecuali soal yang sedang dihapus (excludeQuestionId).
 */
export async function safeDeleteImage(
  url: string,
  pb: PocketBase,
  excludeQuestionId?: string
): Promise<void> {
  if (!url || url.startsWith("data:") || !workerUrl) return;
  try {
    // Cari soal lain yang masih pakai URL ini
    const escapedUrl = url.replace(/'/g, "\\'");
    const idFilter = excludeQuestionId ? ` && id != "${excludeQuestionId}"` : "";
    // Cek di imageUrl field
    const refByImageUrl = await pb.collection("questions").getList(1, 1, {
      filter: `imageUrl = "${escapedUrl}"${idFilter}`,
    }).catch(() => ({ totalItems: 0 }));

    if (refByImageUrl.totalItems > 0) return; // masih dipakai, tidak dihapus

    // Cek di text (Quill HTML) dan options
    const refByText = await pb.collection("questions").getList(1, 1, {
      filter: `(text ~ "${escapedUrl}" || options ~ "${escapedUrl}")${idFilter}`,
    }).catch(() => ({ totalItems: 0 }));

    if (refByText.totalItems > 0) return; // masih dipakai

    // Aman dihapus
    const key = new URL(url).pathname.replace(/^\//, "");
    if (key) deleteImageFromStorage(key); // fire & forget
  } catch (e) {
    console.warn("safeDeleteImage check failed, skipping delete", e);
  }
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
  return uploadViaWorker(folder, file);
}

export async function uploadFixedAssetImage(folder: string, file: File): Promise<UploadResult> {
  return uploadViaWorker(folder, file);
}
