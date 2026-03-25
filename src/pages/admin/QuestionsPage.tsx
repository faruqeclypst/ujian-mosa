import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Image, ChevronDown, FileText, Download, Eye, FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { Card, CardHeader, CardContent, CardTitle } from "../../components/ui/card";
import { uploadInventoryImage, deleteImageFromStorage } from "../../lib/storage";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import ReactQuill, { Quill } from "react-quill";
import ImageResize from "quill-image-resize-module-react";
import "react-quill/dist/quill.snow.css";

Quill.register("modules/imageResize", ImageResize);
import { usePiket } from "../../context/PiketContext";
import { useAuth } from "../../context/AuthContext";
import { DataTable } from "../../components/ui/data-table";
export interface QuestionData {
  id: string;
  examId: string;
  text: string;
  imageUrl?: string;
  groupId?: string; // ID Kelompok/Literasi (Opsional)
  groupText?: string; // Teks khusus Literasi (Opsional)
  choices: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
}

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1200; // Resolusi max agar tetap tajam tapi ringan
        const MAX_HEIGHT = 1200;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Gagal mengompresi gambar"));
            }
          },
          "image/jpeg",
          0.75 // 75% kualitas sangat tinggi untuk visual tp hemat bytes
        );
      };
    };
    reader.onerror = (e) => reject(e);
  });
};

const columns = [
  {
    key: "index",
    label: "No",
    render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
  },
  {
    key: "text",
    label: "Teks Pertanyaan",
    sortable: true,
    render: (v: string, item: QuestionData) => (
      <div className="max-w-lg min-w-[250px]">
        <div className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: item.text }} />
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {(item.imageUrl || item.text.includes("<img")) && (
            <span className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1 font-semibold text-[10px] border border-blue-200 dark:border-blue-800/40">
              🖼️ Bergambar
            </span>
          )}
          {item.groupId && (
            <span className="p-1 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center gap-1 font-semibold text-[10px] border border-amber-200 dark:border-amber-800/40">
              🔖 Grup: {item.groupId}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "choices",
    label: "Detil Pilihan",
    render: (v: any, item: QuestionData) => {
      const keys = Object.keys(item.choices || {});
      const correctKey = keys.find(k => item.choices[k].isCorrect);
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800">{keys.length} Pilihan</span>
          {correctKey && (
            <span className="p-1 px-2 text-[11px] font-bold rounded-md bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/40">
              Kunci {correctKey.toUpperCase()}
            </span>
          )}
        </div>
      )
    }
  }
];

const QuestionsPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { role, teacherId } = useAuth();
  const { mapels, teachers } = usePiket();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionData | null>(null);

  const [formValues, setFormValues] = useState<{
    text: string;
    imageUrl?: string;
    groupId?: string;
    groupText?: string;
    choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
  }>({
    text: "",
    groupId: "",
    groupText: "",
    choices: {
      a: { text: "", isCorrect: false },
      b: { text: "", isCorrect: false },
      c: { text: "", isCorrect: false },
      d: { text: "", isCorrect: false },
      e: { text: "", isCorrect: false },
    }
  });

  const [isLiterasiActive, setIsLiterasiActive] = useState(false);
  const [literasiMode, setLiterasiMode] = useState<"select" | "create">("select");

  const existingLiteracies = useMemo(() => {
    const map: Record<string, string> = {};
    questions.forEach((q) => {
      if (q.groupId && q.groupText) {
        map[q.groupId] = q.groupText;
      }
    });
    return map;
  }, [questions]);

  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [choiceFiles, setChoiceFiles] = useState<Record<string, File | null>>({});

  const [coverSizeInfo, setCoverSizeInfo] = useState<string>("");
  const [choicesSizeInfo, setChoicesSizeInfo] = useState<Record<string, string>>({});

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryTarget, setGalleryTarget] = useState<{ type: "cover" | "choice" | "batch"; letter?: string; index?: number } | null>(null);

  const loadGalleryImages = () => {
    const images = new Set<string>();
    questions.forEach((q) => {
      if (q.imageUrl) images.add(q.imageUrl);
      if (q.choices) {
        Object.values(q.choices).forEach((c) => {
          if (c.imageUrl) images.add(c.imageUrl);
        });
      }
    });
    setGalleryImages(Array.from(images));
  };

  const handlePickGallery = (url: string) => {
    if (!galleryTarget) return;

    if (galleryTarget.type === "cover") {
      setFormValues((prev) => ({ ...prev, imageUrl: url }));
      setQuestionFile(null); // Reset file picker
      setCoverSizeInfo("(Dari Galeri)");
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      handleChoiceChange(letter, "imageUrl", url);
      setChoiceFiles((prev) => ({ ...prev, [letter]: null }));
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: "(Dari Galeri)" }));
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageUrl", url);
      updateBatchItem(galleryTarget.index, "imageFile", null); // Reset file jika ada
    }

    setIsGalleryOpen(false);
  };

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showAlert("Gagal", "Ukuran file gambar maksimal adalah 2MB.", "danger");
      return;
    }

    let fileToUpload = file;
    const origSize = formatSize(file.size);

    if (file.size > 200 * 1024) {
      fileToUpload = await compressImage(file);
    }

    if (!galleryTarget) return;

    if (galleryTarget.type === "cover") {
      setQuestionFile(fileToUpload);
      setFormValues((prev) => ({ ...prev, imageUrl: "" }));
      setCoverSizeInfo(file.size > 200 * 1024 ? `${origSize} ➔ ${formatSize(fileToUpload.size)}` : `${origSize} (Hemat)`);
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      setChoiceFiles((prev) => ({ ...prev, [letter]: fileToUpload }));
      handleChoiceChange(letter, "imageUrl", "");
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: file.size > 100 * 1024 ? `${origSize} ➔ ${formatSize(fileToUpload.size)}` : `${origSize} (Hemat)` }));
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageFile", fileToUpload);
      updateBatchItem(galleryTarget.index, "imageUrl", "");
    }

    setIsPickerOpen(false);
    if (globalFileInputRef.current) globalFileInputRef.current.value = "";
  };

  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false); // <--- Dropdown state
  const [isTambahMenuOpen, setIsTambahMenuOpen] = useState(false); // <--- Tambah Dropdown state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false); // <--- Delete All State

  const importRef = useRef<HTMLDivElement | null>(null);
  const tambahRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(event.target as Node)) {
        setIsImportMenuOpen(false);
      }
      if (tambahRef.current && !tambahRef.current.contains(event.target as Node)) {
        setIsTambahMenuOpen(false);
      }
    };
    if (isImportMenuOpen || isTambahMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isImportMenuOpen, isTambahMenuOpen]);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: "", description: "", type: "info", confirmLabel: "Ok", onConfirm: () => { } });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      type,
      confirmLabel,
      onConfirm: onConfirm || (() => { }),
      showCancel
    });
  };
  const [batchQuestions, setBatchQuestions] = useState<any[]>([
    { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
  ]);

  const handleBatchCreateClick = () => {
    setBatchQuestions([
      { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
    ]);
    setIsBatchModalOpen(true);
  };

  const handleAddBatchRow = () => {
    setBatchQuestions(prev => [
      ...prev,
      { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
    ]);
  };

  const handleRemoveBatchRow = (index: number) => {
    if (batchQuestions.length <= 1) return;
    setBatchQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateBatchItem = (index: number, field: string, value: any) => {
    setBatchQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateBatchChoice = (index: number, letter: string, value: string) => {
    setBatchQuestions(prev => {
      const updated = [...prev];
      const choices = { ...updated[index].choices };
      choices[letter] = { ...choices[letter], text: value };
      updated[index] = { ...updated[index], choices };
      return updated;
    });
  };

  const handleSaveBatch = async () => {
    let validQuestions = batchQuestions.filter(q => q.text.trim() !== "");
    if (validQuestions.length === 0) {
      showAlert("Gagal", "Tidak ada soal yang diisi teks pertanyaannya.", "danger");
      return;
    }

    // Validate all must have key
    const hasEmptyKeys = validQuestions.some(q => {
      const correctChoice = q.choices[q.correctKey];
      return !correctChoice.text || correctChoice.text.trim() === "";
    });

    if (hasEmptyKeys) {
      showAlert("Gagal", "Kunci jawaban dari soal yang Anda ketik tidak boleh kosong teksnya.", "danger");
      return;
    }

    setIsSavingBatch(true);
    try {
      const qRef = ref(database, "questions");
      for (const q of validQuestions) {
        let imageUrl = q.imageUrl || "";
        if (q.imageFile) {
          try {
            let fileToUpload = q.imageFile;
            if (q.imageFile.size > 200 * 1024) {
              fileToUpload = await compressImage(q.imageFile);
            }
            const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
            imageUrl = uploadSnap.url;
          } catch (e) {
            console.error("Gagal mengunggah gambar batch", e);
          }
        }

        const choicesToSave: any = {};
        Object.keys(q.choices).forEach((key) => {
          choicesToSave[key] = {
            text: q.choices[key].text,
            isCorrect: key === q.correctKey
          };
        });

        const payload: any = {
          examId,
          text: `<p>${q.text}</p>`, // wrap HTML dasar
          choices: choicesToSave,
          createdAt: Date.now()
        };

        if (imageUrl) {
          payload.imageUrl = imageUrl;
        }

        await push(qRef, payload);
      }
      setIsBatchModalOpen(false);
      setConfirmModal({
        isOpen: true,
        title: "Berhasil!",
        description: `${validQuestions.length} Soal manual berhasil disimpan ke dalam Bank Soal.`,
        type: "success",
        confirmLabel: "Ok",
        onConfirm: () => { }
      });
    } catch (e) {
      setConfirmModal({
        isOpen: true,
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan batch soal ke server.",
        type: "danger",
        confirmLabel: "Ok",
        onConfirm: () => { }
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const quillRef = useRef<any>(null); // <--- Reference to Question Quill

  const imageHandler = useCallback(function (this: any) {
    const quill = this.quill; // <--- Instance editor yang sedang diklik toolbar-nya
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          let fileToUpload = file;
          if (file.size > 200 * 1024) { // Compress jika > 200KB
            fileToUpload = await compressImage(file);
          }
          const reader = new FileReader();
          reader.readAsDataURL(fileToUpload);
          reader.onload = () => {
            const base64 = reader.result as string;
            if (quill) {
              const range = quill.getSelection() || { index: 0 };
              quill.insertEmbed(range.index, "image", base64);
            }
          };
        } catch (e) {
          alert("Gagal mengunggah gambar ke editor.");
        }
      }
    };
  }, [examId]);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['image', 'clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), [imageHandler]);

  useEffect(() => {
    if (!examId) return;

    // Load Exam Info
    const examRef = ref(database, `exams/${examId}`);
    get(examRef).then((snapshot) => {
      if (snapshot.exists()) {
        const examData = snapshot.val();

        const mapelObj = mapels.find((m) => m.id === examData.subjectId);
        const teacherObj = teachers.find((t) => t.id === examData.teacherId);

        setExam({
          ...examData,
          subject: mapelObj ? mapelObj.name : "",
          teacherName: teacherObj ? teacherObj.name : "",
          teacherCode: teacherObj ? teacherObj.code || "" : ""
        });
      }
    });

    // Load Questions
    const questionsRef = ref(database, "questions");
    const unsubscribe = onValue(questionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: QuestionData[] = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .filter((q) => q.examId === examId);
        setQuestions(loaded);
      } else {
        setQuestions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [examId, mapels, teachers]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedQuestion(null);
    setFormValues({
      text: "",
      groupId: "",
      groupText: "",
      choices: {
        a: { text: "", isCorrect: false },
        b: { text: "", isCorrect: false },
        c: { text: "", isCorrect: false },
        d: { text: "", isCorrect: false },
        e: { text: "", isCorrect: false },
      }
    });
    setIsLiterasiActive(false);
    setLiterasiMode("select");
    setIsDialogOpen(true);
  };

  const handleEditClick = (q: QuestionData) => {
    setDialogMode("edit");
    setSelectedQuestion(q);
    setQuestionFile(null);
    setChoiceFiles({});
    setFormValues({
      text: q.text,
      imageUrl: q.imageUrl,
      groupId: q.groupId || "",
      groupText: q.groupText || "",
      choices: {
        a: { text: q.choices?.a?.text || "", imageUrl: q.choices?.a?.imageUrl, isCorrect: !!q.choices?.a?.isCorrect },
        b: { text: q.choices?.b?.text || "", imageUrl: q.choices?.b?.imageUrl, isCorrect: !!q.choices?.b?.isCorrect },
        c: { text: q.choices?.c?.text || "", imageUrl: q.choices?.c?.imageUrl, isCorrect: !!q.choices?.c?.isCorrect },
        d: { text: q.choices?.d?.text || "", imageUrl: q.choices?.d?.imageUrl, isCorrect: !!q.choices?.d?.isCorrect },
        e: { text: q.choices?.e?.text || "", imageUrl: q.choices?.e?.imageUrl, isCorrect: !!q.choices?.e?.isCorrect },
      }
    });
    // 🔒 Deteksi apakah ini soal pertama di grupnya agar hanya soal #1 yang bisa edit teks wacana
    const groupItems = questions.filter(item => q.groupId && item.groupId === q.groupId);
    const isFirstInGroup = groupItems.length > 0 
      ? groupItems[0].id === q.id 
      : true;

    setIsLiterasiActive(!!q.groupId);
    setLiterasiMode(isFirstInGroup && q.groupText ? "create" : "select");
    setIsDialogOpen(true);
  };

  const handleChoiceChange = (key: string, field: string, value: any) => {
    setFormValues((prev) => {
      const updatedChoices = { ...prev.choices };
      updatedChoices[key] = { ...updatedChoices[key], [field]: value };

      // If setting isCorrect: true, set others to false
      if (field === "isCorrect" && value === true) {
        Object.keys(updatedChoices).forEach((k) => {
          if (k !== key) updatedChoices[k].isCorrect = false;
        });
      }

      return { ...prev, choices: updatedChoices };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validasi Teks Pertanyaan
    const isQuestionEmpty = !formValues.text || formValues.text.replace(/<[^>]*>/g, '').trim() === "";
    if (isQuestionEmpty) {
      showAlert("Gagal", "Teks pertanyaan tidak boleh kosong.", "danger");
      return;
    }

    // 2. Validasi Harus Ada Kunci Jawaban
    const hasCorrectAnswer = Object.values(formValues.choices).some((c) => c.isCorrect);
    if (!hasCorrectAnswer) {
      showAlert("Gagal", "Soal wajib memiliki minimal satu kunci jawaban.", "danger");
      return;
    }

    // 3. Validasi Teks Pilihan yang terpilih (Kunci Jawaban)
    const correctChoicesKeys = Object.keys(formValues.choices).filter(key => formValues.choices[key].isCorrect);
    const correctChoiceKey = correctChoicesKeys[0];
    const isCorrectChoiceEmpty = !formValues.choices[correctChoiceKey].text || formValues.choices[correctChoiceKey].text.replace(/<[^>]*>/g, '').trim() === "";
    if (isCorrectChoiceEmpty) {
      showAlert("Gagal", "Pilihan jawaban yang dipilih sebagai kunci jawaban tidak boleh kosong.", "danger");
      return;
    }

    // 4. Validasi Jumlah Pilihan yang Terisi (Minimal 2 pilihan)
    const filledChoicesCount = Object.values(formValues.choices).filter(c => c.text && c.text.replace(/<[^>]*>/g, '').trim() !== "").length;
    if (filledChoicesCount < 2) {
      showAlert("Gagal", "Minimal harus mengisi atau membuat 2 pilihan jawaban.", "danger");
      return;
    }

    try {
      const uploadBase64ToR2 = async (base64Data: string, prefix: string) => {
        try {
          const blob = await (await fetch(base64Data)).blob();
          const ext = blob.type.split("/")[1] || "png";
          const fileToUpload = new File([blob], `${prefix}_${Date.now()}.${ext}`, { type: blob.type });
          const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
          return uploadSnap.url;
        } catch (e) {
          console.error(`Gagal upload base64 image (${prefix}) to R2`, e);
          return base64Data;
        }
      };

      let imageUrl = formValues.imageUrl || "";
      let textToSave = formValues.text;

      // 🖼️ 1. Upload file Cover Soal (dari tombol input file)
      if (questionFile) {
        let fileToUpload = questionFile;
        if (questionFile.size > 200 * 1024) { // kompress > 200KB
          fileToUpload = await compressImage(questionFile);
        }
        if (dialogMode === "edit" && selectedQuestion?.imageUrl) {
          const extractKey = (url: string) => url.includes("/questions/") ? "questions/" + url.split("/questions/")[1].split("?")[0] : "";
          const oldKey = extractKey(selectedQuestion.imageUrl);
          if (oldKey) await deleteImageFromStorage(oldKey);
        }
        const res = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
        imageUrl = res.url;
      } else if (imageUrl.startsWith("data:image/")) {
        // Jika dari pratinjau tapi belum diupload
        imageUrl = await uploadBase64ToR2(imageUrl, "cover_manual");
      }

      // 🖼️ 2. Scan teks Soal untuk base64
      if (textToSave.includes("data:image/")) {
        const doc = new DOMParser().parseFromString(textToSave, "text/html");
        const ims = doc.querySelectorAll("img[src^='data:image/']");
        for (let i = 0; i < ims.length; i++) {
          const base64 = ims[i].getAttribute("src")!;
          const url = await uploadBase64ToR2(base64, "text_manual");
          ims[i].setAttribute("src", url);
        }
        textToSave = doc.body.innerHTML;
      }

      // 🖼️ 3. Upload file Pilihan Manual ke R2
      const updatedChoices = JSON.parse(JSON.stringify(formValues.choices));
      for (const key in choiceFiles) {
        const file = choiceFiles[key];
        if (file) {
          let fileToUpload = file;
          if (file.size > 200 * 1024) {
            fileToUpload = await compressImage(file);
          }
          if (dialogMode === "edit" && selectedQuestion?.choices?.[key]?.imageUrl) {
            const extractKey = (url: string) => url.includes("/questions/") ? "questions/" + url.split("/questions/")[1].split("?")[0] : "";
            const oldKey = extractKey(selectedQuestion.choices[key].imageUrl);
            if (oldKey) await deleteImageFromStorage(oldKey);
          }
          const res = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
          updatedChoices[key].imageUrl = res.url;
        }
      }

      // 🖼️ 4. Scan teks Pilihan untuk base64 (terutama jika ada paste)
      for (const key in updatedChoices) {
        const choice = updatedChoices[key];
        // Cek properti imageUrl (jika ada data URL sisa)
        if (choice.imageUrl && choice.imageUrl.startsWith("data:image/")) {
          choice.imageUrl = await uploadBase64ToR2(choice.imageUrl, `choice_manual_${key}`);
        } else if (!choice.imageUrl) {
          delete choice.imageUrl;
        }

        // Cek teks pilihan
        if (choice.text && choice.text.includes("data:image/")) {
          const cDoc = new DOMParser().parseFromString(choice.text, "text/html");
          const cIms = cDoc.querySelectorAll("img[src^='data:image/']");
          for (let i = 0; i < cIms.length; i++) {
            const b64 = cIms[i].getAttribute("src")!;
            const url = await uploadBase64ToR2(b64, `choice_text_manual_${key}`);
            cIms[i].setAttribute("src", url);
          }
          choice.text = cDoc.body.innerHTML;
        }
      }

      const payload: any = {
        examId,
        text: textToSave,
        choices: updatedChoices,
        createdAt: Date.now(),
      };

      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      if (formValues.groupId) {
        payload.groupId = formValues.groupId;
        payload.groupText = formValues.groupText || null; // Simpan teks wacana
      } else {
        payload.groupId = null; 
        payload.groupText = null;
      }

      if (dialogMode === "edit" && selectedQuestion) {
        const qRef = ref(database, `questions/${selectedQuestion.id}`);
        await update(qRef, payload);
      } else {
        const qRef = ref(database, "questions");
        await push(qRef, payload);
      }
      setIsDialogOpen(false);
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan soal.", "danger");
    }
  };

  const cleanupQuestionImages = async (q: QuestionData) => {
    const keysToDelete: string[] = [];
    const extractKey = (url: string) => {
      if (url.includes("/questions/")) return "questions/" + url.split("/questions/")[1].split("?")[0];
      return "";
    };

    if (q.imageUrl) keysToDelete.push(extractKey(q.imageUrl));
    if (q.choices) {
      Object.values(q.choices).forEach((c) => {
        if (c.imageUrl) keysToDelete.push(extractKey(c.imageUrl));
        if (c.text && c.text.includes("/questions/")) {
          const doc = new DOMParser().parseFromString(c.text, "text/html");
          doc.querySelectorAll("img").forEach((img) => {
            const src = img.getAttribute("src") || "";
            if (src) keysToDelete.push(extractKey(src));
          });
        }
      });
    }
    if (q.text && q.text.includes("/questions/")) {
      const doc = new DOMParser().parseFromString(q.text, "text/html");
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src) keysToDelete.push(extractKey(src));
      });
    }

    for (const k of keysToDelete) {
      if (k) {
        try {
          await deleteImageFromStorage(k);
        } catch (e) {
          console.error("Gagal menghapus gambar dari storage:", k, e);
        }
      }
    }
  };

  const handleDeleteClick = (q: QuestionData) => {
    setQuestionToDelete(q);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      await cleanupQuestionImages(questionToDelete);
      await remove(ref(database, `questions/${questionToDelete.id}`));
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus soal.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const qRef = ref(database, "questions");
      const snapshot = await get(qRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const updates: any = {};
        const keysToDelete = Object.keys(data).filter((k) => data[k].examId === examId);

        for (const key of keysToDelete) {
          await cleanupQuestionImages({ ...data[key], id: key });
          updates[key] = null; // Set null untuk menghapus
        }
        await update(qRef, updates);
      }
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus semua soal.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteAllDialogOpen(false);
    }
  };

  const handleImportWord = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseQuestionsFromWord(file);
      if (parsed.length === 0) throw new Error("Tidak ada soal yang dikenali dalam file.");

      const duplicates: number[] = [];
      let importedCount = 0;

      for (let i = 0; i < parsed.length; i++) {
        const q = parsed[i];

        // Cek apakah teks soal sudah ada di daftar (questions state)
        const isDuplicate = questions.some(
          (existing) => existing.text.trim().toLowerCase() === q.text.trim().toLowerCase()
        );

        if (isDuplicate) {
          duplicates.push(i + 1); // Menggunakan 1-based index untuk nomor soal
          continue;
        }

        let imageUrlToSave = q.imageUrl || "";
        let textToSave = q.text;
        const choicesToSave = JSON.parse(JSON.stringify(q.choices)); // Deep copy

        const uploadBase64ToR2 = async (base64Data: string, prefix: string) => {
          try {
            const blob = await (await fetch(base64Data)).blob();
            const ext = blob.type.split("/")[1] || "png";
            const fileToUpload = new File([blob], `${prefix}_${Date.now()}.${ext}`, { type: blob.type });
            const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
            return uploadSnap.url;
          } catch (e) {
            console.error(`Gagal upload base64 image (${prefix}) to R2`, e);
            return base64Data;
          }
        };

        // 🖼️ 1. Upload Gambar Cover Soal (dari q.imageUrl)
        if (imageUrlToSave && imageUrlToSave.startsWith("data:image/")) {
          imageUrlToSave = await uploadBase64ToR2(imageUrlToSave, `cover_${i}`);
        }

        // 🖼️ 2. Scan Teks Soal untuk base64 gambar
        const doc = new DOMParser().parseFromString(textToSave, "text/html");
        const imagesInText = doc.querySelectorAll("img[src^='data:image/']");
        for (let j = 0; j < imagesInText.length; j++) {
          const imgEl = imagesInText[j];
          const base64 = imgEl.getAttribute("src")!;
          const r2Url = await uploadBase64ToR2(base64, `text_${i}_${j}`);
          imgEl.setAttribute("src", r2Url);
        }
        textToSave = doc.body.innerHTML;

        // 🖼️ 3. Upload gambar Pilihan (dari data attribute atau text)
        for (const cKey in choicesToSave) {
          const choice = choicesToSave[cKey];
          // a. Cek imageUrl properti
          if (choice.imageUrl && choice.imageUrl.startsWith("data:image/")) {
            choice.imageUrl = await uploadBase64ToR2(choice.imageUrl, `choice_${i}_${cKey}`);
          } else if (!choice.imageUrl) {
            delete choice.imageUrl;
          }

          // b. Cek teks pilihan untuk base64
          if (choice.text && choice.text.includes("data:image/")) {
            const cDoc = new DOMParser().parseFromString(choice.text, "text/html");
            const cImgs = cDoc.querySelectorAll("img[src^='data:image/']");
            for (let k = 0; k < cImgs.length; k++) {
              const imgEl = cImgs[k];
              const base64 = imgEl.getAttribute("src")!;
              const r2Url = await uploadBase64ToR2(base64, `choice_text_${i}_${cKey}_${k}`);
              imgEl.setAttribute("src", r2Url);
            }
            choice.text = cDoc.body.innerHTML;
          }
        }

        const payload: any = {
          examId,
          text: textToSave,
          choices: choicesToSave,
          createdAt: Date.now(),
        };

        if (imageUrlToSave) {
          payload.imageUrl = imageUrlToSave;
        }

        await push(ref(database, "questions"), payload);
        importedCount++;
      }

      let message = `${importedCount} soal berhasil diimport.`;
      if (duplicates.length > 0) {
        message += `\n\n⚠️ Soal nomor [${duplicates.join(", ")}] dilewati karena sudah ada (Duplikat).`;
      }

      showAlert("Import Berhasil", message, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport Word.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative z-20 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bank-soal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Daftar Soal</h2>
            <p className="text-sm text-muted-foreground">
              {exam?.title || "Ujian"}
              {exam?.subject ? ` - ${exam?.subject}` : ""}
              {exam?.teacherName ? ` - ${exam?.teacherName}` : ""}
              {exam?.teacherCode ? ` (${exam?.teacherCode})` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Tombol Import hanya untuk owner atau admin */}
          {(role === "admin" || exam?.teacherId === teacherId) && (
            <div className="relative" ref={importRef}>
              <Button
                onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
                variant="secondary"
                size="lg"
                className="rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 dark:border-indigo-800/30 shadow-sm font-semibold"
              >
                Import <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isImportMenuOpen ? "rotate-180" : ""}`} />
              </Button>

              {isImportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20 p-1 flex flex-col gap-1 animate-in fade-in duration-150">
                  <ImportButton
                    onImport={(file) => {
                      setIsImportMenuOpen(false);
                      handleImportWord(file);
                    }}
                    isLoading={isImporting}
                    label="Upload file Word"
                    accept=".docx"
                    variant="item"
                  />
                  <a
                    href="/templates/Template_Soal.docx"
                    download="Template_Soal.docx"
                    onClick={() => setIsImportMenuOpen(false)}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg transition-all"
                  >
                    Download Template
                  </a>
                  <a
                    href="/templates/Template_Soal_Tabel.docx"
                    download="Template_Soal_Tabel.docx"
                    onClick={() => setIsImportMenuOpen(false)}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg transition-all"
                  >
                    Download Template (Format Tabel)
                  </a>
                </div>
              )}
            </div>
          )}

          {questions.length > 0 && (role === "admin" || exam?.teacherId === teacherId) && (
            <Button
              onClick={() => setDeleteAllDialogOpen(true)}
              variant="secondary"
              size="lg"
              className="rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 dark:border-rose-800/30 shadow-sm font-semibold"
            >
              <Trash className="mr-2 h-4 w-4" /> Hapus Semua
            </Button>
          )}

          {(role === "admin" || exam?.teacherId === teacherId) && (
            <div className="relative" ref={tambahRef}>
              <Button
                onClick={() => setIsTambahMenuOpen(!isTambahMenuOpen)}
                variant="secondary"
                size="lg"
                className="rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/20 shadow-sm font-semibold flex items-center gap-1"
              >
                Tambah <ChevronDown className={`h-4 w-4 transition-transform ${isTambahMenuOpen ? "rotate-180" : ""}`} />
              </Button>

              {isTambahMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20 p-1 flex flex-col gap-0.5 animate-in fade-in duration-150">
                  <button
                    onClick={() => {
                      setIsTambahMenuOpen(false);
                      handleCreateClick();
                    }}
                    className="flex items-center gap-2.5 p-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm rounded-lg transition-all font-medium text-left"
                  >
                    <Plus className="h-4 w-4 text-blue-500" />
                    Tambah Soal
                  </button>
                  <button
                    onClick={() => {
                      setIsTambahMenuOpen(false);
                      handleBatchCreateClick();
                    }}
                    className="flex items-center gap-2.5 p-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm rounded-lg transition-all font-medium text-left"
                  >
                    <Plus className="h-4 w-4 text-purple-500" />
                    Tambah Batch
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center p-12 border bg-card rounded-xl text-slate-400">Belum ada soal untuk ujian ini.</div>
          ) : (
            <div className="space-y-2 mt-4">
              <div className="bg-card border rounded-xl p-4 shadow-sm border-slate-200/60">
                <DataTable
                  data={questions}
                  columns={columns}
                  searchPlaceholder="Cari soal..."
                  emptyMessage="Tidak ada soal ditemukan."
                  actions={(q: QuestionData) => (
                    <div className="flex justify-end items-center gap-1.5 whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 dark:bg-sky-900/10 dark:text-sky-400 dark:hover:bg-sky-900/30 dark:border-sky-800/40 h-7 text-xs"
                        onClick={() => {
                          setPreviewQuestion(q);
                          setIsPreviewOpen(true);
                        }}
                      >
                        Pratinjau
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 dark:bg-sky-900/10 dark:text-sky-400 dark:hover:bg-sky-900/30 dark:border-sky-800/40 h-7 text-xs"
                        onClick={() => {
                          setPreviewQuestion(q);
                          setIsPreviewOpen(true);
                        }}
                      >
                        Pratinjau
                      </Button>
                      {(role === "admin" || exam?.teacherId === teacherId) && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/30 dark:border-green-800/40 h-7 text-xs"
                            onClick={() => handleEditClick(q)}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:border-rose-800/40 h-7 text-xs"
                            onClick={() => handleDeleteClick(q)}
                          >
                            <Trash className="h-4 w-4 mr-1" /> Hapus
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog for Create/Edit Question */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Soal" : "Tambah Soal"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="text" label="Pertanyaan" error={undefined}>
              <div className="bg-card rounded-md border flex flex-col">
                <ReactQuill
                  key={selectedQuestion ? `edit-${selectedQuestion.id}` : "create-main"}
                  ref={quillRef}
                  theme="snow"
                  value={formValues.text}
                  onChange={(content) => setFormValues({ ...formValues, text: content })}
                  placeholder="Tuliskan pertanyaan disini..."
                  modules={quillModules}
                  className="[&_.ql-editor]:min-h-[120px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
                />
              </div>
            </FormField>

            {/* 🏷️ Pengaturan Wacana Literasi */}
            <div className="bg-blue-50/40 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-3">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="literasi-active" 
                  checked={isLiterasiActive} 
                  onChange={(e) => {
                    setIsLiterasiActive(e.target.checked);
                    if (!e.target.checked) {
                      setFormValues({ ...formValues, groupId: "", groupText: "" });
                    }
                  }} 
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="literasi-active" className="text-sm font-semibold text-blue-700 dark:text-blue-400 cursor-pointer">
                  Aktifkan Soal Literasi
                </label>
              </div>

              {isLiterasiActive && (
                <div className="space-y-2.5 pt-2 border-t border-blue-100/60 dark:border-blue-900/40">
                  <FormField id="groupId" label="Pilih / Hubungkan Literasi" error={undefined}>
                    <select
                      value={formValues.groupId === "NEW_LITERASI" ? "NEW_LITERASI" : (literasiMode === "create" ? "NEW_LITERASI" : formValues.groupId)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "NEW_LITERASI") {
                          setLiterasiMode("create");
                          setFormValues({ ...formValues, groupId: "", groupText: "" });
                        } else {
                          setLiterasiMode("select");
                          setFormValues({ 
                            ...formValues, 
                            groupId: val, 
                            groupText: existingLiteracies[val] || "" 
                          });
                        }
                      }}
                      className="bg-card w-full rounded-md border text-sm h-9 px-2 cursor-pointer text-slate-700 dark:text-slate-200"
                    >
                      <option value="">-- Pilih Paket Literasi --</option>
                      {Object.keys(existingLiteracies).map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                      <option value="NEW_LITERASI" className="font-bold text-blue-600">+ Buat Literasi Baru</option>
                    </select>
                    
                    {/* 🔒 Pratinjau Terkunci (Read-Only) untuk Pilih Mode */}
                    {literasiMode === "select" && formValues.groupId && existingLiteracies[formValues.groupId] && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          🔒 Wacana Terkunci (Hanya Edit di Soal #1 grup ini)
                        </span>
                        <div 
                          className="text-[11px] text-slate-600 dark:text-slate-400 [&_img]:max-w-[30px] line-clamp-2 leading-relaxed" 
                          dangerouslySetInnerHTML={{ __html: existingLiteracies[formValues.groupId] }} 
                        />
                      </div>
                    )}
                  </FormField>

                  {literasiMode === "create" && (
                    <div className="space-y-2 mt-2">
                      <FormField id="newGroupId" label="Kode / Nama Literasi Baru" error={undefined}>
                        <Input
                          placeholder="Contoh: literasi1"
                          value={formValues.groupId === "NEW_LITERASI" ? "" : formValues.groupId}
                          onChange={(e) => setFormValues({ ...formValues, groupId: e.target.value })}
                          className="bg-card rounded-md border text-sm h-9"
                        />
                      </FormField>

                      <FormField id="groupText" label="Teks Wacana / Cerita Literasi Baru" error={undefined}>
                        <div className="bg-card rounded-md border flex flex-col mt-1">
                          <ReactQuill
                            key={`group-create`}
                            theme="snow"
                            value={formValues.groupText || ""}
                            onChange={(content) => setFormValues({ ...formValues, groupText: content })}
                            placeholder="Ketikkan teks wacana literasi di sini..."
                            modules={quillModules}
                            className="[&_.ql-editor]:min-h-[100px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
                          />
                        </div>
                      </FormField>
                    </div>
                  )}
                </div>
              )}
            </div>

            <FormField id="image" label="Gambar Cover Soal (Opsional)" error={undefined}>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-400 -mt-1 mb-1">Gambar ini akan ditampilkan tepat di atas teks pertanyaan utama pada lembar ujian siswa.</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 cursor-pointer bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg h-9 text-xs px-3 border border-slate-200 dark:border-slate-800 transition-all font-medium w-fit shadow-sm"
                    onClick={() => {
                      setGalleryTarget({ type: "cover" });
                      setIsPickerOpen(true);
                    }}
                  >
                    <Image className="w-4 h-4 text-slate-400" />
                    <span>{questionFile || formValues.imageUrl ? "Ganti Gambar" : "Tambah Gambar"}</span>
                  </button>
                  {(questionFile || formValues.imageUrl) && (
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={questionFile ? URL.createObjectURL(questionFile) : formValues.imageUrl}
                        alt="Pratinjau Soal"
                        className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                      />
                      {coverSizeInfo && (
                        <span className="text-[9px] text-green-600 font-semibold bg-green-50/80 px-1 py-0.5 rounded border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/40 shadow-sm">
                          ⚡ {coverSizeInfo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </FormField>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 block">Pilihan Jawaban</label>
              {['a', 'b', 'c', 'd', 'e'].map((letter) => (
                <div key={letter} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex gap-3 items-center">
                    <div className="font-bold text-sm w-4">{letter.toUpperCase()}.</div>
                    <div className="bg-card rounded-md border flex-1">
                      <ReactQuill
                        key={selectedQuestion ? `edit-${selectedQuestion.id}-${letter}` : `create-${letter}`}
                        theme="snow"
                        value={formValues.choices[letter].text}
                        onChange={(content) => handleChoiceChange(letter, 'text', content)}
                        placeholder={`Jawaban ${letter.toUpperCase()} ...`}
                        modules={{
                          toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'color': [] }],
                            ['clean']
                          ],
                        }}
                        className="[&_.ql-editor]:min-h-[42px] [&_.ql-editor]:py-2 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-1 [&_.ql-toolbar]:py-0 [&_.ql-formats]:mr-1"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        type="button"
                        className={formValues.choices[letter].isCorrect ? "bg-green-50 text-green-700 border border-green-100 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/40 hover:bg-green-100 h-8 text-xs font-bold" : "h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"}
                        size="sm"
                        onClick={() => handleChoiceChange(letter, 'isCorrect', true)}
                      >
                        Benar
                      </Button>
                      <button
                        type="button"
                        className="flex items-center justify-center gap-1 cursor-pointer bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md h-8 text-[11px] px-2 border border-slate-200 dark:border-slate-800 transition-all font-medium"
                        onClick={() => {
                          setGalleryTarget({ type: "choice", letter });
                          setIsPickerOpen(true);
                        }}
                      >
                        <Image className="w-3.5 h-3.5 text-slate-400" />
                        <span>{choiceFiles[letter] || formValues.choices[letter].imageUrl ? "Ganti" : "Gambar"}</span>
                      </button>
                    </div>
                  </div>
                  {(choiceFiles[letter] || formValues.choices[letter].imageUrl) && (
                    <div className="pl-7 pt-1 flex items-center gap-2">
                      <img
                        src={choiceFiles[letter] ? URL.createObjectURL(choiceFiles[letter]!) : formValues.choices[letter].imageUrl}
                        alt={`Pratinjau ${letter}`}
                        className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                      />
                      {choicesSizeInfo[letter] && (
                        <span className="text-[9px] text-green-600 font-semibold bg-green-50/80 px-1 py-0.5 rounded border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/40 shadow-sm">
                          ⚡ {choicesSizeInfo[letter]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Soal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Soal</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <Card className="rounded-xl border shadow-sm mt-3">
              <CardHeader className="p-4 pb-2">
                {/* 🛡️ Header Label untuk Literasi */}
                <div className="text-sm font-semibold text-slate-400 mb-2">
                  {previewQuestion.groupId && (() => {
                    const groupQuestions = questions.filter(q => q.groupId === previewQuestion.groupId);
                    const indexInGroup = groupQuestions.findIndex(q => q.id === previewQuestion.id) + 1;
                    return (
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">
                        {previewQuestion.groupId} - Soal {indexInGroup > 0 ? indexInGroup : 1}
                      </span>
                    );
                  })()}
                </div>

                {/* 🔖 Render Literasi Jika Tergabung dalam Grup (Seperti di CBT Siswa) */}
                {previewQuestion.groupId && (() => {
                  const firstInGroup = questions.find(q => q.groupId === previewQuestion.groupId);
                  if (firstInGroup) {
                    const textToShow = firstInGroup.groupText || firstInGroup.text;
                    if (!textToShow) return null;
                    const hasCover = firstInGroup.imageUrl;

                    return (
                      <div className="bg-blue-50/20 dark:bg-blue-950/10 p-4 rounded-xl border border-dashed border-blue-200 dark:border-blue-800/40 mb-3 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/40 w-fit block">Wacana Literasi</span>
                        {hasCover && (
                          <div className="mt-2">
                            <img src={firstInGroup.imageUrl} className="max-w-sm h-auto mx-auto block rounded-lg border shadow-sm" alt="Cover Literasi" />
                          </div>
                        )}
                        <div 
                          className={`text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 [&_img]:max-w-sm [&_img]:mx-auto [&_img]:block font-medium p-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_ol]:my-2 [&_ul]:my-2 ql-editor ${hasCover ? "[&_img]:hidden" : ""}`} 
                          dangerouslySetInnerHTML={{ __html: textToShow }} 
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Question Text */}
                <div 
                  className={`ql-editor font-normal text-slate-800 dark:text-white break-words [&_p]:mb-1 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 ${previewQuestion.imageUrl ? "[&_img]:hidden" : ""}`} 
                  dangerouslySetInnerHTML={{ __html: previewQuestion.text }} 
                />
                
                {previewQuestion.imageUrl && (
                  <div className="mt-2">
                    <img src={previewQuestion.imageUrl} alt="Gambar Soal" className="max-w-md h-auto rounded-xl border border-slate-200 shadow-sm" />
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="p-4 pt-0 space-y-2.5">
                {Object.keys(previewQuestion.choices || {}).map((cKey, idx) => {
                  const choice = previewQuestion.choices[cKey];
                  return (
                    <div 
                      key={cKey} 
                      className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
                        choice.isCorrect 
                          ? "bg-green-50/80 dark:bg-green-950/40 border-green-200 shadow-sm text-green-700 dark:text-green-400 font-bold" 
                          : "bg-card border-slate-200 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-sm ${
                        choice.isCorrect ? "bg-green-600 border-green-600 text-white" : "border-slate-300 text-slate-500 dark:text-slate-400"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1 text-sm font-medium">
                        <div className={`break-words ql-editor p-0 [&_img]:max-w-[200px] [&_img]:h-auto [&_img]:rounded-lg [&_img]:mt-1 text-inherit ${choice.isCorrect ? "font-bold" : "font-normal"}`} dangerouslySetInnerHTML={{ __html: choice.text }} />
                        {choice.imageUrl && (
                          <img src={choice.imageUrl} alt={`Pilihan ${cKey.toUpperCase()}`} className="max-h-[150px] w-auto rounded-lg mt-1 border" />
                        )}
                      </div>
                      {choice.isCorrect && <Check className="h-4 w-4 text-green-600 shrink-0 ml-2" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for Batch Create Questions */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Soal Manual (Batch)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {batchQuestions.map((q, index) => (
              <div key={index} className="bg-card border rounded-xl p-3 shadow-sm relative space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-400 text-xs">Soal #{index + 1}</span>
                  {batchQuestions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveBatchRow(index)} className="h-6 w-6 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 rounded-lg"><Trash className="h-3 w-3" /></Button>
                  )}
                </div>

                <div className="bg-card rounded-lg border flex flex-col flex-1">
                  <ReactQuill
                    theme="snow"
                    value={q.text}
                    onChange={(content) => updateBatchItem(index, 'text', content)}
                    placeholder="Tuliskan pertanyaan disini..."
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }],
                        ['clean']
                      ],
                    }}
                    className="[&_.ql-editor]:min-h-[44px] [&_.ql-editor]:py-1 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-1 [&_.ql-toolbar]:py-0 [&_.ql-formats]:mr-1 text-sm flex-1"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg h-7 text-[11px] px-2 border border-slate-200 dark:border-slate-800 font-medium transition-all"
                    onClick={() => {
                      setGalleryTarget({ type: "batch", index });
                      setIsPickerOpen(true);
                    }}
                  >
                    <Image className="h-3.5 w-3.5" />
                    <span>{q.imageFile || q.imageUrl ? "Ganti Gambar" : "Tambah Gambar"}</span>
                  </button>
                  {(q.imageFile || q.imageUrl) && (
                    <div className="flex items-center gap-1.5 border l-2 pl-2">
                      <img src={q.imageFile ? URL.createObjectURL(q.imageFile) : q.imageUrl} className="h-7 w-auto rounded border" alt="Preview" />
                      <Button variant="ghost" size="icon" onClick={() => { updateBatchItem(index, 'imageFile', null); updateBatchItem(index, 'imageUrl', ''); }} className="h-5 w-5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-0"><Trash className="h-3 w-3" /></Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1.5 border-t pt-2">
                  {['a', 'b', 'c', 'd', 'e'].map(letter => (
                    <div key={letter} className="relative">
                      <input
                        type="text"
                        placeholder={`Pil ${letter.toUpperCase()}`}
                        value={q.choices[letter].text}
                        onChange={(e) => updateBatchChoice(index, letter, e.target.value)}
                        className={`w-full text-xs p-2 rounded-lg border border-slate-200/80 dark:border-slate-800/80 focus:outline-none focus:ring-1 focus:ring-blue-600 pr-8 ${q.correctKey === letter ? "bg-green-50/80 dark:bg-green-950/40 border-green-200 dark:border-green-800 font-medium text-green-800 dark:text-green-400" : "bg-card dark:bg-slate-900 text-slate-700 dark:text-slate-200"}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateBatchItem(index, 'correctKey', letter)}
                        className={`absolute right-1.5 top-1.5 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] font-bold transition-all ${q.correctKey === letter ? "bg-green-600 text-white border-transparent" : "bg-card dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800"}`}
                      >
                        {letter.toUpperCase()}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={handleAddBatchRow} className="rounded-xl flex items-center gap-1 text-slate-600 text-xs">
                <Plus className="h-3.5 w-3.5" /> Tambah Soal Lain
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)} className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</Button>
            <Button onClick={handleSaveBatch} disabled={isSavingBatch} className="bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">
              {isSavingBatch ? "Menyimpan..." : `Simpan ${batchQuestions.length} Soal`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Soal"
        description="Apakah Anda yakin ingin menghapus soal ini?"
        itemName="Satu item soal ujian"
        isLoading={isDeleting}
      />

      <DeleteConfirmationDialog
        isOpen={deleteAllDialogOpen}
        onClose={() => setDeleteAllDialogOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Hapus Semua Soal"
        description="Apakah Anda yakin ingin menghapus seluruh soal dalam ujian ini? Tindakan ini tidak dapat dibatalkan."
        itemName={`Total ${questions.length} soal ujian`}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={async () => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel}
        showCancel={confirmModal.showCancel}
      />
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-3xl bg-card max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galeri Media Ujian</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {galleryImages.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-sm">Belum ada gambar yang bisa digunakan di ujian ini.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {galleryImages.map((src, idx) => (
                  <div
                    key={idx}
                    onClick={() => handlePickGallery(src)}
                    className="group relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-2 h-28"
                  >
                    <img src={src} alt="Media" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded-md">Gunakan</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-sm bg-card p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Pilih Sumber Gambar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => globalFileInputRef.current?.click()}
            >
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 text-purple-600 dark:text-purple-400">
                <Image className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-xs">Unggah Dari Komputer</span>
                <span className="text-[10px] text-slate-400">File foto maksimal 2MB</span>
              </div>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => { setIsPickerOpen(false); setIsGalleryOpen(true); loadGalleryImages(); }}
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 text-blue-600 dark:text-blue-400">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-xs">Ambil Dari Galeri</span>
                <span className="text-[10px] text-slate-400">Gunakan file yang sudah di-upload</span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={globalFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleGlobalFileSelect}
      />
    </div>
  );
};

export default QuestionsPage;
