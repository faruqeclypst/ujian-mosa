import { useState, useRef } from "react";
import JSZip from "jszip";
import { 
  Camera, 
  Upload, 
  FileArchive, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  Check, 
  User, 
  HelpCircle,
  FileImage
} from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { StudentData, ClassData } from "../../types/exam";

interface BatchStudentPhotoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  classes: ClassData[];
  onUpdateStudent: (id: string, payload: Partial<StudentData>) => Promise<void>;
  onSuccess: (count: number) => void;
}

interface ParsedPhotoItem {
  filename: string;
  cleanKey: string;
  fileData: string | Blob; // base64 or blob
  student?: StudentData;
  isMatched: boolean;
  status?: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
}

// Kompres gambar ke ukuran pas foto 3x4 (lebar 300px x 400px, JPEG ~25KB)
const compressToPassportPhoto = (source: string | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const targetWidth = 300;
      const targetHeight = 400;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Gagal menginisialisasi canvas"));
        return;
      }

      // Center crop & cover fit ke rasio 3:4
      const srcW = img.width;
      const srcH = img.height;
      const targetRatio = targetWidth / targetHeight; // 0.75
      const srcRatio = srcW / srcH;

      let drawW = srcW;
      let drawH = srcH;
      let startX = 0;
      let startY = 0;

      if (srcRatio > targetRatio) {
        // Gambar lebih lebar
        drawW = srcH * targetRatio;
        startX = (srcW - drawW) / 2;
      } else {
        // Gambar lebih tinggi
        drawH = srcW / targetRatio;
        startY = (srcH - drawH) / 2;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, startX, startY, drawW, drawH, 0, 0, targetWidth, targetHeight);

      // Kualitas 0.82 menghasilkan gambar yang sangat tajam untuk cetak namun hanya ~25-35KB
      const base64 = canvas.toDataURL("image/jpeg", 0.82);
      resolve(base64);
    };

    img.onerror = () => {
      reject(new Error("Gagal membaca file gambar"));
    };

    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Gagal membaca blob"));
      reader.readAsDataURL(source);
    }
  });
};

