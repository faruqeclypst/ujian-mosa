/**
 * OMML (Office Math Markup Language) to LaTeX converter
 * Converts Word equation XML to LaTeX string for KaTeX rendering
 */

const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

// Get text content of first matching child element
const getChildText = (el: Element, localName: string): string => {
  const child = Array.from(el.children).find(c => c.localName === localName);
  return child?.textContent?.trim() || "";
};

// Get child element by local name
const getChild = (el: Element, localName: string): Element | null => {
  return Array.from(el.children).find(c => c.localName === localName) || null;
};

// Get all children by local name
const getChildren = (el: Element, localName: string): Element[] => {
  return Array.from(el.children).filter(c => c.localName === localName);
};

// Convert a single OMML element to LaTeX
const convertElement = (el: Element): string => {
  const tag = el.localName;

  switch (tag) {
    case "r": return convertRun(el);
    case "f": case "frac": return convertFraction(el);
    case "rad": return convertRadical(el);
    case "sSup": return convertSuperscript(el);
    case "sSub": return convertSubscript(el);
    case "sSubSup": return convertSubSup(el);
    case "nary": return convertNary(el);
    case "d": return convertDelimiter(el);
    case "func": return convertFunction(el);
    case "eqArr": return convertEqArray(el);
    case "m": return convertMatrix(el);
    case "acc": return convertAccent(el);
    case "bar": return convertBar(el);
    case "limLow": return convertLimLow(el);
    case "limUpp": return convertLimUpp(el);
    case "groupChr": return convertGroupChar(el);
    case "box": case "borderBox": return convertBox(el);
    default: return convertChildren(el);
  }
};

// Convert all children of an element
const convertChildren = (el: Element): string => {
  return Array.from(el.children).map(convertElement).join("");
};

// Run element (text content)
const convertRun = (el: Element): string => {
  const texts = getChildren(el, "t");
  let result = texts.map(t => t.textContent || "").join("");
  
  // Handle special characters
  result = result
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/±/g, "\\pm ")
    .replace(/∓/g, "\\mp ")
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ")
    .replace(/≈/g, "\\approx ")
    .replace(/∞/g, "\\infty ")
    .replace(/π/g, "\\pi ")
    .replace(/α/g, "\\alpha ")
    .replace(/β/g, "\\beta ")
    .replace(/γ/g, "\\gamma ")
    .replace(/δ/g, "\\delta ")
    .replace(/θ/g, "\\theta ")
    .replace(/λ/g, "\\lambda ")
    .replace(/μ/g, "\\mu ")
    .replace(/σ/g, "\\sigma ")
    .replace(/ω/g, "\\omega ")
    .replace(/Δ/g, "\\Delta ")
    .replace(/Σ/g, "\\Sigma ")
    .replace(/Ω/g, "\\Omega ")
    .replace(/√/g, "\\sqrt ")
    .replace(/∫/g, "\\int ")
    .replace(/∑/g, "\\sum ")
    .replace(/∏/g, "\\prod ")
    .replace(/→/g, "\\rightarrow ")
    .replace(/←/g, "\\leftarrow ")
    .replace(/↔/g, "\\leftrightarrow ")
    .replace(/⇒/g, "\\Rightarrow ")
    .replace(/∈/g, "\\in ")
    .replace(/∉/g, "\\notin ")
    .replace(/⊂/g, "\\subset ")
    .replace(/⊃/g, "\\supset ")
    .replace(/∪/g, "\\cup ")
    .replace(/∩/g, "\\cap ")
    .replace(/∅/g, "\\emptyset ")
    .replace(/∀/g, "\\forall ")
    .replace(/∃/g, "\\exists ")
    .replace(/°/g, "^\\circ ");

  return result;
};

// Fraction: \frac{num}{den}
const convertFraction = (el: Element): string => {
  const num = getChild(el, "num");
  const den = getChild(el, "den");
  const numLatex = num ? convertChildren(num) : "";
  const denLatex = den ? convertChildren(den) : "";
  return `\\frac{${numLatex}}{${denLatex}}`;
};

// Radical: \sqrt{} or \sqrt[n]{}
const convertRadical = (el: Element): string => {
  const deg = getChild(el, "deg");
  const e = getChild(el, "e");
  const eLatex = e ? convertChildren(e) : "";
  const degLatex = deg ? convertChildren(deg).trim() : "";
  if (degLatex && degLatex !== "" && degLatex !== "2") {
    return `\\sqrt[${degLatex}]{${eLatex}}`;
  }
  return `\\sqrt{${eLatex}}`;
};

