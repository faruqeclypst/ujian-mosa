import mammoth from "mammoth";
import JSZip from "jszip";
import { ommlElementToLatex } from "./ommlToLatex";

export interface ParsedQuestion {
  text: string;
  type?: "pilihan_ganda" | "isian_singkat" | "uraian";
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  answerKey?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
}

/**
 * Extract equations from .docx and inject LaTeX placeholders into the XML
 * before mammoth processes it. Returns a map of placeholder → LaTeX.
 */
const extractEquationsFromDocx = async (arrayBuffer: ArrayBuffer): Promise<{ modifiedBuffer: ArrayBuffer; equationMap: Map<string, string> }> => {
  const equationMap = new Map<string, string>();

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) return { modifiedBuffer: arrayBuffer, equationMap };

    let xmlString = await docXmlFile.async("string");
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    // Find all m:oMath elements (equations)
    const allElements = doc.getElementsByTagName("*");
    let eqIndex = 0;
    const toReplace: Array<{ element: Element; placeholder: string }> = [];

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.localName === "oMath" && el.parentElement?.localName !== "oMath") {
        const latex = ommlElementToLatex(el);
        if (latex) {
          const placeholder = `EQPLACEHOLDER${eqIndex}EQEND`;
          equationMap.set(placeholder, `$${latex}$`);
          toReplace.push({ element: el, placeholder });
          eqIndex++;
        }
      }
    }

    // Replace equation elements with placeholder text in the XML
    toReplace.forEach(({ element, placeholder }) => {
      // Create a w:r > w:t element with the placeholder text
      const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      const r = doc.createElementNS(ns, "w:r");
      const t = doc.createElementNS(ns, "w:t");
      t.setAttribute("xml:space", "preserve");
      t.textContent = placeholder;
      r.appendChild(t);

      // Also handle oMathPara wrapper
      const parent = element.parentElement;
      if (parent && parent.localName === "oMathPara") {
        parent.parentNode?.replaceChild(r, parent);
      } else {
        element.parentNode?.replaceChild(r, element);
      }
    });

    // Serialize back to string
    const serializer = new XMLSerializer();
    const modifiedXml = serializer.serializeToString(doc);
    zip.file("word/document.xml", modifiedXml);

    const modifiedBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return { modifiedBuffer, equationMap };
  } catch (e) {
    console.warn("Equation extraction failed, proceeding without equations:", e);
    return { modifiedBuffer: arrayBuffer, equationMap };
  }
};

/**
 * Parse questions from Word (.docx) file - OPTIMIZED
 * 
 * Improvements:
 * - Detects bold text as correct answer marker (not just red color)
 * - Detects multiple color formats (red, blue, green, custom)
 * - Handles underline as answer marker
 * - Better table support
 * - Trailing answer key detection ("Kunci: 1.A 2.B 3.C")
 */
