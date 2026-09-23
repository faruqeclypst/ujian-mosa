export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  timeoutMs?: number;
  mimeType?: string;
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.88,
    timeoutMs = 8000,
    mimeType = "image/webp",
  } = options;

  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) return file;
  if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) return file;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(file), timeoutMs);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        clearTimeout(timeout);
        return resolve(file);
      }

      const img = new window.Image();
      img.src = dataUrl;

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          clearTimeout(timeout);
          return resolve(file);
        }

        const needsResize = width > maxWidth || height > maxHeight;
        if (needsResize) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            if (blob && (blob.size < file.size || needsResize)) {
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const compressedFile = new File([blob], newName, {
                type: mimeType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(file);
      };
    };

    reader.onerror = () => {
      clearTimeout(timeout);
      resolve(file);
    };
  });
}
