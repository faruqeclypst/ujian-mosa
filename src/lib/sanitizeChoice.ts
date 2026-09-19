/**
 * Utility sanitasi pilihan jawaban (Multiple Choice / Options)
 * Memastikan pilihan jawaban:
 * 1. Rata kiri (tanpa text-align center/right/justify)
 * 2. Normal teks (tanpa header h1-h6, font-size, color, background, italic, underline, strike)
 * 3. HANYA Bold dan List yang dipertahankan
 * 4. Rumus matematika (KaTeX/LaTeX) dan gambar tetap aman
 * 5. Bersihkan spasi di awal kata, non-breaking space (&nbsp; / \u00A0), tab
 * 6. Mendukung sub-soal / pernyataan bertingkat:
 *    - Jika soal biasa ("A. Praktik..."), "A." dibersihkan.
 *    - Jika ada sub-soal ("a.  a. asdad \n b. asdasdasdf"), "a." pertama dibersihkan, sub-pernyataan (a., b., c.) dipertahankan!
 *    - Jika baris pertama "a. asdad" dan baris kedua "b. asdasdasdf", sub-pernyataan "a." tidak terhapus!
 */

// Regex untuk mendeteksi awalan label opsi tunggal atau sub-item (misal: "A. ", "a. ", "B) ", "1. ", "• ")
export const SINGLE_PREFIX_REGEX = /^[ \t\u00A0\u200B\uFEFF]*(?:(?:[a-eA-E][\.\)\:\-]|[1-9][\.\)\:\-]|\([a-eA-E1-9]\)|[\u2022\u2023\u25E6\u2043\u2219\-\*]))+[ \t\u00A0\u200B\uFEFF]*/;

// Alias untuk kompatibilitas
export const CHOICE_PREFIX_REGEX = SINGLE_PREFIX_REGEX;

// Regex untuk mendeteksi double prefix pada baris pertama (misal: "a.  a. asdad" atau "b.  (1) asdad")
export const DOUBLE_PREFIX_REGEX = /^[ \t\u00A0\u200B\uFEFF]*(?:[a-eA-E][\.\)\:\-]|\([a-eA-E]\))[ \t\u00A0\u200B\uFEFF]+(?=(?:[a-eA-E][\.\)\:\-]|[1-9][\.\)\:\-]|\([a-eA-E1-9]\)|[\u2022\u2023\u25E6\u2043\u2219\-\*])[ \t\u00A0\u200B\uFEFF]*)/;

export const LEADING_WHITESPACE_REGEX = /^[ \t\u00A0\u200B\uFEFF]+/;

/**
 * Membersihkan teks polos (string) untuk pilihan jawaban
 */
export function sanitizeChoiceText(raw: string): string {
  if (!raw) return "";
  const lines = raw.split(/\r?\n/);
  // Apakah baris ke-2 dan seterusnya memiliki sub-marker (misal "b. ", "c. ", "2. ", dll)?
  const hasSubsequentMarkers = lines.slice(1).some(l => SINGLE_PREFIX_REGEX.test(l.trim()));

  const cleanedLines = lines.map((line, idx) => {
    let text = line.replace(/[\u00A0\u200B\uFEFF]/g, " ");
    if (idx === 0) {
      if (DOUBLE_PREFIX_REGEX.test(text)) {
        // Double prefix: "a.  a. asdad" -> hapus awalan "a." pertama saja
        text = text.replace(DOUBLE_PREFIX_REGEX, "");
      } else if (!hasSubsequentMarkers) {
        // Soal biasa tanpa sub-item -> bersihkan label opsi
        text = text.replace(SINGLE_PREFIX_REGEX, "");
      }
      // Jika ada hasSubsequentMarkers dan hanya 1 prefix, JANGAN dihapus karena itu sub-pernyataan pertama (a.)
    }
    // Bersihkan spasi di awal baris agar rata kiri rapi
    text = text.replace(LEADING_WHITESPACE_REGEX, "");
    return text;
  });

  return cleanedLines.join("\n");
}

/**
 * Membersihkan HTML pilihan jawaban agar:
 * - Rata kiri
 * - Normal teks (hapus heading, font, ukuran, warna, italic, underline, strike)
 * - Hanya BOLD yang dipertahankan
 * - Rumus matematika & gambar tetap utuh
 * - Spasi di awal kata & awalan label opsi dibersihkan tanpa merusak sub-pernyataan
 */
