import { X } from "lucide-react";

/** True bila URL bukti adalah gambar (bukan PDF). */
export const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
};

/**
 * Lightbox fullscreen untuk melihat bukti pembayaran.
 * Klik sekali → gambar langsung tampil besar. PDF di-embed via iframe.
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
    <div
      className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex flex-col p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 mb-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white text-sm font-bold truncate">
          {title || "Bukti Pembayaran"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/25 transition shrink-0"
          title="Tutup"
        >
          <X size={20} />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage ? (
          <img
            src={url}
            alt={title || "Bukti pembayaran"}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white"
          />
        ) : (
          <iframe
            src={url}
            title={title || "Bukti pembayaran"}
            className="w-full h-full max-w-5xl bg-white rounded-xl shadow-2xl"
          />
        )}
      </div>
      {actions && (
        <div
          className="flex flex-wrap justify-center gap-2 mt-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
