import React from "react";
import { Plus, X, Trash } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { MatrixColumn, MatrixStatement } from "./types";

export interface MatrixEditorProps {
  columns: MatrixColumn[];
  statements: MatrixStatement[];
  onChangeColumns: (columns: MatrixColumn[]) => void;
  onChangeStatements: (statements: MatrixStatement[]) => void;
}

export const MatrixEditor: React.FC<MatrixEditorProps> = ({
  columns = [],
  statements = [],
  onChangeColumns,
  onChangeStatements,
}) => {
  const handleColumnTextChange = (cIdx: number, text: string) => {
    const updated = [...columns];
    updated[cIdx] = { ...updated[cIdx], text };
    onChangeColumns(updated);
  };

  const handleRemoveColumn = (cIdx: number) => {
    if (columns.length <= 2) return;
    const updated = columns.filter((_, i) => i !== cIdx);
    onChangeColumns(updated);
  };

  const handleAddColumn = () => {
    const newId = `c${Date.now().toString(36)}`;
    onChangeColumns([...columns, { id: newId, text: "" }]);
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
    const firstColId = columns[0]?.id || "";
    onChangeStatements([...statements, { id: newId, text: "", answer: firstColId }]);
  };

  return (
    <div className="space-y-4">
      {/* Editor Kolom */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Kolom Pilihan
          </span>
          <span className="text-xs text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
            Min. 2 Kolom
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {columns.map((col, cIdx) => (
            <div
              key={col.id}
              className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <Input
                value={col.text}
                onChange={(e) => handleColumnTextChange(cIdx, e.target.value)}
                placeholder={`Kolom ${cIdx + 1}`}
                className="h-8 text-xs w-28 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveColumn(cIdx)}
                disabled={columns.length <= 2}
                className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg inline-flex items-center justify-center cursor-pointer disabled:opacity-30"
                title="Hapus Kolom"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
            className="h-8 text-xs border-dashed rounded-xl font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 px-3 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Kolom
          </Button>
        </div>
      </div>

      {/* Editor Pernyataan */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Daftar Pernyataan & Kunci Jawaban
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
                  className="h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-2.5 cursor-pointer text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.text || `(Kolom ${col.id})`}
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

export default MatrixEditor;
