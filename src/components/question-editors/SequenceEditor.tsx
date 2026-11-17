import React, { useState } from "react";
import { GripVertical, Trash, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { QuestionItem } from "./types";

export interface SequenceEditorProps {
  type: "urutkan" | "drag_drop";
  items: QuestionItem[];
  onChangeItems: (items: QuestionItem[]) => void;
}

export const SequenceEditor: React.FC<SequenceEditorProps> = ({
  items = [],
  onChangeItems,
}) => {
  const [canDrag, setCanDrag] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleItemTextChange = (id: string, text: string) => {
    const updated = items.map((it) => (it.id === id ? { ...it, text } : it));
    onChangeItems(updated);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    const updated = items.filter((it) => it.id !== id);
    onChangeItems(updated);
  };

  const handleAddItem = () => {
    const newId = Date.now().toString();
    onChangeItems([...items, { id: newId, text: "" }]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-indigo-700 dark:text-indigo-300 p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
        Ketik item di bawah ini dalam <strong>URUTAN YANG BENAR</strong>. Sistem akan mengacak urutannya saat lembar ujian dibuka oleh siswa.
      </p>

      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable={canDrag}
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedIndex === null || draggedIndex === index) return;
              const newItems = [...items];
              const temp = newItems[draggedIndex];
              newItems[draggedIndex] = newItems[index];
              newItems[index] = temp;
              onChangeItems(newItems);
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

            <div className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
              {index + 1}
            </div>

            <Input
              placeholder={`Item ke-${index + 1}...`}
              value={item.text}
              onChange={(e) => handleItemTextChange(item.id, e.target.value)}
              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveItem(item.id)}
              className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl shrink-0 cursor-pointer"
              disabled={items.length <= 1}
              title="Hapus item"
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
        onClick={handleAddItem}
        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Item
      </Button>
    </div>
  );
};

export default SequenceEditor;
