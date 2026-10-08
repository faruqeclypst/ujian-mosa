import { X, FileText } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/** True bila URL bukti adalah gambar (bukan PDF). */
export const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
};

/**
 * Lightbox bukti pembayaran memakai komponen Dialog tema
 * (portal otomatis ke document.body, Escape, klik overlay, dan
 * animasi bawaan — sama seperti modal di halaman lain).
 * Mendukung dark mode penuh.
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
      <DialogContent hideClose className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </span>
              <span className="truncate">{title || "Bukti Pembayaran"}</span>
            </DialogTitle>
            <DialogClose className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold hover:bg-slate-700 dark:hover:bg-white transition shrink-0">
              <X size={16} />
              Tutup
            </DialogClose>
          </div>
          <DialogDescription>
            Klik area gelap di luar gambar atau tekan Esc untuk menutup
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5 pt-0 overflow-auto">
          {isImage ? (
            <img
              src={url}
              alt={title || "Bukti pembayaran"}
              className="mx-auto max-h-[calc(100vh-300px)] w-auto max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm"
            />
          ) : (
            <iframe
              src={url}
              title={title || "Bukti pembayaran"}
              className="w-full h-[calc(100vh-300px)] min-h-[320px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm"
            />
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
            {actions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