// Superscript: base^{sup}
const convertSuperscript = (el: Element): string => {
  const e = getChild(el, "e");
  const sup = getChild(el, "sup");
  const eLatex = e ? convertChildren(e) : "";
  const supLatex = sup ? convertChildren(sup) : "";
  return `${eLatex}^{${supLatex}}`;
};

// Subscript: base_{sub}
const convertSubscript = (el: Element): string => {
  const e = getChild(el, "e");
  const sub = getChild(el, "sub");
  const eLatex = e ? convertChildren(e) : "";
  const subLatex = sub ? convertChildren(sub) : "";
  return `${eLatex}_{${subLatex}}`;
};

// SubSup: base_{sub}^{sup}
const convertSubSup = (el: Element): string => {
  const e = getChild(el, "e");
  const sub = getChild(el, "sub");
  const sup = getChild(el, "sup");
  const eLatex = e ? convertChildren(e) : "";
  const subLatex = sub ? convertChildren(sub) : "";
  const supLatex = sup ? convertChildren(sup) : "";
  return `${eLatex}_{${subLatex}}^{${supLatex}}`;
};

// N-ary operator (sum, integral, product)
const convertNary = (el: Element): string => {
  const naryPr = getChild(el, "naryPr");
  const sub = getChild(el, "sub");
  const sup = getChild(el, "sup");
  const e = getChild(el, "e");

  let op = "\\int";
  if (naryPr) {
    const chr = getChild(naryPr, "chr");
    const charVal = chr?.getAttribute("m:val") || chr?.getAttribute("val") || "";
    if (charVal === "∑" || charVal === "Σ") op = "\\sum";
    else if (charVal === "∏" || charVal === "Π") op = "\\prod";
    else if (charVal === "∫") op = "\\int";
    else if (charVal === "∮") op = "\\oint";
  }

  const subLatex = sub ? convertChildren(sub).trim() : "";
  const supLatex = sup ? convertChildren(sup).trim() : "";
  const eLatex = e ? convertChildren(e) : "";

  let result = op;
  if (subLatex) result += `_{${subLatex}}`;
  if (supLatex) result += `^{${supLatex}}`;
  result += ` ${eLatex}`;
  return result;
};

// Delimiter (parentheses, brackets, etc.)
const convertDelimiter = (el: Element): string => {
  const dPr = getChild(el, "dPr");
  let begChar = "(", endChar = ")";
  if (dPr) {
    const beg = getChild(dPr, "begChr");
    const end = getChild(dPr, "endChr");
    begChar = beg?.getAttribute("m:val") || beg?.getAttribute("val") || "(";
    endChar = end?.getAttribute("m:val") || end?.getAttribute("val") || ")";
  }

  const eElements = getChildren(el, "e");
  const content = eElements.map(e => convertChildren(e)).join(", ");

  // Map special delimiters
  const leftMap: Record<string, string> = { "(": "\\left(", "[": "\\left[", "{": "\\left\\{", "|": "\\left|", "‖": "\\left\\|" };
  const rightMap: Record<string, string> = { ")": "\\right)", "]": "\\right]", "}": "\\right\\}", "|": "\\right|", "‖": "\\right\\|" };

  const left = leftMap[begChar] || `\\left${begChar}`;
  const right = rightMap[endChar] || `\\right${endChar}`;

  return `${left}${content}${right}`;
};

// Function (sin, cos, log, etc.)
const convertFunction = (el: Element): string => {
  const fName = getChild(el, "fName");
  const e = getChild(el, "e");
  const nameLatex = fName ? convertChildren(fName).trim() : "";
  const eLatex = e ? convertChildren(e) : "";

  // Common function names - including trigonometry (basic, inverse, hyperbolic)
  const knownFuncs = [
    // Trigonometri dasar
    "sin", "cos", "tan", "cot", "sec", "csc",
    // Trigonometri inverse
    "arcsin", "arccos", "arctan", "arccot", "arcsec", "arccsc",
    // Trigonometri hiperbolik
    "sinh", "cosh", "tanh", "coth", "sech", "csch",
    // Trigonometri hiperbolik inverse
    "arcsinh", "arccosh", "arctanh", "arccoth", "arcsech", "arccsch",
    // Fungsi lainnya
    "log", "ln", "exp", "lim", "max", "min", "det", "gcd", "lcm", "mod",
    "sup", "inf", "dim", "deg"
  ];
  const cleanName = nameLatex.replace(/\\/g, "");
  if (knownFuncs.includes(cleanName.toLowerCase())) {
    return `\\${cleanName.toLowerCase()} ${eLatex}`;
  }
  return `\\mathrm{${nameLatex}}${eLatex}`;
};

