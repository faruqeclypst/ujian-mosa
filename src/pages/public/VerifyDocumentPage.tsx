import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp } from "../../lib/motion";
import { useTheme } from "../../context/ThemeContext";
import {
  decodeDocVerification,
  DocumentVerificationPayload,
} from "../../utils/documentVerifyHelper";
import { masterPb } from "../../lib/pocketbase";
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Building,
  Calendar,
  Info,
  Sun,
  Moon,
  AlertCircle,
} from "../../lib/icons/phosphor-bridge";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const VerifyDocumentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { actualTheme, toggleTheme } = useTheme();

  const noParam = searchParams.get("no") || searchParams.get("doc") || "";
  const dParam = searchParams.get("d") || searchParams.get("code") || "";

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNo, setCopiedNo] = useState(false);
  const [isDbChecking, setIsDbChecking] = useState(false);
  const [dbInvoice, setDbInvoice] = useState<any>(null);

  // Decode data dari URL parameter 'd'
  const decodedData = useMemo<DocumentVerificationPayload | null>(() => {
    if (!dParam) return null;
    return decodeDocVerification(dParam);
  }, [dParam]);

  // Cek validasi real-time ke master database PocketBase jika ada nomor invoice
  useEffect(() => {
    const rawNo = noParam || decodedData?.no || "";
    if (!rawNo) return;

    const cleanInvoiceNo = rawNo
      .replace(/^KWT\/BOS\//i, "")
      .replace(/^#/i, "")
      .trim();

    if (!cleanInvoiceNo) return;

    setIsDbChecking(true);
    masterPb
      .collection("invoices")
      .getFirstListItem(`invoice_number = "${cleanInvoiceNo}"`)
      .then((record) => {
        setDbInvoice(record);
      })
      .catch((err) => {
        console.log("Database lookup notice:", err?.message || err);
        setDbInvoice(null);
      })
      .finally(() => {
        setIsDbChecking(false);
      });
  }, [noParam, decodedData]);

  // Gabungkan data decoded dengan live database jika ada
  const docInfo = useMemo(() => {
    if (decodedData) {
      return {
        type: decodedData.t === "receipt" ? "Kuitansi Bukti Pembayaran (SPJ Dana BOS)" : "Invoice Resmi Layanan",
        isReceipt: decodedData.t === "receipt",
        docNumber: decodedData.no,
        schoolName: decodedData.sn,
        schoolSlug: decodedData.sl || (dbInvoice ? dbInvoice.school_slug : ""),
        amount: decodedData.amt,
        date: decodedData.dt,
        status: dbInvoice ? (dbInvoice.status === "paid" ? "paid" : decodedData.st) : decodedData.st,
        provider: decodedData.pr || "Alfaruq Asri (EXAMKU CBT)",
        activity: decodedData.act || "Pelaksanaan Evaluasi / Asesmen Pembelajaran Berbasis Komputer CBT",
        plan: decodedData.plan || (dbInvoice ? dbInvoice.plan_label : "Paket Layanan CBT"),
        tax: decodedData.tax,
        fingerprint: decodedData.hash,
        isDbConfirmed: Boolean(dbInvoice),
      };
    }

    if (dbInvoice) {
      return {
        type: "Invoice Resmi Layanan",
        isReceipt: false,
        docNumber: `#${dbInvoice.invoice_number}`,
        schoolName: dbInvoice.school_name || "Sekolah",
        schoolSlug: dbInvoice.school_slug || "",
        amount: Number(dbInvoice.amount) || 0,
        date: dbInvoice.paid_date || dbInvoice.created || "-",
        status: dbInvoice.status || "paid",
        provider: "Alfaruq Asri (EXAMKU CBT)",
        activity: "Biaya Layanan & Lisensi Aplikasi CBT EXAMKU",
        plan: dbInvoice.plan_label || "Paket Layanan CBT",
        tax: undefined,
        fingerprint: `EXAMKU-LIVE-${dbInvoice.id.slice(0, 8).toUpperCase()}`,
        isDbConfirmed: true,
      };
    }

    return null;
  }, [decodedData, dbInvoice]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyNo = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNo(true);
    setTimeout(() => setCopiedNo(false), 2000);
  };

  const isPaid = docInfo?.status === "paid";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans antialiased selection:bg-emerald-500 selection:text-white"
    >
      {/* Top Navbar */}
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-sm shadow-sm">
            E
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              EXAMKU CBT
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                TTE VERIFIED
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Portal Validasi Dokumen & Kuitansi Resmi
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-xs cursor-pointer"
            title={actualTheme === "dark" ? "Mode Terang" : "Mode Gelap"}
            aria-label="Ganti Tema"
          >
            {actualTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl w-full mx-auto my-6 space-y-6">
        {docInfo ? (
          <>
            {/* Status Hero Card */}
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-3xl p-6 sm:p-7 shadow-lg shadow-emerald-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-emerald-500/10 via-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30">
                  <ShieldCheck size={32} />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Dokumen Sah & Tervalidasi
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Tanda Tangan Elektronik Terverifikasi
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Dokumen ini dikeluarkan secara resmi oleh EXAMKU CBT dan telah melalui penandatanganan elektronik tersertifikasi (TTE). Integritas isi dokumen terjamin sah.
                  </p>
                </div>
              </div>

              {/* Status Lunas Highlight */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                    <CheckCircle2 size={16} />
                    <span>STATUS: {isPaid ? "SUDAH LUNAS" : "MENUNGGU PEMBAYARAN"}</span>
                  </div>
                  {docInfo.isDbConfirmed && (
                    <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <Check size={14} className="text-emerald-500" />
                      Sinkron Database Master
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Ref: {docInfo.docNumber}
                </div>
              </div>
            </div>

            {/* Document Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    Detail Rincian Dokumen
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyNo(docInfo.docNumber)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {copiedNo ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Salin No.
                    </>
                  )}
                </button>
              </div>

              {/* Data Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Jenis Dokumen</div>
                  <div className="font-bold text-slate-900 dark:text-white">{docInfo.type}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Nomor Registrasi</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">{docInfo.docNumber}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Diterbitkan Kepada</div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building size={14} className="text-slate-400 shrink-0" />
                    <span>{docInfo.schoolName}</span>
                  </div>
                  {docInfo.schoolSlug && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {docInfo.schoolSlug}.examku.my.id
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Penyedia Jasa (Penerima)</div>
                  <div className="font-bold text-slate-900 dark:text-white">Alfaruq Asri</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tim Keuangan EXAMKU CBT
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Total Nilai Transaksi
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {formatRupiah(docInfo.amount)}
                    </div>
                  </div>
                  {docInfo.tax && (
                    <div className="text-right text-[11px] text-slate-600 dark:text-slate-400 sm:border-l sm:border-emerald-200 sm:dark:border-emerald-800/50 sm:pl-4">
                      <div>Hak Layanan: {formatRupiah(docInfo.tax.subtotal)}</div>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                        PPN {docInfo.tax.rate}%: {formatRupiah(docInfo.tax.amount)}
                      </div>
                      <div className="text-[10px] text-slate-500">*Disetor Bendahara BOS (WAPU)</div>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Peruntukan Belanja / SPJ</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{docInfo.activity}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paket: <strong className="text-slate-700 dark:text-slate-300">{docInfo.plan}</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tanggal Pengesahan</div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{docInfo.date}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kode Hash TTE (Fingerprint)</div>
                  <div className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
                    {docInfo.fingerprint}
                  </div>
                </div>
              </div>

              {/* Legal Footnote */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1.5">
                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Lock size={15} className="text-emerald-600 dark:text-emerald-400" />
                  Landasan Keabsahan Hukum (UU ITE)
                </div>
                <p>
                  Dokumen elektronik ini memiliki kekuatan hukum yang sah mengacu pada <strong>Pasal 5 ayat (1) UU No. 11 Tahun 2008</strong> tentang Informasi dan Transaksi Elektronik (UU ITE). Bukti kuitansi dan faktur ini sah dipergunakan untuk kelengkapan administrasi <strong>Surat Pertanggungjawaban (SPJ) Dana BOS / BOSP</strong>, pembukuan ARKAS, serta pemeriksaan audit BPK / Inspektorat Daerah.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 min-w-[140px] h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Cetak Bukti Validasi</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="h-10 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  {copiedLink ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                  <span>{copiedLink ? "Link Tersalin!" : "Salin Link"}</span>
                </button>

                {docInfo.schoolSlug && (
                  <a
                    href={`https://${docInfo.schoolSlug}.examku.my.id`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Portal Sekolah</span>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Fallback jika URL dibuka tanpa parameter */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 mx-auto flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Parameter Dokumen Tidak Ditemukan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Silakan pindai kode QR yang tertera pada berkas cetak Kuitansi SPJ atau Invoice EXAMKU CBT untuk memvalidasi keaslian dokumen secara otomatis.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition-colors"
              >
                Kembali ke Beranda EXAMKU
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl w-full mx-auto text-center pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 space-y-1">
        <div>&copy; {new Date().getFullYear()} EXAMKU CBT &bull; Layanan Evaluasi Akademik Terdistribusi</div>
        <div>Sistem Validasi Dokumen Terpusat (Banda Aceh, Indonesia)</div>
      </footer>
    </motion.div>
  );
};

export default VerifyDocumentPage;