export function sanitizeChoiceContent(html: string): string {
  if (!html || !html.trim()) return "";
  if (html === "<p><br></p>" || html === "<p></p>") return html;

  // 1. Browser environment menggunakan DOMParser
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const body = doc.body;

      // Hapus atribut align dan style yang mengganggu (text-align, color, font-size, background, dll)
      const allElements = body.querySelectorAll("*");
      allElements.forEach((el) => {
        el.removeAttribute("align");
        el.removeAttribute("color");
        el.removeAttribute("size");
        el.removeAttribute("face");

        if (el instanceof HTMLElement) {
          el.style.textAlign = "";
          el.style.fontSize = "";
          el.style.fontFamily = "";
          el.style.color = "";
          el.style.backgroundColor = "";
          el.style.background = "";
          el.style.textIndent = "";
          el.style.marginLeft = "";
          el.style.marginRight = "";
          el.style.paddingLeft = "";
          el.style.paddingRight = "";
          el.style.lineHeight = "";

          // Jika style kosong setelah dibersihkan, hapus atribut style
          if (!el.getAttribute("style") || el.getAttribute("style")?.trim() === "") {
            el.removeAttribute("style");
          }
        }

        // Hapus class alignment Quill
        el.classList.remove("ql-align-center", "ql-align-right", "ql-align-justify");

        // Ganti heading (h1..h6) menjadi paragraf biasa
        if (/^H[1-6]$/i.test(el.tagName)) {
          const p = doc.createElement("p");
          p.innerHTML = el.innerHTML;
          el.parentNode?.replaceChild(p, el);
          return;
        }

        // Lepas tag formatting yang tidak diizinkan (italic, underline, strike, font, mark, dll)
        // KECUALI strong, b, img, formula/math, table, ol, ul, li
        const tag = el.tagName.toUpperCase();
        if (["EM", "I", "U", "S", "STRIKE", "FONT", "MARK", "SMALL", "BIG", "SUB", "SUP"].includes(tag)) {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        }
      });

      // Bersihkan spasi di awal kata dan awalan label opsi pada awal paragraf / blok
      const blocks = body.querySelectorAll("p, div, li");
      const targetBlocks = blocks.length > 0 ? Array.from(blocks) : [body];

      // Deteksi apakah blok ke-2 dst memiliki sub-marker (seperti "b. ", "c. ", "2. ")
      const hasSubsequentMarkers = targetBlocks.slice(1).some((b) => {
        const text = b.textContent?.trim() || "";
        return SINGLE_PREFIX_REGEX.test(text);
      });

      targetBlocks.forEach((block, blockIdx) => {
        let node: Node | null = block.firstChild;
        let atStartOfBlock = true;

        while (node && atStartOfBlock) {
          if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent || "";
            text = text.replace(/[\u00A0\u200B\uFEFF]/g, " ");

            if (blockIdx === 0) {
              if (DOUBLE_PREFIX_REGEX.test(text)) {
                // Double prefix pada baris pertama: "a.  a. asdad" -> hapus "a." pertama saja
                text = text.replace(DOUBLE_PREFIX_REGEX, "");
              } else if (!hasSubsequentMarkers) {
                // Bukan sub-soal bertingkat -> hapus label opsi
                text = text.replace(SINGLE_PREFIX_REGEX, "");
              }
              // Jika hasSubsequentMarkers dan hanya 1 prefix, pertahankan karena itu sub-pernyataan pertama
            }

            // Bersihkan spasi di awal kata agar selalu rata kiri
            if (LEADING_WHITESPACE_REGEX.test(text)) {
              text = text.replace(LEADING_WHITESPACE_REGEX, "");
            }

            node.textContent = text;

            if (text.length > 0) {
              atStartOfBlock = false;
              break;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.firstChild) {
              node = el.firstChild;
              continue;
            }
          }

          let next: Node | null = node.nextSibling;
          if (!next && node.parentNode && node.parentNode !== block) {
            next = node.parentNode.nextSibling;
          }
          node = next;
        }
      });

      return body.innerHTML;
    } catch {
      // Fallback jika terjadi error pada DOMParser
    }
  }

  // 2. Fallback regex untuk environment tanpa DOMParser
  let result = html;
  result = result.replace(/<\/?h[1-6][^>]*>/gi, "<p>");
  result = result.replace(/<\/?(?:em|i|u|s|strike|font|mark)[^>]*>/gi, "");
  result = result.replace(/\s+(?:style|align)="[^"]*"/gi, "");
  result = result.replace(/\s*class="[^"]*ql-align-[^"]*"/gi, "");
  result = result.replace(/&nbsp;/gi, " ");
  result = result.replace(/[\u00A0\u200B\uFEFF]/g, " ");

  const hasSubsequentMarkersFallback = /(?:<p[^>]*>|<br>|\n)[ \t]*(?:[b-eB-E][\.\)\:\-]|[2-9][\.\)\:\-]|\([b-eB-E2-9]\))/i.test(result);
  if (!hasSubsequentMarkersFallback) {
    result = result.replace(/(<p[^>]*>)[ \t]*(?:[a-eA-E][\.\)\:\-]|[1-5][\.\)\:\-]|\([a-eA-E1-5]\)|[\u2022\u2023\u25E6\u2043\u2219\-\*])[ \t]*/gi, "$1");
  } else {
    result = result.replace(/(<p[^>]*>)[ \t]*(?:[a-eA-E][\.\)\:\-]|\([a-eA-E]\))[ \t]+(?=(?:[a-eA-E][\.\)\:\-]|[1-9][\.\)\:\-]|\([a-eA-E1-9]\)|[\u2022\u2023\u25E6\u2043\u2219\-\*]))/gi, "$1");
  }
  result = result.replace(/(<p[^>]*>)[ \t]+/gi, "$1");

  return result;
}

