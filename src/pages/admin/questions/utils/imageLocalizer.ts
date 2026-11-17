import { uploadInventoryImage } from "../../../../lib/storage";
import { compressImage } from "../../../../lib/imageCompression";

export interface ImageLocalizerContext {
  school?: { plan?: string; id?: string; slug?: string } | null;
  examId?: string | null;
}

export const isClientOffline = (school?: { plan?: string; id?: string } | null): boolean => {
  return (
    school?.plan === "offline" ||
    school?.id === "local_server" ||
    (typeof window !== "undefined" &&
      (/^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(window.location.hostname) ||
        /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)))
  );
};

export const localizeImage = async (
  url: string,
  filenamePrefix: string,
  context?: ImageLocalizerContext
): Promise<string> => {
  if (!url) return "";

  if (isClientOffline(context?.school)) {
    return url; // Di mode offline, jangan kontak Cloudflare
  }

  const schoolFolder = context?.school?.slug || "unknown";
  const examId = context?.examId || "temp";

  // 1. If base64
  if (url.startsWith("data:image/")) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      let file = new File([blob], `${filenamePrefix}-${Date.now()}.webp`, { type: blob.type });
      if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
        try {
          file = await compressImage(file);
        } catch {
          /* keep original */
        }
      }
      const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
      return uploaded.url;
    } catch (err) {
      console.warn("Gagal upload base64 image:", err);
      return url;
    }
  }

  // 2. If external remote URL
  const isRemote = url.startsWith("http") && !url.includes("assets.examku.my.id") && !url.includes("/api/files/");
  if (isRemote) {
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const blob = await response.blob();

      let ext = "png";
      if (blob.type === "image/jpeg") ext = "jpg";
      else if (blob.type === "image/webp") ext = "webp";
      else if (blob.type === "image/gif") ext = "gif";

      let file = new File([blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type: blob.type });
      if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
        try {
          file = await compressImage(file);
        } catch {
          /* keep original */
        }
      }

      const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
      return uploaded.url;
    } catch (err) {
      console.warn("Gagal localize remote image:", url, err);
      return url;
    }
  }

  return url;
};

export const localizeInlineImages = async (
  html: string,
  context?: ImageLocalizerContext
): Promise<string> => {
  if (!html) return html;

  if (isClientOffline(context?.school)) {
    return html; // Di mode offline, jangan kontak Cloudflare
  }

  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let result = html;
  let match: RegExpExecArray | null;
  const matches: { full: string; src: string }[] = [];

  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }

  if (matches.length === 0) return html;

  const localized = await Promise.allSettled(
    matches.map(async (m, idx) => {
      const newUrl = await localizeImage(m.src, `inline-imported-${idx}`, context);
      return { src: m.src, newUrl };
    })
  );

  for (const r of localized) {
    if (r.status === "fulfilled" && r.value) {
      result = result.split(r.value.src).join(r.value.newUrl);
    }
  }

  return result;
};
