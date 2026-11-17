import React, { useState } from "react";
import { GripVertical, ArrowLeft, Trash, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { QuestionPair } from "./types";

export interface MatchingEditorProps {
  pairs: QuestionPair[];
  onChangePairs: (pairs: QuestionPair[]) => void;
}

export const MatchingEditor: React.FC<MatchingEditorProps> = ({
  pairs = [],
  onChangePairs,
}) => {
  const [canDrag, setCanDrag] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handlePairChange = (id: string, field: "left" | "right", value: string) => {
    const updated = pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    onChangePairs(updated);
  };

  const handleRemovePair = (id: string) => {
    if (pairs.length <= 1) return;
    const updated = pairs.filter((p) => p.id !== id);
    onChangePairs(updated);
  };

  const handleAddPair = () => {
    const newId = Date.now().toString();
    onChangePairs([...pairs, { id: newId, left: "", right: "" }]);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 px-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Pernyataan (Kiri)
        </span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Pasangan (Kanan)
        </span>
      </div>

      <div className="space-y-2.5">
        {pairs.map((pair, index) => (
          <div
            key={pair.id}
            draggable={canDrag}
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedIndex === null || draggedIndex === index) return;
              const newPairs = [...pairs];
              const temp = newPairs[draggedIndex];
              newPairs[draggedIndex] = newPairs[index];
              newPairs[index] = temp;
              onChangePairs(newPairs);
              setDraggedIndex(null);
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setCanDrag(false);
            }}
            className="flex gap-2.5 items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            <div
              onMouseEnter={() => setCanDrag(true)}
              onMouseLeave={() => setCanDrag(false)}
              className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500"
              title="Tahan dan geser untuk ubah urutan"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <Input
              placeholder="Teks pernyataan kiri..."
              value={pair.left}
              onChange={(e) => handlePairChange(pair.id, "left", e.target.value)}
              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />

            <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400 shrink-0" />

            <Input
              placeholder="Teks pasangan kanan..."
              value={pair.right}
              onChange={(e) => handlePairChange(pair.id, "right", e.target.value)}
              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemovePair(pair.id)}
              className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl shrink-0 cursor-pointer"
              disabled={pairs.length <= 1}
              title="Hapus pasangan"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddPair}
        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Pasangan
      </Button>
    </div>
  );
};

export default MatchingEditor;
