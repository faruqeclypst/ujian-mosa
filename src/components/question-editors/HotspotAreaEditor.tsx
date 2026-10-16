import { useState, useRef, useCallback } from "react";
import { Trash, Plus } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export interface HotspotArea {
  id: string;
  x: number; // % 0-100, kiri atas
  y: number; // % 0-100, kiri atas
  w: number; // % lebar
  h: number; // % tinggi
  label: string;
}

interface Props {
  imageUrl: string;
  areas: HotspotArea[];
  onChange: (areas: HotspotArea[]) => void;
}

// Konversi event pointer ke koordinat % relatif terhadap container
const toPercent = (clientX: number, clientY: number, rect: DOMRect) => ({
  x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
  y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
});

export default function HotspotAreaEditor({ imageUrl, areas, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const startDraw = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = toPercent(clientX, clientY, rect);
    setDrawing({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }, []);

  const moveDraw = useCallback((clientX: number, clientY: number) => {
    if (!drawing) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = toPercent(clientX, clientY, rect);
    setDrawing({ ...drawing, x2: p.x, y2: p.y });
  }, [drawing]);

  const endDraw = useCallback(() => {
    if (!drawing) return;
    const x = Math.min(drawing.x1, drawing.x2);
    const y = Math.min(drawing.y1, drawing.y2);
    const w = Math.abs(drawing.x2 - drawing.x1);
    const h = Math.abs(drawing.y2 - drawing.y1);
    setDrawing(null);
    // Abaikan drag terlalu kecil (kemungkinan klik tidak sengaja)
    if (w < 2 || h < 2) return;
    const newArea: HotspotArea = {
      id: `a${Date.now().toString(36)}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
      label: `Area ${areas.length + 1}`,
    };
    onChange([...areas, newArea]);
    setSelectedId(newArea.id);
  }, [drawing, areas, onChange]);

  const updateArea = (id: string, patch: Partial<HotspotArea>) => {
    onChange(areas.map(a => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeArea = (id: string) => {
    onChange(areas.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = areas.find(a => a.id === selectedId) || null;

  // Rect yang sedang digambar (untuk overlay)
  const drawRect = drawing
    ? {
        x: Math.min(drawing.x1, drawing.x2),
        y: Math.min(drawing.y1, drawing.y2),
        w: Math.abs(drawing.x2 - drawing.x1),
        h: Math.abs(drawing.y2 - drawing.y1),
      }
    : null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <span className="font-bold text-slate-700 dark:text-slate-300">Cara membuat area:</span> klik-tahan lalu
        geser (drag) pada gambar untuk menggambar kotak area. Atau tambah manual lalu atur koordinat (%).
      </p>

      {/* Canvas gambar + overlay area */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 select-none"
        style={{ touchAction: "none", cursor: "crosshair" }}
        onMouseDown={(e) => {
          // Jangan mulai drag jika klik pada area yang sudah ada (untuk pilih)
          if ((e.target as HTMLElement).dataset.areaId) return;
          startDraw(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => moveDraw(e.clientX, e.clientY)}
        onMouseUp={endDraw}
        onMouseLeave={() => setDrawing(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if ((e.target as HTMLElement).dataset.areaId) return;
          startDraw(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          moveDraw(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={endDraw}
      >
        {!imgError ? (
          <img
            src={imageUrl}
            alt="Gambar hotspot"
            className="w-full h-auto block pointer-events-none"
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center text-sm text-rose-600 dark:text-rose-400 font-semibold p-6 text-center">
            Gambar gagal dimuat. Periksa URL gambar.
          </div>
        )}

        {/* Overlay area yang sudah ada */}
        {areas.map((a, idx) => (
          <div
            key={a.id}
            data-area-id={a.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              setSelectedId(a.id);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              setSelectedId(a.id);
            }}
            className={`absolute border-2 rounded-sm flex items-start justify-start transition-colors ${
              selectedId === a.id
                ? "border-amber-400 bg-amber-400/25"
                : "border-emerald-400 bg-emerald-400/20 hover:bg-emerald-400/30"
            }`}
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              width: `${a.w}%`,
              height: `${a.h}%`,
              cursor: "pointer",
            }}
            title={a.label}
          >
            <span
              className={`text-[10px] font-black px-1.5 py-0.5 rounded-br-md ${
                selectedId === a.id ? "bg-amber-400 text-white" : "bg-emerald-500 text-white"
              }`}
            >
              {idx + 1}
            </span>
          </div>
        ))}

        {/* Overlay rect yang sedang digambar */}
        {drawRect && (
          <div
            className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/20 pointer-events-none"
            style={{
              left: `${drawRect.x}%`,
              top: `${drawRect.y}%`,
              width: `${drawRect.w}%`,
              height: `${drawRect.h}%`,
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
          {areas.length} area terdefinisi
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const newArea: HotspotArea = {
              id: `a${Date.now().toString(36)}`,
              x: 10,
              y: 10,
              w: 20,
              h: 20,
              label: `Area ${areas.length + 1}`,
            };
            onChange([...areas, newArea]);
            setSelectedId(newArea.id);
          }}
          className="text-xs h-8 border-dashed rounded-xl font-semibold"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Manual
        </Button>
      </div>

      {/* Daftar area + edit koordinat */}
      {areas.length > 0 && (
        <div className="space-y-2">
          {areas.map((a, idx) => (
            <div
              key={a.id}
              className={`p-3 rounded-xl border shadow-xs space-y-2.5 ${
                selectedId === a.id
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                  : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-md text-[11px] font-black flex items-center justify-center ${
                    selectedId === a.id
                      ? "bg-amber-400 text-white"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {idx + 1}
                </span>
                <Input
                  value={a.label}
                  onChange={(e) => updateArea(a.id, { label: e.target.value })}
                  placeholder="Label area"
                  className="h-8 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArea(a.id)}
                  className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg shrink-0"
                  title="Hapus Area"
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["x", "X (%)"],
                    ["y", "Y (%)"],
                    ["w", "Lebar (%)"],
                    ["h", "Tinggi (%)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={a[key]}
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        updateArea(a.id, { [key]: v } as Partial<HotspotArea>);
                      }}
                      onFocus={() => setSelectedId(a.id)}
                      className="h-8 text-xs mt-0.5 bg-slate-50/50 dark:bg-slate-900"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