/**
 * Membersihkan Quill Delta ops khusus untuk pilihan jawaban:
 * - Hanya pertahankan bold untuk atribut teks
 * - Hapus align, header, font, size, color, background
 * - Bersihkan spasi di awal kata dan label opsi otomatis (A., B., dll) dengan proteksi sub-soal
 */
export function cleanDeltaForChoice(delta: any, node?: any): any {
  if (!delta || !delta.ops || !Array.isArray(delta.ops)) return delta;

  // 1. Filter attributes: hanya BOLD dan LIST yang diizinkan
  delta.ops = delta.ops.map((op: any) => {
    if (typeof op.insert === "string") {
      const isBold = !!(op.attributes && op.attributes.bold);
      const list = op.attributes?.list;
      op.attributes = {};
      if (isBold) op.attributes.bold = true;
      if (list) op.attributes.list = list;
      if (Object.keys(op.attributes).length === 0) delete op.attributes;
    } else if (typeof op.insert === "object") {
      // Embed seperti gambar, formula
      if (op.attributes) {
        delete op.attributes.align;
        delete op.attributes.color;
        delete op.attributes.background;
      }
    }
    return op;
  });

  // Jika node adalah elemen inline yang memiliki previousSibling (bukan di awal blok),
  // jangan hapus spasi awal pada op pertama agar spasi antar-kata tidak hilang.
  const isInlineMiddle = node && node.previousSibling && !["P", "DIV", "BODY", "LI"].includes(node.nodeName);
  let atStart = !isInlineMiddle;

  // Cek apakah di dalam delta ada baris ke-2 dst dengan sub-marker
  const fullText = delta.ops.map((o: any) => typeof o.insert === "string" ? o.insert : "").join("");
  const lines = fullText.split("\n");
  const hasSubsequentMarkers = lines.slice(1).some((l: string) => SINGLE_PREFIX_REGEX.test(l.trim()));

  for (let i = 0; i < delta.ops.length; i++) {
    const op = delta.ops[i];
    if (typeof op.insert === "string") {
      if (atStart) {
        op.insert = op.insert.replace(/[\u00A0\u200B\uFEFF]/g, " ");

        if (DOUBLE_PREFIX_REGEX.test(op.insert)) {
          op.insert = op.insert.replace(DOUBLE_PREFIX_REGEX, "");
        } else if (!hasSubsequentMarkers) {
          op.insert = op.insert.replace(SINGLE_PREFIX_REGEX, "");
        }

        if (LEADING_WHITESPACE_REGEX.test(op.insert)) {
          op.insert = op.insert.replace(LEADING_WHITESPACE_REGEX, "");
        }

        if (op.insert.length > 0) {
          atStart = false;
        }
      }

      // Periksa juga setelah setiap newline (\n) di dalam string
      if (op.insert.includes("\n")) {
        const innerLines = op.insert.split("\n");
        for (let l = 1; l < innerLines.length; l++) {
          innerLines[l] = innerLines[l].replace(/[\u00A0\u200B\uFEFF]/g, " ");
          // Jangan hapus sub-marker (b., c., 2., dll) di baris ke-2 dst! Hanya bersihkan spasi awal agar rata kiri
          if (LEADING_WHITESPACE_REGEX.test(innerLines[l])) {
            innerLines[l] = innerLines[l].replace(LEADING_WHITESPACE_REGEX, "");
          }
        }
        op.insert = innerLines.join("\n");
      }
    } else {
      atStart = false;
    }
  }

  delta.ops = delta.ops.filter((op: any) => typeof op.insert !== "string" || op.insert.length > 0);

  return delta;
}
