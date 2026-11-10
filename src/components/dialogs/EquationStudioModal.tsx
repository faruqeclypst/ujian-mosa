import React, { useState, useRef, useEffect, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem";
import { Dialog, DialogContent } from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import {
  Function,
  Sigma,
  Pi,
  Atom,
  Sparkles,
  Trash2,
  Copy,
  Check,
  X,
  Plus,
  Pencil,
} from "../../lib/icons/phosphor-bridge";

export interface EquationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string, isBlock: boolean) => void;
  initialLatex?: string;
}

interface SymbolItem {
  label: string;
  latex: string;
  desc?: string;
  preview?: string;
}

interface CategoryGroup {
  id: string;
  name: string;
  icon: any;
  symbols: SymbolItem[];
}

export interface MathSlot {
  id: number;
  value: string;
  start: number;
  end: number;
}

/**
 * Sisipkan kelas slot interaktif pada angka & variabel LaTeX
 * Contoh: \frac{a}{b} -> \frac{\htmlClass{math-slot slot-0}{a}}{\htmlClass{math-slot slot-1}{b}}
 */
export function annotateLatexForInteractivePreview(latex: string): {
  annotatedLatex: string;
  slots: MathSlot[];
} {
  let result = "";
  let i = 0;
  let slotId = 0;
  const slots: MathSlot[] = [];

  while (i < latex.length) {
    // Lewati perintah LaTeX (diawali dengan backslash)
    if (latex[i] === "\\") {
      let cmd = "\\";
      i++;
      while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
        cmd += latex[i];
        i++;
      }
      result += cmd;

      // Jika perintah \begin atau \end, salin nama environment {...} apa adanya tanpa tokenizing
      if (cmd === "\\begin" || cmd === "\\end") {
        while (i < latex.length && latex[i] === " ") {
          result += " ";
          i++;
        }
        if (i < latex.length && latex[i] === "{") {
          while (i < latex.length && latex[i] !== "}") {
            result += latex[i];
            i++;
          }
          if (i < latex.length && latex[i] === "}") {
            result += "}";
            i++;
          }
        }
      }

      // Jika \ce{...} (rumus kimia mhchem), lewati isinya agar tidak merusak sintaks parser kimia
      if (cmd === "\\ce") {
        while (i < latex.length && latex[i] === " ") {
          result += " ";
          i++;
        }
        if (i < latex.length && latex[i] === "{") {
          let depth = 1;
          result += "{";
          i++;
          while (i < latex.length && depth > 0) {
            if (latex[i] === "{") depth++;
            else if (latex[i] === "}") depth--;
            result += latex[i];
            i++;
          }
        }
      }
      continue;
    }

    // Angka desimal atau integer
    if (/[0-9]/.test(latex[i])) {
      const start = i;
      while (i < latex.length && /[0-9.]/.test(latex[i])) {
        i++;
      }
      const val = latex.substring(start, i);
      const currentId = slotId++;
      slots.push({ id: currentId, value: val, start, end: i });

      const prevNonSpace = result.trimEnd().slice(-1);
      const isSubSup = prevNonSpace === "^" || prevNonSpace === "_";
      const tag = `{\\htmlClass{math-slot slot-${currentId}}{${val}}}`;
      result += isSubSup ? tag : `\\htmlClass{math-slot slot-${currentId}}{${val}}`;
      continue;
    }

    // Huruf atau variabel tunggal
    if (/[a-zA-Z]/.test(latex[i])) {
      const start = i;
      const val = latex[i];
      i++;
      const currentId = slotId++;
      slots.push({ id: currentId, value: val, start, end: i });

      const prevNonSpace = result.trimEnd().slice(-1);
      const isSubSup = prevNonSpace === "^" || prevNonSpace === "_";
      const tag = `{\\htmlClass{math-slot slot-${currentId}}{${val}}}`;
      result += isSubSup ? tag : `\\htmlClass{math-slot slot-${currentId}}{${val}}`;
      continue;
    }

    result += latex[i];
    i++;
  }

  return { annotatedLatex: result, slots };
}

