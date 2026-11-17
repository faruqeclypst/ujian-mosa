import React from "react";
import { Input } from "../ui/input";

export interface ShortAnswerEditorProps {
  type: "isian_singkat" | "uraian";
  answerKey: string;
  onChangeAnswerKey: (value: string) => void;
}

export const ShortAnswerEditor: React.FC<ShortAnswerEditorProps> = ({
  type,
  answerKey = "",
  onChangeAnswerKey,
}) => {
  return (
    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
      <label htmlFor="answerKey" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
        {type === "isian_singkat" ? "Kunci Jawaban Tepat" : "Pedoman / Contoh Jawaban Benar"}
      </label>
      <Input
        id="answerKey"
        placeholder={
          type === "isian_singkat"
            ? "Ketikkan kunci jawaban tepat..."
            : "Tulis contoh jawaban/pedoman penilaian di sini..."
        }
        value={answerKey}
        onChange={(e) => onChangeAnswerKey(e.target.value)}
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm h-10 shadow-xs"
      />
      {type === "isian_singkat" && (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          * Siswa harus menjawab identik dengan teks di atas untuk memperoleh nilai otomatis.
        </p>
      )}
      {type === "uraian" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
          * Jenis soal uraian / esai memerlukan koreksi dan penilaian manual oleh Guru di lembar penilaian.
        </p>
      )}
    </div>
  );
};

export default ShortAnswerEditor;
