import React from "react";
import { Input } from "../ui/input";
import { detectRumpangIds, hasUnbalancedRumpang, type IsianRumpangBlank } from "./types";

export interface ClozeEditorProps {
  text: string;
  blanks: IsianRumpangBlank[];
  onChangeText: (text: string) => void;
  onChangeBlanks: (blanks: IsianRumpangBlank[]) => void;
}

export const ClozeEditor: React.FC<ClozeEditorProps> = ({
  text = "",
  blanks = [],
  onChangeText,
  onChangeBlanks,
}) => {
  const handleTextareaChange = (newText: string) => {
    onChangeText(newText);
    const detectedIds = detectRumpangIds(newText);
    const synced = detectedIds.map((id) => {
      const found = blanks.find((b) => b.id === id);
      return found || { id, answersText: "", caseSensitive: false };
    });
    onChangeBlanks(synced);
  };

  const handleBlankAnswerChange = (bIdx: number, answersText: string) => {
    const updated = [...blanks];
    updated[bIdx] = { ...updated[bIdx], answersText };
    onChangeBlanks(updated);
  };

  const handleBlankCaseSensitiveChange = (bIdx: number, caseSensitive: boolean) => {
    const updated = [...blanks];
    updated[bIdx] = { ...updated[bIdx], caseSensitive };
    onChangeBlanks(updated);
  };

  const detectedIds = detectRumpangIds(text);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 flex-wrap gap-1.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Teks Bacaan
          </span>
          <span className="text-xs text-lime-700 dark:text-lime-400 font-semibold bg-lime-50 dark:bg-lime-950/40 px-2.5 py-1 rounded-full border border-lime-200 dark:border-lime-800">
            Tulis [[1]], [[2]] untuk rumpang
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => handleTextareaChange(e.target.value)}
          placeholder="Contoh: Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]]."
          rows={5}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm p-3 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-lime-500/20 focus:border-lime-500 resize-y"
        />
        {hasUnbalancedRumpang(text) && (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2">
            ⚠️ Ada tanda [[ tanpa pasangan ]]. Periksa kembali penulisan rumpang.
          </p>
        )}
        {detectedIds.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
            Terdeteksi{" "}
            <span className="font-bold text-lime-700 dark:text-lime-400">
              {detectedIds.length} rumpang
            </span>
            : {detectedIds.map((id) => `[[${id}]]`).join(", ")}
          </p>
        )}
      </div>

      {blanks.length > 0 && (
        <div className="space-y-2.5">
          <div className="px-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Kunci Jawaban per Rumpang
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pisahkan dengan koma jika ada beberapa jawaban yang diterima (mis. "Rupiah, IDR").
            </p>
          </div>
          <div className="space-y-2.5">
            {blanks.map((b, bIdx) => (
              <div
                key={b.id}
                className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-lime-100 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 text-xs font-black border border-lime-200 dark:border-lime-800/40 font-mono">
                  [[{b.id}]]
                </span>
                <Input
                  placeholder={`Jawaban benar untuk [[${b.id}]]...`}
                  value={b.answersText}
                  onChange={(e) => handleBlankAnswerChange(bIdx, e.target.value)}
                  className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none px-1">
                  <input
                    type="checkbox"
                    checked={!!b.caseSensitive}
                    onChange={(e) => handleBlankCaseSensitiveChange(bIdx, e.target.checked)}
                    className="w-4 h-4 rounded accent-lime-600 cursor-pointer"
                  />
                  <span
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap"
                    title="Bedakan huruf besar/kecil"
                  >
                    Case-sensitive
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClozeEditor;
