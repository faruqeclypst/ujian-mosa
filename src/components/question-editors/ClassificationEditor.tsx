import React from "react";
import { Plus, X, Trash } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { KlasifikasiCategory, KlasifikasiStatement } from "./types";

export interface ClassificationEditorProps {
  categories: KlasifikasiCategory[];
  statements: KlasifikasiStatement[];
  shuffle?: boolean;
  onChangeCategories: (categories: KlasifikasiCategory[]) => void;
  onChangeStatements: (statements: KlasifikasiStatement[]) => void;
  onChangeShuffle?: (shuffle: boolean) => void;
}

export const ClassificationEditor: React.FC<ClassificationEditorProps> = ({
  categories = [],
  statements = [],
  shuffle = false,
  onChangeCategories,
  onChangeStatements,
  onChangeShuffle,
}) => {
  const handleCategoryTextChange = (cIdx: number, text: string) => {
    const updated = [...categories];
    updated[cIdx] = { ...updated[cIdx], text };
    onChangeCategories(updated);
  };

  const handleRemoveCategory = (cIdx: number) => {
    if (categories.length <= 2) return;
    const updated = categories.filter((_, i) => i !== cIdx);
    onChangeCategories(updated);
  };

  const handleAddCategory = () => {
    const newId = `k${Date.now().toString(36)}`;
    onChangeCategories([...categories, { id: newId, text: "" }]);
  };

  const handleStatementTextChange = (index: number, text: string) => {
    const updated = [...statements];
    updated[index] = { ...updated[index], text };
    onChangeStatements(updated);
  };

  const handleStatementAnswerChange = (index: number, answer: string) => {
    const updated = [...statements];
    updated[index] = { ...updated[index], answer };
    onChangeStatements(updated);
  };

  const handleRemoveStatement = (index: number) => {
    if (statements.length <= 1) return;
    const updated = statements.filter((_, i) => i !== index);
    onChangeStatements(updated);
  };

  const handleAddStatement = () => {
    const newId = `s${Date.now().toString(36)}`;
    const firstCatId = categories[0]?.id || "";
    onChangeStatements([...statements, { id: newId, text: "", answer: firstCatId }]);
  };

  return (
    <div className="space-y-4">
      {/* Editor Kategori */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Kategori (boleh dipakai berulang)
          </span>
          <span className="text-xs text-violet-700 dark:text-violet-400 font-semibold bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800">
            Min. 2 Kategori
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, cIdx) => (
            <div
              key={cat.id}
              className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <Input
                value={cat.text}
                onChange={(e) => handleCategoryTextChange(cIdx, e.target.value)}
                placeholder={`Kategori ${cIdx + 1}`}
                className="h-8 text-xs w-28 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveCategory(cIdx)}
                disabled={categories.length <= 2}
                className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg inline-flex items-center justify-center cursor-pointer disabled:opacity-30"
                title="Hapus Kategori"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCategory}
            className="h-8 text-xs border-dashed rounded-xl font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 px-3 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Kategori
          </Button>
        </div>
      </div>

      {/* Toggle Acak */}
      {onChangeShuffle && (
        <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!shuffle}
            onChange={(e) => onChangeShuffle(e.target.checked)}
            className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Acak urutan pernyataan saat ujian
          </span>
        </label>
      )}

      {/* Editor Pernyataan */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Daftar Pernyataan & Kategori Benar
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
                  onChange={(e) => handleStatementTextChange(index, e.target.value)}
                  className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <select
                  value={st.answer}
                  onChange={(e) => handleStatementAnswerChange(index, e.target.value)}
                  className="h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-2.5 cursor-pointer text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 max-w-[160px]"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.text || `(Kategori ${cat.id})`}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveStatement(index)}
                  className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
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
          onClick={handleAddStatement}
          className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris Pernyataan
        </Button>
      </div>
    </div>
  );
};

export default ClassificationEditor;
