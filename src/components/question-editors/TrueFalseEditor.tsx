import React from "react";
import { Check, X, Trash, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { QuestionStatement } from "./types";

export interface TrueFalseEditorProps {
  statements: QuestionStatement[];
  onChangeStatements: (statements: QuestionStatement[]) => void;
}

export const TrueFalseEditor: React.FC<TrueFalseEditorProps> = ({
  statements = [],
  onChangeStatements,
}) => {
  const handleTextChange = (index: number, text: string) => {
    const updated = [...statements];
    updated[index] = { ...updated[index], text };
    onChangeStatements(updated);
  };

  const handleAnswerChange = (index: number, answer: "benar" | "salah") => {
    const updated = [...statements];
    updated[index] = { ...updated[index], answer };
    onChangeStatements(updated);
  };

  const handleRemove = (index: number) => {
    if (statements.length <= 1) return;
    const updated = statements.filter((_, i) => i !== index);
    onChangeStatements(updated);
  };

  const handleAdd = () => {
    const maxId = statements.reduce((max: number, s) => {
      const n = parseInt(s.id, 10);
      return !isNaN(n) && n < 1000 && n > max ? n : max;
    }, 0);
    const newId = String(maxId + 1);
    onChangeStatements([...statements, { id: newId, text: "", answer: "benar" }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Daftar Pernyataan & Kunci Jawaban
        </span>
        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          Tabel Matriks ANBK
        </span>
      </div>

      <div className="space-y-2.5">
        {statements.map((st, index) => (
          <div
            key={st.id || index}
            className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            <div className="flex items-center gap-2.5 w-full sm:w-auto sm:flex-1">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                {index + 1}
              </span>
              <Input
                placeholder={`Tuliskan pernyataan ke-${index + 1}...`}
                value={st.text}
                onChange={(e) => handleTextChange(index, e.target.value)}
                className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Kunci Jawaban Benar / Salah (Segmented Pills) */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleAnswerChange(index, "benar")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                  st.answer === "benar"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:border-emerald-500 shadow-emerald-500/20"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500"
                }`}
              >
                <Check
                  className={`w-3.5 h-3.5 stroke-[2.5] ${
                    st.answer === "benar" ? "text-white" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                <span>Benar</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnswerChange(index, "salah")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                  st.answer === "salah"
                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 dark:border-rose-500 shadow-rose-500/20"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500"
                }`}
              >
                <X
                  className={`w-3.5 h-3.5 stroke-[2.5] ${
                    st.answer === "salah" ? "text-white" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                <span>Salah</span>
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 ml-1 rounded-xl cursor-pointer"
                disabled={statements.length <= 1}
                title="Hapus Pernyataan"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris Pernyataan
      </Button>
    </div>
  );
};

export default TrueFalseEditor;
