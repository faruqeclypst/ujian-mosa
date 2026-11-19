import React from "react";
import { cn } from "../../../../lib/utils";
import { NeonTableColumn } from "../../../../components/ui/NeonTable";
import { MathText } from "../../../../components/ui/MathText";
import { NeonBadge } from "../../../../components/ui/NeonBadge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from "../../../../components/ui/tooltip";
import { BookOpen, Search, Edit, Trash, FileSpreadsheet, Image } from "lucide-react";
import { QuestionData, QUESTION_TYPE_BADGE, QUESTION_TYPE_LABELS } from "../types";
import { QuestionDetailsView } from "./QuestionDetailsView";

export interface QuestionColumnsOptions {
  questions: QuestionData[];
  inspectedQuestion?: QuestionData | null;
  canEdit?: boolean;
  onPreview: (item: QuestionData, index: number) => void;
  onEdit: (item: QuestionData) => void;
  onDelete: (item: QuestionData) => void;
}

export function getQuestionColumns({
  questions,
  inspectedQuestion,
  canEdit,
  onPreview,
  onEdit,
  onDelete
}: QuestionColumnsOptions): NeonTableColumn<QuestionData>[] {
  return [
    {
      key: "no",
      header: "#",
      width: "36px",
      align: "center",
      className: "w-9 text-center shrink-0",
      headerClassName: "w-9 text-center shrink-0",
      render: (item, index) => {
        const isInspected = inspectedQuestion?.id === item.id;
        return (
          <div className="flex items-center justify-center">
            <span
              className={cn(
                "h-6 min-w-6 px-1.5 rounded-md font-mono text-xs font-bold flex items-center justify-center transition-all",
                isInspected
                  ? "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.6)] scale-105"
                  : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-800 dark:group-hover:text-neutral-200"
              )}
            >
              {index + 1}
            </span>
          </div>
        );
      }
    },
    {
      key: "text",
      header: "Teks Pertanyaan & Stimulus",
      className: "min-w-0 max-w-full break-words",
      headerClassName: "min-w-0",
      render: (item) => (
        <div className="space-y-1.5 py-0.5 min-w-0 max-w-full overflow-hidden">
          {/* Question Text & Embedded Table/Image Wrapper (Max height capped to prevent giant rows) */}
          <div className="relative max-h-24 sm:max-h-28 overflow-hidden rounded-md group/math">
            <MathText
              content={item.text}
              className="text-xs sm:text-[13px] font-serif text-neutral-900 dark:text-neutral-100 leading-relaxed ql-editor !p-0 [&_p]:m-0 [&_figure]:m-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_img]:!max-h-20 sm:[&_img]:!max-h-24 [&_img]:!max-w-[140px] sm:[&_img]:!max-w-[180px] [&_img]:!w-auto [&_img]:!h-auto [&_img]:object-contain [&_img]:rounded-md [&_img]:border [&_img]:border-neutral-200/80 [&_img]:dark:border-neutral-800 [&_img]:my-1 [&_img]:block [&_table]:!text-[10px] [&_table]:!leading-tight [&_table]:!my-1 [&_table]:!max-w-full [&_table]:!border-collapse [&_td]:!p-0.5 [&_td]:!px-2 [&_th]:!p-0.5 [&_th]:!px-2 [&_td]:!text-[10px] [&_th]:!text-[10px] [&_td]:!border [&_td]:!border-neutral-200 dark:[&_td]:!border-neutral-750 [&_th]:!border [&_th]:!border-neutral-200 dark:[&_th]:!border-neutral-750 [&_th]:!bg-neutral-50 dark:[&_th]:!bg-neutral-850 [&_.ql-table-embed]:!my-0.5 [&_.ql-table-embed]:!p-0 [&_.ql-table-embed]:!border-none [&_.ql-table-embed]:!bg-transparent shadow-2xs"
            />

          </div>

          {/* Standalone Image Thumbnail (if question has item.imageUrl not embedded in text) */}
          {item.imageUrl && !item.text?.includes("<img") && (
            <img
              src={item.imageUrl}
              alt="Gambar Soal"
              className="max-h-16 sm:max-h-20 max-w-[140px] sm:max-w-[180px] w-auto h-auto object-contain rounded-md border border-neutral-200/80 dark:border-neutral-800 my-1 block shadow-2xs"
            />
          )}

          {/* Badges Metadata Line */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {item.text?.includes("<table") && (
              <NeonBadge variant="neutral" size="xs" icon={FileSpreadsheet}>
                Tabel Data
              </NeonBadge>
            )}
            {(item.imageUrl || item.text.includes("<img")) && (
              <NeonBadge variant="sky" size="xs" icon={Image}>
                Bergambar
              </NeonBadge>
            )}
            {item.groupId && (() => {
              const firstMainInGroup = questions.find(q => q.groupId === item.groupId && Boolean(q.groupText)) || questions.find(q => q.groupId === item.groupId);
              const isMainWacana = firstMainInGroup ? firstMainInGroup.id === item.id : false;
              const stimulusText = item.groupText || firstMainInGroup?.groupText || "";
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex min-w-0 shrink-0">
                      <NeonBadge
                        variant="amber"
                        size="xs"
                        icon={BookOpen}
                        className="max-w-[190px] xs:max-w-[260px] sm:max-w-[340px] md:max-w-[420px] min-w-0 shrink-0 cursor-pointer transition-all duration-200 hover:border-amber-400 dark:hover:border-amber-400 hover:shadow-[0_0_10px_rgba(245,158,11,0.25)] hover:bg-amber-500/15"
                      >
                        <span className="truncate min-w-0 font-medium">Paket: {item.groupId}</span>
                        {isMainWacana && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/40 text-[9px] font-bold uppercase tracking-wider shrink-0 leading-none">
                            Main
                          </span>
                        )}
                      </NeonBadge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="z-[110] max-w-sm sm:max-w-md p-3.5 bg-white dark:bg-neutral-900 border border-amber-200/90 dark:border-amber-800/70 rounded-xl shadow-xl shadow-amber-500/5 dark:shadow-none space-y-2.5 text-left text-neutral-900 dark:text-neutral-100"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tracking-tight">
                          Paket Stimulus (Literasi / AKM)
                        </span>
                      </div>
                      {isMainWacana ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Main
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shrink-0">
                          Terhubung
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-neutral-500 dark:text-neutral-400 font-medium">ID Paket:</span>
                        <code className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 break-all">
                          {item.groupId}
                        </code>
                      </div>

                      {stimulusText ? (
                        <div className="space-y-1.5 pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block">
                            Teks Stimulus:
                          </span>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 font-serif leading-relaxed line-clamp-4 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                            {stimulusText.replace(/<[^>]*>/g, '')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic pt-1">
                          Soal ini menggunakan stimulus bersama dari induk paket literasi "{item.groupId}".
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })()}
            {/* Mobile Type Badge */}
            <span className="sm:hidden">
              <NeonBadge
                variant={(QUESTION_TYPE_BADGE[item.type || "pilihan_ganda"]?.variant) || "neutral"}
                size="xs"
              >
                {QUESTION_TYPE_LABELS[item.type || "pilihan_ganda"] || item.type}
              </NeonBadge>
            </span>
          </div>
        </div>
      )
    },
    {
      key: "details",
      header: "Detail",
      width: "145px",
      className: "hidden sm:table-cell w-[145px] shrink-0",
      headerClassName: "hidden sm:table-cell w-[145px] shrink-0",
      render: (item) => <QuestionDetailsView item={item} showTypeBadge={true} />
    },
    {
      key: "actions",
      header: "Aksi",
      width: "100px",
      overflow: "visible",
      className: "w-[100px] text-right shrink-0 !px-2 overflow-visible",
      headerClassName: "w-[100px] text-right shrink-0 !px-2",
      align: "right",
      render: (item) => {
        const idx = questions.findIndex(q => q.id === item.id);
        return (
          <div className="flex justify-end items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Quick Action: Pratinjau */}
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item, idx >= 0 ? idx : 0);
              }}
              title="Pratinjau Soal"
              aria-label="Pratinjau Soal"
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            {/* Quick Action: Edit */}
            {canEdit && (
              <button
                type="button"
                className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
                onClick={() => onEdit(item)}
                title="Edit Soal"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Quick Action: Hapus */}
            {canEdit && (
              <button
                type="button"
                className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-colors shadow-2xs cursor-pointer shrink-0"
                onClick={() => onDelete(item)}
                title="Hapus Soal"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      }
    }
  ];
}