export const BatchStudentPhotoDialog = ({
  isOpen,
  onClose,
  students,
  classes,
  onUpdateStudent,
  onSuccess
}: BatchStudentPhotoDialogProps) => {
  const [photoItems, setPhotoItems] = useState<ParsedPhotoItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [filterMode, setFilterMode] = useState<"all" | "matched" | "unmatched">("matched");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Normalisasi kunci pencarian (hapus ekstensi, spasi, simbol)
  const extractKeyFromFilename = (filename: string): string => {
    // Ambil nama dasar tanpa ekstensi
    const base = filename.replace(/\.[^/.]+$/, "").trim();
    // Hilangkan karakter non-alfanumerik kecuali strip
    return base.toLowerCase();
  };

  // Cocokkan nama file dengan siswa
  const matchStudent = (key: string): StudentData | undefined => {
    const cleanK = key.replace(/[\s\-_]/g, "").toLowerCase();
    return students.find((s) => {
      const sNisn = (s.nisn || "").replace(/[\s\-_]/g, "").toLowerCase();
      const sExam = (s.examNumber || "").replace(/[\s\-_]/g, "").toLowerCase();
      const sUser = ((s as any).username || "").replace(/[\s\-_]/g, "").toLowerCase();
      return (
        sNisn === cleanK ||
        sExam === cleanK ||
        sUser === cleanK ||
        // Cocokkan jika ada leading zero yang hilang
        sNisn.replace(/^0+/, "") === cleanK.replace(/^0+/, "")
      );
    });
  };

  // Handler: Pilih Banyak File Foto Sekaligus
  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    const items: ParsedPhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const key = extractKeyFromFilename(file.name);
      const student = matchStudent(key);

      items.push({
        filename: file.name,
        cleanKey: key,
        fileData: file,
        student,
        isMatched: Boolean(student),
        status: "pending"
      });
    }

    setPhotoItems(items);
    setIsParsing(false);
    e.target.value = "";
  };

  // Handler: Upload File ZIP
  const handleZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const items: ParsedPhotoItem[] = [];

      for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;
        const lower = relativePath.toLowerCase();
        if (!lower.match(/\.(jpg|jpeg|png|webp)$/)) continue;

        // Ambil nama file saja tanpa folder di dalam zip
        const filename = relativePath.split("/").pop() || relativePath;
        const key = extractKeyFromFilename(filename);
        const student = matchStudent(key);

        const blob = await zipEntry.async("blob");

        items.push({
          filename,
          cleanKey: key,
          fileData: blob,
          student,
          isMatched: Boolean(student),
          status: "pending"
        });
      }

      setPhotoItems(items);
    } catch (err: any) {
      alert("Gagal membaca file ZIP: " + (err.message || "File rusak atau tidak valid"));
    } finally {
      setIsParsing(false);
      e.target.value = "";
    }
  };

  // Eksekusi Simpan Foto ke Database
  const handleSavePhotos = async () => {
    const matched = photoItems.filter((i) => i.isMatched && i.student);
    if (matched.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: matched.length });

    let successCount = 0;
    const chunkSize = 5; // Proses 5 foto sekaligus agar responsif dan cepat

    for (let i = 0; i < matched.length; i += chunkSize) {
      const chunk = matched.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (item) => {
          if (!item.student) return;
          try {
            // Kompres foto ke 3x4 JPEG
            const base64Photo = await compressToPassportPhoto(item.fileData);
            await onUpdateStudent(item.student.id, { photo: base64Photo });
            item.status = "success";
            successCount++;
          } catch (err: any) {
            console.error(`Gagal update foto ${item.filename}:`, err);
            item.status = "error";
            item.errorMessage = err.message || "Gagal simpan";
          }
        })
      );

      const processed = Math.min(i + chunkSize, matched.length);
      setUploadProgress({ current: processed, total: matched.length });
    }

    setIsUploading(false);
    onSuccess(successCount);
    onClose();
  };

  if (!isOpen) return null;

  const matchedCount = photoItems.filter((i) => i.isMatched).length;
  const unmatchedCount = photoItems.filter((i) => !i.isMatched).length;

  const filteredItems = photoItems.filter((item) => {
    if (filterMode === "matched") return item.isMatched;
    if (filterMode === "unmatched") return !item.isMatched;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] max-h-[92vh] p-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Upload Pas Foto Massal Siswa
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cocokkan foto siswa secara otomatis berdasarkan <strong>NISN</strong> atau <strong>Nomor Peserta</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
              className="text-xs h-8 px-3 border-slate-300 dark:border-slate-700"
            >
              Tutup
            </Button>
            {photoItems.length > 0 && matchedCount > 0 && (
              <Button
                onClick={handleSavePhotos}
                disabled={isUploading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-8 px-4 gap-1.5 shadow-sm"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ({uploadProgress.current}/{uploadProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Terapkan {matchedCount} Foto Siswa</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Petunjuk & Tombol Upload */}
        <div className="px-5 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Box Opsi 1: Multi File Select */}
            <div 
              onClick={() => !isUploading && !isParsing && fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-300 dark:border-purple-800/60 rounded-xl p-4 flex items-center gap-3.5 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <FileImage className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Pilih Banyak File Foto (.jpg / .png)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Bisa langsung blok 50–500 file foto dari komputer Anda.
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleMultipleFiles}
                className="hidden"
              />
            </div>

            {/* Box Opsi 2: Upload File ZIP */}
            <div 
              onClick={() => !isUploading && !isParsing && zipInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 dark:border-blue-800/60 rounded-xl p-4 flex items-center gap-3.5 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Upload Berkas Arsip (.ZIP)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kompres folder foto siswa menjadi 1 file ZIP lalu upload.
                </p>
              </div>
              <input
                type="file"
                ref={zipInputRef}
                accept=".zip,application/zip"
                onChange={handleZipFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Bar Info Format Nama File */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400">
            <HelpCircle className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              <strong>Format Nama File:</strong> Beri nama file foto dengan NISN atau Nomor Peserta siswa (Contoh: <code className="font-bold text-purple-700 dark:text-purple-300">0093242958.jpg</code> atau <code className="font-bold text-purple-700 dark:text-purple-300">01-001-001.png</code>). Sistem akan otomatis me-resize ke pas foto 3x4 standar.
            </span>
          </div>

          {/* Statistik Rekap dan Filter */}
          {photoItems.length > 0 && (
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300">Hasil Deteksi:</span>
                <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 border-slate-300 font-semibold">
                  Total: {photoItems.length} Foto
                </Badge>
                <Badge className="text-xs bg-emerald-600 text-white font-semibold">
                  Cocok: {matchedCount} Siswa
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300">
                    Tidak Ditemukan: {unmatchedCount}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFilterMode("matched")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    filterMode === "matched"
                      ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Cocok ({matchedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("unmatched")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    filterMode === "unmatched"
                      ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Belum Cocok ({unmatchedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    filterMode === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua ({photoItems.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Area Daftar Foto & Siswa (Grid) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isParsing ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="font-semibold text-sm">Membaca dan memindai foto...</p>
            </div>
          ) : photoItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/30">
              <Camera className="w-12 h-12 mb-2 opacity-40 text-purple-500" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Belum ada foto yang dipilih</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Silakan pilih banyak file foto (.jpg / .png) atau upload 1 file .ZIP berisi kumpulan pas foto siswa sekolah Anda di atas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item, idx) => {
                const studentClass = item.student
                  ? classes.find((c) => c.id === item.student?.classId)
                  : undefined;
                const photoSrc =
                  typeof item.fileData === "string"
                    ? item.fileData
                    : URL.createObjectURL(item.fileData);

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      item.isMatched
                        ? "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xs"
                        : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                    }`}
                  >
                    {/* Thumbnail Foto */}
                    <div className="w-12 h-16 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 overflow-hidden flex-shrink-0 relative">
                      <img
                        src={photoSrc}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                      />
                      {item.isMatched && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Informasi Siswa / File */}
                    <div className="flex-1 min-w-0">
                      {item.isMatched && item.student ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {item.student.name}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-purple-700 dark:text-purple-300 font-semibold mt-0.5">
                            {item.student.nisn}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                            <Badge variant="outline" className="px-1.5 py-0 text-[9px] border-slate-300">
                              {studentClass?.name || item.student.className || "Kelas"}
                            </Badge>
                            <span className="truncate">File: {item.filename}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-xs">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.filename}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Kunci: <code className="font-bold text-slate-700 dark:text-slate-300">{item.cleanKey}</code>
                          </p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400/90 mt-0.5">
                            Tidak cocok dengan NISN/No Peserta mana pun
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress Bar Footer Saat Upload */}
        {isUploading && (
          <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Menyimpan pas foto siswa ke database...
                </span>
                <span className="font-mono text-purple-600 font-bold">
                  {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / Math.max(1, uploadProgress.total)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-2 transition-all duration-200 rounded-full"
                  style={{ width: `${(uploadProgress.current / Math.max(1, uploadProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BatchStudentPhotoDialog;
