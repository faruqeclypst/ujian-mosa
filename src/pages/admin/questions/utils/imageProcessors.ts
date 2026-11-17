import { getR2PublicBaseUrl, getR2WorkerUrl } from "../../../../lib/storage";

export const getAbsoluteUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const cleanUrl = url.startsWith("/") ? url.substring(1) : url;
  if (cleanUrl.startsWith("api/files/")) {
    return `${window.location.origin}/${cleanUrl}`;
  }
  if (cleanUrl.startsWith("schools/")) {
    const r2Base = getR2PublicBaseUrl();
    if (r2Base) {
      const base = r2Base.replace(/\/$/, "");
      return `${base}/${cleanUrl}`;
    }
  }
  return `${window.location.origin}/${cleanUrl}`;
};

export const forceSmallImage = (imgTag: string, physW: number, physH: number): string => {
  let cleaned = imgTag
    .replace(/\bwidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\bheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  cleaned = cleaned.replace(/(style=["'])([^"']*)(["'])/gi, (_, prefix, styleContent, suffix) => {
    const cleanedStyle = styleContent
      .replace(/\bwidth\s*:\s*[^;]+;?/gi, "")
      .replace(/\bheight\s*:\s*[^;]+;?/gi, "");
    return prefix + cleanedStyle + suffix;
  });

  if (physW > 0 && physH > 0) {
    const maxDisplayW = 290;
    let displayW = physW;
    let displayH = physH;
    if (physW > maxDisplayW) {
      displayH = Math.round((physH * maxDisplayW) / physW);
      displayW = maxDisplayW;
    }
    cleaned = cleaned.replace(/\/?>$/, ` width="${displayW}" height="${displayH}"$&`);
  } else {
    cleaned = cleaned.replace(/\/?>$/, ' width="290"$&');
  }
  return cleaned;
};

export const processHtmlInlineImages = (
  htmlText: string,
  imageMapping?: Map<string, { mappedUrl: string; base64: string; width: number; height: number }>
): string => {
  if (!htmlText) return "";
  let result = htmlText;
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  const matches: { full: string; src: string }[] = [];
  while ((match = imgRegex.exec(htmlText)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }
  for (const m of matches) {
    let replacedUrl = "";
    let width = 0;
    let height = 0;
    const absSrc = getAbsoluteUrl(m.src);
    const info = imageMapping ? imageMapping.get(m.src) || (absSrc ? imageMapping.get(absSrc) : undefined) : undefined;

    if (info) {
      replacedUrl = info.mappedUrl;
      width = info.width;
      height = info.height;
      let replacedImg = m.full.replace(m.src, replacedUrl);

      const isLatex = m.src.includes("latex.codecogs.com");
      if (!isLatex) {
        replacedImg = forceSmallImage(replacedImg, width, height);
      } else if (width > 480) {
        const scaledH = Math.round((height * 480) / width);
        replacedImg = replacedImg.replace(/\/?>$/, ` width="480" height="${scaledH}"$&`);
      }

      result = result.replace(m.full, replacedImg);
    } else {
      replacedUrl = absSrc || m.src;
      let replacedImg = m.full.replace(m.src, replacedUrl);
      const isLatex = m.src.includes("latex.codecogs.com");
      if (!isLatex) {
        replacedImg = forceSmallImage(replacedImg, width, height);
      }
      result = result.replace(m.full, replacedImg);
    }
  }
  return result;
};

export const convertToPngBase64 = async (
  url: string,
  pb?: any
): Promise<{ base64: string; width: number; height: number }> => {
  if (!url) return { base64: "", width: 0, height: 0 };

  const processDataUriWithCanvas = (dataUri: string): Promise<{ base64: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, w, h);
          const outDataUrl = canvas.toDataURL("image/png");
          const base64Data = outDataUrl.split(",")[1] || "";
          resolve({ base64: base64Data, width: w, height: h });
        } catch (canvasErr) {
          console.warn("Canvas export failed for image:", canvasErr);
          const rawBase64 = dataUri.split(",")[1] || "";
          resolve({ base64: rawBase64, width: img.naturalWidth || 290, height: img.naturalHeight || 200 });
        }
      };
      img.onerror = () => {
        resolve({ base64: "", width: 0, height: 0 });
      };
      img.src = dataUri;
    });
  };

  if (url.startsWith("data:")) {
    return processDataUriWithCanvas(url);
  }

  let blob: Blob | null = null;
  const isPbFile = url.includes("/api/files/");
  const pbToken = pb?.authStore?.token;

  try {
    const resp = await fetch(url, isPbFile && pbToken ? { headers: { Authorization: pbToken } } : undefined);
    if (resp.ok) {
      blob = await resp.blob();
    }
  } catch {
    blob = null;
  }

  const workerUrl = getR2WorkerUrl();
  const publicBaseUrl = getR2PublicBaseUrl();

  if (!blob && workerUrl) {
    try {
      let workerFetchUrl = "";
      if (publicBaseUrl && url.startsWith(publicBaseUrl)) {
        const key = url.replace(publicBaseUrl, "").replace(/^\/+/, "");
        workerFetchUrl = `${workerUrl}/${encodeURI(key)}`;
      } else if (!isPbFile) {
        workerFetchUrl = `${workerUrl}/proxy?url=${encodeURIComponent(url)}`;
      }
      if (workerFetchUrl) {
        const wResp = await fetch(workerFetchUrl);
        if (wResp.ok) {
          blob = await wResp.blob();
        }
      }
    } catch {
      // Proceed to PocketBase fallback
    }
  }

  if (!blob && pb) {
    try {
      const pbBase = (pb.baseUrl || window.location.origin).replace(/\/$/, "");
      const proxyUrl = `${pbBase}/api/image-proxy?url=${encodeURIComponent(url)}`;
      const proxyResp = await fetch(proxyUrl);
      if (proxyResp.ok) {
        const json = await proxyResp.json();
        if (json.base64) {
          const mime = json.contentType || "image/png";
          const dataUri = `data:${mime};base64,${json.base64}`;
          return processDataUriWithCanvas(dataUri);
        }
      }
    } catch (proxyErr) {
      console.warn("PocketBase image proxy fallback failed for:", url, proxyErr);
    }
  }

  if (!blob) {
    return { base64: "", width: 0, height: 0 };
  }

  const isLatex = url.toLowerCase().includes("latex.codecogs.com");
  if (isLatex) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = (reader.result as string) || "";
        const base64Data = dataUrl.split(",")[1] || "";
        const img = new window.Image();
        img.onload = () => resolve({ base64: base64Data, width: img.width, height: img.height });
        img.onerror = () => resolve({ base64: base64Data, width: 0, height: 0 });
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) {
        resolve({ base64: "", width: 0, height: 0 });
        return;
      }
      processDataUriWithCanvas(dataUrl).then(resolve);
    };
    reader.onerror = () => resolve({ base64: "", width: 0, height: 0 });
    reader.readAsDataURL(blob);
  });
};
