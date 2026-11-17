import React from "react";
import { cn } from "../../../../lib/utils";
import { NeonBadge } from "../../../../components/ui/NeonBadge";
import { QuestionData, QUESTION_TYPE_BADGE } from "../types";

export interface QuestionDetailsViewProps {
  item: QuestionData;
  showTypeBadge?: boolean;
}

export const QuestionDetailsView: React.FC<QuestionDetailsViewProps> = ({
  item,
  showTypeBadge = true,
}) => {
    const qType = item.type || "pilihan_ganda";
    const meta = QUESTION_TYPE_BADGE[qType] || { variant: "neutral" as const, label: qType };

    const renderKeyAndCount = () => {
      if (qType === "benar_salah") {
        const stList = item.statements || item.options?.statements || [];
        if (stList.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <div
                className="flex items-center gap-0.5 flex-wrap cursor-help"
                title={stList.map((s: any, idx: number) => `${idx + 1}. ${s.text ? s.text.replace(/<[^>]*>/g, '').trim() : 'Pernyataan'}: ${(s.answer || 'benar').toUpperCase()}`).join("\n")}
              >
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold mr-0.5">Kunci:</span>
                {stList.slice(0, 5).map((s: any, idx: number) => {
                  const isBenar = (s.answer || "benar").toLowerCase() === "benar";
                  return (
                    <span
                      key={s.id || idx}
                      className={cn(
                        "inline-flex items-center justify-center px-1 py-0.2 rounded text-[10px] font-bold font-mono",
                        isBenar
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                      )}
                    >
                      {idx + 1}:{isBenar ? "B" : "S"}
                    </span>
                  );
                })}
                {stList.length > 5 && <span className="text-[9px] text-neutral-400 font-mono">+{stList.length - 5}</span>}
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                {stList.length} Pernyataan
              </span>
            </div>
          );
        }

        const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
        const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
        if (keys.length > 0) {
          const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              {correctKeys ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 truncate max-w-full shadow-2xs">
                  Kunci: {correctKeys}
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Belum ada kunci
                </span>
              )}
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                {keys.length} Opsi
              </span>
            </div>
          );
        }

        return (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">Belum ada pernyataan</span>
        );
      }

      if (qType === "matriks") {
        const cols = item.options?.columns || [];
        const stList = item.options?.statements || [];
        if (stList.length > 0 || cols.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                {stList.length} × {cols.length} Sel
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                Tabel Matriks
              </span>
            </div>
          );
        }
        return <span className="text-xs text-neutral-400 italic">Belum ada matriks</span>;
      }

      if (qType === "klasifikasi") {
        const cats = item.options?.categories || [];
        const stList = item.options?.statements || [];
        if (stList.length > 0 || cats.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                {stList.length} Baris × {cats.length} Kat.
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                Klasifikasi
              </span>
            </div>
          );
        }
        return <span className="text-xs text-neutral-400 italic">Belum ada data</span>;
      }

      if (qType === "isian_rumpang") {
        const blanks = item.options?.blanks || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {blanks.length} Isian Rumpang
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Teks Rumpang
            </span>
          </div>
        );
      }

      if (qType === "hotspot") {
        const areas = item.options?.areas || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              {areas.length} Area Hotspot
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Titik Gambar
            </span>
          </div>
        );
      }

      if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") {
        const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
        const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
        const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");

        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            {correctKeys ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 truncate max-w-full shadow-2xs">
                Kunci: {correctKeys}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Belum ada kunci
              </span>
            )}
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              {keys.length} Opsi
            </span>
          </div>
        );
      }

      if (qType === "menjodohkan") {
        const pairs = item.pairs || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
              {pairs.length} Pasangan
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Mencocokkan
            </span>
          </div>
        );
      }

      if (qType === "isian_singkat" || qType === "uraian") {
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 truncate max-w-[130px]" title={item.answerKey || "-"}>
              {item.answerKey ? `Kunci: ${item.answerKey}` : "(Rubrik Esai)"}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              {qType === "uraian" ? "Jawaban Uraian" : "Isian Singkat"}
            </span>
          </div>
        );
      }

      if (qType === "urutkan" || qType === "drag_drop") {
        const items = item.items || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
              {items.length} Tahapan
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Urutan Kronologis
            </span>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="flex flex-col items-start gap-1.5 min-w-0">
        {showTypeBadge && (
          <NeonBadge variant={meta.variant} size="xs" className="shrink-0 font-medium">
            {meta.label}
          </NeonBadge>
        )}
        {renderKeyAndCount()}
      </div>
    );
};
