import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import { MathText } from "../ui/MathText";
import {
  Function,
  Sigma,
  Pi,
  Atom,
  Sparkles,
  RotateCcw,
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
  label: string; // Teks preview / nama tombol
  latex: string; // Kode LaTeX yang disisipkan
  desc?: string; // Penjelasan singkat
  preview?: string; // Pratinjau visual khusus
}

interface CategoryGroup {
  id: string;
  name: string;
  icon: any;
  symbols: SymbolItem[];
}

export interface MathToken {
  id: number;
  value: string;
  start: number;
  end: number;
  type: "variable" | "number";
}

export function extractEditableTokens(latex: string): MathToken[] {
  const tokens: MathToken[] = [];
  let i = 0;
  let id = 0;

  while (i < latex.length) {
    if (latex[i] === "\\") {
      let cmd = "";
      i++;
      while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
        cmd += latex[i];
        i++;
      }
      if (cmd === "begin" || cmd === "end") {
        while (i < latex.length && latex[i] === " ") i++;
        if (latex[i] === "{") {
          while (i < latex.length && latex[i] !== "}") i++;
          if (latex[i] === "}") i++;
        }
      }
      continue;
    }

    if (/[0-9]/.test(latex[i])) {
      const start = i;
      while (i < latex.length && /[0-9.]/.test(latex[i])) {
        i++;
      }
      tokens.push({
        id: id++,
        value: latex.substring(start, i),
        start,
        end: i,
        type: "number",
      });
      continue;
    }

    if (/[a-zA-Z]/.test(latex[i])) {
      const start = i;
      tokens.push({
        id: id++,
        value: latex[i],
        start,
        end: i + 1,
        type: "variable",
      });
      i++;
      continue;
    }

    i++;
  }

  return tokens;
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
  const popoverInputRef = useRef<HTMLInputElement>(null);

  // State untuk editing token langsung di preview
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [editSlotValue, setEditSlotValue] = useState("");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Sync initial latex saat dialog dibuka
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || "");
      setSelectedTokenId(null);
      setPopoverPos(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialLatex]);

  const currentCategory = useMemo(() => {
    return EQUATION_CATEGORIES.find((c) => c.id === activeCategory) || EQUATION_CATEGORIES[0];
  }, [activeCategory]);

  // Ekstraksi token nilai yang dapat diedit langsung
  const tokens = useMemo(() => extractEditableTokens(latex), [latex]);

  const selectedToken = useMemo(
    () => tokens.find((t) => t.id === selectedTokenId),
    [tokens, selectedTokenId]
  );

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setLatex((prev) => (prev ? `${prev} ${snippet}` : snippet));
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = latex.substring(0, start);
    const after = latex.substring(end);
    const newText = `${before}${snippet}${after}`;
    setLatex(newText);

    setTimeout(() => {
      el.focus();
      const nextPos = start + snippet.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 10);
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

  // Simpan nilai baru token yang diedit dari preview
  const handleSaveTokenEdit = () => {
    if (selectedTokenId === null || !selectedToken) return;

    const newLatex =
      latex.substring(0, selectedToken.start) +
      editSlotValue +
      latex.substring(selectedToken.end);

    setLatex(newLatex);
    setSelectedTokenId(null);
    setEditSlotValue("");
    setPopoverPos(null);
  };

  // Klik langsung pada angka atau variabel di dalam pratinjau KaTeX
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Cari elemen leaf .mord terdekat di dalam KaTeX HTML
    const leafSpan = target.closest(".mord") as HTMLElement;
    if (!leafSpan) return;

    const text = leafSpan.textContent?.trim();
    if (!text) return;

    // Ambil seluruh leaf element .mord di dalam container pratinjau
    const allLeaves = Array.from(
      previewBoxRef.current?.querySelectorAll(".katex-html .mord") || []
    ).filter(
      (el) => el.textContent && el.textContent.trim().length > 0 && el.children.length === 0
    );

    const leafIndex = allLeaves.indexOf(leafSpan);
    const token =
      leafIndex >= 0 && leafIndex < tokens.length
        ? tokens[leafIndex]
        : tokens.find((t) => t.value === text);

    if (token) {
      setSelectedTokenId(token.id);
      setEditSlotValue(token.value);

      const containerRect = previewBoxRef.current?.getBoundingClientRect();
      const spanRect = leafSpan.getBoundingClientRect();
      if (containerRect) {
        setPopoverPos({
          top: spanRect.bottom - containerRect.top + 8,
          left: Math.max(12, Math.min(containerRect.width - 170, spanRect.left - containerRect.left - 25)),
        });
        setTimeout(() => popoverInputRef.current?.focus(), 60);
      }
    }
  };

  // Content for preview rendering
  const previewContent = useMemo(() => {
    const clean = latex.trim();
    if (!clean) return "";
    return isBlock ? `$$ ${clean} $$` : `$ ${clean} $`;
  }, [latex, isBlock]);

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
                  KaTeX &amp; Interactive WYSIWYG
                </span>
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Pilih simbol atau ketik formula. Nilai pada pratinjau rumus dapat langsung Anda klik untuk diedit.
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Palet Simbol &amp; Template (Klik untuk Sisipkan)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {currentCategory.symbols.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertSnippet(item.latex)}
                  title={item.desc || item.latex}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all flex flex-col items-center justify-center text-center gap-1 group shadow-2xs cursor-pointer min-h-[56px]"
                >
                  <div className="text-xs text-neutral-800 dark:text-neutral-200 pointer-events-none">
                    <MathText content={`$ ${item.preview || item.latex} $`} />
                  </div>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* LaTeX Input Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Sintaks Rumus LaTeX / KaTeX
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
                    setSelectedTokenId(null);
                    setPopoverPos(null);
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
              rows={3}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="Contoh: \frac{1}{2} x^2 + \sqrt{y} = r^2"
              className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-750 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner resize-y leading-relaxed"
            />
          </div>

          {/* Live Interactive Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span>Pratinjau Visual (Klik Nilai untuk Edit Langsung)</span>
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

            <div
              ref={previewBoxRef}
              className="relative p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 min-h-[88px] flex flex-col items-center justify-center text-center overflow-visible"
            >
              {previewContent ? (
                <>
                  <div
                    onClick={handlePreviewClick}
                    className="text-base sm:text-xl text-neutral-900 dark:text-neutral-100 font-serif select-none cursor-pointer py-1 [&_.katex-html_.mord]:transition-all [&_.katex-html_.mord]:rounded-md [&_.katex-html_.mord]:px-0.5 [&_.katex-html_.mord]:cursor-pointer [&_.katex-html_.mord:hover]:bg-emerald-500/20 [&_.katex-html_.mord:hover]:ring-1.5 [&_.katex-html_.mord:hover]:ring-emerald-500"
                    title="Klik angka atau variabel untuk mengubah nilainya langsung"
                  >
                    <MathText content={previewContent} />
                  </div>

                  {/* Floating Popover Editor saat elemen diklik */}
                  {selectedToken && popoverPos && (
                    <div
                      style={{ top: popoverPos.top, left: popoverPos.left }}
                      className="absolute z-30 p-1.5 bg-white dark:bg-neutral-900 border-2 border-emerald-500 rounded-xl shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pl-1 shrink-0">
                        Ubah:
                      </span>
                      <input
                        ref={popoverInputRef}
                        value={editSlotValue}
                        onChange={(e) => setEditSlotValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTokenEdit();
                          if (e.key === "Escape") setSelectedTokenId(null);
                        }}
                        className="w-20 h-7 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-bold text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveTokenEdit}
                        className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                        title="Terapkan Perubahan (Enter)"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTokenId(null)}
                        className="h-7 w-7 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 flex items-center justify-center cursor-pointer shrink-0"
                        title="Batal (Esc)"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                  Ketik atau klik tombol simbol di atas untuk melihat rumus...
                </span>
              )}
            </div>

            {/* Smart Interactive Value Slots Bar */}
            {tokens.length > 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-emerald-800 dark:text-emerald-300">
                    <Pencil className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Slot Nilai Rumus (Klik untuk ubah cepat):</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {tokens.length} nilai terdeteksi
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar pt-0.5">
                  {tokens.map((tok) => {
                    const isSelected = selectedTokenId === tok.id;
                    return (
                      <button
                        key={tok.id}
                        type="button"
                        onClick={() => {
                          setSelectedTokenId(tok.id);
                          setEditSlotValue(tok.value);
                          setPopoverPos(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-xs scale-105"
                            : "bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200 hover:border-emerald-500/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
                        }`}
                        title={`Klik untuk mengedit ${tok.type === "number" ? "angka" : "variabel"} "${tok.value}"`}
                      >
                        <span className="text-[10px] font-sans font-normal opacity-60">
                          {tok.type === "number" ? "123" : "xyz"}:
                        </span>
                        <span>{tok.value}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Inline Quick Editor saat memilih dari slot bar */}
                {selectedToken && !popoverPos && (
                  <div className="pt-2 mt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      Ubah nilai <strong>"{selectedToken.value}"</strong>:
                    </span>
                    <input
                      autoFocus
                      value={editSlotValue}
                      onChange={(e) => setEditSlotValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTokenEdit();
                        if (e.key === "Escape") setSelectedTokenId(null);
                      }}
                      className="w-24 h-7 px-2 rounded-lg bg-white dark:bg-neutral-900 text-xs font-mono font-bold text-neutral-900 dark:text-white border border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTokenEdit}
                      className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Terapkan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTokenId(null)}
                      className="h-7 px-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-neutral-500 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}
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
