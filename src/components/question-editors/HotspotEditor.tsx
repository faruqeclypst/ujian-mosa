import React from "react";
import { Image, FolderOpen, Trash } from "lucide-react";
import { Button } from "../ui/button";
import HotspotAreaEditor, { type HotspotArea } from "./HotspotAreaEditor";

export interface HotspotEditorProps {
  hotspotImageUrl?: string;
  hotspotFile?: File | null;
  hotspotMode?: "any" | "all";
  hotspotAreas: HotspotArea[];
  onPickImage: () => void;
  onUploadImage?: () => void;
  onRemoveImage: () => void;
  onChangeMode: (mode: "any" | "all") => void;
  onChangeAreas: (areas: HotspotArea[]) => void;
}

export const HotspotEditor: React.FC<HotspotEditorProps> = ({
  hotspotImageUrl = "",
  hotspotFile = null,
  hotspotMode = "any",
  hotspotAreas = [],
  onPickImage,
  onUploadImage,
  onRemoveImage,
  onChangeMode,
  onChangeAreas,
}) => {
  const currentImageUrl = hotspotFile ? URL.createObjectURL(hotspotFile) : hotspotImageUrl;

  return (
    <div className="space-y-4">
      {/* Upload Gambar */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Gambar Hotspot <span className="text-rose-500">*</span>
          </span>
          <span className="text-xs text-sky-700 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
            Wajib ada
          </span>
        </div>

        {currentImageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            <img
              src={currentImageUrl}
              alt="Gambar hotspot"
              className="w-full h-auto max-h-64 object-contain"
            />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onPickImage}
                className="text-xs h-8 shadow-md cursor-pointer"
              >
                Ganti
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onRemoveImage}
                className="h-8 w-8 shadow-md inline-flex items-center justify-center cursor-pointer"
                title="Hapus gambar"
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onUploadImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUploadImage}
                className="text-xs h-10 px-4 rounded-xl font-semibold cursor-pointer"
              >
                <Image className="w-4 h-4 mr-1.5" /> Upload Gambar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPickImage}
              className="text-xs h-10 px-4 rounded-xl font-semibold cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 mr-1.5" /> Dari Galeri
            </Button>
          </div>
        )}
      </div>

      {/* Mode */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
          Mode Penilaian
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChangeMode("any")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs active:scale-95 cursor-pointer ${
              hotspotMode === "any"
                ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400"
            }`}
          >
            Satu saja
            <span className="block text-xs font-normal opacity-80 mt-0.5">
              Cukup klik salah satu area benar
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("all")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs active:scale-95 cursor-pointer ${
              hotspotMode === "all"
                ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400"
            }`}
          >
            Semua area
            <span className="block text-xs font-normal opacity-80 mt-0.5">
              Harus klik semua area (skor parsial)
            </span>
          </button>
        </div>
      </div>

      {/* Editor Area */}
      {currentImageUrl && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
            Area Target
          </span>
          <HotspotAreaEditor
            imageUrl={currentImageUrl}
            areas={hotspotAreas}
            onChange={onChangeAreas}
          />
        </div>
      )}
    </div>
  );
};

export default HotspotEditor;
