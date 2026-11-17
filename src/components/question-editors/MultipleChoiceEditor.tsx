import React, { useState } from "react";
import ReactQuill from "react-quill";
import { GripVertical, Key, Check, Image, X } from "lucide-react";
import { Button } from "../ui/button";
import { MathText } from "../ui/MathText";
import { autoDetectLatex, type QuestionChoice } from "./types";

export interface MultipleChoiceEditorProps {
  type: "pilihan_ganda" | "pilihan_ganda_kompleks";
  choices: Record<string, QuestionChoice>;
  choiceFiles?: Record<string, File | null>;
  onChangeChoice: (letter: string, field: "text" | "isCorrect" | "imageUrl", value: any) => void;
  onReorderChoices: (newChoices: Record<string, QuestionChoice>) => void;
  onPickChoiceImage: (letter: string) => void;
  onRemoveChoiceImage: (letter: string) => void;
  showPreview?: boolean;
  quillModules?: any;
  quillFormats?: any;
  selectedQuestionId?: string;
}

export const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({
  type,
  choices,
  choiceFiles = {},
  onChangeChoice,
  onReorderChoices,
  onPickChoiceImage,
  onRemoveChoiceImage,
  showPreview = false,
  quillModules,
  quillFormats,
  selectedQuestionId,
}) => {
  const [canDrag, setCanDrag] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const letters = Object.keys(choices);

  const handleKeyToggle = (letter: string) => {
    const isCurrentlyCorrect = !!choices[letter]?.isCorrect;
    if (type === "pilihan_ganda") {
      // Single choice: matikan semua pilihan lain, nyalakan yang diklik jika belum benar
      letters.forEach((l) => {
        onChangeChoice(l, "isCorrect", l === letter ? !isCurrentlyCorrect : false);
      });
    } else {
      // Multiple choice: toggle individual
      onChangeChoice(letter, "isCorrect", !isCurrentlyCorrect);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {type === "pilihan_ganda"
          ? "Pilih tepat satu opsi sebagai KUNCI jawaban benar."
          : "Pilihan Ganda Kompleks: Anda dapat mencentang lebih dari satu opsi sebagai KUNCI jawaban benar."}
      </p>

      {letters.map((letter, index) => {
        const choice = choices[letter] || { text: "", isCorrect: false };
        const isCorrect = !!choice.isCorrect;
        const file = choiceFiles[letter];
        const hasImage = !!file || !!choice.imageUrl;
        const imageUrl = file ? URL.createObjectURL(file) : choice.imageUrl;

        return (
          <div
            key={letter}
            draggable={canDrag}
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedIndex === null || draggedIndex === index) return;
              const letterKeys = ['a', 'b', 'c', 'd', 'e'];
              const oldLetter = letterKeys[draggedIndex] || letters[draggedIndex];
              const newLetter = letterKeys[index] || letters[index];

              const updatedChoices = { ...choices };
              const temp = updatedChoices[oldLetter];
              updatedChoices[oldLetter] = updatedChoices[newLetter];
              updatedChoices[newLetter] = temp;

              onReorderChoices(updatedChoices);
              setDraggedIndex(null);
            }}
            className={`p-3 sm:p-3.5 border rounded-xl transition-all relative ${
              isCorrect
                ? "bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800/60 shadow-xs"
                : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              {/* Drag handle & Letter badge */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-1.5">
                <div
                  onMouseEnter={() => setCanDrag(true)}
                  onMouseLeave={() => setCanDrag(false)}
                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                  title="Tahan dan geser untuk ubah urutan opsi"
                >
                  <GripVertical className="h-4 w-4" />
                </div>

                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center transition-colors shadow-2xs ${
                    isCorrect
                      ? "bg-emerald-600 text-white shadow-emerald-600/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {letter.toUpperCase()}
                </div>
              </div>

              {/* ReactQuill Editor Opsi */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 min-w-0 overflow-hidden shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10">
                <ReactQuill
                  key={selectedQuestionId ? `edit-${selectedQuestionId}-${letter}` : `create-${letter}`}
                  theme="snow"
                  value={choice.text}
                  onChange={(content, _delta, source) => {
                    if (source !== "user") return;
                    onChangeChoice(letter, "text", content);
                  }}
                  placeholder={`Jawaban opsi ${letter.toUpperCase()} ...`}
                  modules={quillModules}
                  formats={quillFormats}
                  className="[&_.ql-editor]:min-h-[76px] sm:[&_.ql-editor]:min-h-[84px] [&_.ql-editor]:py-3 [&_.ql-editor]:px-3.5 [&_.ql-editor]:text-sm sm:[&_.ql-editor]:text-[15px] [&_.ql-editor]:leading-relaxed [&_.ql-editor]:text-left [&_.ql-editor_p]:!text-left [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-3 [&_.ql-toolbar]:py-1.5 [&_.ql-toolbar]:bg-slate-50/70 dark:[&_.ql-toolbar]:bg-slate-800/60"
                />

                {/* Pratinjau Opsi jika showPreview aktif */}
                {showPreview && choice.text && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
                    <MathText
                      content={autoDetectLatex(choice.text)}
                      disableJustify={true}
                      className="text-xs sm:text-sm font-serif ql-editor !p-0 cbt-choice-text text-left text-slate-700 dark:text-slate-300"
                    />
                  </div>
                )}
              </div>

              {/* 1 Kolom 2 Baris: Kunci di atas, Gambar di bawah */}
              <div className="flex flex-col gap-2 shrink-0 w-24 sm:w-28 pt-0.5">
                {/* Baris 1: KUNCI */}
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-9 w-full text-xs font-bold rounded-lg transition-all border flex items-center justify-center gap-1.5 select-none active:scale-95 shadow-xs ${
                    isCorrect
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:border-emerald-500 shadow-emerald-500/20"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 hover:border-emerald-400"
                  }`}
                  size="sm"
                  onClick={() => handleKeyToggle(letter)}
                  title="Jadikan sebagai kunci jawaban benar"
                >
                  {isCorrect ? (
                    <>
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>KUNCI</span>
                    </>
                  ) : (
                    <>
                      <Key className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      <span>Kunci</span>
                    </>
                  )}
                </Button>

                {/* Baris 2: GAMBAR */}
                <button
                  type="button"
                  className={`h-9 w-full text-xs font-semibold rounded-lg transition-all border flex items-center justify-center gap-1.5 select-none active:scale-95 shadow-xs ${
                    hasImage
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/40"
                      : "bg-white hover:bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                  }`}
                  onClick={() => onPickChoiceImage(letter)}
                  title="Tambah atau ubah gambar opsi"
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>{hasImage ? "Ganti" : "Gambar"}</span>
                </button>
              </div>
            </div>

            {/* Image Thumbnail if attached */}
            {hasImage && (
              <div className="mt-2.5 pl-11 sm:pl-12 flex items-center gap-2.5">
                <div className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Pratinjau ${letter}`}
                    className="h-14 w-auto max-w-[130px] object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveChoiceImage(letter)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                    title="Hapus gambar opsi"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs text-slate-400">Gambar opsi {letter.toUpperCase()}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MultipleChoiceEditor;
