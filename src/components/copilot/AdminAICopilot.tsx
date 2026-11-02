import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X,
  Send,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Clock,
  BookOpen,
  Users,
  KeyRound,
  Zap,
  Terminal,
  HelpCircle,
  Layers,
  CheckSquare,
  Square,
  Search,
  Maximize2,
  Minimize2,
  ChevronDown,
  BarChart2,
  Compass,
  Lightbulb
} from "lucide-react";
import { cn } from "../../lib/utils";
import { NeonButton } from "../ui/NeonButton";
import { MathText } from "../ui/MathText";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import {
  askAdminCopilotAI,
  executeCreateBankSoal,
  executeCreateExamRoom,
  executeCreateMultipleExamRooms,
  executeUpdateExamRoom,
  resolveExamSchedule,
  COPILOT_COMMAND_TEMPLATES,
  type CopilotMessage,
  type CopilotAction
} from "../../lib/aiCopilot";

/**
 * Executive Copilot Emblem:
 * Ikon AI futuristik, presisi & elegan (astroid star prism) bergaya executive enterprise
 */
export const CopilotEmblem: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Ambient Outer Radar Ring */}
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" />

    {/* Primary Supersonic Copilot Delta Wing */}
    <path
      d="M12 3.75L18.5 16.25L12 13.5L5.5 16.25L12 3.75Z"
      fill="currentColor"
      fillOpacity="0.2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Inner Command Core Pulse */}
    <path
      d="M12 7.25L15 13.25L12 12L9 13.25L12 7.25Z"
      fill="currentColor"
      fillOpacity="0.9"
    />

    {/* Horizon Navigation Arc */}
    <path
      d="M7.5 18.5C9 19.5 10.4 20 12 20C13.6 20 15 19.5 16.5 18.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeOpacity="0.85"
    />
  </svg>
);

/**
 * ChatMessageMarkdown:
 * Parser markdown terstruktur ala Neon ChatGPT dengan dukungan sintaks perintah interaktif
 */
interface ChatMessageMarkdownProps {
  content: string;
  onRunCommand?: (cmd: string) => void;
}