const EQUATION_CATEGORIES: CategoryGroup[] = [
  {
    id: "algebra",
    name: "Aljabar & Pecahan",
    icon: Function,
    symbols: [
      { label: "Pecahan", latex: "\\frac{a}{b}", desc: "Pecahan biasa", preview: "\\frac{a}{b}" },
      { label: "Pangkat", latex: "x^{2}", desc: "Eksponen / Pangkat", preview: "x^2" },
      { label: "Indeks", latex: "x_{1}", desc: "Subskrip / Indeks", preview: "x_1" },
      { label: "Akar Kuadrat", latex: "\\sqrt{x}", desc: "Akar kuadrat", preview: "\\sqrt{x}" },
      { label: "Akar Pangkat n", latex: "\\sqrt[n]{x}", desc: "Akar ke-n", preview: "\\sqrt[n]{x}" },
      { label: "Nilai Mutlak", latex: "|x|", desc: "Nilai mutlak", preview: "|x|" },
      { label: "Kurung ( )", latex: "\\left( x \\right)", desc: "Kurung buka-tutup proporsional", preview: "(x)" },
      { label: "Kurung [ ]", latex: "\\left[ x \\right]", desc: "Kurung siku", preview: "[x]" },
      { label: "Kurung { }", latex: "\\left\\{ x \\right\\}", desc: "Kurung kurawal", preview: "\\{x\\}" },
      { label: "Rumus ABC", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", desc: "Persamaan kuadrat", preview: "x=\\frac{-b\\pm\\sqrt{D}}{2a}" },
      { label: "Sistem Persamaan", latex: "\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}", desc: "SPLDV / SPLTV", preview: "\\begin{cases} x+y \\\\ x-y \\end{cases}" },
    ],
  },
  {
    id: "operators",
    name: "Operator & Relasi",
    icon: Plus,
    symbols: [
      { label: "Kali (×)", latex: "\\times", preview: "\\times" },
      { label: "Bagi (÷)", latex: "\\div", preview: "\\div" },
      { label: "Plus-Minus (±)", latex: "\\pm", preview: "\\pm" },
      { label: "Minus-Plus (∓)", latex: "\\mp", preview: "\\mp" },
      { label: "Titik Kali (·)", latex: "\\cdot", preview: "\\cdot" },
      { label: "Kurang Sama (≤)", latex: "\\le", preview: "\\le" },
      { label: "Lebih Sama (≥)", latex: "\\ge", preview: "\\ge" },
      { label: "Tidak Sama (≠)", latex: "\\neq", preview: "\\neq" },
      { label: "Kira-kira (≈)", latex: "\\approx", preview: "\\approx" },
      { label: "Ekuivalen (≡)", latex: "\\equiv", preview: "\\equiv" },
      { label: "Tak Hingga (∞)", latex: "\\infty", preview: "\\infty" },
      { label: "Derajat (°)", latex: "^{\\circ}", preview: "30^\\circ" },
      { label: "Sebanding (∝)", latex: "\\propto", preview: "\\propto" },
      { label: "Elemen (∈)", latex: "\\in", preview: "\\in" },
      { label: "Bukan Elemen (∉)", latex: "\\notin", preview: "\\notin" },
      { label: "Irisan (∩)", latex: "\\cap", preview: "A \\cap B" },
      { label: "Gabungan (∪)", latex: "\\cup", preview: "A \\cup B" },
    ],
  },
  {
    id: "trig",
    name: "Trigonometri & Sudut",
    icon: Pi,
    symbols: [
      { label: "sin", latex: "\\sin \\theta", preview: "\\sin\\theta" },
      { label: "cos", latex: "\\cos \\theta", preview: "\\cos\\theta" },
      { label: "tan", latex: "\\tan \\theta", preview: "\\tan\\theta" },
      { label: "cot", latex: "\\cot \\theta", preview: "\\cot\\theta" },
      { label: "sec", latex: "\\sec \\theta", preview: "\\sec\\theta" },
      { label: "csc", latex: "\\csc \\theta", preview: "\\csc\\theta" },
      { label: "arcsin", latex: "\\arcsin(x)", preview: "\\arcsin x" },
      { label: "arccos", latex: "\\arccos(x)", preview: "\\arccos x" },
      { label: "arctan", latex: "\\arctan(x)", preview: "\\arctan x" },
      { label: "Sudut (∠)", latex: "\\angle ABC", preview: "\\angle ABC" },
      { label: "Segitiga (△)", latex: "\\triangle ABC", preview: "\\triangle ABC" },
      { label: "Sejajar (∥)", latex: "\\parallel", preview: "AB \\parallel CD" },
      { label: "Tegak Lurus (⊥)", latex: "\\perp", preview: "AB \\perp CD" },
    ],
  },
  {
    id: "calculus",
    name: "Kalkulus & Matriks",
    icon: Sigma,
    symbols: [
      { label: "Integral Tentu", latex: "\\int_{a}^{b} f(x) \\, dx", preview: "\\int_a^b f(x)dx" },
      { label: "Integral Tak Tentu", latex: "\\int f(x) \\, dx", preview: "\\int f(x)dx" },
      { label: "Sigma (Jumlah)", latex: "\\sum_{i=1}^{n} x_i", preview: "\\sum_{i=1}^n x_i" },
      { label: "Produk (Perkalian)", latex: "\\prod_{i=1}^{n} x_i", preview: "\\prod_{i=1}^n x_i" },
      { label: "Limit", latex: "\\lim_{x \\to 0} f(x)", preview: "\\lim_{x\\to 0} f(x)" },
      { label: "Turunan dy/dx", latex: "\\frac{dy}{dx}", preview: "\\frac{dy}{dx}" },
      { label: "Turunan Parsial", latex: "\\frac{\\partial f}{\\partial x}", preview: "\\frac{\\partial f}{\\partial x}" },
      { label: "Matriks 2x2", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", preview: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { label: "Matriks 3x3", latex: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}", preview: "\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}" },
      { label: "Determinan", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", preview: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
      { label: "Vektor", latex: "\\vec{v} = \\begin{pmatrix} x \\\\ y \\end{pmatrix}", preview: "\\vec{v}" },
    ],
  },
  {
    id: "greek",
    name: "Huruf Yunani",
    icon: Pi,
    symbols: [
      { label: "α (alpha)", latex: "\\alpha", preview: "\\alpha" },
      { label: "β (beta)", latex: "\\beta", preview: "\\beta" },
      { label: "γ (gamma)", latex: "\\gamma", preview: "\\gamma" },
      { label: "θ (theta)", latex: "\\theta", preview: "\\theta" },
      { label: "λ (lambda)", latex: "\\lambda", preview: "\\lambda" },
      { label: "μ (mu)", latex: "\\mu", preview: "\\mu" },
      { label: "π (pi)", latex: "\\pi", preview: "\\pi" },
      { label: "σ (sigma)", latex: "\\sigma", preview: "\\sigma" },
      { label: "ω (omega)", latex: "\\omega", preview: "\\omega" },
      { label: "Δ (Delta)", latex: "\\Delta", preview: "\\Delta" },
      { label: "Σ (Sigma)", latex: "\\Sigma", preview: "\\Sigma" },
      { label: "Ω (Omega)", latex: "\\Omega", preview: "\\Omega" },
      { label: "φ (phi)", latex: "\\phi", preview: "\\phi" },
      { label: "ρ (rho)", latex: "\\rho", preview: "\\rho" },
    ],
  },
  {
    id: "chemistry",
    name: "Reaksi Kimia & Panah",
    icon: Atom,
    symbols: [
      { label: "Air (H₂O)", latex: "\\ce{H2O}", preview: "\\ce{H2O}" },
      { label: "CO₂", latex: "\\ce{CO2}", preview: "\\ce{CO2}" },
      { label: "Glukosa", latex: "\\ce{C6H12O6}", preview: "\\ce{C6H12O6}" },
      { label: "Reaksi Asam Basa", latex: "\\ce{HCl + NaOH -> NaCl + H2O}", preview: "\\ce{HCl + NaOH -> NaCl + H2O}" },
      { label: "Kesetimbangan (⇌)", latex: "\\ce{N2 + 3H2 <=> 2NH3}", preview: "\\ce{A <=> B}" },
      { label: "Panah Reaksi (→)", latex: "\\rightarrow", preview: "\\rightarrow" },
      { label: "Panah Bolak-balik (⇌)", latex: "\\rightleftharpoons", preview: "\\rightleftharpoons" },
      { label: "Gas (↑)", latex: "\\uparrow", preview: "\\uparrow" },
      { label: "Endapan (↓)", latex: "\\downarrow", preview: "\\downarrow" },
    ],
  },
];

export const EquationStudioModal: React.FC<EquationStudioModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  initialLatex = "",
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [isBlock, setIsBlock] = useState(false);
  const [activeCategory, setActiveCategory] = useState("algebra");
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // State untuk editing in-place langsung di atas slot angka/variabel
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [inputPos, setInputPos] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Sync saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || "");
      setActiveSlotId(null);
      setInputPos(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialLatex]);

  const currentCategory = useMemo(() => {
    return EQUATION_CATEGORIES.find((c) => c.id === activeCategory) || EQUATION_CATEGORIES[0];
  }, [activeCategory]);

  // Render HTML KaTeX teranotasi dengan slot interaktif
  const { renderedHtml, slots } = useMemo(() => {
    const clean = latex.trim();
    if (!clean) return { renderedHtml: "", slots: [] as MathSlot[] };

    try {
      const { annotatedLatex, slots } = annotateLatexForInteractivePreview(clean);
      const html = katex.renderToString(annotatedLatex, {
        displayMode: isBlock,
        trust: true,
        strict: false,
      });
      return { renderedHtml: html, slots };
    } catch {
      try {
        const html = katex.renderToString(clean, {
          displayMode: isBlock,
          trust: false,
          strict: false,
          throwOnError: false,
        });
        return { renderedHtml: html, slots: [] as MathSlot[] };
      } catch {
        return { renderedHtml: "", slots: [] as MathSlot[] };
      }
    }
  }, [latex, isBlock]);

  // Aktifkan slot untuk diedit langsung
  const activateSlot = (slotId: number, targetEl?: HTMLElement, retries = 4) => {
    let el = targetEl;
    if (!el && previewBoxRef.current) {
      el = previewBoxRef.current.querySelector(`.slot-${slotId}`) as HTMLElement;
    }

    if (!el && retries > 0) {
      setTimeout(() => activateSlot(slotId, undefined, retries - 1), 40);
      return;
    }

    if (el && previewBoxRef.current) {
      const containerRect = previewBoxRef.current.getBoundingClientRect();
      const slotRect = el.getBoundingClientRect();

      const targetWidth = Math.max(38, Math.round(slotRect.width + 16));
      const targetHeight = Math.max(32, Math.round(slotRect.height + 8));
      const slotCenterX = slotRect.left - containerRect.left + slotRect.width / 2;
      const slotCenterY = slotRect.top - containerRect.top + slotRect.height / 2;

      setInputPos({
        top: Math.round(slotCenterY - targetHeight / 2),
        left: Math.round(slotCenterX - targetWidth / 2),
        width: targetWidth,
        height: targetHeight,
      });

      setActiveSlotId(slotId);
      const textVal = el.textContent?.trim() || "";
      setEditValue(textVal);

      setTimeout(() => {
        inlineInputRef.current?.focus();
        inlineInputRef.current?.select();
      }, 30);
    }
  };

  // Terapkan perubahan nilai slot
  const handleCommitEdit = (nextSlotOffset = 0) => {
    if (activeSlotId === null) return;
    const currentSlot = slots.find((s) => s.id === activeSlotId);
    if (!currentSlot) {
      setActiveSlotId(null);
      setInputPos(null);
      return;
    }

    const valToSet = editValue.trim() !== "" ? editValue.trim() : currentSlot.value;

    if (valToSet !== currentSlot.value) {
      const newLatex =
        latex.substring(0, currentSlot.start) +
        valToSet +
        latex.substring(currentSlot.end);
      setLatex(newLatex);
    }

    if (nextSlotOffset !== 0) {
      const currentIndex = slots.findIndex((s) => s.id === activeSlotId);
      const targetIndex = currentIndex + nextSlotOffset;
      if (targetIndex >= 0 && targetIndex < slots.length) {
        setTimeout(() => {
          activateSlot(targetIndex);
        }, 50);
        return;
      }
    }

    setActiveSlotId(null);
    setInputPos(null);
  };

  // Keyboard handler pada inline input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitEdit(0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleCommitEdit(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveSlotId(null);
      setInputPos(null);
    }
  };

  // Klik langsung pada elemen angka/variabel di pratinjau rumus
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const slotEl = target.closest(".math-slot") as HTMLElement;
    if (!slotEl) {
      if (activeSlotId !== null) {
        handleCommitEdit(0);
      }
      return;
    }

    const match = slotEl.className.match(/\bslot-(\d+)\b/);
    if (!match) return;

    const slotId = parseInt(match[1], 10);
    if (activeSlotId !== null && activeSlotId !== slotId) {
      handleCommitEdit(0);
    }
    activateSlot(slotId, slotEl);
  };

  // Klik template pada palet simbol
  const insertSnippet = (snippet: string) => {
    let nextLatex = snippet;
    let targetSlotIndex = 0;

    const textarea = textareaRef.current;
    if (!latex.trim()) {
      nextLatex = snippet;
      targetSlotIndex = 0;
    } else if (textarea && textarea.selectionStart !== undefined && textarea.selectionEnd !== undefined) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = latex.substring(0, start);
      const after = latex.substring(end);
      const sep = before.endsWith(" ") || snippet.startsWith(" ") ? "" : " ";
      nextLatex = `${before}${sep}${snippet}${after}`;
      const { slots: beforeSlots } = annotateLatexForInteractivePreview(before);
      targetSlotIndex = beforeSlots.length;
    } else {
      nextLatex = `${latex} ${snippet}`;
      const { slots: currentSlots } = annotateLatexForInteractivePreview(latex);
      targetSlotIndex = currentSlots.length;
    }

    setLatex(nextLatex);
    setActiveSlotId(null);
    setInputPos(null);

    // Otomatis aktifkan slot pertama dari template yang baru disisipkan
    const tryFocusInserted = (retries = 5) => {
      setTimeout(() => {
        const { slots: newSlots } = annotateLatexForInteractivePreview(nextLatex);
        const slotToActivate = newSlots[targetSlotIndex] || newSlots[0];
        if (slotToActivate && previewBoxRef.current) {
          const el = previewBoxRef.current.querySelector(`.slot-${slotToActivate.id}`) as HTMLElement;
          if (el) {
            activateSlot(slotToActivate.id, el);
            return;
          }
        }
        if (retries > 0) {
          tryFocusInserted(retries - 1);
        }
      }, 50);
    };

    tryFocusInserted();
  };

  const handleCopy = () => {
    if (!latex) return;
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!latex.trim()) return;
    onInsert(latex.trim(), isBlock);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-white dark:bg-[#0e0f11] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Function className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>Visual Equation Studio</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  KaTeX &amp; Visual WYSIWYG
                </span>
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Pilih template rumus di bawah. Anda dapat langsung mengklik angka atau variabel pada rumus untuk mengubah nilainya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 pt-2 bg-neutral-50/30 dark:bg-neutral-900/20 overflow-x-auto no-scrollbar gap-1">
          {EQUATION_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Body Container */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Symbol Palette Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Template Rumus &amp; Simbol Siap Pakai
              </span>
              <span className="text-[10px] text-neutral-400">Klik template untuk mengisi angka</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {currentCategory.symbols.map((item, idx) => {
                let previewHtml = "";
                try {
                  previewHtml = katex.renderToString(item.preview || item.latex, {
                    throwOnError: false,
                  });
                } catch {}

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => insertSnippet(item.latex)}
                    title={item.desc || item.latex}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-500/70 dark:hover:border-emerald-500/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all flex flex-col items-center justify-center text-center gap-1.5 group shadow-2xs cursor-pointer min-h-[60px]"
                  >
                    <div
                      className="text-xs text-neutral-800 dark:text-neutral-200 pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                    <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate max-w-full">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Live Formula Preview Canvas */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span>Pratinjau Rumus (Klik Angka/Huruf untuk Mengubah)</span>
              </span>

              {/* Mode Toggle: Inline vs Display */}
              <div className="flex items-center rounded-lg p-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsBlock(false)}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    !isBlock
                      ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                  }`}
                >
                  Sebaris (Inline)
                </button>
                <button
                  type="button"
                  onClick={() => setIsBlock(true)}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    isBlock
                      ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                  }`}
                >
                  Blok Tengah (Display)
                </button>
              </div>
            </div>

            {/* Canvas Box dengan In-Place Editor */}
            <div
              ref={previewBoxRef}
              className="relative p-6 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 min-h-[100px] flex items-center justify-center text-center overflow-visible select-none math-interactive-preview"
            >
              {renderedHtml ? (
                <>
                  <div
                    onClick={handlePreviewClick}
                    className="text-lg sm:text-2xl text-neutral-900 dark:text-neutral-100 font-serif leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />

                  {/* Input In-Place Tepat di Atas Elemen yang Sedang Diedit */}
                  {activeSlotId !== null && inputPos && (
                    <input
                      ref={inlineInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={() => handleCommitEdit(0)}
                      style={{
                        position: "absolute",
                        top: Math.max(4, inputPos.top),
                        left: Math.max(4, inputPos.left),
                        width: inputPos.width,
                        height: inputPos.height,
                      }}
                      className="z-30 text-center font-serif text-emerald-950 dark:text-emerald-100 bg-white dark:bg-neutral-900 border-2 border-emerald-500 rounded-lg shadow-xl text-base sm:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      title="Ketik nilai baru, tekan Enter untuk selesai atau Tab untuk ke nilai berikutnya"
                    />
                  )}
                </>
              ) : (
                <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                  Pilih salah satu template di atas untuk mulai membuat rumus...
                </span>
              )}
            </div>

            {/* Petunjuk Guru */}
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1 pt-0.5">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <Pencil className="h-3 w-3" />
                <span>
                  <strong>Tips:</strong> Klik angka/variabel bergaris bawah putus-putus untuk mengubah. Tekan <strong>Tab</strong> untuk pindah ke slot berikutnya.
                </span>
              </span>
              {slots.length > 0 && (
                <span className="text-[10px] text-neutral-400">
                  {slots.length} nilai terdeteksi
                </span>
              )}
            </div>
          </div>

          {/* LaTeX Sintaks Box (Accordion / Advanced View) */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Kode Sintaks LaTeX (Otomatis Tersinkron)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!latex}
                  className="text-[11px] font-medium text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Tersalin" : "Salin Kode"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLatex("");
                    setActiveSlotId(null);
                    setInputPos(null);
                  }}
                  disabled={!latex}
                  className="text-[11px] font-medium text-neutral-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={2}
              value={latex}
              onChange={(e) => {
                setLatex(e.target.value);
                setActiveSlotId(null);
                setInputPos(null);
              }}
              placeholder="Kode LaTeX ter-update otomatis saat Anda mengubah nilai di atas..."
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/40">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Format yang disisipkan:{" "}
            <code className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200 font-bold">
              {isBlock ? "$$ ... $$" : "$ ... $"}
            </code>
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <NeonButton variant="secondary" size="xs" onClick={onClose}>
              Batal
            </NeonButton>
            <NeonButton
              variant="primary"
              color="brand"
              size="xs"
              onClick={handleSubmit}
              disabled={!latex.trim()}
            >
              <Function className="h-3.5 w-3.5" />
              <span>Sisipkan Rumus ke Soal</span>
            </NeonButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EquationStudioModal;
