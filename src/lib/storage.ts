import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function deleteImageFromStorage(key: string): Promise<void> {
  const config = getConfig();
  if (import.meta.env.VITE_R2_DEV_INLINE_BASE64 === "true") return; // offline skips
  if (!isR2Configured()) return;

  const client = ensureClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

export interface UploadResult {
  key: string;
  url: string;
}

const bucket = import.meta.env.VITE_R2_BUCKET as string | undefined;
const endpoint = import.meta.env.VITE_R2_ENDPOINT as string | undefined;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID as string | undefined;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY as string | undefined;
const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined;

let cachedClient: S3Client | null = null;
let cachedConfig:
  | {
      bucket: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    }
  | null = null;

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const getConfig = () => {
  if (!cachedConfig) {
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      const missing: string[] = [];
      if (!bucket) missing.push("VITE_R2_BUCKET");
      if (!endpoint) missing.push("VITE_R2_ENDPOINT");
      if (!accessKeyId) missing.push("VITE_R2_ACCESS_KEY_ID");
      if (!secretAccessKey) missing.push("VITE_R2_SECRET_ACCESS_KEY");
      throw new Error(
        `Konfigurasi R2 belum lengkap. Variabel berikut belum terisi: ${missing.join(", ")}.`
      );
    }

    cachedConfig = {
      bucket,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    };
  }

  return cachedConfig;
};

const ensureClient = () => {
  const config = getConfig();

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
};

const isR2Configured = () => !!(bucket && endpoint && accessKeyId && secretAccessKey);

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export async function uploadInventoryImage(folder: string, file: File): Promise<UploadResult> {
  // Offline fallback: force inline base64 images if configured (very useful for local tests / isolated networks)
  if (import.meta.env.VITE_R2_DEV_INLINE_BASE64 === "true") {
    const dataUrl = await blobToDataUrl(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = sanitizeFileName(file.name);
    const key = `${folder}/${timestamp}-${safeName}`;
    console.warn("Menggunakan mode offline base64 untuk gambar.");
    return { key, url: dataUrl };
  }

  if (!isR2Configured()) {
    throw new Error(
      "Konfigurasi R2 belum lengkap. Set env VITE_R2_* atau aktifkan fallback dev dengan VITE_R2_DEV_INLINE_BASE64=true."
    );
  }

  const config = getConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeFileName(file.name);
  const key = `${folder}/${timestamp}-${safeName}`;

  const client = ensureClient();
  // Convert to Uint8Array to avoid ReadableStream issues in some browsers
  const arrayBuffer = await file.arrayBuffer();
  const bodyBytes = new Uint8Array(arrayBuffer);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bodyBytes,
      ContentType: file.type || "application/octet-stream",
      // ContentLength: bodyBytes.byteLength, // optional: R2 generally infers
    })
  );

  let baseUrl = config.publicBaseUrl;
  if (!baseUrl) {
    try {
      const endpointUrl = new URL(config.endpoint);
      baseUrl = `https://${config.bucket}.${endpointUrl.host}`;
    } catch (error) {
      console.warn("Tidak dapat membentuk URL publik R2 dari endpoint", error);
      baseUrl = config.endpoint;
    }
  }

  if (!baseUrl) {
    throw new Error("Gagal menentukan URL publik R2. Periksa konfigurasi endpoint atau VITE_R2_PUBLIC_BASE_URL.");
  }

  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  return { key, url: `${normalizedBase}/${key}` };
}

export async function uploadFixedAssetImage(folder: string, file: File): Promise<UploadResult> {
  // Offline fallback: force inline base64 if configured
  if (import.meta.env.VITE_R2_DEV_INLINE_BASE64 === "true") {
    const dataUrl = await blobToDataUrl(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = sanitizeFileName(file.name);
    const key = `${folder}/${timestamp}-${safeName}`;
    console.warn("Menggunakan mode offline base64 untuk fixed asset.");
    return { key, url: dataUrl };
  }

  if (!isR2Configured()) {
    throw new Error(
      "Konfigurasi R2 belum lengkap. Set env VITE_R2_* atau aktifkan fallback dev."
    );
  }

  const config = getConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeFileName(file.name);
  const key = `${folder}/${timestamp}-${safeName}`;

  const client = ensureClient();
  const arrayBuffer = await file.arrayBuffer();
  const bodyBytes = new Uint8Array(arrayBuffer);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bodyBytes,
      ContentType: file.type || "application/octet-stream",
    })
  );

  let baseUrl = config.publicBaseUrl;
  if (!baseUrl) {
    try {
      const endpointUrl = new URL(config.endpoint);
      baseUrl = `https://${config.bucket}.${endpointUrl.host}`;
    } catch (error) {
      console.warn("Tidak dapat membentuk URL publik R2 dari endpoint", error);
      baseUrl = config.endpoint;
    }
  }

  if (!baseUrl) {
    throw new Error("Gagal menentukan URL publik R2.");
  }

  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  return { key, url: `${normalizedBase}/${key}` };
}