const ChatMessageMarkdown: React.FC<ChatMessageMarkdownProps> = ({ content, onRunCommand }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const normalized = useMemo(() => {
    if (!content) return "";
    return content.replace(/\r\n/g, "\n").trim();
  }, [content]);

  const blocks = useMemo(() => {
    const lines = normalized.split("\n");
    const result: Array<
      | { type: "header"; level: number; text: string }
      | { type: "bullet"; items: string[] }
      | { type: "numbered"; items: string[] }
      | { type: "quote"; text: string }
      | { type: "paragraph"; text: string }
      | { type: "code"; lang: string; code: string }
    > = [];

    let currentList: { type: "bullet" | "numbered"; items: string[] } | null = null;
    let inCodeBlock = false;
    let codeLang = "";
    let codeLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          result.push({ type: "code", lang: codeLang, code: codeLines.join("\n") });
          inCodeBlock = false;
          codeLang = "";
          codeLines = [];
        } else {
          if (currentList) {
            result.push(currentList);
            currentList = null;
          }
          inCodeBlock = true;
          codeLang = line.trim().replace(/^```/, "").trim();
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headerMatch) {
        if (currentList) {
          result.push(currentList);
          currentList = null;
        }
        result.push({ type: "header", level: headerMatch[1].length, text: headerMatch[2] });
        continue;
      }

      // Quote: > text
      const quoteMatch = line.match(/^>\s*(.*)$/);
      if (quoteMatch) {
        if (currentList) {
          result.push(currentList);
          currentList = null;
        }
        result.push({ type: "quote", text: quoteMatch[1] });
        continue;
      }

      const bulletMatch = line.match(/^[\*\-•]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== "bullet") {
          if (currentList) result.push(currentList);
          currentList = { type: "bullet", items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // Support 1. item, or **1. Item**
      const numMatch = line.match(/^(?:\*\*|\*)?(\d+)[\.\)]\s*(.*?)(?:\*\*|\*)?$/);
      if (numMatch && (line.trim().startsWith(numMatch[1]) || line.trim().startsWith(`**${numMatch[1]}`))) {
        if (!currentList || currentList.type !== "numbered") {
          if (currentList) result.push(currentList);
          currentList = { type: "numbered", items: [] };
        }
        currentList.items.push(numMatch[2]);
        continue;
      }

      if (!line.trim()) {
        if (currentList) {
          result.push(currentList);
          currentList = null;
        }
        continue;
      }

      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
      result.push({ type: "paragraph", text: line });
    }

    if (currentList) result.push(currentList);
    if (inCodeBlock) {
      result.push({ type: "code", lang: codeLang, code: codeLines.join("\n") });
    }

    return result;
  }, [normalized]);

  const renderInlineFormatted = (str: string) => {
    const codeParts = str.split(/(`[^`]+`)/g);
    return codeParts.map((part, pIdx) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        const codeText = part.slice(1, -1);
        const isSlashCmd = codeText.startsWith("/");
        if (isSlashCmd && onRunCommand) {
          return (
            <button
              key={pIdx}
              type="button"
              onClick={() => onRunCommand(codeText)}
              title={`Klik untuk menjalankan ${codeText}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer shadow-2xs group/btn"
            >
              <span>{codeText}</span>
              <span className="text-[9px] text-emerald-500 opacity-60 group-hover/btn:opacity-100">↗</span>
            </button>
          );
        }

        return (
          <code
            key={pIdx}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-neutral-200/70 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold border border-neutral-300/60 dark:border-neutral-700/60"
          >
            {codeText}
          </code>
        );
      }

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length > 4) {
          return (
            <strong key={bIdx} className="font-bold text-neutral-900 dark:text-neutral-100">
              {bPart.slice(2, -2)}
            </strong>
          );
        }

        // Support both *italic* and _italic_
        const italicParts = bPart.split(/((?:\*[^*]+\*|_[^_]+_))/g);
        return italicParts.map((iPart, iIdx) => {
          if (
            (iPart.startsWith("*") && iPart.endsWith("*") && iPart.length > 2) ||
            (iPart.startsWith("_") && iPart.endsWith("_") && iPart.length > 2)
          ) {
            return (
              <em key={iIdx} className="italic text-neutral-700 dark:text-neutral-300">
                {iPart.slice(1, -1)}
              </em>
            );
          }
          return <MathText key={iIdx} content={iPart} disableJustify />;
        });
      });
    });
  };

  return (
    <div className="space-y-2 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">
      {blocks.map((block, bIdx) => {
        if (block.type === "header") {
          return (
            <h4
              key={bIdx}
              className="font-bold text-neutral-900 dark:text-neutral-100 pt-2 pb-1 tracking-tight flex items-center gap-1.5 text-xs sm:text-sm border-b border-neutral-200/60 dark:border-neutral-800/80"
            >
              {renderInlineFormatted(block.text)}
            </h4>
          );
        }

        if (block.type === "quote") {
          return (
            <div
              key={bIdx}
              className="pl-3 py-1 my-1.5 border-l-2 border-emerald-500 bg-emerald-500/[0.04] rounded-r-lg text-neutral-600 dark:text-neutral-400 text-xs italic"
            >
              {renderInlineFormatted(block.text)}
            </div>
          );
        }

        if (block.type === "bullet") {
          return (
            <ul key={bIdx} className="space-y-1.5 my-1.5 pl-0.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbered") {
          return (
            <ol key={bIdx} className="space-y-1.5 my-1.5 pl-0.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                  <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    {iIdx + 1}.
                  </span>
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={bIdx}
              className="my-2 rounded-xl bg-neutral-900 dark:bg-[#08090a] text-neutral-100 overflow-hidden shadow-xs border border-neutral-800"
            >
              <div className="flex items-center justify-between px-3 py-1 bg-neutral-950/80 border-b border-neutral-800 text-[10px] text-neutral-400">
                <span className="font-mono uppercase font-bold text-emerald-400">
                  {block.lang || "perintah"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.code, bIdx)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedCodeIdx === bIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed text-neutral-200">
                {block.code}
              </pre>
            </div>
          );
        }

        return (
          <p key={bIdx} className="leading-relaxed">
            {renderInlineFormatted(block.text)}
          </p>
        );
      })}
    </div>
  );
};

/**
 * CopilotHelpCard:
 * Kartu panduan perintah cepat bergaya Neon Enterprise, rapi & 100% interaktif
 */
interface CopilotHelpCardProps {
  payload?: any;
  onRunCommand: (cmdText: string) => void;
  onNavigate: (path: string) => void;
}

const CopilotHelpCard: React.FC<CopilotHelpCardProps> = ({ payload, onRunCommand, onNavigate }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const categories = payload?.categories || [];

  return (
    <div className="mt-2 p-2.5 sm:p-3 rounded-2xl bg-neutral-50/90 dark:bg-[#08090a] border border-emerald-500/30 space-y-2.5 shadow-xs">
      {/* Header Tag Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800 pb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
          <Zap className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
          Perintah Cepat Instan
        </span>
        <span className="text-[10px] font-medium text-neutral-400">
          100% Offline
        </span>
      </div>

      {/* Categories */}
      <div className="space-y-2.5">
        {categories.map((cat: any) => {
          if (cat.id === "navigation" && cat.links) {
            return (
              <div key={cat.id} className="space-y-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-500" />
                  Pintasan Cepat 1-Klik
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {cat.links.map((link: any, lIdx: number) => {
                    const IconComponent =
                      link.cmd === "/monitoring" ? BarChart2 :
                        link.cmd === "/token" ? KeyRound :
                          link.cmd === "/bank-soal" ? BookOpen : Layers;

                    return (
                      <button
                        key={lIdx}
                        type="button"
                        onClick={() => {
                          if (link.isCommand) {
                            onRunCommand(link.cmd);
                          } else {
                            onNavigate(link.path);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111214] border border-neutral-200/80 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all flex items-center justify-between gap-1.5 group cursor-pointer shadow-2xs"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <IconComponent className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {link.label}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 group-hover:text-emerald-500 shrink-0">
                          ↗
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={cat.id} className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                {cat.id === "rooms" ? <Layers className="w-3 h-3 text-emerald-500" /> : <BookOpen className="w-3 h-3 text-emerald-500" />}
                {cat.title}
              </span>

              <div className="space-y-1.5">
                {cat.commands?.map((cmdItem: any, cIdx: number) => (
                  <div
                    key={cIdx}
                    className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#111214] border border-neutral-200/70 dark:border-neutral-800 space-y-1.5 shadow-2xs hover:border-emerald-500/40 transition-all"
                  >
                    {/* Baris 1: Command Badge + Label + Tombol Aksi Coba & Salin */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 shrink-0">
                          {cmdItem.cmd}
                        </span>
                        <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                          {cmdItem.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(cmdItem.example)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Salin perintah"
                        >
                          {copiedCmd === cmdItem.example ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRunCommand(cmdItem.example)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-xs transition-all cursor-pointer shrink-0"
                        >
                          <Zap className="w-2.5 h-2.5" />
                          <span>Coba</span>
                        </button>
                      </div>
                    </div>

                    {/* Baris 2: Contoh sintaks ringkas 1 baris */}
                    <div
                      onClick={() => onRunCommand(cmdItem.example)}
                      title="Klik untuk mencoba perintah ini"
                      className="px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 text-[10px] font-mono text-neutral-600 dark:text-neutral-400 truncate cursor-pointer hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                    >
                      {cmdItem.example}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface RoomBankSoalPickerProps {
  roomIndex?: number;
  room: any;
  availableExams: Array<{ id: string; title: string; subject?: string }>;
  onSelectExam: (examId: string, examTitle: string) => void;
}

const RoomBankSoalPicker: React.FC<RoomBankSoalPickerProps> = ({
  room,
  availableExams,
  onSelectExam
}) => {
  const [search, setSearch] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Smart sort: Bank soal yang cocok dengan mapel/nama ruangan
  const sortedAndFilteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    const roomKeyword = (room.subject || room.roomName || "").toLowerCase();

    const filtered = (availableExams || []).filter(ex => {
      if (!query) return true;
      return (
        (ex.title && ex.title.toLowerCase().includes(query)) ||
        (ex.subject && ex.subject.toLowerCase().includes(query))
      );
    });

    return filtered.sort((a, b) => {
      const aTitle = (a.title || "").toLowerCase();
      const bTitle = (b.title || "").toLowerCase();
      const aMatch = roomKeyword && aTitle.includes(roomKeyword);
      const bMatch = roomKeyword && bTitle.includes(roomKeyword);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [availableExams, search, room.subject, room.roomName]);

  const isAutoNew = !room.examId;
  const currentTitle = isAutoNew
    ? `+ Otomatis: ${room.examTitle || `Bank Soal ${room.subject || "Baru"}`}`
    : room.examTitle || "Belum dipilih";

  return (
    <div className="space-y-1.5 pt-1">
      {/* Status Bank Soal Terpilih: Compact Neon Badge */}
      <div className="p-2 rounded-xl bg-white dark:bg-[#111214] border border-emerald-500/30 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-neutral-400 block tracking-wider leading-none">
              Paket Bank Soal
            </span>
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block mt-0.5">
              {currentTitle}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors cursor-pointer border border-emerald-500/25"
        >
          <span>{isExpanded ? "Tutup" : "Ganti Soal"}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
        </button>
      </div>

      {/* Accordion Picker: Hanya Muncul Saat Diklik Ganti Soal */}
      {isExpanded && (
        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#0c0d0e] border border-neutral-200/80 dark:border-neutral-800 space-y-2 animate-in fade-in duration-150">
          {/* Input Pencarian Cepat */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari bank soal atau mata pelajaran..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-[#141619] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 placeholder:text-neutral-400"
            />
          </div>

          {/* List Pilihan Bank Soal Terstruktur */}
          <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
            {/* Opsi Buat Otomatis */}
            <button
              type="button"
              onClick={() => {
                onSelectExam("", `Bank Soal ${room.subject || "Baru"}`);
                setIsExpanded(false);
              }}
              className={cn(
                "w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer border",
                isAutoNew
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-bold"
                  : "bg-white dark:bg-[#111214] border-neutral-200/70 dark:border-neutral-800 hover:border-emerald-500/40 text-neutral-700 dark:text-neutral-300"
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">+ Buat Otomatis dari Mata Pelajaran</span>
              </div>
              {isAutoNew && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </button>

            {/* Daftar Bank Soal yang Ada */}
            {sortedAndFilteredExams.map((exam) => {
              const isSelected = room.examId === exam.id || room.examTitle === exam.title;
              return (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => {
                    onSelectExam(exam.id, exam.title);
                    setIsExpanded(false);
                  }}
                  className={cn(
                    "w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer border",
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                      : "bg-white dark:bg-[#111214] border-neutral-200/70 dark:border-neutral-800 hover:border-emerald-500/40 text-neutral-800 dark:text-neutral-200"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                      {exam.title}
                    </p>
                    {exam.subject && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {exam.subject}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              );
            })}

            {sortedAndFilteredExams.length === 0 && search && (
              <p className="text-[11px] text-neutral-400 p-2 italic text-center">
                Tidak ada bank soal yang cocok &quot;{search}&quot;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SUGGESTIONS = [
  {
    icon: "💡",
    label: "/help",
    prompt: "/help"
  },
  {
    icon: "⚡",
    label: "2 Ruang",
    prompt: "buat 2 ruang untuk B.Inggris dan B.Indonesia jam 8 durasi 120 menit jeda 15m"
  },
  {
    icon: "🚪",
    label: "Ruang Besok",
    prompt: "buka ruang ujian untuk besok"
  },
  {
    icon: "🕒",
    label: "Ubah Jadwal",
    prompt: "ubah jadwal besok 09:00 120m"
  },
  {
    icon: "📚",
    label: "Bank Soal",
    prompt: "buat bank soal Ulangan Biologi Bab 3"
  },
  {
    icon: "🔑",
    label: "Token",
    prompt: "/token"
  },
  {
    icon: "📊",
    label: "Monitoring",
    prompt: "/monitoring"
  }
];

export const AdminAICopilot: React.FC = () => {
  const { pb } = useTenant();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Data master sekolah untuk live selection di Copilot
  const [allSchoolExams, setAllSchoolExams] = useState<Array<{ id: string; title: string; subject?: string }>>([]);
  const [allSchoolClasses, setAllSchoolClasses] = useState<Array<{ id: string; name: string; level?: string }>>([]);

  // Menyimpan ID ruang ujian terakhir yang dibuat/diedit dalam sesi Copilot ini
  const lastActionRoomIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("examku_admin_copilot_messages");
      if (saved) return JSON.parse(saved);
    } catch { }
    return [
      {
        id: "welcome",
        role: "assistant",
        content: `Halo! Saya **Examku Copilot**, asisten manajemen ujian & bank soal.

Kini Anda dapat mengonfigurasi dan membuka ruang ujian secara interaktif:
• 🚪 **Buka Ruang Besok**: Menanyakan detail nama ruang, jadwal, durasi, kelas, dan bank soal sebelum dibuka.
• 👥 **Multiple Ruang**: *"buat 2 ruang untuk b.inggris dan b.indonesia jam 8 jeda 15m durasi 120 menit"*
• 🕒 **Ubah Jadwal**: \`/jadwal besok 09:00 120m\`
• 📝 **Buat Bank Soal**: \`/banksoal Ulangan Harian Informatika XI\`
• 🔑 \`/token\` - Cek token ruang ujian aktif
• ❓ \`/help\` - Panduan lengkap seluruh command

Ketik \`/\` di kolom input untuk melihat daftar template perintah cepat!`,
        timestamp: Date.now()
      }
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Muat data master bank soal & kelas saat Copilot dibuka
  useEffect(() => {
    if (!isOpen || !pb) return;

    pb.collection("exams")
      .getList(1, 50, { fields: "id,title,subject", sort: "-created" })
      .then(res =>
        setAllSchoolExams(res.items.map(e => ({ id: e.id, title: e.title || "Bank Soal", subject: e.subject || "" })))
      )
      .catch(() => { });

    pb.collection("classes")
      .getFullList({ fields: "id,name,level", sort: "name" })
      .then(res =>
        setAllSchoolClasses(res.map(c => ({ id: c.id, name: c.name || "Kelas", level: c.level || "" })))
      )
      .catch(() => { });
  }, [isOpen, pb]);

  // Autocomplete command matching
  const isCommandInput = input.trim().startsWith("/");
  const commandQuery = isCommandInput ? input.trim().slice(1).toLowerCase() : "";
  const filteredCommands = useMemo(() => {
    if (!isCommandInput) return [];
    if (!commandQuery) return COPILOT_COMMAND_TEMPLATES;
    return COPILOT_COMMAND_TEMPLATES.filter(
      c => c.cmd.toLowerCase().includes(commandQuery) || c.desc.toLowerCase().includes(commandQuery)
    );
  }, [isCommandInput, commandQuery]);

  // Simpan riwayat chat ke localStorage
  useEffect(() => {
    try {
      localStorage.setItem("examku_admin_copilot_messages", JSON.stringify(messages.slice(-30)));
    } catch { }
  }, [messages]);

  // Auto scroll HANYA saat ada pesan baru masuk atau panel pertama kali dibuka
  // TIDAK scroll saat pengguna sedang mengetik atau memilih pill/opsi di dalam kartu
  const prevMessagesLengthRef = useRef(messages.length);
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    const isNewMessageAdded = messages.length > prevMessagesLengthRef.current;
    const isJustOpened = !prevIsOpenRef.current && isOpen;

    if (isOpen && (isNewMessageAdded || isJustOpened || isLoading)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    prevMessagesLengthRef.current = messages.length;
    prevIsOpenRef.current = isOpen;
  }, [messages.length, isOpen, isLoading]);

  // Global shortcut Alt+C to toggle Copilot and Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Fokus input saat panel dibuka tanpa memicu lompatan scroll
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 250);
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `Riwayat percakapan telah dibersihkan. Ketik \`/help\` untuk melihat daftar perintah cepat.`,
        timestamp: Date.now()
      }
    ]);
    lastActionRoomIdRef.current = null;
    addToast({
      type: "info",
      title: "Riwayat Dibersihkan",
      description: "Percakapan Copilot telah direset."
    });
  };

  // 🔀 Handler Update Single Room Parameters pada Kartu Konfirmasi
  const handleUpdateSingleRoom = (msgId: string, updates: Record<string, any>) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId || !m.action || m.action.type !== "create_exam_room") return m;
        const currentPayload = m.action.payload || {};
        const newPayload = { ...currentPayload, ...updates };

        if (updates.date !== undefined || updates.time !== undefined || updates.duration !== undefined) {
          const sched = resolveExamSchedule({
            date: newPayload.date,
            time: newPayload.time,
            duration: newPayload.duration,
            text: newPayload.roomName
          });
          newPayload.scheduleText = sched.formattedSchedule;
        }

        return {
          ...m,
          action: {
            ...m.action,
            payload: newPayload
          }
        };
      })
    );
  };

  // 🔀 Handler Toggle Kelas Spesifik pada Single Room Card
  const handleToggleSingleRoomClass = (msgId: string, classId: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId || !m.action || m.action.type !== "create_exam_room") return m;
        const currentPayload = m.action.payload || {};
        const currentClasses: string[] = currentPayload.classIds || [];
        const exists = currentClasses.includes(classId);
        const newClasses = exists
          ? currentClasses.filter(id => id !== classId)
          : [...currentClasses, classId];

        return {
          ...m,
          action: {
            ...m.action,
            payload: {
              ...currentPayload,
              allClasses: false,
              classIds: newClasses
            }
          }
        };
      })
    );
  };

  // 🔀 Handler Toggle Enable/Disable Ruangan pada Multiple Rooms Card
  const handleToggleRoomEnabled = (msgId: string, roomIdx: number) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId || !m.action || m.action.type !== "create_multiple_exam_rooms") return m;
        const currentRooms = m.action.payload?.rooms || [];
        const newRooms = currentRooms.map((r: any, idx: number) =>
          idx === roomIdx ? { ...r, enabled: !r.enabled } : r
        );
        return {
          ...m,
          action: {
            ...m.action,
            payload: {
              ...m.action.payload,
              rooms: newRooms
            }
          }
        };
      })
    );
  };

  // 🔀 Handler Pemilihan Bank Soal pada Multiple Rooms Card
  const handleSelectRoomExam = (msgId: string, roomIdx: number, examId: string, examTitle: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId || !m.action || m.action.type !== "create_multiple_exam_rooms") return m;
        const currentRooms = m.action.payload?.rooms || [];
        const newRooms = currentRooms.map((r: any, idx: number) =>
          idx === roomIdx ? { ...r, examId, examTitle } : r
        );
        return {
          ...m,
          action: {
            ...m.action,
            payload: {
              ...m.action.payload,
              rooms: newRooms
            }
          }
        };
      })
    );
  };

  const handleExecuteAction = async (msgId: string, action: CopilotAction) => {
    if (!pb || action.executed) return;
    setExecutingActionId(msgId);

    try {
      if (action.type === "create_bank_soal") {
        const res = await executeCreateBankSoal(pb, action.payload);
        if (res.success && res.examId) {
          sessionStorage.setItem("activeQuestionsExamId", res.examId);
          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? {
                  ...m,
                  action: {
                    ...action,
                    executed: true,
                    resultMessage: res.message
                  }
                }
                : m
            )
          );
          addToast({
            type: "success",
            title: "Bank Soal Dibuat!",
            description: res.message
          });
          navigate("/admin/bank-soal/questions");
          setIsOpen(false);
        } else {
          addToast({ type: "error", title: "Gagal", description: res.message });
        }
      } else if (action.type === "create_exam_room") {
        const res = await executeCreateExamRoom(pb, action.payload);
        if (res.success && res.roomId) {
          lastActionRoomIdRef.current = res.roomId;
          sessionStorage.setItem("activeMonitoringRoomId", res.roomId);

          // ⚡ Trigger update instan di halaman Ruang Ujian
          window.dispatchEvent(new CustomEvent("exam-rooms-updated", { detail: { roomId: res.roomId } }));

          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? {
                  ...m,
                  action: {
                    ...action,
                    executed: true,
                    resultMessage: res.message
                  }
                }
                : m
            )
          );
          addToast({
            type: "success",
            title: "Ruang Ujian Terbuka!",
            description: res.message
          });
        } else {
          addToast({ type: "error", title: "Gagal", description: res.message });
        }
      } else if (action.type === "create_multiple_exam_rooms") {
        const res = await executeCreateMultipleExamRooms(pb, action.payload);
        if (res.success && res.createdRooms.length > 0) {
          lastActionRoomIdRef.current = res.createdRooms[res.createdRooms.length - 1].id;
          sessionStorage.setItem("activeMonitoringRoomId", res.createdRooms[0].id);

          // ⚡ Trigger update instan di halaman Ruang Ujian
          window.dispatchEvent(new CustomEvent("exam-rooms-updated"));

          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? {
                  ...m,
                  action: {
                    ...action,
                    executed: true,
                    resultMessage: res.message
                  }
                }
                : m
            )
          );
          addToast({
            type: "success",
            title: "Semua Ruang Terbuka!",
            description: `${res.createdRooms.length} ruang ujian berhasil dibuka.`
          });
        } else {
          addToast({ type: "error", title: "Gagal", description: res.message });
        }
      } else if (action.type === "update_exam_room") {
        const res = await executeUpdateExamRoom(pb, action.payload);
        if (res.success && res.roomId) {
          lastActionRoomIdRef.current = res.roomId;

          // ⚡ Trigger update instan di tabel halaman Ruang Ujian
          window.dispatchEvent(new CustomEvent("exam-rooms-updated", { detail: { roomId: res.roomId } }));

          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? {
                  ...m,
                  action: {
                    ...action,
                    executed: true,
                    resultMessage: res.message
                  }
                }
                : m
            )
          );
          addToast({
            type: "success",
            title: "Jadwal Diperbarui!",
            description: res.message
          });
        } else {
          addToast({ type: "error", title: "Gagal Update", description: res.message });
        }
      } else if (action.type === "navigate" && action.payload?.path) {
        navigate(action.payload.path);
        setIsOpen(false);
      }
    } catch (e: any) {
      addToast({ type: "error", title: "Gagal Eksekusi", description: e?.message || "Tindakan gagal dijalankan." });
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isLoading || !pb) return;

    setInput("");
    const userMsgId = `u-${Date.now()}`;
    const newMessages: CopilotMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        content: textToSend,
        timestamp: Date.now()
      }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      // Dapatkan data konteks: bank soal & ruang ujian terkini untuk auto-matching
      let existingExams = allSchoolExams;
      if (existingExams.length === 0) {
        try {
          const examsRes = await pb.collection("exams").getList(1, 30, {
            fields: "id,title,subject",
            sort: "-created"
          });
          existingExams = examsRes.items.map(e => ({
            id: e.id,
            title: e.title || "Bank Soal",
            subject: e.subject || ""
          }));
        } catch { }
      }

      let existingClasses = allSchoolClasses;
      if (existingClasses.length === 0) {
        try {
          const clsRes = await pb.collection("classes").getFullList({
            fields: "id,name,level",
            sort: "name"
          });
          existingClasses = clsRes.map(c => ({ id: c.id, name: c.name || "Kelas", level: c.level || "" }));
        } catch { }
      }

      let existingRooms: Array<{
        id: string;
        title: string;
        roomCode?: string;
        startTime?: string;
        duration?: number;
        status?: string;
      }> = [];
      try {
        const roomsRes = await pb.collection("exam_rooms").getList(1, 10, {
          fields: "id,title,room_name,start_time,startTime,duration,room_code,status",
          filter: 'status != "archive"',
          sort: "-created"
        });
        existingRooms = roomsRes.items.map(r => ({
          id: r.id,
          title: r.room_name || r.title || "Ruang Ujian",
          roomCode: r.room_code || "",
          startTime: r.start_time || r.startTime || "",
          duration: r.duration || 90,
          status: r.status || "active"
        }));
      } catch { }

      const result = await askAdminCopilotAI({
        pb,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        context: {
          currentPath: location.pathname,
          existingExams,
          existingClasses,
          existingRooms,
          lastActionRoomId: lastActionRoomIdRef.current || (existingRooms.length > 0 ? existingRooms[0].id : undefined)
        },
        signal: abortControllerRef.current.signal
      });

      const assistantMsgId = `a-${Date.now()}`;

      // 🛡️ KEBIJAKAN KONFIRMASI AMAN:
      // Seluruh aksi (termasuk preset & deterministic commands) TIDAK PERNAH dieksekusi secara diam-diam.
      // Sistem selalu menampilkan draf kartu interaktif terlebih dahulu agar pengguna dapat memeriksa
      // parameter (nama ruang, jadwal, durasi, kelas, bank soal) dan mengklik konfirmasi secara sadar.
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: result.replyText,
          action: result.action && result.action.type !== "none" ? result.action : undefined,
          timestamp: Date.now()
        }
      ]);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[Copilot UI] Error:", err);
      addToast({
        type: "error",
        title: "Kendala Copilot",
        description: err?.message || "Gagal memproses perintah."
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <>
      {/* 🚀 1. Floating Action Button (Kanan Bawah) - Hanya Tampil Saat Panel Tertutup */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 print:hidden animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Buka Examku Copilot (Alt+C)"
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-300 text-white shadow-[0_4px_25px_rgba(16,185,129,0.45)] hover:shadow-[0_6px_35px_rgba(16,185,129,0.65)] border-2 border-white/30 dark:border-white/20 flex items-center justify-center transition-all duration-200 cursor-pointer group active:scale-95 hover:scale-105"
          >
            <CopilotEmblem className="w-6 h-6 transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)] text-white" />

            {/* Pulsing online indicator */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-white dark:border-neutral-900 shadow-xs" />
            </span>

            {/* Tooltip on hover */}
            <span className="absolute right-full mr-3.5 px-3 py-1.5 rounded-xl bg-neutral-900/95 dark:bg-[#111214]/95 text-white text-xs font-semibold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl border border-neutral-700/60 dark:border-neutral-800 hidden sm:flex items-center gap-1.5">
              <CopilotEmblem className="w-3.5 h-3.5 text-emerald-400" />
              <span>Examku Copilot</span>
              <kbd className="text-[10px] text-emerald-400 font-mono bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">Alt+C</kbd>
            </span>
          </button>
        </div>
      )}

      {/* 🤖 2. Copilot Panel / Window - Sleek Neon Glassmorphism */}
      {isOpen && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-5 sm:right-5 z-50 rounded-t-3xl sm:rounded-3xl bg-white/95 dark:bg-[#0c0d0e]/95 backdrop-blur-2xl border border-neutral-200/90 dark:border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 print:hidden transition-all",
            isExpanded
              ? "w-full sm:w-[620px] h-[90vh] sm:h-[680px] max-h-[95vh] sm:max-h-[calc(100vh-2rem)]"
              : "w-full sm:w-[430px] h-[85vh] sm:h-[600px] max-h-[92vh] sm:max-h-[min(650px,calc(100vh-3.5rem))]"
          )}
        >
          {/* Mobile Pull Indicator */}
          <div className="pt-2 pb-1 sm:hidden flex justify-center shrink-0">
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          </div>

          {/* Neon Signature Top Beam */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shrink-0" />

          {/* Header Bar */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214]/90 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                <CopilotEmblem className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                    Examku Copilot
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  Asisten Cepat & Perintah Instan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Expand / Minimize Toggle (Desktop) */}
              <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                title={isExpanded ? "Perkecil panel" : "Perbesar panel"}
                className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              {/* Clear History */}
              <button
                type="button"
                onClick={handleClearHistory}
                title="Bersihkan Percakapan"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {/* Close Window */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup Copilot (Esc)"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4 sm:hidden" />
                <X className="w-4 h-4 hidden sm:block" />
              </button>
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/60 bg-white/60 dark:bg-[#0c0d0e]/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x shrink-0">
            {SUGGESTIONS.map((sug, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => handleSendMessage(sug.prompt)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 hover:bg-emerald-50 dark:bg-neutral-850 dark:hover:bg-emerald-950/40 text-neutral-700 dark:text-neutral-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-neutral-200/60 dark:border-neutral-750 hover:border-emerald-500/30 transition-all shrink-0 whitespace-nowrap cursor-pointer shadow-2xs group"
              >
                <span className="text-xs">{sug.icon}</span>
                <span>{sug.label}</span>
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3.5 sm:p-4 space-y-3.5 overflow-y-auto bg-neutral-50/40 dark:bg-[#0c0d0e]/40 custom-scrollbar">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-sm font-sans shadow-sm leading-relaxed break-words">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[98%] w-full bg-white dark:bg-[#111214] border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl rounded-tl-xs p-3.5 sm:p-4 text-xs sm:text-sm space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CopilotEmblem className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Examku Copilot</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          addToast({ type: "info", title: "Tersalin", description: "Pesan disalin ke clipboard." });
                        }}
                        title="Salin jawaban"
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-0.5 rounded cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <ChatMessageMarkdown
                      content={msg.content}
                      onRunCommand={(cmd) => handleSendMessage(cmd)}
                    />

                    {/* 🌟 0. NEON HELP GUIDE CARD (/help ATAU BANTUAN) */}
                    {msg.action && msg.action.type === "help" && (
                      <CopilotHelpCard
                        payload={msg.action.payload}
                        onRunCommand={(cmd) => handleSendMessage(cmd)}
                        onNavigate={(path) => {
                          navigate(path);
                          setIsOpen(false);
                        }}
                      />
                    )}

                    {/* 🎴 NEON ACTION CARD (JIKA ADA TINDAKAN EKSEKUTIF) */}
                    {msg.action && msg.action.type !== "none" && msg.action.type !== "help" && (
                      <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0d0f11] border border-emerald-500/25 dark:border-emerald-500/40 shadow-[0_2px_15px_rgba(16,185,129,0.1)] space-y-3">
                        {/* Header Tag Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800/80 pb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                            <Zap className="w-3 h-3 text-emerald-500" />
                            {msg.action.type === "create_multiple_exam_rooms" && "Multiple Ruang Ujian Berurutan"}
                            {msg.action.type === "update_exam_room" && "Penyesuaian Jadwal Ruang Ujian"}
                            {msg.action.type === "create_exam_room" && "Konfigurasi Ruang Ujian"}
                            {msg.action.type === "create_bank_soal" && "Buat Bank Soal Baru"}
                            {msg.action.type === "navigate" && "Navigasi Cepat"}
                          </span>
                          {msg.action.executed && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Tersimpan di Server
                            </span>
                          )}
                        </div>

                        {/* 🌟 1. MULTIPLE EXAM ROOMS CONFIGURATOR (PILIHAN BANK SOAL & RUANGAN PIL KOTAK) */}
                        {msg.action.type === "create_multiple_exam_rooms" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-emerald-500" />
                                {msg.action.payload?.rooms?.length || 2} Sesi Ujian Berurutan
                              </span>
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Jeda Antar Sesi: {msg.action.payload?.breakMinutes || 15} Menit
                              </span>
                            </div>

                            {/* Daftar Ruangan Berurutan */}
                            <div className="space-y-2.5">
                              {msg.action.payload?.rooms?.map((room: any, rIdx: number) => {
                                const isEnabled = room.enabled !== false;
                                return (
                                  <div
                                    key={rIdx}
                                    className={cn(
                                      "p-3 rounded-xl border transition-all space-y-2",
                                      isEnabled
                                        ? "bg-white dark:bg-[#111214] border-emerald-500/35 shadow-xs"
                                        : "bg-neutral-100/50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 opacity-60"
                                    )}
                                  >
                                    {/* Baris Atas: Toggle Enable/Disable Pill & Jadwal */}
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-200/60 dark:border-neutral-800">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRoomEnabled(msg.id, rIdx)}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                          isEnabled
                                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                            : "bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-500 line-through"
                                        )}
                                      >
                                        {isEnabled ? (
                                          <>
                                            <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                                            <span>Sesi {rIdx + 1}: Aktif</span>
                                          </>
                                        ) : (
                                          <>
                                            <Square className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Sesi {rIdx + 1}: Nonaktif</span>
                                          </>
                                        )}
                                      </button>

                                      <span className="text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-emerald-500" />
                                        {room.scheduleText?.split("(")[0]?.trim() || room.time}
                                      </span>
                                    </div>

                                    {/* Nama Ruangan & Durasi */}
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[220px]">
                                        {room.roomName}
                                      </span>
                                      <span className="text-[10px] text-neutral-500 font-medium shrink-0">
                                        Durasi: <strong>{room.duration} Menit</strong>
                                      </span>
                                    </div>

                                    {/* Subkomponen Pemilih Bank Soal Bersih & Responsif */}
                                    {isEnabled && (
                                      <RoomBankSoalPicker
                                        roomIndex={rIdx}
                                        room={room}
                                        availableExams={allSchoolExams.length > 0 ? allSchoolExams : msg.action?.payload?.availableExams || []}
                                        onSelectExam={(examId, examTitle) =>
                                          handleSelectRoomExam(msg.id, rIdx, examId, examTitle)
                                        }
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 🌟 2. INTERACTIVE SINGLE EXAM ROOM CONFIGURATOR (NAMA, KAPAN, DURASI, KELAS, BANK SOAL) */}
                        {msg.action.type === "create_exam_room" && (() => {
                          const action = msg.action!;
                          const payload = action.payload || {};
                          return (
                            <div className="space-y-3 pt-1">
                              {/* 1. Nama Ruang Ujian */}
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block tracking-wider">
                                  Nama Ruang Ujian:
                                </label>
                                <input
                                  type="text"
                                  value={payload.roomName || ""}
                                  onChange={(e) => handleUpdateSingleRoom(msg.id, { roomName: e.target.value })}
                                  placeholder="Contoh: Ulangan Harian Informatika XI"
                                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-[#111214] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                                />
                              </div>

                              {/* 2. Kapan (Tanggal & Jam Mulai) */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block tracking-wider">
                                  Kapan (Jadwal Pelaksanaan):
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {["hari ini", "besok", "lusa"].map((d) => {
                                    const isSelected = (payload.date || "besok").toLowerCase() === d;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => handleUpdateSingleRoom(msg.id, { date: d })}
                                        className={cn(
                                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all cursor-pointer",
                                          isSelected
                                            ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
                                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/40"
                                        )}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}

                                  {/* Input Jam */}
                                  <div className="flex items-center gap-1 ml-auto">
                                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                    <input
                                      type="time"
                                      value={payload.time || "08:00"}
                                      onChange={(e) => handleUpdateSingleRoom(msg.id, { time: e.target.value })}
                                      className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-[#111214] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </div>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                  Jadwal: {payload.scheduleText || "Sesuai pilihan"}
                                </p>
                              </div>

                              {/* 3. Durasi Pengerjaan */}
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block tracking-wider">
                                  Durasi Pengerjaan:
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {[45, 60, 90, 120].map((dur) => {
                                    const isSelected = Number(payload.duration || 90) === dur;
                                    return (
                                      <button
                                        key={dur}
                                        type="button"
                                        onClick={() => handleUpdateSingleRoom(msg.id, { duration: dur })}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                                          isSelected
                                            ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
                                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/40"
                                        )}
                                      >
                                        {dur} Menit
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 4. Target Kelas Peserta */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block tracking-wider">
                                    Target Kelas Peserta:
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateSingleRoom(msg.id, {
                                        allClasses: !payload.allClasses,
                                        classIds: payload.allClasses ? [] : payload.classIds || []
                                      })
                                    }
                                    className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                  >
                                    {payload.allClasses !== false ? "Ubah ke Kelas Tertentu" : "Pilih Semua Kelas"}
                                  </button>
                                </div>

                                {payload.allClasses !== false ? (
                                  <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                                    <Users className="w-4 h-4 shrink-0 text-blue-500" />
                                    <span className="font-medium text-[11px]">
                                      👥 <strong>Semua Kelas</strong> dapat mengakses ruang ujian ini.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="p-1.5 max-h-24 overflow-y-auto custom-scrollbar flex flex-wrap gap-1 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800">
                                      {(allSchoolClasses.length > 0 ? allSchoolClasses : payload.availableClasses || []).map((cls: any) => {
                                        const isSelected = (payload.classIds || []).includes(cls.id);
                                        return (
                                          <button
                                            key={cls.id}
                                            type="button"
                                            onClick={() => handleToggleSingleRoomClass(msg.id, cls.id)}
                                            className={cn(
                                              "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1",
                                              isSelected
                                                ? "bg-emerald-600 text-white font-bold shadow-xs border border-emerald-500"
                                                : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-750 hover:border-emerald-500/40"
                                            )}
                                          >
                                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                                            <span>{cls.name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <span className="text-[10px] text-neutral-400 italic">
                                      {(payload.classIds || []).length} kelas terpilih
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 5. Pemilih Bank Soal */}
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block tracking-wider">
                                  Paket Bank Soal:
                                </label>
                                <RoomBankSoalPicker
                                  room={{
                                    roomName: payload.roomName,
                                    subject: payload.examTitle,
                                    examId: payload.examId,
                                    examTitle: payload.examTitle
                                  }}
                                  availableExams={allSchoolExams.length > 0 ? allSchoolExams : payload.availableExams || []}
                                  onSelectExam={(examId, examTitle) =>
                                    handleUpdateSingleRoom(msg.id, { examId, examTitle })
                                  }
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Parameter Grid: Update Exam Room */}
                        {msg.action.type === "update_exam_room" && (
                          <div className="space-y-2.5">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                              {msg.action.payload?.roomName || "Ruang Ujian"}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/25 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                                    Jadwal Pelaksanaan
                                  </span>
                                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-[11px] truncate block">
                                    {msg.action.payload?.changeSummary ||
                                      resolveExamSchedule({
                                        date: msg.action.payload?.date,
                                        time: msg.action.payload?.time,
                                        duration: msg.action.payload?.duration
                                      }).formattedSchedule}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-750 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                                    Durasi Pengerjaan
                                  </span>
                                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-[11px] block">
                                    {msg.action.payload?.duration || 120} Menit
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parameter Grid: Create Bank Soal */}
                        {msg.action.type === "create_bank_soal" && (
                          <div className="space-y-2.5">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                              📚 {msg.action.payload?.title || "Bank Soal Baru"}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 font-medium border border-neutral-200/70 dark:border-neutral-750">
                                Mapel: <strong>{msg.action.payload?.subject || "Umum"}</strong>
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 font-medium border border-neutral-200/70 dark:border-neutral-750">
                                Tipe: <strong>{msg.action.payload?.examType || "Ulangan"}</strong>
                              </span>
                              {msg.action.payload?.questions && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-500/25">
                                  Soal Siap: <strong>{msg.action.payload.questions.length} Butir</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Parameter Grid: Navigate */}
                        {msg.action.type === "navigate" && (
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100">
                              🧭 {msg.action.payload?.label || "Buka Halaman"}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                              {msg.action.payload?.path}
                            </p>
                          </div>
                        )}

                        {/* Status Hasil Eksekusi / Tombol Eksekusi Neon */}
                        {msg.action.executed ? (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                            <span className="flex items-center gap-2 font-medium leading-relaxed whitespace-pre-line min-w-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 self-start mt-0.5" />
                              <span className="truncate">{msg.action.resultMessage || "Tindakan berhasil diterapkan!"}</span>
                            </span>
                            {(msg.action.type === "create_exam_room" ||
                              msg.action.type === "create_multiple_exam_rooms" ||
                              msg.action.type === "update_exam_room") && (
                                <NeonButton
                                  size="xs"
                                  variant="outline"
                                  color="brand"
                                  onClick={() => {
                                    navigate("/admin/monitoring");
                                    setIsOpen(false);
                                  }}
                                >
                                  Pantau ↗
                                </NeonButton>
                              )}
                            {msg.action.type === "create_bank_soal" && (
                              <NeonButton
                                size="xs"
                                variant="outline"
                                color="brand"
                                onClick={() => {
                                  navigate("/admin/bank-soal/questions");
                                  setIsOpen(false);
                                }}
                              >
                                Kelola Soal ↗
                              </NeonButton>
                            )}
                          </div>
                        ) : (
                          <div className="pt-1">
                            <NeonButton
                              variant="primary"
                              size="md"
                              color="brand"
                              className="w-full justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] min-w-0 font-semibold text-xs sm:text-sm py-2 px-3"
                              loading={executingActionId === msg.id}
                              onClick={() => handleExecuteAction(msg.id, msg.action!)}
                            >
                              <span className="flex items-center justify-center gap-1.5 truncate">
                                {msg.action.type === "create_multiple_exam_rooms" && (
                                  <>
                                    <Layers className="w-4 h-4 text-emerald-200" />
                                    <span>
                                      Buka {(msg.action?.payload?.rooms || []).filter((r: any) => r.enabled !== false).length} Ruang Ujian Sekarang
                                    </span>
                                  </>
                                )}
                                {msg.action.type === "update_exam_room" && (
                                  <>
                                    <Zap className="w-4 h-4 text-emerald-200" />
                                    <span>Simpan Perubahan Jadwal</span>
                                  </>
                                )}
                                {msg.action.type === "create_exam_room" && (
                                  <>
                                    <Zap className="w-4 h-4 text-emerald-200" />
                                    <span>Buka Ruang Ujian Sekarang</span>
                                  </>
                                )}
                                {msg.action.type === "create_bank_soal" && (
                                  <>
                                    <BookOpen className="w-4 h-4 text-emerald-200" />
                                    <span>Buat Bank Soal Baru ↗</span>
                                  </>
                                )}
                                {msg.action.type === "navigate" && (
                                  <>
                                    <Compass className="w-4 h-4 text-emerald-200" />
                                    <span>Buka {msg.action.payload?.label || "Halaman"} ↗</span>
                                  </>
                                )}
                              </span>
                            </NeonButton>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#111214] border border-neutral-200/70 dark:border-neutral-800/80 w-fit text-xs text-neutral-500 dark:text-neutral-400 shadow-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>Memproses perintah Anda...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-3 sm:p-3.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-[#111214]/80 shrink-0 relative">
            {/* ⚡ Command Autocomplete Palette (Muncul saat mengetik '/') */}
            {isCommandInput && filteredCommands.length > 0 && (
              <div className="absolute bottom-full mb-2 left-3 right-3 sm:left-3.5 sm:right-3.5 p-2 rounded-2xl bg-white/95 dark:bg-[#111214]/95 backdrop-blur-xl border border-emerald-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.4)] z-30 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    Command Instan (Tanpa AI)
                  </span>
                  <span className="text-[10px] text-neutral-400">Pilih template</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {filteredCommands.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInput(item.example);
                        textareaRef.current?.focus();
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-500/30 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {item.cmd}
                          </span>
                          <span className="text-[11px] text-neutral-400 truncate">
                            {item.syntax.replace(item.cmd, "")}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {item.desc}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Pilih ↵
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                disabled={isLoading}
                placeholder="Ketik '/' untuk daftar command ..."
                className="flex-1 min-h-[40px] max-h-[100px] px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none shadow-xs"
              />
              <NeonButton
                type="submit"
                variant="primary"
                size="md"
                color="brand"
                iconOnly
                disabled={!input.trim() || isLoading}
                aria-label="Kirim Perintah"
                className="shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0"
              >
                <Send className="w-4 h-4" />
              </NeonButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminAICopilot;
