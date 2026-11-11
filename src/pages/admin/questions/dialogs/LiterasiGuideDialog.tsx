import React from "react";
import { Dialog, DialogContent, DialogFooter } from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { Separator } from "../../../../components/ui/separator";
import { BookOpen, FileText, Check, FileSpreadsheet, FileJson, Copy, Download } from "lucide-react";

interface LiterasiGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadTemplate: () => void;
  onToast: (toast: { title: string; description: string; type: "success" | "error" | "info" | "warning"; duration?: number }) => void;
}

export const LiterasiGuideDialog: React.FC<LiterasiGuideDialogProps> = ({
  open,
  onOpenChange,
  onDownloadTemplate,
  onToast,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl overflow-hidden p-0 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
        <div className="bg-gradient-to-br from-sky-600 to-indigo-700 p-8 text-white relative">
          <BookOpen className="h-16 w-16 opacity-10 absolute right-8 top-8" />
          <h2 className="text-2xl font-bold mb-2">Panduan Soal Literasi</h2>
          <p className="text-sky-100 text-sm">Pelajari cara mengelompokkan soal berdasarkan stimulus (AKM/Literasi).</p>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
              <FileText className="h-6 w-6" />
              1. Import dari Word (.docx)
            </h3>
            <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">Tulis kata kunci <b className="text-emerald-600">LITERASI:</b> diikuti narasi Anda di luar tabel soal. Tabel data di dalam soal akan otomatis dipreservasi.</p>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-xs shadow-sm leading-relaxed">
                <div className="text-emerald-600 font-bold mb-1 underline">LITERASI: Mengenal Ekosistem Hutan</div>
                <div className="text-slate-400 mb-4 italic">Hutan adalah paruparu dunia yang harus kita jaga...</div>

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 p-2 rounded mb-1 text-slate-600">
                  [Tabel Soal Nomor 1]
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 p-2 rounded text-slate-600">
                  [Tabel Soal Nomor 2]
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg italic">
                <Check className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Semua soal di bawah judul tsb akan otomatis menjadi satu grup literasi. Tabel data dari Word juga akan ditampilkan dengan rapi.</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
              <FileSpreadsheet className="h-6 w-6" />
              2. Import dari Excel
            </h3>
            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">Gunakan kolom <b className="text-indigo-600">GroupId</b> untuk mengelompokkan soal.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Kolom GroupId</div>
                  <div className="text-indigo-600 font-bold text-sm">GAJAH-01</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Teks Literasi</div>
                  <div className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2">Gajah adalah mamalia...</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">Cukup tuliskan Teks Literasi pada baris pertama dalam satu grup ID.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-3 text-orange-700 dark:text-orange-400">
              <FileJson className="h-6 w-6" />
              3. Import dari JSON
            </h3>
            <div className="bg-orange-50/50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/50 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">Gunakan field <b className="text-orange-600">groupId</b> dan <b className="text-orange-600">groupText</b> untuk literasi. Bisa juga minta ChatGPT buatkan soal dengan format ini.</p>

              <div className="space-y-2">
                <p className="text-xs font-black text-orange-600 uppercase tracking-widest">Template Prompt untuk ChatGPT (Klik untuk Salin):</p>
                <div
                  onClick={() => {
                    const prompt = `Buatkan 10 soal pilihan ganda untuk mata pelajaran [ISI MAPEL] kelas [ISI KELAS] dengan format JSON berikut. Gunakan format KaTeX \\(...\\) untuk rumus matematika. Untuk soal literasi, isi groupId dan groupText.

Format JSON:
[{"text": "<p>Teks pertanyaan \\\\(rumus\\\\) ...</p>","type": "pilihan_ganda","groupId": "","groupText": "","choices": {"a": {"isCorrect": false,"text": "Pilihan A"},"b": {"isCorrect": false,"text": "Pilihan B"},"c": {"isCorrect": true,"text": "Pilihan C"},"d": {"isCorrect": false,"text": "Pilihan D"},"e": {"isCorrect": false,"text": "Pilihan E"}},"answerKey": "c","order": 1}]

Aturan:
- type: pilihan_ganda (wajib 5 opsi a-e, 1 isCorrect: true)
- Untuk literasi: isi groupId (misal "LIT-1") dan groupText (teks bacaan HTML)
- Soal dengan groupId sama akan berbagi stimulus yang sama
- Untuk rumus: gunakan \\\\(...\\\\) sebagai delimiter
- answerKey: huruf kecil dari jawaban benar
- Output HANYA JSON array, tanpa penjelasan`;
                    navigator.clipboard.writeText(prompt);
                    onToast({ title: "Tersalin!", description: "Prompt template sudah di-copy. Paste ke ChatGPT.", type: "success", duration: 3000 });
                  }}
                  className="p-3 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 rounded-xl cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all group"
                >
                  <code className="text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed block">
                    Buatkan 10 soal pilihan ganda untuk mata pelajaran [MAPEL] kelas [KELAS] dengan format JSON... (klik untuk salin prompt lengkap)
                  </code>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-orange-500 group-hover:text-orange-700">
                    <Copy className="w-3 h-3" /> Klik untuk salin prompt ke ChatGPT
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black text-orange-600 uppercase tracking-widest">Contoh Hasil JSON (Klik untuk Salin):</p>
                <div
                  onClick={() => {
                    const sample = JSON.stringify([{ "text": "<p>Perangkat keras komputer yang berfungsi menampilkan hasil proses adalah ...</p>", "type": "pilihan_ganda", "groupId": "", "groupText": "", "choices": { "a": { "isCorrect": false, "text": "Keyboard" }, "b": { "isCorrect": false, "text": "Mouse" }, "c": { "isCorrect": true, "text": "Monitor" }, "d": { "isCorrect": false, "text": "Scanner" }, "e": { "isCorrect": false, "text": "Microphone" } }, "answerKey": "c", "order": 1 }], null, 2);
                    navigator.clipboard.writeText(sample);
                    onToast({ title: "Tersalin!", description: "Contoh JSON sudah di-copy.", type: "success", duration: 3000 });
                  }}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 transition-all group max-h-24 overflow-hidden"
                >
                  <code className="text-xs font-mono text-slate-500 leading-relaxed block">
                    {'[{"text":"<p>Perangkat keras...</p>","type":"pilihan_ganda","choices":{"a":{"isCorrect":false,"text":"Keyboard"},...},"answerKey":"c"}]'}
                  </code>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-slate-400 group-hover:text-indigo-600">
                    <Copy className="w-3 h-3" /> Klik untuk salin contoh JSON
                  </div>
                </div>
              </div>

              <p className="text-xs text-orange-600/80 italic">Paste hasil dari ChatGPT ke tab "Import JSON" di Smart AI Import. Tidak perlu API key.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between gap-3 items-center border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-slate-400 italic">Pastikan format file sesuai panduan.</div>
          <div className="flex gap-2">
            <Button onClick={() => onOpenChange(false)} variant="ghost" className="rounded-xl px-6 font-bold text-slate-500 hover:text-slate-700">Tutup</Button>
            <Button onClick={() => { onOpenChange(false); onDownloadTemplate(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Word
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

