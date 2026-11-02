// src/components/dialogs/SharedGalleryModal.tsx
// Dialog Galeri Media Bersama Sekolah & Pencarian Online dengan Validasi AI (Tema Neon)

import React, { useState, useEffect, useMemo, useRef } from "react";
import PocketBase from "pocketbase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
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

      await loadGallery();
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
                  Galeri Media Bersama & Sumber Online
                </DialogTitle>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal mt-0.5">
                  Gunakan gambar dari rekan guru sekolah atau cari materi edukatif online yang divalidasi AI.
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

            <button
              type="button"
              onClick={() => setActiveTab("online")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "online"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cari Online (AI Validasi)</span>
            </button>
          </div>
        </div>

        {/* Isi Tab 1: Galeri Sekolah & Tab 2: Arsip Soal Saya */}
        {(activeTab === "school" || activeTab === "mine") && (
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
                    Unggah gambar dari komputer Anda atau gunakan tab "Cari Online (AI)" untuk menambahkan materi visual.
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
        )}

        {/* Isi Tab 3: Cari Gambar Online (AI Validasi) */}
        {activeTab === "online" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search & AI Keyword Bar */}
            <div className="p-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={onlineQuery}
                    onChange={(e) => setOnlineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchOnline()}
                    placeholder="Ketik topik visual (contoh: mitokondria, fotosintesis, borobudur, peta asean)..."
                    className="h-10 pl-10 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-700 focus:ring-emerald-500"
                  />
                  {onlineQuery && (
                    <button
                      onClick={() => setOnlineQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <NeonButton
                    variant="primary"
                    color="brand"
                    size="sm"
                    onClick={() => handleSearchOnline()}
                    disabled={isSearchingOnline || !onlineQuery.trim()}
                    className="gap-1.5"
                  >
                    {isSearchingOnline ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>{isSearchingOnline ? "Mencari..." : "Cari Gambar Web"}</span>
                  </NeonButton>

                  {currentQuestionContext?.text && (
                    <NeonButton
                      variant="soft"
                      color="brand"
                      size="sm"
                      onClick={handleSuggestKeywords}
                      disabled={isSuggestingKeywords}
                      className="gap-1.5"
                      title="Minta AI merekomendasikan kata kunci pencarian berdasarkan teks soal"
                    >
                      <Wand2 className={`w-3.5 h-3.5 ${isSuggestingKeywords ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Saran AI</span>
                    </NeonButton>
                  )}
                </div>
              </div>

              {/* Keyword Pills jika ada saran AI */}
              {suggestedKeywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-500" /> Kata Kunci Rekomendasi AI:
                  </span>
                  {suggestedKeywords.map((kw, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setOnlineQuery(kw);
                        handleSearchOnline(kw);
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
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
              <div className="px-6 py-2.5 bg-emerald-500/5 dark:bg-emerald-950/20 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Ditemukan <span className="font-semibold text-emerald-600 dark:text-emerald-400">{onlineResults.length} gambar</span> dari pencarian web.
                  </p>
                </div>

                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => triggerAIValidation()}
                  disabled={isValidatingAI}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isValidatingAI ? "animate-spin" : ""}`} />
                  <span>{isValidatingAI ? "Sedang Memvalidasi AI..." : "Validasi Ulang AI"}</span>
                </NeonButton>
              </div>
            )}

            {/* Grid Hasil Pencarian Online */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {isSearchingOnline ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                  <p className="text-xs font-semibold">Mencari materi visual di web internet...</p>
                </div>
              ) : onlineResults.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 border border-emerald-500/20">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    Cari Gambar Edukasi dari Web Internet
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 mb-4">
                    Ketik topik atau klik saran AI di atas. AI akan otomatis memeriksa kesesuaian materi serta memastikan gambar tidak membocorkan kunci jawaban ke siswa.
                  </p>
                  {currentQuestionContext?.topic && (
                    <NeonButton
                      variant="soft"
                      color="brand"
                      size="sm"
                      onClick={() => {
                        const kw = currentQuestionContext.topic || "";
                        setOnlineQuery(kw);
                        handleSearchOnline(kw);
                      }}
                      className="gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Cari Topik Soal: "{currentQuestionContext.topic}"</span>
                    </NeonButton>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                  {onlineResults.map((item) => {
                    const val = validations[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`group relative border rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-2xs flex flex-col transition-all hover:shadow-md ${
                          val?.isRecommended
                            ? "border-emerald-500/60 dark:border-emerald-500/40 ring-1 ring-emerald-500/20"
                            : val?.isSpoiler
                            ? "border-rose-400/60 dark:border-rose-800/60 bg-rose-50/10"
                            : "border-neutral-200/80 dark:border-neutral-800"
                        }`}
                      >
                        {/* Image Preview Container */}
                        <div className="relative h-44 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-3 overflow-hidden border-b border-neutral-100 dark:border-neutral-800/60">
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
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1 ${
                                    val.badge === "Sangat Cocok"
                                      ? "bg-emerald-600 text-white"
                                      : val.badge === "Cukup Relevan"
                                      ? "bg-sky-600 text-white"
                                      : val.badge === "Bocor Jawaban"
                                      ? "bg-rose-600 text-white"
                                      : "bg-neutral-600 text-white"
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
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Menilai...
                                </span>
                              ) : null}

                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-black/60 text-white shadow-xs">
                                Web
                              </span>
                            </div>

                            <a
                              href={item.descriptionUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="pointer-events-auto p-1 rounded-md bg-black/40 hover:bg-black/70 text-white transition-colors cursor-pointer"
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
                              className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 line-clamp-2 leading-snug"
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
                                    : "bg-neutral-50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-800"
                                }`}
                              >
                                <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{val.reason}</span>
                              </div>
                            )}
                          </div>

                          {/* Tombol Pilih Gambar */}
                          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-neutral-400 font-normal">Web Edukasi</span>
                            <NeonButton
                              size="sm"
                              variant="primary"
                              color="brand"
                              onClick={() => {
                                onSelectImage(item.url);
                                onClose();
                              }}
                              className="gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Gunakan Gambar</span>
                            </NeonButton>
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
