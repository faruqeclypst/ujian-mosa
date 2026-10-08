import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, FileText } from "lucide-react";
import { Dialog, DialogPortal, DialogTitle } from "./ui/dialog";

/** True bila URL bukti adalah gambar (bukan PDF). */
export const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
};

/**
 * Penampil bukti pembayaran memakai sistem Dialog tema: portal ke
 * document.body, tutup via Escape dan klik overlay (bawaan Radix).
 * Overlay terang, header solid berisi judul dan tombol "Tutup" berlabel jelas.
 */
export function ProofLightbox({
  url,
  title,
  onClose,
  actions,
}: {
  url: string;
  title?: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  const isImage = isImageProof(url);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-slate-200/85 backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[200] w-[calc(100vw-2rem)] max-w-4xl max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl outline-none">
          <DialogTitle className="sr-only">{title || "Bukti Pembayaran"}</DialogTitle>

          {/* Header: solid, kontrol selalu terlihat */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {title || "Bukti Pembayaran"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Klik area abu-abu di luar gambar atau tekan Esc untuk menutup
                </p>
              </div>
            </div>
            <DialogPrimitive.Close className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition shrink-0">
              <X size={16} />
              Tutup
            </DialogPrimitive.Close>
          </div>

          {/* Isi: kartu putih berbingkai, selalu utuh terlihat */}
          <div className="flex-1 min-h-0 overflow-auto bg-slate-100 p-4 sm:p-6">
            {isImage ? (
              <img
                src={url}
                alt={title || "Bukti pembayaran"}
                className="mx-auto max-h-[calc(100vh-300px)] w-auto max-w-full object-contain rounded-xl border border-slate-300 bg-white shadow-lg"
              />
            ) : (
              <iframe
                src={url}
                title={title || "Bukti pembayaran"}
                className="w-full h-[calc(100vh-300px)] min-h-[320px] rounded-xl border border-slate-300 bg-white shadow-lg"
              />
            )}
          </div>

          {/* Aksi opsional */}
          {actions && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 bg-white border-t border-slate-200 shrink-0">
              {actions}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