export const parseQuestionsFromWord = async (file: File, options?: { includeEssay?: boolean }): Promise<ParsedQuestion[]> => {
  const includeEssay = options?.includeEssay ?? true;
  const arrayBuffer = await file.arrayBuffer();
  
  // Step 1: Extract equations and inject placeholders
  const { modifiedBuffer, equationMap } = await extractEquationsFromDocx(arrayBuffer);
  
  // Step 2: Convert to HTML with mammoth
  // Mammoth memetakan bold -> <strong>, italic -> <em>, coret -> <s>, dan
  // super/subscript secara bawaan, TAPI membuang garis bawah. Petakan
  // underline secara eksplisit ke <u> agar formatnya ikut terbawa.
  const result = await mammoth.convertToHtml(
    { arrayBuffer: modifiedBuffer },
    { styleMap: ["u => u"] }
  );
  let html = result.value;

  // Step 2b: Post-process — convert tab/nbsp indentation to margin-left style
  html = html.replace(/<p>((?:&nbsp;|\t|\u00A0){2,})/g, (match, spaces) => {
    const indentLevel = Math.min(Math.floor(spaces.replace(/&nbsp;/g, ' ').length / 4), 4);
    return `<p style="margin-left:${indentLevel * 2}em">`;
  });

  // Step 2c: Fix ordered lists — preserve numeric list markers (e.g. 1) 2) 3))
  // Since CSS list-style-type may be overridden, convert <ol><li> to explicit numbered paragraphs.
  html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
    let index = 0;
    const items = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_: string, inner: string) => {
      const trimmed = inner.trim();
      index++;
      if (/^\(?[0-9a-zA-Z]{1,3}[\.\)]/.test(trimmed)) {
        return `<p style="margin-left:1.5em;">${trimmed}</p>`;
      }
      return `<p style="margin-left:1.5em;">${index}) ${trimmed}</p>`;
    });
    return items;
  });

  // Step 3: Replace placeholders with LaTeX in the HTML
  equationMap.forEach((latex, placeholder) => {
    html = html.split(placeholder).join(latex);
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  // Ambil semua p, li, dan td, tapi saring td yang sudah punya p di dalamnya
  // Also collect standalone tables that are NOT literasi format tables
  const paragraphs = Array.from(doc.querySelectorAll("p, li, td")).filter(el => {
    if (el.tagName === 'TD') return el.querySelectorAll('p').length === 0;
    if (el.tagName === 'LI') return el.querySelectorAll('p').length === 0;
    return true;
  });

  // Identify content tables (tables nested inside other tables = data tables in questions/literasi)
  // Only the TOP-LEVEL structured table (with question numbers, choices, literasi codes) should be parsed per-cell.
  // Any table that is NESTED inside another table is a content/data table and should be preserved as HTML.
  const contentTables = new Set<Element>();
  const allTables = Array.from(doc.querySelectorAll("table"));
  allTables.forEach(table => {
    // If this table is inside another table's cell, it's a content/data table
    const parentTd = table.parentElement?.closest('td');
    if (parentTd) {
      contentTables.add(table);
    }
  });

  // Build a set of TD elements that belong to content tables (to skip in main loop)
  const contentTableTds = new Set<Element>();
  contentTables.forEach(table => {
    // Mark cells and paragraphs that are DIRECT descendants of this content table
    // (not elements that happen to be in a parent table that contains this content table)
    table.querySelectorAll("td, th").forEach(cell => {
      // Only include if the closest table ancestor is THIS content table
      if (cell.closest('table') === table) contentTableTds.add(cell);
    });
    table.querySelectorAll("p").forEach(p => {
      // Only include if the closest table ancestor is THIS content table
      if (p.closest('table') === table) contentTableTds.add(p);
    });
  });

  // Track which content tables have been injected already
  const injectedTables = new Set<Element>();

  const questions: ParsedQuestion[] = [];

  // ─── LITERASI REGISTRY: stores kode → isi literasi ─────────────────────
  const literasiRegistry = new Map<string, string>();
  let literasiSetForCurrentBlock = false;
  let isEssaySection = false; // tracks if we're in "Uraian / Isian Singkat" section

  let pendingNumber: string | null = null;
  let pendingLetter: string | null = null;
  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let currentAnswerKey = "";
  let inSubStatementList = false;

  let currentGroupId: string | undefined = undefined;
  let currentGroupText: string | undefined = undefined;

  // Trailing answer key collection
  const trailingAnswerKeys = new Map<number, string>();
  let questionCounter = 0;

  // Helper: extract all image sources from an element
  const extractImages = (el: Element): string[] => {
    const imgs = el.querySelectorAll("img");
    return Array.from(imgs).map(img => img.getAttribute("src")).filter(Boolean) as string[];
  };

  // Helper: get text content without image alt text
  const getCleanText = (el: Element): string => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("img").forEach(img => img.remove());
    return clone.textContent?.trim() || "";
  };

  // Helper: detect if element has "correct answer" styling
  const hasCorrectMarker = (el: Element, innerHTML: string): boolean => {
    // 1. Color-based detection (red, blue, green, or any non-black color with emphasis)
    const colorPatterns = [
      /color:\s*#(?!000|333|444|555|666)[0-9a-f]{3,6}/i,
      /color:\s*(?:red|blue|green|darkred|darkblue)/i,
      /color:\s*rgb\(\s*(?!0\s*,\s*0\s*,\s*0)[\d,\s]+\)/i,
    ];
    const hasColor = colorPatterns.some(p => p.test(innerHTML));
    
    // 2. Bold detection — entire choice text is bold
    const isBold = (
      innerHTML.includes("<strong") || 
      innerHTML.includes("<b>") || 
      innerHTML.includes("font-weight: bold") ||
      innerHTML.includes("font-weight:bold") ||
      innerHTML.includes("font-weight: 700") ||
      innerHTML.includes("font-weight:700")
    );
    
    // 3. Underline detection (some teachers use underline for correct answer)
    const isUnderlined = innerHTML.includes("text-decoration: underline") || innerHTML.includes("<u>");
    
    // Color alone is strong signal. Bold alone needs to be the ENTIRE text.
    // Underline alone is weaker signal but still valid.
    if (hasColor) return true;
    
    // For bold: check if the ENTIRE choice text is wrapped in bold (not just a word)
    if (isBold) {
      const textContent = getCleanText(el);
      // Strip the choice letter prefix to get just the answer text
      const choiceTextMatch = textContent.match(/^[A-Ea-e][\.\)\s]+(.*)/);
      const choiceBody = choiceTextMatch ? choiceTextMatch[1] : textContent;
      
      // Check if bold wraps most of the content
      const strongContent = el.querySelector("strong, b");
      if (strongContent) {
        const boldText = strongContent.textContent?.trim() || "";
        // If bold text is >60% of choice body, consider it marked
        if (boldText.length > choiceBody.length * 0.6) return true;
      }
    }
    
    if (isUnderlined) return true;
    
    return false;
  };

  // Helper: ambil innerHTML elemen dengan `count` karakter teks pertama
  // dibuang — dipakai untuk membuang penanda nomor soal / huruf pilihan
  // dari HTML TANPA menghilangkan format (bold/italic/underline) di sisa
  // teksnya. Penanda bisa terpecah ke beberapa run/format, jadi penghapusan
  // berjalan per simpul teks mengikuti urutan dokumen.
  const stripLeadingCharsFromHtml = (el: Element, count: number): string => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("img").forEach(img => img.remove());
    let remaining = count;
    let started = false;
    const visit = (node: Node): void => {
      if (started && remaining <= 0) return;
      if (node.nodeType === 3) {
        let text = node.textContent || "";
        if (!started) {
          // Teks acuan (getCleanText) sudah di-trim: lewati spasi awal dulu
          const trimmedStart = text.replace(/^\s+/, "");
          if (trimmedStart.length === 0) {
            node.textContent = "";
            return;
          }
          node.textContent = trimmedStart;
          text = trimmedStart;
          started = true;
        }
        if (text.length <= remaining) {
          remaining -= text.length;
          node.textContent = "";
        } else {
          node.textContent = text.slice(remaining);
          remaining = 0;
        }
        return;
      }
      Array.from(node.childNodes).forEach(visit);
    };
    visit(clone);
    return (clone as HTMLElement).innerHTML?.trim() || "";
  };

  // Helper: bila SELURUH isi pilihan dibungkus bold atau underline, format
  // itu adalah penanda kunci jawaban dari guru — bukan format isi soal.
  // Lepas bungkusnya agar kunci tidak bocor terlihat oleh siswa. Format
  // sebagian teks (mis. satu kata ditebalkan) tetap dipertahankan.
  const unwrapMarkerFormatting = (html: string): string => {
    if (!html) return html;
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const totalText = (tmp.textContent || "").trim();
    if (!totalText) return html;
    ["strong, b", "u"].forEach((selector) => {
      const nodes = Array.from(tmp.querySelectorAll(selector));
      if (nodes.length === 0) return;
      const wrappedText = nodes.map(n => (n.textContent || "").trim()).join("");
      if (wrappedText.length > totalText.length * 0.6) {
        nodes.forEach(n => {
          const parent = n.parentNode;
          if (!parent) return;
          while (n.firstChild) parent.insertBefore(n.firstChild, n);
          parent.removeChild(n);
        });
      }
    });
    return tmp.innerHTML.trim();
  };

  // ─── FIRST PASS: Detect trailing answer key section ────────────────────
  const allTexts = paragraphs.map(p => getCleanText(p));
  for (let i = allTexts.length - 1; i >= Math.max(0, allTexts.length - 30); i--) {
    const text = allTexts[i];
    if (!text) continue;
    
    // Detect answer key header
    if (/^(kunci|jawaban|answer|key)\s*(jawaban)?/i.test(text)) {
      // Collect answer items from this point onwards
      const remaining = allTexts.slice(i).join(" ");
      const matches = remaining.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g);
      for (const match of matches) {
        trailingAnswerKeys.set(parseInt(match[1]), match[2].toLowerCase());
      }
      break;
    }
    
    // Detect inline answer list without header (e.g., "1.A 2.B 3.C 4.D 5.E")
    const inlineMatches = [...text.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g)];
    if (inlineMatches.length >= 3) {
      // Likely an answer key list
      const remaining = allTexts.slice(i).join(" ");
      const allMatches = remaining.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g);
      for (const match of allMatches) {
        trailingAnswerKeys.set(parseInt(match[1]), match[2].toLowerCase());
      }
      break;
    }
  }

  // ─── PRE-PROCESS: Handle structured exam tables ──────────────────────────
  // Supports:
  // 1. Multi-question tables (an entire exam of 40-50 questions in one or more tables,
  //    with optional header metadata rows at the top: "Nama Guru : ...", "Kelas : ...").
  // 2. Per-question tables (one table per question).
  // 3. Tables broken across page boundaries.
  const topLevelTables = allTables.filter(t => !t.parentElement?.closest('table'));

  const getTableRows = (table: Element) =>
    Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));

  const processedTableQuestions: ParsedQuestion[] = [];

  let curQText = "";
  let curQChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let curQKey = "";
  let curQImage: string | undefined = undefined;

  const commitCurrentTableQuestion = () => {
    if (!curQText || !curQText.trim()) return;
    const choiceKeys = Object.keys(curQChoices);
    if (choiceKeys.length >= 2) {
      if (curQKey && curQChoices[curQKey]) {
        curQChoices[curQKey].isCorrect = true;
      }
      processedTableQuestions.push({
        text: curQText.trim(),
        type: "pilihan_ganda",
        choices: { ...curQChoices },
        answerKey: curQKey || undefined,
        imageUrl: curQImage,
      });
    } else if (includeEssay) {
      const textOnly = curQText.replace(/<[^>]*>/g, '').trim();
      const isShort = textOnly.length < 80 && !curQText.includes('<li') && !curQText.includes('•');
      processedTableQuestions.push({
        text: curQText.trim(),
        type: isShort ? "isian_singkat" : "uraian",
        choices: {},
        answerKey: curQKey || undefined,
        imageUrl: curQImage,
      });
    }
    curQText = "";
    curQChoices = {};
    curQKey = "";
    curQImage = undefined;
  };

  // Collect all direct rows across all top-level tables
  const allRows: Element[] = [];
  topLevelTables.forEach(table => {
    const rows = getTableRows(table);
    allRows.push(...rows);
  });

  allRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll(':scope > td, :scope > th'));
    if (cells.length === 0) return;

    const fullRowText = cells.map(c => c.textContent?.trim() || "").join(" ").trim();
    if (!fullRowText) return;

    // A. Check for metadata / header rows to ignore
    // e.g. "Nama Guru : RN", "Mata Pelajaran : PJOK", "Kelas : XII", "No | Soal | Kunci"
    if (/^(?:Nama\s*Guru|Mata\s*Pelajaran|Mapel|Kelas|Hari\s*\/\s*Tanggal|Waktu|Petunjuk)\s*[:]/i.test(fullRowText)) {
      return;
    }
    const c0 = cells[0]?.textContent?.trim() || "";
    const c1 = cells.length >= 2 ? (cells[1]?.textContent?.trim() || "") : "";
    if (/^(?:no|nomor)$/i.test(c0) && /^(?:soal|pertanyaan|uraian\s*soal|item)/i.test(c1)) {
      return;
    }

    // B. Check for Answer Key Row (e.g. "Kunci Jawaban: A" or cell 0 "Kunci" cell 1 "A")
    const keyMatch = fullRowText.match(/^(?:kunci(?:\s*jawaban)?|jawaban|answer|key)\s*[:\.\s]+([A-Ea-e])\b/i) ||
                     fullRowText.match(/\bkunci\s*(?:jawaban)?\s*[:\.\s]+([A-Ea-e])\b/i);
    if (keyMatch && (curQText || Object.keys(curQChoices).length > 0)) {
      curQKey = keyMatch[1].toLowerCase();
      if (curQChoices[curQKey]) {
        curQChoices[curQKey].isCorrect = true;
      }
      return;
    }

    // C. Check for Question Number Row
    // Col 0 has question number: "1.", "1", "1)", "(1)", "No. 1", "No 1", "Nomor 1", "40."
    const qNumMatch = c0.match(/^(?:no[\.\s]*|nomor[\.\s]*)?\(?(\d{1,4})\)?[\.\)]*$/i);
    if (qNumMatch && cells.length >= 2) {
      // Commit previous question if any
      commitCurrentTableQuestion();

      const cell1Html = (cells[1] as HTMLElement)?.innerHTML?.trim() || "";
      const cell1Text = cells[1]?.textContent?.trim() || "";
      curQText = cell1Html || cell1Text;

      const qImgs = extractImages(cells[1]);
      if (qImgs.length > 0) curQImage = qImgs[0];

      // Check if 3-column table has key in col 2 (e.g. | 1 | Soal... | A |)
      if (cells.length >= 3) {
        const c2 = cells[2]?.textContent?.trim() || "";
        const m2 = c2.match(/^([A-Ea-e])$/i) || c2.match(/kunci\s*[:\.\s]*([A-Ea-e])/i);
        if (m2) curQKey = m2[1].toLowerCase();
      }
      return;
    }

    // D. Check for Horizontal Choice Row (e.g. 4-5 cells: A: ... | B: ... | C: ...)
    if (curQText && cells.length >= 4) {
      let matchedChoicesInRow = 0;
      cells.forEach(cell => {
        const txt = cell.textContent?.trim() || "";
        const m = txt.match(/^([A-Ea-e])[\.\)\s]+(.*)/s);
        if (m) {
          matchedChoicesInRow++;
          const letter = m[1].toLowerCase();
          const cHtml = cell.innerHTML.replace(/^[\s\S]*?[A-Ea-e][\.\)\s]+/, '').trim();
          const cImgs = extractImages(cell);
          curQChoices[letter] = {
            text: cHtml || m[2].trim(),
            imageUrl: cImgs.length > 0 ? cImgs[0] : undefined,
            isCorrect: false,
          };
        }
      });
      if (matchedChoicesInRow >= 3) return;
    }

    // E. Check for Single Choice Row
    // Col 0 has choice letter: "A", "B", "C", "D", "E", "A.", "(A)", "a)"
    const choiceMatch = c0.match(/^\(?([A-Ea-e])\)?[\.\)]*$/);
    if (curQText && choiceMatch) {
      const letter = choiceMatch[1].toLowerCase();
      const choiceHtml = cells.length >= 2 ? ((cells[1] as HTMLElement)?.innerHTML?.trim() || "") : "";
      const choiceText = cells.length >= 2 ? (cells[1]?.textContent?.trim() || "") : "";
      const cImgs = cells.length >= 2 ? extractImages(cells[1]) : [];
      const isMarked = cells.length >= 2 ? hasCorrectMarker(cells[1], choiceHtml) : false;

      curQChoices[letter] = {
        text: choiceHtml || choiceText,
        imageUrl: cImgs.length > 0 ? cImgs[0] : undefined,
        isCorrect: false,
      };
      if (isMarked && !curQKey) curQKey = letter;
      return;
    }

    // F. Continuation of Question Text
    // If we're inside a question and choices haven't started yet:
    if (curQText && Object.keys(curQChoices).length === 0) {
      const cell1Html = cells.length >= 2 ? ((cells[1] as HTMLElement)?.innerHTML?.trim() || "") : "";
      const rowContent = cell1Html || fullRowText;
      curQText += "<br>" + rowContent;
      const rImgs = extractImages(row);
      if (rImgs.length > 0 && !curQImage) curQImage = rImgs[0];
      return;
    }
  });

  // Commit the last table question
  commitCurrentTableQuestion();

  // If table questions were successfully parsed:
  if (processedTableQuestions.length > 0) {
    // Apply trailing answer keys if present and inline keys were missing
    if (trailingAnswerKeys.size > 0) {
      processedTableQuestions.forEach((q, index) => {
        const questionNum = index + 1;
        const key = trailingAnswerKeys.get(questionNum);
        if (key && q.choices[key]) {
          const hasInlineAnswer = Object.values(q.choices).some(c => c.isCorrect);
          if (!hasInlineAnswer) {
            Object.keys(q.choices).forEach(k => { q.choices[k].isCorrect = false; });
            q.choices[key].isCorrect = true;
            q.answerKey = key;
          }
        }
      });
    }

    const finalTableQuestions = includeEssay
      ? processedTableQuestions
      : processedTableQuestions.filter(q => q.type === "pilihan_ganda");
    finalTableQuestions.forEach(q => {
      q.text = (q.text || "").trim();
    });
    if (finalTableQuestions.length > 0) {
      return finalTableQuestions;
    }
  }

  // ─── MAIN PARSE ──────────────────────────────────────────────────────
  paragraphs.forEach((p) => {
    const images = extractImages(p);
    const firstImage = images.length > 0 ? images[0] : undefined;
    const textOnly = getCleanText(p);
    const line = p.innerHTML?.trim() || "";

    // ─── CONTENT TABLE HANDLING ──────────────────────────────────────────
    // If this element belongs to a content table, inject the full table HTML
    // into the current question text (only once per table)
    if (contentTableTds.has(p)) {
      const parentTable = p.closest('table');
      if (parentTable && contentTables.has(parentTable) && !injectedTables.has(parentTable)) {
        injectedTables.add(parentTable);
        const tableHtml = parentTable.outerHTML;
        if (currentQuestion) {
          currentQuestion.text += " " + tableHtml;
        } else if (currentGroupId && currentGroupText !== undefined) {
          // Only inject if groupText doesn't already contain this table
          // (it might already be included via secondCellHtml)
          if (!currentGroupText.includes('<table')) {
            currentGroupText += " " + tableHtml;
          }
        }
      }
      return; // Skip individual cell processing
    }

    // Ignore Headers
    if (textOnly.match(/^(Nama Guru|Kelas|Mapel|Mata Pelajaran|Nama Sekolah|Waktu|Hari|Tanggal|Petunjuk|Pilihlah|Berilah|Kerjakan)\s*[:]/i)) return;
    if (textOnly.match(/^PENTING:/i)) return;

    // Detect essay section header
    if (textOnly.match(/^(Uraian|Isian Singkat|Uraian\s*[\/&]\s*Isian Singkat|Essay|Soal Uraian|Soal Isian)/i)) {
      // Save previous question if any
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) { const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect); if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; } }
        questionCounter++;
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          groupId: currentGroupId,
          groupText: currentGroupText,
          choices: { ...currentChoices },
        });
        currentQuestion = null;
        currentChoices = {};
        currentAnswerKey = "";
      }
      isEssaySection = true;
      currentGroupId = undefined;
      currentGroupText = undefined;
      return;
    }

    // If in essay section but includeEssay is false, skip everything
    if (isEssaySection && !includeEssay) return;

    // In essay section, <li> elements handling:
    // - If it starts with a number (1. 2. etc) or is a top-level ordered list item → new question
    // - If currentQuestion exists and this is a bullet/sub-item → append to current question text
    if (isEssaySection && p.tagName === 'LI') {
      const isNumberedItem = textOnly.match(/^[\(]?(\d+)[\.\s\)]+(.*)/) || (p.parentElement?.tagName === 'OL');
      const isBulletSubItem = p.parentElement?.tagName === 'UL' || textOnly.match(/^[•\-\*]/);
      
      if (isBulletSubItem && currentQuestion) {
        // Append bullet point to current question text
        currentQuestion.text += `<br>• ${textOnly}`;
        return;
      }
      
      if (isNumberedItem && textOnly && !textOnly.match(/^[A-Ea-e][\.\)\s]/)) {
        // Save previous question
        if (currentQuestion && currentQuestion.text) {
          if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) { const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect); if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; } }
          questionCounter++;
          questions.push({
            text: currentQuestion.text,
            imageUrl: currentQuestion.imageUrl,
            groupId: currentGroupId,
            groupText: currentGroupText,
            choices: { ...currentChoices },
          });
        }
        // Start new essay question — strip the number prefix if from <ol>
        const questionText = p.parentElement?.tagName === 'OL' ? (line || textOnly) : (textOnly.replace(/^[\(]?\d+[\.\s\)]+/, '').trim() || textOnly);
        currentQuestion = { text: questionText, imageUrl: firstImage || undefined };
        currentChoices = {};
        currentAnswerKey = "";
        currentGroupId = undefined;
        currentGroupText = undefined;
        literasiSetForCurrentBlock = false;
        pendingNumber = null;
        pendingLetter = null;
        return;
      }
      
      // Default: append to current question if exists
      if (currentQuestion) {
        currentQuestion.text += `<br>${textOnly}`;
        return;
      }
    }

    const isImageOnly = !textOnly && images.length > 0;
    if (!textOnly && !isImageOnly) return;

    // Skip if this is part of the trailing answer key section
    if (trailingAnswerKeys.size > 0) {
      const answerListMatch = textOnly.match(/^(kunci|jawaban|answer|key)\s*(jawaban)?/i);
      if (answerListMatch) return;
      // Check if line is purely answer items
      const items = [...textOnly.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g)];
      if (items.length >= 3 && textOnly.replace(/[\d\.\)\s,A-Ea-e]/g, "").length < 5) return;
    }

    // ─── KODE LITERASI TABLE FORMAT ──────────────────────────────────────
    // Format tabel:
    // Baris 1: | Kode Literasi (misal LIT-1) | Isi teks literasi... |
    // Baris 2: | 1. | Teks pertanyaan |
    // Baris 3: | A | Pilihan A |
    // ...
    // Jika kode sama dengan yang sudah ada di registry, pakai teks yang sudah tersimpan
    // Jika kode baru + ada isi, simpan ke registry
    // Tanpa baris kode = soal mandiri
    
    // Skip header row "Kode Literasi | Contoh Isi Literasi"
    if (textOnly.match(/^kode\s*literasi$/i) || textOnly.match(/^(contoh\s*)?isi\s*literasi$/i) || textOnly.match(/^contoh/i)) return;

    // Detect kode literasi row in table
    // Works with <p> inside <td> (mammoth output) or bare <td>
    const parentTd = p.tagName === 'TD' ? p : p.closest ? p.closest('td') : null;
    if (parentTd) {
      const row = parentTd.closest('tr');
      if (row) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 2) {
          const firstCell = cells[0];
          const secondCell = cells[1];
          
          // Only process once per row (when we're in the first cell)
          if (parentTd === firstCell) {
            const cellText = (firstCell.textContent?.trim() || "");
            const secondCellText = (secondCell.textContent?.trim() || "");
            const secondCellHtml = (secondCell.innerHTML?.trim() || "");
            
            // Check if this looks like a literasi code
            // Can be anything: "LIT-1", "jaringan", "KODE-1", "ekosistem", etc.
            // Must NOT be: a question number, a choice letter, "Kunci Jawaban", or common headers
            // Additional: second cell must be either empty (reference) or have substantial text (>20 chars)
            const isLiterasiKode = cellText &&
              cellText.length >= 2 &&
              cellText.length <= 30 &&
              !cellText.match(/^\d+[\.\)\s]*$/) && // not a question number (1. 2. etc)
              !cellText.match(/^[A-Ea-e][\.\)\s]*$/) && // not a choice letter
              !cellText.match(/^kunci/i) && // not answer key
              !cellText.match(/^(Nama|Kelas|Mapel|Mata|Guru|Waktu|Hari|Tanggal|Petunjuk)/i) && // not header
              !cellText.match(/^\d+[\.\)]\s+\S/) && // not "1. question text"
              !cellText.match(/^[A-Ea-e][\.\)]\s+\S/) && // not "A. choice text"
              (secondCellText.length === 0 || secondCellText.length > 20); // isi must be empty or substantial
            
            if (isLiterasiKode) {
              // Push previous question BEFORE setting new literasi group
              if (currentQuestion && currentQuestion.text) {
                if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
                  const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect);
                  if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; }
                }
                questionCounter++;
                questions.push({
                  text: currentQuestion.text,
                  imageUrl: currentQuestion.imageUrl,
                  groupId: currentGroupId,
                  groupText: currentGroupText,
                  choices: { ...currentChoices },
                });
                currentQuestion = null;
                currentChoices = {};
                currentAnswerKey = "";
              }

              const kode = cellText.replace(/\s+/g, '-').toUpperCase();
              literasiSetForCurrentBlock = true;
              
              if (secondCellText && secondCellText.length > 10) {
                // Extract only the stimulus text (before the first question number)
                // Remove question numbers, choices, and answer keys from groupText
                let stimulusHtml = secondCellHtml || secondCellText;
                // Find where questions start (first "1." or numbered pattern in the cell)
                const questionStartMatch = stimulusHtml.match(/(<p[^>]*>)?\s*[\(]?\d+[\.\s\)]/);
                if (questionStartMatch && questionStartMatch.index !== undefined) {
                  stimulusHtml = stimulusHtml.substring(0, questionStartMatch.index).trim();
                }
                // Also remove "Kunci Jawaban" lines
                stimulusHtml = stimulusHtml.replace(/<p[^>]*>.*?[Kk]unci\s*[Jj]awaban.*?<\/p>/gi, '');
                
                literasiRegistry.set(kode, stimulusHtml);
                currentGroupId = kode;
                currentGroupText = literasiRegistry.get(kode)!;
              } else {
                if (literasiRegistry.has(kode)) {
                  currentGroupId = kode;
                  currentGroupText = literasiRegistry.get(kode)!;
                } else {
                  currentGroupId = kode;
                  currentGroupText = secondCellText || "";
                }
              }
              return;
            }
          }
          
          // Skip second cell content ONLY if it's the literasi text (before any question number)
          // Don't skip if the content looks like a question number or choice letter
          if (parentTd === secondCell) {
            const firstCellText = (firstCell.textContent?.trim() || "");
            const isFirstKode = firstCellText &&
              firstCellText.length >= 2 &&
              firstCellText.length <= 30 &&
              !firstCellText.match(/^\d+[\.\)\s]*$/) &&
              !firstCellText.match(/^[A-Ea-e][\.\)\s]*$/) &&
              !firstCellText.match(/^kunci/i) &&
              !firstCellText.match(/^(Nama|Kelas|Mapel|Mata|Guru|Waktu|Hari|Tanggal|Petunjuk)/i) &&
              !firstCellText.match(/^\d+[\.\)]\s+\S/) &&
              !firstCellText.match(/^[A-Ea-e][\.\)]\s+\S/);
            if (isFirstKode) {
              // Only skip if this element is NOT a question/choice/answer key
              // Allow question numbers, choice letters, and answer keys to pass through
              const isQuestionOrChoice = textOnly.match(/^[\(]?(\d+)[\.\s\)]+/) || 
                textOnly.match(/^[A-Ea-e][.\s)]+/) ||
                textOnly.match(/^(kunci|jawaban|answer)/i);
              if (!isQuestionOrChoice) {
                // Skip — groupText was already set from secondCellHtml when literasi kode was detected
                return;
              }
              // If it IS a question/choice, let it fall through to normal processing
            }
          }
        }
      }
    }

    // ─── LITERASI / STIMULUS DETECTION ─────────────────────────────────────
    // Format yang didukung:
    // - "===LITERASI===" atau "---LITERASI---" atau "[LITERASI]" → mulai blok literasi
    // - "===AKHIR LITERASI===" atau "---AKHIR LITERASI---" atau "[/LITERASI]" → akhir blok literasi
    // - "LITERASI 1:", "STIMULUS:", "TEKS BACAAN:", "WACANA:", "BACAAN:" → mulai blok
    // - Blok literasi otomatis berakhir saat soal pertama dimulai (nomor soal)
    // - Setelah soal-soal literasi, bisa ada literasi baru atau soal mandiri

    // Detect explicit end of literasi
    const endLiterasiMatch = textOnly.match(/^(={3,}|—{3,}|-{3,})\s*(AKHIR|END)\s*(LITERASI|STIMULUS|TEKS|WACANA|BACAAN)\s*(={3,}|—{3,}|-{3,})?$/i)
      || textOnly.match(/^\[\/(LITERASI|STIMULUS|TEKS|WACANA|BACAAN)\]$/i);
    if (endLiterasiMatch) {
      // End current literasi group — subsequent questions are standalone
      currentGroupId = undefined;
      currentGroupText = undefined;
      return;
    }

    // Detect start of literasi block
    const literasiStartSeparator = textOnly.match(/^(={3,}|—{3,}|-{3,})\s*(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI)\s*(\d+)?\s*(={3,}|—{3,}|-{3,})?$/i)
      || textOnly.match(/^\[(LITERASI|STIMULUS|TEKS|WACANA|BACAAN)\s*(\d+)?\]$/i);
    const literasiStartKeyword = textOnly.match(/^(LITERASI|STIMULUS|TEKS BACAAN|WACANA|BACAAN|STIMULI|PARAGRAF|CERITA|KUTIPAN|PERHATIKAN TEKS)\s*(\d+)?\s*[:\s\-]+(.*)/i);

    if (literasiStartSeparator || literasiStartKeyword) {
      // Save previous question if any
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) { const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect); if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; } }
        questionCounter++;
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          groupId: currentGroupId,
          groupText: currentGroupText,
          choices: { ...currentChoices },
        });
        currentQuestion = null;
        currentChoices = {};
        currentAnswerKey = "";
      }

      const num = literasiStartSeparator
        ? (literasiStartSeparator[3] || literasiStartSeparator[2] || "")
        : (literasiStartKeyword![2] || "");
      currentGroupId = `GROUP-${num || Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      currentGroupText = literasiStartKeyword ? (literasiStartKeyword[3] || "") : "";
      return;
    }

    // If we're collecting literasi text (no question started yet in this group)
    if (currentGroupId && currentGroupText !== undefined && !currentQuestion) {
      const isQuestionStart = textOnly.match(/^[\(]?(\d+)[\.\s\)]+/);
      if (!isQuestionStart) {
        // Still part of the stimulus text — preserve HTML formatting
        currentGroupText += (currentGroupText ? "<br>" : "") + (line || textOnly);
        return;
      }
    }

    // Check if this paragraph is a numbered sub-statement of the CURRENT question
    // (e.g. "1) ...", "2) ...", "(1) ...", "[1] ...", Roman numerals "I. ...")
    // When a question has started, has no choices yet, and hasn't ended with an answer key,
    // these statements belong to the question body, NOT a new question!
    const isSubStatement = Boolean(
      currentQuestion &&
      currentQuestion.text &&
      Object.keys(currentChoices).length === 0 &&
      !currentAnswerKey &&
      (
        // Sub-statement with parenthesis: "1) ...", "(1) ...", "[1] ..."
        textOnly.match(/^[\(]?\d{1,3}\)\s*.*$/) ||
        textOnly.match(/^\(\d{1,3}\)\s*.*$/) ||
        textOnly.match(/^\[\d{1,3}\]\s*.*$/) ||
        // Roman numerals "I. ...", "II) ..."
        textOnly.match(/^[\(]?[IVXLCDM]{1,6}[\.\)\s]+\S/i) ||
        // Lowercase letter sub-points "a) ...", "b) ..." before choices start
        textOnly.match(/^[a-z]\)\s*.*$/) ||
        // Sub-statement numbered "1. ..." when current question already has text (cannot be question 1 starting twice)
        textOnly.match(/^1[\.\)]\s+\S/) ||
        // Following numbered statements in a sequence (2., 3., etc.) if already inside a sub-statement list
        (inSubStatementList && textOnly.match(/^\d{1,3}[\.\)]\s*.*$/)) ||
        // Prompt ended with colon ":" followed by numbered item
        (currentQuestion.text.trim().replace(/<[^>]*>/g, '').trim().endsWith(":") && textOnly.match(/^[\(]?\d{1,3}[\.\)]\s*.*$/))
      )
    );

    if (isSubStatement && currentQuestion) {
      inSubStatementList = true;
      const htmlContent = (line && line !== textOnly) ? line : textOnly;
      const pStyle = p.tagName === 'P' && p.getAttribute('style') ? ` style="${p.getAttribute('style')}"` : '';
      if (pStyle) {
        currentQuestion.text += `<p${pStyle}>${htmlContent}</p>`;
      } else {
        currentQuestion.text += "<br>" + htmlContent;
      }
      if (firstImage && !currentQuestion.imageUrl) currentQuestion.imageUrl = firstImage;
      else if (firstImage) currentQuestion.text += `<br><img src="${firstImage}" />`;
      return;
    }

    // Not a sub-statement: reset the sub-statement list sequence flag
    inSubStatementList = false;

    // A. Detect Question Start
    const questionMatch = textOnly.match(/^[\(]?(\d+)[\.\s\)]+(.*)/);
    const isJustNumber = textOnly.match(/^[\(]?(\d+)[\.\s\)]?$/);

    if ((questionMatch || isJustNumber) && !pendingLetter) {
      // Save previous question
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) { const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect); if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; } }
        questionCounter++;
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          groupId: currentGroupId,
          groupText: currentGroupText,
          choices: { ...currentChoices },
        });
      }

      // If no literasi kode was set before this question, it's standalone
      if (!literasiSetForCurrentBlock) {
        currentGroupId = undefined;
        currentGroupText = undefined;
      }
      // Reset flag for next question block
      literasiSetForCurrentBlock = false;

      // Ambil isi soal dari HTML (bukan teks polos) agar format
      // bold/italic/underline pada baris pertama soal ikut terbawa.
      let text = questionMatch ? questionMatch[2] : "";
      if (questionMatch) {
        // Panjang penanda nomor = seluruh kecocokan dikurangi isi soal
        // (match[0] mencakup keduanya).
        const markerLength = questionMatch[0].length - questionMatch[2].length;
        const htmlText = stripLeadingCharsFromHtml(p, markerLength);
        if (htmlText.replace(/<[^>]*>/g, "").trim()) text = htmlText;
      }
      currentQuestion = { text, imageUrl: firstImage || undefined };
      currentChoices = {};
      currentAnswerKey = "";
      inSubStatementList = false;
      pendingNumber = questionMatch ? null : (isJustNumber![1]);
      pendingLetter = null;
      return;
    }

    // B. Detect Choice
    const choiceMatch = textOnly.match(/^([A-Ea-e])[.\s)]+(.*)/);
    const isJustLetter = textOnly.match(/^([A-Ea-e])$/);

    if (choiceMatch || isJustLetter) {
      inSubStatementList = false;
      if (currentQuestion) {
        const letter = choiceMatch ? choiceMatch[1].toLowerCase() : isJustLetter![1].toLowerCase();
        // Ambil isi pilihan dari HTML agar format bold/italic/underline
        // di dalam pilihan ikut terbawa (dulu selalu teks polos).
        let text = choiceMatch ? choiceMatch[2].trim() : "";
        if (choiceMatch) {
          const markerLength = choiceMatch[0].length - choiceMatch[2].length;
          const htmlText = stripLeadingCharsFromHtml(p, markerLength);
          if (htmlText.replace(/<[^>]*>/g, "").trim()) text = htmlText;
        }

        // Store choice — don't mark correct yet, wait for explicit "Kunci Jawaban" line
        // Only use inline markers as fallback if no explicit key is found later
        const isMarkedCorrect = hasCorrectMarker(p, line);
        // Bila pilihan ini ditandai guru sebagai kunci lewat bold/underline
        // menyeluruh, lepas format penandanya agar tidak bocor ke siswa.
        if (isMarkedCorrect) text = unwrapMarkerFormatting(text);
        
        currentChoices[letter] = { 
          text, 
          imageUrl: firstImage || undefined,
          isCorrect: false // default false, will be set by "Kunci Jawaban" or post-process
        };
        
        // Track inline marker as potential answer (used only as fallback)
        if (isMarkedCorrect && !currentAnswerKey) currentAnswerKey = letter;
        
        pendingLetter = choiceMatch ? null : letter;
        pendingNumber = null;
        return;
      }
    }

    // C. Detect Answer Key ("Kunci: A") — this is the PRIMARY answer detection
    // Must be at the START of the text (or after separator) to avoid matching "terkunci" etc.
    const answerMatch = textOnly.match(/^(?:Kunci|Answer|Kunci Jawaban|Jawaban)\s*[:\.\s]+([A-Ea-e])\s*$/i)
      || textOnly.match(/^(?:Kunci|Answer|Kunci Jawaban|Jawaban)\s*[:\.\s]+([A-Ea-e])\b/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[1].toLowerCase();
      // Immediately mark the correct choice
      Object.keys(currentChoices).forEach(k => { currentChoices[k].isCorrect = false; });
      if (currentChoices[currentAnswerKey]) {
        currentChoices[currentAnswerKey].isCorrect = true;
      }
      return;
    }

    // D. Image-only paragraph
    if (isImageOnly) {
      if (currentQuestion) {
        if (pendingLetter && currentChoices[pendingLetter]) {
          if (!currentChoices[pendingLetter].imageUrl) {
            currentChoices[pendingLetter].imageUrl = firstImage;
          }
          pendingLetter = null;
        } else if (!currentQuestion.text && !currentQuestion.imageUrl) {
          // Only set as cover if question text hasn't started yet
          currentQuestion.imageUrl = firstImage;
        } else {
          // Embed image in question text (it's part of the question content)
          currentQuestion.text += `<br><img src="${firstImage}" />`;
        }
      }
      return;
    }

    // E. Fragment Handling
    if (currentQuestion) {
      if (pendingNumber && !currentQuestion.text) {
        currentQuestion.text = (line && line !== textOnly) ? line : textOnly;
        if (firstImage && !currentQuestion.imageUrl) currentQuestion.imageUrl = firstImage;
        pendingNumber = null;
      } else if (pendingLetter) {
        const pendingChoice = currentChoices[pendingLetter];
        if (pendingChoice) {
          pendingChoice.text = (line && line !== textOnly) ? line : textOnly;
          if (firstImage && !pendingChoice.imageUrl) {
            pendingChoice.imageUrl = firstImage;
          }
        }
        pendingLetter = null;
      } else {
        // Continuation for question text (before choices start)
        if (textOnly || firstImage) {
          if (!currentChoices["a"] && !currentAnswerKey) {
            // Preserve HTML formatting with proper paragraph separation
            // Use innerHTML (line) which contains formatting like bold, italic, styles
            const htmlContent = (line && line !== textOnly) ? line : textOnly;
            // If the source element is a <p> with style, preserve it as-is
            const pStyle = p.tagName === 'P' && p.getAttribute('style') ? ` style="${p.getAttribute('style')}"` : '';
            if (pStyle) {
              currentQuestion.text += `<p${pStyle}>${htmlContent}</p>`;
            } else {
              currentQuestion.text += "<br>" + htmlContent;
            }
            if (firstImage && !currentQuestion.imageUrl) currentQuestion.imageUrl = firstImage;
            else if (firstImage) currentQuestion.text += `<br><img src="${firstImage}" />`;
          }
        }
      }
    } else if (currentGroupText !== undefined) {
      currentGroupText += " " + ((line && line !== textOnly) ? line : textOnly);
    }
  });

  // Push last question
  const lastQ = currentQuestion as Partial<ParsedQuestion> | null;
  if (lastQ && lastQ.text) {
    if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) { const alreadyHasCorrect = Object.values(currentChoices).some(c => c.isCorrect); if (!alreadyHasCorrect) { currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true; } }
    questionCounter++;
    questions.push({
      text: lastQ.text,
      imageUrl: lastQ.imageUrl,
      groupId: currentGroupId,
      groupText: currentGroupText,
      choices: { ...currentChoices },
    });
  }

  // ─── POST-PROCESS: Apply trailing answer keys ──────────────────────────
  if (trailingAnswerKeys.size > 0) {
    questions.forEach((q, index) => {
      const questionNum = index + 1;
      const key = trailingAnswerKeys.get(questionNum);
      if (key && q.choices[key]) {
        // Only apply if no answer was already detected inline
        const hasInlineAnswer = Object.values(q.choices).some(c => c.isCorrect);
        if (!hasInlineAnswer) {
          Object.keys(q.choices).forEach(k => { q.choices[k].isCorrect = false; });
          q.choices[key].isCorrect = true;
        }
      }
    });
  }

  // ─── POST-PROCESS: Detect essay questions ──────────────────────────────
  // Questions without choices (no A-E options) are essay/isian singkat
  questions.forEach(q => {
    if (!q.type) {
      const hasChoices = Object.keys(q.choices).length > 0;
      if (!hasChoices) {
        // Short questions (< 50 chars) without sub-points are "isian_singkat"
        // Longer questions or those with bullet points are "uraian"
        const isShort = q.text.replace(/<[^>]*>/g, '').length < 80 && !q.text.includes('<li') && !q.text.includes('•');
        q.type = isShort ? "isian_singkat" : "uraian";
      } else {
        q.type = "pilihan_ganda";
      }
    }
  });

  // If includeEssay is false, filter out essay questions
  const finalQuestions = includeEssay ? questions : questions.filter(q => q.type === "pilihan_ganda");

  // Clean up: trim whitespace from question text
  finalQuestions.forEach(q => {
    q.text = (q.text || "").trim();
    if (q.groupText) q.groupText = q.groupText.trim();
  });

  return finalQuestions;
};
