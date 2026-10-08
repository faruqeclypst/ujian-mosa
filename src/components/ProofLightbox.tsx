import { useEffect } from "react";
import { X, FileText } from "lucide-react";

/** True bila URL bukti adalah gambar (bukan PDF). */
export const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
};

/**
 * Penampil bukti pembayaran: overlay terang, header solid berisi judul
 * dan tombol "Tutup" berlabel jelas. Gambar/dokumen tampil dalam kartu
 * putih berbingkai agar tetap terbaca di atas overlay terang.
 * Ditutup via tombol Tutup, klik overlay, atau tombol Escape.
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isImage = isImageProof(url);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-slate-200/85 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Bukti pembayaran"}
    >
      {/* Header: solid, kontrol selalu terlihat */}
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
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
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition shrink-0"
        >
          <X size={16} />
          Tutup
        </button>
      </div>

      {/* Isi: kartu putih berbingkai, selalu utuh terlihat */}
      <div
        className="flex-1 min-h-0 overflow-auto flex"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="m-auto w-full max-w-4xl p-4 sm:p-8">
          {isImage ? (
            <img
              src={url}
              alt={title || "Bukti pembayaran"}
              className="mx-auto max-h-[calc(100vh-260px)] w-auto max-w-full object-contain rounded-2xl border border-slate-300 bg-white shadow-xl"
            />
          ) : (
            <iframe
              src={url}
              title={title || "Bukti pembayaran"}
              className="w-full h-[calc(100vh-260px)] rounded-2xl border border-slate-300 bg-white shadow-xl"
            />
          )}
        </div>
      </div>

      {/* Aksi opsional */}
      {actions && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 bg-white border-t border-slate-200 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