// Equation array (aligned equations)
const convertEqArray = (el: Element): string => {
  const eElements = getChildren(el, "e");
  const lines = eElements.map(e => convertChildren(e));
  if (lines.length <= 1) return lines[0] || "";
  return `\\begin{aligned}${lines.join(" \\\\ ")}\\end{aligned}`;
};

// Matrix
const convertMatrix = (el: Element): string => {
  const rows = getChildren(el, "mr");
  const matrixContent = rows.map(row => {
    const cells = getChildren(row, "e");
    return cells.map(c => convertChildren(c)).join(" & ");
  }).join(" \\\\ ");
  return `\\begin{pmatrix}${matrixContent}\\end{pmatrix}`;
};

// Accent (hat, tilde, etc.)
const convertAccent = (el: Element): string => {
  const accPr = getChild(el, "accPr");
  const e = getChild(el, "e");
  const eLatex = e ? convertChildren(e) : "";
  
  let accent = "\\hat";
  if (accPr) {
    const chr = getChild(accPr, "chr");
    const val = chr?.getAttribute("m:val") || chr?.getAttribute("val") || "^";
    if (val === "~" || val === "̃") accent = "\\tilde";
    else if (val === "→" || val === "⃗") accent = "\\vec";
    else if (val === "¯" || val === "̄") accent = "\\bar";
    else if (val === "˙" || val === "̇") accent = "\\dot";
    else if (val === "̈") accent = "\\ddot";
  }
  return `${accent}{${eLatex}}`;
};

// Bar (overline/underline)
const convertBar = (el: Element): string => {
  const e = getChild(el, "e");
  const eLatex = e ? convertChildren(e) : "";
  return `\\overline{${eLatex}}`;
};

// Lower limit
const convertLimLow = (el: Element): string => {
  const e = getChild(el, "e");
  const lim = getChild(el, "lim");
  const eLatex = e ? convertChildren(e) : "";
  const limLatex = lim ? convertChildren(lim) : "";
  return `${eLatex}_{${limLatex}}`;
};

// Upper limit
const convertLimUpp = (el: Element): string => {
  const e = getChild(el, "e");
  const lim = getChild(el, "lim");
  const eLatex = e ? convertChildren(e) : "";
  const limLatex = lim ? convertChildren(lim) : "";
  return `${eLatex}^{${limLatex}}`;
};

// Group character
const convertGroupChar = (el: Element): string => {
  const e = getChild(el, "e");
  return e ? convertChildren(e) : "";
};

// Box / BorderBox
const convertBox = (el: Element): string => {
  const e = getChild(el, "e");
  return e ? convertChildren(e) : "";
};

/**
 * Convert an OMML <m:oMath> or <m:oMathPara> XML element to LaTeX string
 */
export const ommlElementToLatex = (el: Element): string => {
  try {
    const latex = convertChildren(el).trim();
    return latex || "";
  } catch (e) {
    console.warn("OMML to LaTeX conversion error:", e);
    return "";
  }
};

/**
 * Extract all equations from Word document XML and return a map of paragraph index to LaTeX
 * This parses the raw document.xml to find <m:oMath> elements
 */
export const extractEquationsFromDocXml = (xmlString: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  
  // Find all oMath and oMathPara elements
  const equations: string[] = [];
  
  const mathElements = doc.querySelectorAll("oMath, oMathPara");
  mathElements.forEach(el => {
    const latex = ommlElementToLatex(el);
    if (latex) {
      equations.push(latex);
    }
  });

  return equations;
};

/**
 * Given the raw document.xml content, find equations and return them
 * mapped to a placeholder that can be injected into mammoth's HTML output
 */
export const processDocumentXmlForEquations = (xmlString: string): Map<string, string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const equationMap = new Map<string, string>();

  // Walk through all paragraphs and find equations within them
  const paragraphs = doc.querySelectorAll("p");
  let eqIndex = 0;

  paragraphs.forEach(p => {
    const mathElements = p.querySelectorAll("oMath");
    mathElements.forEach(math => {
      const latex = ommlElementToLatex(math);
      if (latex) {
        const placeholder = `__EQUATION_${eqIndex}__`;
        equationMap.set(placeholder, latex);
        // Replace the math element with a text node containing the placeholder
        const textNode = doc.createTextNode(placeholder);
        math.parentNode?.replaceChild(textNode, math);
        eqIndex++;
      }
    });
  });

  return equationMap;
};
