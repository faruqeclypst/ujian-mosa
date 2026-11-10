// src/components/dialogs/SharedGalleryModal.tsx
// Dialog Galeri Media Bersama Sekolah (Tema Neon)

import React, { useState, useEffect, useMemo, useRef } from "react";
import PocketBase from "pocketbase";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import {
  Image,
  FolderOpen,
  UploadCloud,
  Check,
  X,
  RefreshCw,
  Search,
  Building,
  User,
} from "../../lib/icons/phosphor-bridge";
import { uploadInventoryImage } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";

export interface SharedGalleryItem {
  id: string;
  url: string;
  title: string;
  teacherId: string;
  teacherName: string;
  examTitle: string;
  created: string;
  count: number;
  isOwn: boolean;
  source?: string;
}

export interface SharedGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  pb: PocketBase;
  school?: any;
  currentQuestionContext?: any;
  currentUser?: {
    id?: string;
    role?: string;
    teacherId?: string;
    name?: string;
  } | null;
}

export const SharedGalleryModal: React.FC<SharedGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  pb,
  school,
  currentQuestionContext,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<"school" | "mine">("school");

  // State Galeri Server (Sekolah & Pribadi)
  const [images, setImages] = useState<SharedGalleryItem[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [gallerySearch, setGallerySearch] = useState<string>("");
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Galeri saat modal dibuka (menggabungkan server gallery + seluruh butir soal semua guru)
  const loadGallery = async () => {
    if (!pb) return;
    setIsLoadingGallery(true);
    try {
      const combinedMap: Record<string, SharedGalleryItem> = {};
      const teacherMap: Record<string, { id: string; name: string; count: number }> = {};

      const myTeacherId = currentUser?.teacherId || "";
      const isAdmin = currentUser?.role === "admin";

      // 1. Coba ambil dari endpoint backend /api/shared-gallery jika aktif
      try {
        const res = await fetch(`${pb.baseUrl}/api/shared-gallery`, {
          headers: {
            Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : "",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const serverImages: SharedGalleryItem[] = data.images || [];
          serverImages.forEach((img) => {
            if (img.url) {
              const tId = img.teacherId || "";
              const isOwn = (myTeacherId && tId === myTeacherId) || (!tId && isAdmin);
              combinedMap[img.url] = {
                ...img,
                isOwn: !!isOwn,
              };
              if (tId) {
                if (!teacherMap[tId]) {
                  teacherMap[tId] = { id: tId, name: img.teacherName || "Guru", count: 0 };
                }
                teacherMap[tId].count++;
              }
            }
          });
        }
      } catch (netErr) {
        console.warn("Notice: Fetch /api/shared-gallery gagal:", netErr);
      }

      // 2. Ambil seluruh butir soal, ujian, dan data guru dari database PocketBase
      // agar gambar dari SEMUA guru sekolah selalu muncul lengkap
      try {
        const [qRes, examsRes, teachersRes] = await Promise.allSettled([
          pb.collection("questions").getList(1, 200, { sort: "-created" }),
          pb.collection("exams").getFullList(),
          pb.collection("teachers").getFullList(),
        ]);

        const examToInfo: Record<string, { title: string; teacherId: string }> = {};
        if (examsRes.status === "fulfilled" && examsRes.value) {
          examsRes.value.forEach((ex: any) => {
            examToInfo[ex.id] = {
              title: ex.title || "Ujian",
              teacherId: ex.teacherId || ex.teacherid || "",
            };
          });
        }

        const teacherIdToName: Record<string, string> = {};
        if (teachersRes.status === "fulfilled" && teachersRes.value) {
          teachersRes.value.forEach((t: any) => {
            teacherIdToName[t.id] = t.name || t.username || "Guru";
          });
        }

        const addLocalUrl = (u?: string, qExamId?: string, customTitle?: string) => {
          if (!u) return;
          const clean = u.trim();
          if (clean.length < 5) return;

          const examInfo = qExamId ? examToInfo[qExamId] : undefined;
          const tId = examInfo?.teacherId || "";
          const tName = tId
            ? teacherIdToName[tId] || "Guru"
            : (isAdmin ? "Admin / Sistem" : "Guru");
          const eTitle = examInfo?.title || customTitle || "Bank Soal";
          const isOwn = (myTeacherId && tId === myTeacherId) || (!tId && isAdmin);

          if (combinedMap[clean]) {
            combinedMap[clean].count++;
            if (isOwn) combinedMap[clean].isOwn = true;
            return;
          }

          combinedMap[clean] = {
            id: `qimg_${Object.keys(combinedMap).length}`,
            url: clean,
            title: eTitle,
            teacherId: tId,
            teacherName: tName,
            examTitle: eTitle,
            created: new Date().toISOString(),
            count: 1,
            isOwn: !!isOwn,
            source: "questions",
          };

          if (tId) {
            if (!teacherMap[tId]) {
              teacherMap[tId] = { id: tId, name: tName, count: 0 };
            }
            teacherMap[tId].count++;
          }
        };

        const scanHtml = (str?: string, examId?: string) => {
          if (!str || !str.includes("<img")) return;
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
          let m;
          while ((m = imgRegex.exec(str)) !== null) {
            if (m[1]) addLocalUrl(m[1], examId);
          }
        };

        const scanOptions = (opts?: any, examId?: string) => {
          if (!opts) return;
          if (typeof opts === "string") {
            scanHtml(opts, examId);
            const urlRegex = /"(?:imageUrl|url|src)"\s*:\s*"([^"]+)"/g;
            let m;
            while ((m = urlRegex.exec(opts)) !== null) {
              if (m[1]) addLocalUrl(m[1], examId);
            }
          } else if (typeof opts === "object") {
            Object.values(opts).forEach((opt: any) => {
              if (opt?.imageUrl) addLocalUrl(opt.imageUrl, examId);
              if (opt?.text) scanHtml(opt.text, examId);
            });
          }
        };

        if (qRes.status === "fulfilled" && qRes.value?.items) {
          qRes.value.items.forEach((q: any) => {
            if (q.imageUrl) addLocalUrl(q.imageUrl, q.examId);
            scanHtml(q.text, q.examId);
            scanHtml(q.groupText, q.examId);
            scanOptions(q.options, q.examId);
          });
        }

        // 3. Scan konteks butir soal saat ini yang sedang aktif diedit di form
        if (currentQuestionContext) {
          const curTopic = currentQuestionContext.topic || "Soal Saat Ini";
          scanHtml(currentQuestionContext.text);
          if (Array.isArray(currentQuestionContext.options)) {
            currentQuestionContext.options.forEach((optText: string) => scanHtml(optText));
          }
        }
      } catch (dbErr) {
        console.warn("Notice: scanning PB collections for gallery:", dbErr);
      }

      const allMergedImages = Object.values(combinedMap);
      setImages(allMergedImages);

      const mergedTeacherList = Object.values(teacherMap).sort((a, b) => b.count - a.count);
      setTeachers(mergedTeacherList);
    } catch (err) {
      console.warn("Gagal memuat galeri:", err);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGallery();
    }
  }, [isOpen]);

  // Filter gambar sekolah & arsip saya
  const filteredGalleryImages = useMemo(() => {
    let list = images;
    if (activeTab === "mine") {
      list = list.filter((img) => img.isOwn);
    } else if (teacherFilter !== "all") {
      list = list.filter((img) => img.teacherId === teacherFilter);
    }

    if (gallerySearch.trim()) {
      const q = gallerySearch.toLowerCase();
      list = list.filter(
        (img) =>
          (img.title && img.title.toLowerCase().includes(q)) ||
          (img.teacherName && img.teacherName.toLowerCase().includes(q)) ||
          (img.examTitle && img.examTitle.toLowerCase().includes(q))
      );
    }

    return list;
  }, [images, activeTab, teacherFilter, gallerySearch]);

  // Handler Upload Langsung ke Galeri Bersama
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDirect(true);
    try {
      let fileToUpload: File = file;
      try {
        fileToUpload = await compressImage(file);
      } catch {
        fileToUpload = file;
      }

      const schoolFolder = school?.slug || school?.id || "default";
      let finalUrl = "";

      // 1. Coba upload via Cloudflare R2 Worker
      try {
        const uploaded = await uploadInventoryImage(
          `schools/${schoolFolder}/gallery`,
          fileToUpload
        );
        finalUrl = uploaded.url;

        // Catat metadata ke backend shared_gallery jika aktif
        try {
          await fetch(`${pb.baseUrl}/api/shared-gallery`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : "",
            },
            body: JSON.stringify({
              url: finalUrl,
              title: file.name.replace(/\.[^/.]+$/, ""),
              examTitle: "Unggahan Galeri",
              teacherName: currentUser?.name || "Guru",
              teacherId: currentUser?.teacherId || "",
            }),
          });
        } catch (_) {}
      } catch (uploadErr) {
        console.warn("Upload ke worker gagal, beralih ke fallback Base64 DataURL (sama seperti ReactQuill):", uploadErr);
        // Fallback langsung ke Data URL seperti ReactQuill agar user TIDAK PERNAH terblokir
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToUpload);
        });
      }

      if (finalUrl) {
        const newItem: SharedGalleryItem = {
          id: `upload_${Date.now()}`,
          url: finalUrl,
          title: file.name.replace(/\.[^/.]+$/, ""),
          teacherId: currentUser?.teacherId || "",
          teacherName: currentUser?.name || "Guru",
          examTitle: "Unggahan Galeri",
          created: new Date().toISOString(),
          count: 1,
          isOwn: true,
          source: "direct_upload",
        };

        setImages((prev) => [newItem, ...prev.filter((i) => i.url !== finalUrl)]);

        onSelectImage(finalUrl);
        onClose();
      }
    } catch (err: any) {
      alert("Gagal memproses gambar: " + (err.message || ""));
    } finally {
      setIsUploadingDirect(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl bg-white dark:bg-neutral-900 max-h-[88vh] overflow-hidden flex flex-col p-0 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl">
        {/* Header Bersama dengan Tab Tema Neon */}
        <div className="px-6 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                  Galeri Media Bersama
                </DialogTitle>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal mt-0.5">
                  Gunakan gambar dari galeri sekolah, arsip soal Anda, atau unggah gambar baru.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleDirectUpload}
              />
              <NeonButton
                variant="outline"
                color="brand"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingDirect}
                className="gap-1.5"
              >
                {isUploadingDirect ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>Upload ke Galeri</span>
              </NeonButton>
            </div>
          </div>

          {/* Tab Navigation Segmented Neon */}
          <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("school")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "school"
                  ? "bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Building className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Galeri Sekolah</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold">
                {images.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "mine"
                  ? "bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Arsip Soal Saya</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold">
                {images.filter((i) => i.isOwn).length}
              </span>
            </button>
          </div>
        </div>

        {/* Isi Galeri Sekolah & Arsip Soal Saya */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  placeholder="Cari nama ujian, judul, atau nama guru..."
                  className="h-9 pl-8 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-700 focus:ring-emerald-500"
                />
                {gallerySearch && (
                  <button
                    onClick={() => setGallerySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {activeTab === "school" && teachers.length > 0 && (
                <select
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl text-xs font-medium bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Semua Guru ({images.length})</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <NeonButton
              variant="ghost"
              size="sm"
              onClick={loadGallery}
              disabled={isLoadingGallery}
              className="gap-1.5"
              title="Muat Ulang Galeri"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGallery ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </NeonButton>
          </div>

          {/* Grid Gambar Galeri */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {isLoadingGallery ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs font-semibold">Menghubungkan galeri bersama sekolah...</p>
              </div>
            ) : filteredGalleryImages.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 border border-emerald-500/20">
                  <Image className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {activeTab === "mine"
                    ? "Belum ada gambar di arsip Anda"
                    : "Belum ada gambar yang dibagikan"}
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
                  Unggah gambar dari komputer Anda untuk menambahkan materi visual ke galeri bersama.
                </p>
                <NeonButton
                  size="sm"
                  variant="primary"
                  color="brand"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Unggah Gambar Sekarang</span>
                </NeonButton>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredGalleryImages.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    onClick={() => {
                      onSelectImage(img.url);
                      onClose();
                    }}
                    className="group relative border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all bg-white dark:bg-neutral-900 flex flex-col"
                  >
                    {/* Image Thumbnail Container */}
                    <div className="relative h-28 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-2 overflow-hidden border-b border-neutral-100 dark:border-neutral-800/60">
                      <img
                        src={img.url}
                        alt={img.title}
                        className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-white text-xs font-bold bg-emerald-600 px-3 py-1.5 rounded-lg shadow-md tracking-wider uppercase flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Pilih
                        </span>
                      </div>

                      {/* Badge Milik Anda */}
                      {img.isOwn && (
                        <div className="absolute top-1.5 left-1.5">
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                            Milik Anda
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info Footer */}
                    <div className="p-2.5 flex flex-col justify-between flex-1">
                      <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {img.title || "Ilustrasi Soal"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                        <span className="truncate max-w-[90px]" title={img.teacherName}>
                          {img.teacherName || "Admin"}
                        </span>
                        {img.count > 1 && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400" title="Dipakai di beberapa soal">
                            {img.count}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharedGalleryModal;
