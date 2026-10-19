// src/components/dialogs/SharedGalleryModal.tsx
// Dialog Galeri Media Bersama Sekolah & Pencarian Online dengan Validasi AI

import React, { useState, useEffect, useMemo, useRef } from "react";
import PocketBase from "pocketbase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Image,
  FolderOpen,
  Sparkles,
  Wand2,
  UploadCloud,
  Check,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Filter,
  User,
  Building,
  GraduationCap,
  Info,
  Search
} from "lucide-react";
import {
  OnlineImageCandidate,
  AIImageValidationResult,
  searchWebImages,
  suggestKeywordsWithAI,
  validateImagesWithAI,
} from "../../lib/imageSearch";
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
  currentQuestionContext?: {
    text?: string;
    topic?: string;
    subject?: string;
    options?: string[];
    correctAnswer?: string;
  };
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
  const [activeTab, setActiveTab] = useState<"school" | "mine" | "online">("school");

  // State Galeri Server (Sekolah & Pribadi)
  const [images, setImages] = useState<SharedGalleryItem[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [gallerySearch, setGallerySearch] = useState<string>("");
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Pencarian Online
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineResults, setOnlineResults] = useState<OnlineImageCandidate[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [validations, setValidations] = useState<Record<string, AIImageValidationResult>>({});
  const [isValidatingAI, setIsValidatingAI] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // Load Galeri saat modal dibuka
  const loadGallery = async () => {
    if (!pb) return;
    setIsLoadingGallery(true);
    try {
      const res = await fetch(`${pb.baseUrl}/api/shared-gallery`, {
        headers: {
          Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : "",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
        setTeachers(data.teachers || []);
      } else {
        // Fallback jika hook belum terpasang: ambil dari questions milik user saat ini
        await loadFallbackLocalGallery();
      }
    } catch (err) {
      console.warn("Gagal mengambil galeri bersama server, beralih ke fallback:", err);
      await loadFallbackLocalGallery();
    } finally {
      setIsLoadingGallery(false);
    }
  };

  // Fallback lokal client-side jika endpoint `/api/shared-gallery` tidak merespon
  const loadFallbackLocalGallery = async () => {
    try {
      const qRes = await pb.collection("questions").getList(1, 100, {
        sort: "-created",
      });
      const localMap: Record<string, SharedGalleryItem> = {};
      const qItems = qRes.items || [];

      qItems.forEach((q: any) => {
        const addUrl = (u?: string) => {
          if (!u || u.length < 5 || localMap[u]) return;
          localMap[u] = {
            id: `fb_${q.id}_${Object.keys(localMap).length}`,
            url: u,
            title: "Arsip Soal",
            teacherId: currentUser?.teacherId || "",
            teacherName: currentUser?.name || "Guru",
            examTitle: "Bank Soal",
            created: q.created || "",
            count: 1,
            isOwn: true,
          };
        };

        if (q.imageUrl) addUrl(q.imageUrl);
        if (q.text && q.text.includes("<img")) {
          const match = q.text.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match && match[1]) addUrl(match[1]);
        }
      });

      setImages(Object.values(localMap));
    } catch (e) {
      console.warn("Fallback lokal galeri juga gagal:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGallery();

      // Pre-fill query online dari konteks soal jika ada
      const ctxText = currentQuestionContext?.topic || currentQuestionContext?.text || "";
      const cleanCtx = ctxText.replace(/<[^>]+>/g, " ").trim();
      if (cleanCtx) {
        const words = cleanCtx.split(/\s+/).slice(0, 3).join(" ");
        setOnlineQuery(words);
      }
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

  // Handler Cari Gambar Online dari Web Internet
  const handleSearchOnline = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? onlineQuery).trim();
    if (!q) return;
    setIsSearchingOnline(true);
    setValidations({});
    try {
      const candidates = await searchWebImages(pb, q, 24);
      setOnlineResults(candidates);

      // Jika ada kandidat dan konteks pertanyaan tersedia, otomatis jalankan validasi AI
      if (candidates.length > 0 && currentQuestionContext?.text) {
        triggerAIValidation(candidates);
      }
    } catch (err) {
      console.warn("Pencarian online error:", err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Handler Saran Kata Kunci Visual dari AI
  const handleSuggestKeywords = async () => {
    if (!currentQuestionContext?.text && !currentQuestionContext?.topic) return;
    setIsSuggestingKeywords(true);
    try {
      const keywords = await suggestKeywordsWithAI(
        pb,
        currentQuestionContext.text || "",
        currentQuestionContext.topic,
        currentQuestionContext.subject
      );
      setSuggestedKeywords(keywords);
    } catch (err) {
      console.warn("Gagal saran kata kunci:", err);
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  // Handler Validasi AI
  const triggerAIValidation = async (candidatesToValidate?: OnlineImageCandidate[]) => {
    const list = candidatesToValidate || onlineResults;
    if (!list || list.length === 0 || !currentQuestionContext?.text) return;
    setIsValidatingAI(true);
    try {
      const results = await validateImagesWithAI(
        pb,
        {
          text: currentQuestionContext.text,
          options: currentQuestionContext.options,
          correctAnswer: currentQuestionContext.correctAnswer,
        },
        list
      );
      setValidations(results);
    } catch (err) {
      console.warn("Validasi AI error:", err);
    } finally {
      setIsValidatingAI(false);
    }
  };

  // Handler Upload Langsung ke Galeri Bersama
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDirect(true);
    try {
      const compressed = await compressImage(file);
      const schoolFolder = school?.slug || "unknown";
      const uploaded = await uploadInventoryImage(
        `schools/${schoolFolder}/gallery`,
        compressed
      );

      // Simpan metadata ke shared_gallery table via POST /api/shared-gallery
      try {
        await fetch(`${pb.baseUrl}/api/shared-gallery`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : "",
          },
          body: JSON.stringify({
            url: uploaded.url,
            title: file.name.replace(/\.[^/.]+$/, ""),
            examTitle: "Unggahan Galeri",
            teacherName: currentUser?.name || "Guru",
            teacherId: currentUser?.teacherId || "",
          }),
        });
      } catch (postErr) {
        console.warn("Notice: gagal POST shared_gallery:", postErr);
      }

      // Reload gallery agar gambar baru langsung tampil
      await loadGallery();

      // Pilih gambar ini langsung
      onSelectImage(uploaded.url);
      onClose();
    } catch (err: any) {
      alert("Gagal mengunggah gambar ke galeri: " + (err.message || ""));
    } finally {
      setIsUploadingDirect(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl bg-white dark:bg-slate-900 max-h-[88vh] overflow-hidden flex flex-col p-0 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl">
        {/* Header Bersama dengan Tab */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Galeri Media Bersama & Sumber Online
              </DialogTitle>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Gunakan gambar dari rekan guru sekolah atau cari materi edukatif online yang divalidasi AI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleDirectUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingDirect}
                className="h-9 rounded-xl border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold gap-1.5 shadow-sm"
              >
                {isUploadingDirect ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                Upload ke Galeri
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("school")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "school"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Galeri Sekolah
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                {images.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "mine"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Arsip Soal Saya
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                {images.filter((i) => i.isOwn).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("online")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "online"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm shadow-indigo-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cari Online (AI Validasi)
            </button>
          </div>
        </div>

        {/* Isi Tab 1: Galeri Sekolah & Tab 2: Arsip Soal Saya */}
        {(activeTab === "school" || activeTab === "mine") && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                    placeholder="Cari nama ujian, judul, atau nama guru..."
                    className="h-9 pl-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700"
                  />
                  {gallerySearch && (
                    <button
                      onClick={() => setGallerySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {activeTab === "school" && teachers.length > 0 && (
                  <select
                    value={teacherFilter}
                    onChange={(e) => setTeacherFilter(e.target.value)}
                    className="h-9 px-3 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
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

              <Button
                variant="ghost"
                size="sm"
                onClick={loadGallery}
                disabled={isLoadingGallery}
                className="h-9 px-3 rounded-xl text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 gap-1.5"
                title="Muat Ulang Galeri"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGallery ? "animate-spin" : ""}`} />
                Muat Ulang
              </Button>
            </div>

            {/* Grid Gambar Galeri */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {isLoadingGallery ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-semibold">Menghubungkan galeri bersama sekolah...</p>
                </div>
              ) : filteredGalleryImages.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-400 mb-3 border border-indigo-100 dark:border-indigo-900/40">
                    <Image className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {activeTab === "mine"
                      ? "Belum ada gambar di arsip Anda"
                      : "Belum ada gambar yang dibagikan"}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Unggah gambar dari komputer Anda atau gunakan tab "Cari Online (AI)" untuk menambahkan materi visual.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Unggah Gambar Sekarang
                  </Button>
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
                      className="group relative border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all bg-white dark:bg-slate-900 flex flex-col"
                    >
                      {/* Image Thumbnail Container */}
                      <div className="relative h-28 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-2 overflow-hidden border-b border-slate-100 dark:border-slate-800/60">
                        <img
                          src={img.url}
                          alt={img.title}
                          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-indigo-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="text-white text-xs font-black bg-indigo-600 px-3 py-1.5 rounded-lg shadow-md tracking-wider uppercase flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Pilih
                          </span>
                        </div>

                        {/* Badge Milik Anda */}
                        {img.isOwn && (
                          <div className="absolute top-1.5 left-1.5">
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/90 text-white shadow-sm">
                              Milik Anda
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info Footer */}
                      <div className="p-2.5 flex flex-col justify-between flex-1">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                          {img.title || "Ilustrasi Soal"}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate max-w-[90px]" title={img.teacherName}>
                            {img.teacherName || "Admin"}
                          </span>
                          {img.count > 1 && (
                            <span className="font-semibold text-indigo-500" title="Dipakai di beberapa soal">
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
        )}

        {/* Isi Tab 3: Cari Gambar Online (AI Validasi) */}
        {activeTab === "online" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search & AI Keyword Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={onlineQuery}
                    onChange={(e) => setOnlineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchOnline()}
                    placeholder="Ketik topik visual (contoh: mitokondria, fotosintesis, borobudur, peta asean)..."
                    className="h-10 pl-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700"
                  />
                  {onlineQuery && (
                    <button
                      onClick={() => setOnlineQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSearchOnline()}
                    disabled={isSearchingOnline || !onlineQuery.trim()}
                    className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm"
                  >
                    {isSearchingOnline ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    {isSearchingOnline ? "Mencari..." : "Cari Gambar Web"}
                  </Button>

                  {currentQuestionContext?.text && (
                    <Button
                      variant="outline"
                      onClick={handleSuggestKeywords}
                      disabled={isSuggestingKeywords}
                      className="h-10 rounded-xl border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-bold px-3 gap-1.5"
                      title="Minta AI merekomendasikan kata kunci pencarian berdasarkan teks soal"
                    >
                      <Wand2 className={`w-3.5 h-3.5 ${isSuggestingKeywords ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Saran AI</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Keyword Pills jika ada saran AI */}
              {suggestedKeywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-500" /> Kata Kunci Rekomendasi AI:
                  </span>
                  {suggestedKeywords.map((kw, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setOnlineQuery(kw);
                        handleSearchOnline(kw);
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/40 transition-all flex items-center gap-1"
                    >
                      <span>{kw}</span>
                      <Search className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tombol Aksi Validasi AI & Status */}
            {onlineResults.length > 0 && currentQuestionContext?.text && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-indigo-50/70 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Ditemukan <span className="font-bold text-indigo-600 dark:text-indigo-400">{onlineResults.length} gambar</span> dari pencarian web internet.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => triggerAIValidation()}
                  disabled={isValidatingAI}
                  className="h-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isValidatingAI ? "animate-spin" : ""}`} />
                  {isValidatingAI ? "Sedang Memvalidasi AI..." : "Validasi Ulang AI"}
                </Button>
              </div>
            )}

            {/* Grid Hasil Pencarian Online */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {isSearchingOnline ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                  <p className="text-xs font-semibold">Mencari materi edukatif di web internet...</p>
                </div>
              ) : onlineResults.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-400 mb-3 border border-purple-100 dark:border-purple-900/40">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Cari Gambar Edukasi dari Web Internet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                    Ketik topik atau klik saran AI di atas. AI akan otomatis memeriksa kesesuaian materi serta memastikan gambar tidak membocorkan kunci jawaban ke siswa.
                  </p>
                  {currentQuestionContext?.topic && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const kw = currentQuestionContext.topic || "";
                        setOnlineQuery(kw);
                        handleSearchOnline(kw);
                      }}
                      className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Cari Topik Soal: "{currentQuestionContext.topic}"
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                  {onlineResults.map((item) => {
                    const val = validations[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`group relative border rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm flex flex-col transition-all hover:shadow-lg ${
                          val?.isRecommended
                            ? "border-emerald-300 dark:border-emerald-700/60 ring-2 ring-emerald-500/10"
                            : val?.isSpoiler
                            ? "border-rose-300 dark:border-rose-800/60 bg-rose-50/10"
                            : "border-slate-200/80 dark:border-slate-800"
                        }`}
                      >
                        {/* Image Preview Container */}
                        <div className="relative h-44 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-3 overflow-hidden border-b border-slate-100 dark:border-slate-800/60">
                          <img
                            src={item.thumbUrl}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />

                          {/* Top Badges */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                            <div className="flex flex-wrap items-center gap-1">
                              {val ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 ${
                                    val.badge === "Sangat Cocok"
                                      ? "bg-emerald-500 text-white"
                                      : val.badge === "Cukup Relevan"
                                      ? "bg-teal-500 text-white"
                                      : val.badge === "Bocor Jawaban"
                                      ? "bg-rose-500 text-white"
                                      : "bg-slate-500 text-white"
                                  }`}
                                >
                                  {val.isSpoiler ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3" />
                                  )}
                                  {val.badge} ({val.score}%)
                                </span>
                              ) : isValidatingAI ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Menilai...
                                </span>
                              ) : null}

                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 text-white shadow-sm">
                                Web Internet
                              </span>
                            </div>

                            <a
                              href={item.descriptionUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="pointer-events-auto p-1 rounded-md bg-black/40 hover:bg-black/70 text-white transition-colors"
                              title="Buka sumber asli"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Detail Info & Validation Reason */}
                        <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2.5">
                          <div>
                            <h5
                              className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug"
                              title={item.title}
                            >
                              {item.title}
                            </h5>

                            {/* Alasan AI */}
                            {val && (
                              <div
                                className={`mt-2 p-2 rounded-xl text-[11px] leading-tight flex items-start gap-1.5 ${
                                  val.isSpoiler
                                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                                    : val.isRecommended
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40"
                                    : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800"
                                }`}
                              >
                                <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-indigo-500" />
                                <span>{val.reason}</span>
                              </div>
                            )}
                          </div>

                          {/* Tombol Pilih Gambar */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 font-medium">Web Edukasi</span>
                            <Button
                              size="sm"
                              onClick={() => {
                                onSelectImage(item.url);
                                onClose();
                              }}
                              className={`h-8 rounded-xl text-xs font-black px-3.5 gap-1.5 ${
                                val?.isRecommended
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Gunakan Gambar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default SharedGalleryModal;
