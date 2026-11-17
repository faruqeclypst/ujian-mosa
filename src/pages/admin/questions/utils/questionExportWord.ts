import { latexToOmml } from "../../../../lib/latexToWordMath";
import {
  getAbsoluteUrl,
  processHtmlInlineImages,
  convertToPngBase64,
} from "./imageProcessors";

export interface ExportWordOptions {
  questions: any[];
  exam?: any;
  pb?: any;
  terminology?: { student?: string; teacher?: string; class?: string };
  selectedIds?: string[];
  onProgress?: (progress: { current: number; total: number; message: string; title: string }) => void;
}

export const exportQuestionsToWord = async ({
  questions,
  exam,
  pb,
  terminology = { student: "Siswa", teacher: "Guru", class: "Kelas" },
  selectedIds,
  onProgress,
}: ExportWordOptions): Promise<{ count: number; fileName: string }> => {
  const targetQuestions = selectedIds && selectedIds.length > 0
    ? questions.filter((q) => selectedIds.includes(q.id))
    : questions;

  if (targetQuestions.length === 0) {
    return { count: 0, fileName: "" };
  }

  const studentTerm = terminology.student || "Siswa";
  const teacherTerm = terminology.teacher || "Guru";
  const classTerm = terminology.class || "Kelas";

  onProgress?.({
    isOpen: true,
    total: targetQuestions.length,
    current: 0,
    message: "Menyiapkan export...",
    title: "Export ke Word",
  } as any);

  const cleanForWord = (htmlText: string) => {
    if (!htmlText) return "";
    return htmlText
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "<br/>")
      .replace(/<div>/gi, "")
      .replace(/<\/div>/gi, "<br/>")
      .replace(/(<br\/>)+$/, "")
      .trim();
  };

  const processLatex = (htmlInput: string) => {
    if (!htmlInput) return htmlInput;
    let result = htmlInput;
    const fixFormula = (f: string) =>
      f
        .trim()
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\u2026/g, "\\ldots")
        .replace(/\.\.\./g, "\\ldots");

    result = result.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (_, _s, formula) => {
      const clean = fixFormula(formula);
      const omml = latexToOmml(clean);
      if (omml) return `<br/>${omml}<br/>`;
      const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
      return `<br/><img src="${url}" class="latex-formula" /><br/>`;
    });

    result = result.replace(/(?<!\$)(\$)([^\$\n]+?)(\$)(?!\$)/g, (_, _s, formula) => {
      const clean = fixFormula(formula);
      if (!/[\\^_{}]/.test(clean)) return formula;
      const omml = latexToOmml(clean);
      if (omml) return ` ${omml} `;
      const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
      return `&nbsp;<img src="${url}" class="latex-formula" style="vertical-align: -2px; margin: 0 1pt;" />&nbsp;`;
    });

    result = result.replace(/(\\\()([\s\S]*?)(\\\))/g, (_, _s, formula) => {
      const clean = fixFormula(formula);
      const omml = latexToOmml(clean);
      if (omml) return ` ${omml} `;
      const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
      return `&nbsp;<img src="${url}" class="latex-formula" style="vertical-align: -2px; margin: 0 1pt;" />&nbsp;`;
    });

    return result;
  };

  // 1. Pre-collect all image URLs
  const urlsToConvert = new Set<string>();

  const addUrl = (url: string | undefined) => {
    if (!url) return;
    const abs = getAbsoluteUrl(url);
    if (abs) {
      urlsToConvert.add(abs);
    }
    urlsToConvert.add(url);
  };

  const collectFromHtml = (htmlText: string | undefined) => {
    if (!htmlText) return;
    const processed = processLatex(htmlText);
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let match;
    while ((match = imgRegex.exec(processed)) !== null) {
      addUrl(match[1]);
    }
  };

  for (const q of targetQuestions) {
    collectFromHtml(q.groupText);
    collectFromHtml(q.text);
    addUrl(q.imageUrl);

    if (
      q.choices &&
      (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")
    ) {
      for (const letter of ["a", "b", "c", "d", "e"]) {
        const c = (q.choices as any)[letter];
        if (c) {
          collectFromHtml(c.text);
          addUrl(c.imageUrl);
        }
      }
    } else if (q.type === "menjodohkan" && q.pairs) {
      for (const p of q.pairs) {
        collectFromHtml(p.left);
        collectFromHtml(p.right);
      }
    } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
      for (const item of q.items) {
        collectFromHtml(item.text);
        addUrl(item.imageUrl);
      }
    }
  }

  // 2. Download and convert all collected images to standard PNGs
  const imageMapping = new Map<string, { mappedUrl: string; base64: string; width: number; height: number }>();
  const urlList = Array.from(urlsToConvert);

  onProgress?.({
    total: urlList.length + targetQuestions.length,
    current: 0,
    message: `Mengunduh & mengonversi gambar (0/${urlList.length})...`,
    title: "Export ke Word",
  } as any);

  for (let idx = 0; idx < urlList.length; idx++) {
    const originalUrl = urlList[idx];
    onProgress?.({
      total: urlList.length + targetQuestions.length,
      current: idx,
      message: `Mengunduh & mengonversi gambar (${idx + 1}/${urlList.length})...`,
      title: "Export ke Word",
    } as any);

    const result = await convertToPngBase64(originalUrl, pb);
    if (result.base64) {
      const mappedUrl = `https://local-asset/img_${idx}.png`;
      const mappedObj = { mappedUrl, base64: result.base64, width: result.width, height: result.height };
      imageMapping.set(originalUrl, mappedObj);
      const abs = getAbsoluteUrl(originalUrl);
      if (abs) {
        imageMapping.set(abs, mappedObj);
      }
    }
  }

  const dateStr = new Date()
    .toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");

  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas.microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; color: #000; font-size: 11pt; }
  .kop { text-align: center; border-bottom: 2pt solid #000; margin-bottom: 15px; padding-bottom: 5px; }
  .hanging { margin-left: 0pt; padding-left: 0pt; text-indent: 0pt; margin-bottom: 3pt; text-align: left; }
  .choice { padding-left: 45pt; text-indent: -20pt; margin-bottom: 1pt; text-align: left; }
  img { display: block; margin: 5pt 0; border: none; }
  img.latex-formula { display: inline; margin: 0 1pt; vertical-align: -2px; }
  .wacana { border: 1pt solid #000; padding: 10pt; margin-bottom: 15pt; background: #f5f5f5; font-style: italic; }
  .spacer { margin: 0; padding: 0; line-height: 12pt; font-size: 12pt; height: 12pt; }
  p, div, span { margin: 0; padding: 0; line-height: 1.3; text-align: left; }
</style>
</head>
<body>
  <div class="kop">
    <p style="font-size: 14pt; font-weight: bold;">NASKAH SOAL UJIAN</p>
    <p style="font-size: 12pt;">${exam?.title || "UJIAN CBT"}</p>
    <p style="font-size: 10pt; font-weight: normal;">Mata Pelajaran: ${exam?.subject || "-"} | ${teacherTerm}: ${exam?.teacherName || "-"}</p>
  </div>
  <table border="0" cellpadding="0" cellspacing="0" style="width:100%; font-size: 10pt; margin-bottom: 15pt; border: none; border-collapse: collapse;">
    <tr>
      <td width="15%" style="border:none; padding: 2px;">No. Peserta</td><td width="2%" style="border:none;">:</td><td width="33%" style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td width="15%" style="border:none; padding: 2px;">${classTerm}</td><td width="2%" style="border:none;">:</td><td style="border:none;">${exam?.level || "-"}</td>
    </tr>
    <tr>
      <td style="border:none; padding: 2px;">Nama ${studentTerm}</td><td>:</td><td style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td style="padding: 2px;">Hari/Tgl</td><td>:</td><td>..........................</td>
    </tr>
  </table>
`;

  let currentGroupId = "";
  let keys = "";

  for (let i = 0; i < targetQuestions.length; i++) {
    const q = targetQuestions[i];
    onProgress?.({
      total: urlList.length + targetQuestions.length,
      current: urlList.length + i + 1,
      message: `Memproses soal #${i + 1}...`,
      title: "Export ke Word",
    } as any);

    if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
      const cleanLiterasi = cleanForWord(processHtmlInlineImages(processLatex(q.groupText || ""), imageMapping));
      html += `<div class="wacana"><b>STIMULUS / LITERASI:</b><br/>${cleanLiterasi}</div>`;
      currentGroupId = q.groupId;
    }

    const processedQText = cleanForWord(processHtmlInlineImages(processLatex(q.text || ""), imageMapping));
    html += `
    <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 3pt; border: none; border-collapse: collapse;">
      <tr>
        <td valign="top" width="25" style="width: 25pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;"><b>${i + 1}.</b></td>
        <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;"><span>${processedQText}</span></td>
      </tr>
    </table>`;

    if (q.imageUrl) {
      const absImg = getAbsoluteUrl(q.imageUrl);
      const info = imageMapping.get(q.imageUrl) || (absImg ? imageMapping.get(absImg) : undefined);
      if (info) {
        const displayW = Math.round(info.width > 290 ? 290 : info.width);
        const displayH = Math.round(info.width > 290 ? (info.height * 290) / info.width : info.height);
        html += `<div style="margin: 5pt 0 5pt 25pt;"><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Soal" /></div>`;
      }
    }

    if (
      q.choices &&
      (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")
    ) {
      for (const letter of ["a", "b", "c", "d", "e"]) {
        const c = (q.choices as any)[letter];
        if (c && (c.text || c.imageUrl)) {
          const processedCText = cleanForWord(processHtmlInlineImages(processLatex(c.text || ""), imageMapping));
          let choiceHtml = `
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-left: 25pt; margin-bottom: 1pt; border: none; border-collapse: collapse;">
            <tr>
              <td valign="top" width="20" style="width: 20pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;">${letter.toUpperCase()}.</td>
              <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;">
                <span>${processedCText}</span>`;
          if (c.imageUrl) {
            const absChoiceImg = getAbsoluteUrl(c.imageUrl);
            const info = imageMapping.get(c.imageUrl) || (absChoiceImg ? imageMapping.get(absChoiceImg) : undefined);
            if (info) {
              const displayW = Math.round(info.width > 181 ? 181 : info.width);
              const displayH = Math.round(info.width > 181 ? (info.height * 181) / info.width : info.height);
              choiceHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Pilihan" />`;
            }
          }
          choiceHtml += `
              </td>
            </tr>
          </table>`;
          html += choiceHtml;
        }
      }
      html += `<p class="spacer">&nbsp;</p>`;
      const ans = Object.entries(q.choices)
        .filter(([_, v]) => (v as any).isCorrect)
        .map(([k]) => k.toUpperCase())
        .join(", ");
      keys += `<tr><td align="center">${i + 1}</td><td align="center"><b>${ans || "-"}</b></td></tr>`;
    } else if (q.type === "menjodohkan" && q.pairs) {
      html += `<div style="margin-left: 25pt; margin-bottom: 5pt;">`;
      html += `<table border="1" cellpadding="4" style="border-collapse: collapse; width: 80%;">`;
      html += `<tr style="background-color: #f3f4f6;"><th>Pernyataan 1</th><th>Pernyataan 2</th></tr>`;
      for (const p of q.pairs) {
        html += `<tr><td>${cleanForWord(processHtmlInlineImages(processLatex(p.left || ""), imageMapping))}</td><td>${cleanForWord(processHtmlInlineImages(processLatex(p.right || ""), imageMapping))}</td></tr>`;
      }
      html += `</table></div>`;
      keys += `<tr><td align="center">${i + 1}</td><td>Menjodohkan (Lihat Lembar Jawaban)</td></tr>`;
      html += `<p class="spacer">&nbsp;</p>`;
    } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
      html += `<div style="margin-left: 25pt; margin-bottom: 5pt;"><ol>`;
      for (const item of q.items) {
        let itemHtml = `<li>${cleanForWord(processHtmlInlineImages(processLatex(item.text || ""), imageMapping))}`;
        if (item.imageUrl) {
          const absItemImg = getAbsoluteUrl(item.imageUrl);
          const info = imageMapping.get(item.imageUrl) || (absItemImg ? imageMapping.get(absItemImg) : undefined);
          if (info) {
            const displayW = Math.round(info.width > 145 ? 145 : info.width);
            const displayH = Math.round(info.width > 145 ? (info.height * 145) / info.width : info.height);
            itemHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Item" />`;
          }
        }
        itemHtml += `</li>`;
        html += itemHtml;
      }
      html += `</ol></div>`;
      keys += `<tr><td align="center">${i + 1}</td><td>${q.answerKey || "-"}</td></tr>`;
      html += `<p class="spacer">&nbsp;</p>`;
    } else {
      keys += `<tr><td align="center">${i + 1}</td><td>${q.answerKey || "-"}</td></tr>`;
      html += `<p class="spacer">&nbsp;</p>`;
    }
  }

  html += `
  <div style="page-break-before: always;"></div>
  <p align="center" style="font-weight:bold; font-size:14pt; border-bottom:1pt solid #000;">KUNCI JAWABAN</p>
  <table border="1" style="width:100%; border-collapse:collapse; margin-top:10px;">
    <tr style="background:#eee;"><th>No</th><th>Jawaban</th></tr>
    ${keys}
  </table>
</body></html>`;

  // 3. Assemble as MHTML
  const boundary = "----=_NextPart_Boundary_Ujian_CBT";
  let mhtml = "";
  mhtml += "MIME-Version: 1.0\r\n";
  mhtml += `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"\r\n\r\n`;

  // HTML Part
  mhtml += `--${boundary}\r\n`;
  mhtml += 'Content-Type: text/html; charset="utf-8"\r\n';
  mhtml += "Content-Transfer-Encoding: 8bit\r\n";
  mhtml += "Content-Location: https://local-asset/document.html\r\n\r\n";
  mhtml += html + "\r\n\r\n";

  // Attached image parts
  const attachedUrls = new Set<string>();
  for (const [_, mapped] of imageMapping.entries()) {
    if (attachedUrls.has(mapped.mappedUrl)) continue;
    attachedUrls.add(mapped.mappedUrl);

    const filename = mapped.mappedUrl.split("/").pop() || "image.png";

    mhtml += `--${boundary}\r\n`;
    mhtml += "Content-Type: image/png\r\n";
    mhtml += "Content-Transfer-Encoding: base64\r\n";
    mhtml += `Content-ID: <${filename}>\r\n`;
    mhtml += `Content-Location: ${mapped.mappedUrl}\r\n\r\n`;

    const base64Formatted = mapped.base64.replace(/(.{76})/g, "$1\r\n");
    mhtml += base64Formatted + "\r\n\r\n";
  }

  mhtml += `--${boundary}--\r\n`;

  const blob = new Blob([mhtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const fileName = selectedIds && selectedIds.length > 0
    ? `SOAL_TERPILIH_${targetQuestions.length}_${dateStr}.doc`
    : `${exam?.subject || "Ujian"} - ${exam?.teacherName || "Guru"} - ${dateStr}.doc`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: targetQuestions.length, fileName };
};
