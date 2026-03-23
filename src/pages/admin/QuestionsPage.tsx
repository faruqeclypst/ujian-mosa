import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Image, ChevronDown, FileText, Download, Eye } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { Card, CardHeader, CardContent, CardTitle } from "../../components/ui/card";
import { uploadInventoryImage } from "../../lib/storage";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { usePiket } from "../../context/PiketContext";
import { DataTable } from "../../components/ui/data-table";
export interface QuestionData {
  id: string;
  examId: string;
  text: string;
  imageUrl?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
}

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
        <div className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text }} />
        {item.imageUrl && (
          <div className="flex items-center gap-1 text-xs text-blue-500 mt-1">
            <span className="p-1 rounded-md bg-blue-50 text-blue-600 flex items-center gap-1 font-semibold text-[10px] border border-blue-200">
              🖼️ Bergambar
            </span>
          </div>
        )}
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
          <span className="p-1 px-2 rounded-md bg-slate-100 text-slate-600 text-xs border border-slate-200">{keys.length} Pilihan</span>
          {correctKey && (
            <span className="p-1 px-2 text-[11px] font-bold rounded-md bg-green-50 text-green-600 border border-green-200">
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
    choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
  }>({
    text: "",
    choices: {
      a: { text: "", isCorrect: false },
      b: { text: "", isCorrect: false },
      c: { text: "", isCorrect: false },
      d: { text: "", isCorrect: false },
      e: { text: "", isCorrect: false },
    }
  });

  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [choiceFiles, setChoiceFiles] = useState<Record<string, File | null>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false); // <--- Dropdown state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false); // <--- Delete All State

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: "", description: "", type: "info", confirmLabel: "Ok", onConfirm: () => { } });
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
      alert("Gagal! Tidak ada soal yang diisi teks pertanyaannya.");
      return;
    }

    // Validate all must have key
    const hasEmptyKeys = validQuestions.some(q => {
      const correctChoice = q.choices[q.correctKey];
      return !correctChoice.text || correctChoice.text.trim() === "";
    });

    if (hasEmptyKeys) {
      alert("Gagal! Kunci jawaban dari soal yang Anda ketik tidak boleh kosong teksnya.");
      return;
    }

    setIsSavingBatch(true);
    try {
      const qRef = ref(database, "questions");
      for (const q of validQuestions) {
        let imageUrl = "";
        if (q.imageFile) {
          try {
            const uploadSnap = await uploadInventoryImage(`questions/${examId}`, q.imageFile);
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

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          // Upload berkas ke R2 Storage
          const res = await uploadInventoryImage(`questions/${examId || "general"}`, file);
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection();
            quill.insertEmbed(range.index, "image", res.url);
          }
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
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['image', 'clean']
      ],
      handlers: {
        image: imageHandler
      }
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
      choices: {
        a: { text: "", isCorrect: false },
        b: { text: "", isCorrect: false },
        c: { text: "", isCorrect: false },
        d: { text: "", isCorrect: false },
        e: { text: "", isCorrect: false },
      }
    });
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
      choices: {
        a: { text: q.choices?.a?.text || "", imageUrl: q.choices?.a?.imageUrl, isCorrect: !!q.choices?.a?.isCorrect },
        b: { text: q.choices?.b?.text || "", imageUrl: q.choices?.b?.imageUrl, isCorrect: !!q.choices?.b?.isCorrect },
        c: { text: q.choices?.c?.text || "", imageUrl: q.choices?.c?.imageUrl, isCorrect: !!q.choices?.c?.isCorrect },
        d: { text: q.choices?.d?.text || "", imageUrl: q.choices?.d?.imageUrl, isCorrect: !!q.choices?.d?.isCorrect },
        e: { text: q.choices?.e?.text || "", imageUrl: q.choices?.e?.imageUrl, isCorrect: !!q.choices?.e?.isCorrect },
      }
    });
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
      alert("Gagal menyimpan! Teks pertanyaan tidak boleh kosong.");
      return;
    }

    // 2. Validasi Harus Ada Kunci Jawaban
    const hasCorrectAnswer = Object.values(formValues.choices).some((c) => c.isCorrect);
    if (!hasCorrectAnswer) {
      alert("Gagal menyimpan! Soal wajib memiliki minimal satu kunci jawaban.");
      return;
    }

    // 3. Validasi Teks Pilihan yang terpilih (Kunci Jawaban)
    const correctChoicesKeys = Object.keys(formValues.choices).filter(key => formValues.choices[key].isCorrect);
    const correctChoiceKey = correctChoicesKeys[0];
    const isCorrectChoiceEmpty = !formValues.choices[correctChoiceKey].text || formValues.choices[correctChoiceKey].text.replace(/<[^>]*>/g, '').trim() === "";
    if (isCorrectChoiceEmpty) {
      alert("Gagal menyimpan! Pilihan jawaban yang dipilih sebagai kunci jawaban tidak boleh kosong.");
      return;
    }

    // 4. Validasi Jumlah Pilihan yang Terisi (Minimal 2 pilihan)
    const filledChoicesCount = Object.values(formValues.choices).filter(c => c.text && c.text.replace(/<[^>]*>/g, '').trim() !== "").length;
    if (filledChoicesCount < 2) {
      alert("Gagal menyimpan! Minimal harus mengisi atau membuat 2 pilihan jawaban.");
      return;
    }

    try {
      let imageUrl = formValues.imageUrl || "";

      // 1. Upload file Soal Manual ke R2
      if (questionFile) {
        const res = await uploadInventoryImage(`questions/${examId}`, questionFile);
        imageUrl = res.url;
      }

      // 2. Upload file Pilihan Manual ke R2
      const updatedChoices = { ...formValues.choices };
      for (const key in choiceFiles) {
        const file = choiceFiles[key];
        if (file) {
          const res = await uploadInventoryImage(`questions/${examId}`, file);
          updatedChoices[key].imageUrl = res.url;
        }
      }

      // 🧹 Bersihkan undefined dari updatedChoices sebelum upload
      Object.keys(updatedChoices).forEach((key) => {
        if (!updatedChoices[key].imageUrl) {
          delete updatedChoices[key].imageUrl;
        }
      });

      const payload: any = {
        examId,
        text: formValues.text,
        choices: updatedChoices,
        createdAt: Date.now(),
      };

      if (imageUrl) {
        payload.imageUrl = imageUrl;
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
      alert("Gagal menyimpan soal.");
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
      await remove(ref(database, `questions/${questionToDelete.id}`));
    } catch (error) {
      alert("Gagal menghapus soal.");
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
        Object.keys(data).forEach((key) => {
          if (data[key].examId === examId) {
            updates[key] = null; // Set null untuk menghapus
          }
        });
        await update(qRef, updates);
      }
    } catch (error) {
      alert("Gagal menghapus semua soal.");
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
        const choicesToSave = { ...q.choices };

        // 🖼️ Upload gambar Soal jika ada base64 inline (R2 Storage)
        if (imageUrlToSave && imageUrlToSave.startsWith("data:image/")) {
          try {
            const blob = await (await fetch(imageUrlToSave)).blob();
            const fileToUpload = new File([blob], `question_${i}.png`, { type: blob.type || "image/png" });
            const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
            imageUrlToSave = uploadSnap.url;
          } catch (e) {
            console.error("Gagal upload gambar soal ke R2", e);
          }
        }

        // 🖼️ Upload gambar Pilihan jika ada base64 inline (R2 Storage)
        for (const cKey in choicesToSave) {
          if (choicesToSave[cKey].imageUrl && choicesToSave[cKey].imageUrl.startsWith("data:image/")) {
            try {
              const blob = await (await fetch(choicesToSave[cKey].imageUrl!)).blob();
              const fileToUpload = new File([blob], `choice_${i}_${cKey}.png`, { type: blob.type || "image/png" });
              const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
              choicesToSave[cKey].imageUrl = uploadSnap.url;
            } catch (e) {
              console.error("Gagal upload gambar pilihan ke R2", e);
            }
          } else if (!choicesToSave[cKey].imageUrl) {
            delete choicesToSave[cKey].imageUrl; // <--- Hapus undefined untuk kompatibilitas Firebase
          }
        }

        const payload: any = {
          examId,
          text: q.text,
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

      alert(message);
    } catch (err: any) {
      alert(err.message || "Gagal mengimport Word.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
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
          <div className="relative">
            <Button
              onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              Import <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isImportMenuOpen ? "rotate-180" : ""}`} />
            </Button>

            {isImportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsImportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-1 flex flex-col gap-1 animate-in fade-in duration-150">
                  <div className="relative flex items-center">
                    <ImportButton
                      onImport={(file) => {
                        setIsImportMenuOpen(false);
                        handleImportWord(file);
                      }}
                      isLoading={isImporting}
                      label="Upload file Word"
                      accept=".docx"
                    />
                  </div>
                  <a
                    href="/templates/Template_Soal.docx"
                    download="Template_Soal.docx"
                    onClick={() => setIsImportMenuOpen(false)}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 text-slate-700 text-sm rounded-lg transition-all"
                  >
                    <Download className="h-4 w-4 text-indigo-600" /> Download Template
                  </a>
                </div>
              </>
            )}
          </div>

          {questions.length > 0 && (
            <Button
              onClick={() => setDeleteAllDialogOpen(true)}
              variant="destructive"
              size="lg"
              className="rounded-xl"
            >
              <Trash className="mr-2 h-4 w-4" /> Hapus Semua
            </Button>
          )}

          <Button onClick={handleBatchCreateClick} variant="outline" size="lg" className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Tambah Batch
          </Button>

          <Button onClick={handleCreateClick} size="lg" className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Tambah Soal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center p-12 border bg-white rounded-xl text-slate-400">Belum ada soal untuk ujian ini.</div>
          ) : (
            <div className="space-y-2 mt-4">
              <div className="bg-white border rounded-xl p-4 shadow-sm border-slate-200/60">
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
                        className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200 dark:bg-sky-950 dark:text-sky-400"
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
                        className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                        onClick={() => handleEditClick(q)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                        onClick={() => handleDeleteClick(q)}
                      >
                        Hapus
                      </Button>
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
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Soal" : "Tambah Soal"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="text" label="Pertanyaan" error={undefined}>
              <div className="bg-white rounded-md border flex flex-col">
                <ReactQuill
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

            <FormField id="image" label="Gambar Cover Soal (Opsional)" error={undefined}>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-400 -mt-1 mb-1">Gambar ini akan ditampilkan tepat di atas teks pertanyaan utama pada lembar ujian siswa.</p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center justify-center gap-1.5 cursor-pointer bg-white hover:bg-slate-50 text-slate-700 rounded-lg h-9 text-xs px-3 border border-slate-200 transition-all font-medium w-fit shadow-sm">
                    <Image className="w-4 h-4 text-slate-400" />
                    <span>{questionFile || formValues.imageUrl ? "Ganti Gambar" : "Unggah Gambar"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {(questionFile || formValues.imageUrl) && (
                    <img
                      src={questionFile ? URL.createObjectURL(questionFile) : formValues.imageUrl}
                      alt="Pratinjau Soal"
                      className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                    />
                  )}
                </div>
              </div>
            </FormField>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 block">Pilihan Jawaban</label>
              {['a', 'b', 'c', 'd', 'e'].map((letter) => (
                <div key={letter} className="p-3 border rounded-xl space-y-2 bg-slate-50/50">
                  <div className="flex gap-3 items-center">
                    <div className="font-bold text-sm w-4">{letter.toUpperCase()}.</div>
                    <div className="bg-white rounded-md border flex-1">
                      <ReactQuill
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
                        variant={formValues.choices[letter].isCorrect ? "default" : "outline"}
                        className={formValues.choices[letter].isCorrect ? "bg-green-600 hover:bg-green-700 h-9 text-xs" : "h-9 text-xs"}
                        size="sm"
                        onClick={() => handleChoiceChange(letter, 'isCorrect', true)}
                      >
                        Benar
                      </Button>
                      <label className="flex items-center justify-center gap-1 cursor-pointer bg-white hover:bg-slate-50 text-slate-600 rounded-md h-8 text-[11px] px-2 border border-slate-200 transition-all font-medium">
                        <Image className="w-3 h-3 text-slate-400" />
                        <span>{choiceFiles[letter] || formValues.choices[letter].imageUrl ? "Ganti" : "Gambar"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setChoiceFiles(prev => ({ ...prev, [letter]: file }));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {(choiceFiles[letter] || formValues.choices[letter].imageUrl) && (
                    <div className="pl-7 pt-1">
                      <img
                        src={choiceFiles[letter] ? URL.createObjectURL(choiceFiles[letter]!) : formValues.choices[letter].imageUrl}
                        alt={`Pratinjau ${letter}`}
                        className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Soal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Soal</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="font-medium text-slate-800 dark:text-white break-words [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: previewQuestion.text }} />
                {previewQuestion.imageUrl && (
                  <div className="mt-2">
                    <img src={previewQuestion.imageUrl} alt="Gambar Soal" className="max-w-md h-auto rounded-xl border border-slate-200 shadow-sm" />
                  </div>
                )}
              </div>
              <div className="grid gap-2 text-sm max-w-xl">
                {Object.keys(previewQuestion.choices || {}).map((cKey) => {
                  const choice = previewQuestion.choices[cKey];
                  return (
                    <div key={cKey} className={`p-3 rounded-xl border flex items-center justify-between ${choice.isCorrect ? "bg-green-50/80 border-green-200 text-green-800 font-medium" : "bg-slate-50 border-slate-100 text-slate-700"
                      }`}>
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="font-bold text-slate-400 mt-0.5">{cKey.toUpperCase()}.</span>
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="break-words leading-relaxed [&_p]:m-0" dangerouslySetInnerHTML={{ __html: choice.text }} />
                          {choice.imageUrl && (
                            <img src={choice.imageUrl} alt={`Pilihan ${cKey.toUpperCase()}`} className="max-w-[180px] h-auto rounded-lg border border-slate-200/60 shadow-sm" />
                          )}
                        </div>
                      </div>
                      {choice.isCorrect && <Check className="h-4 w-4 text-green-600 shrink-0 ml-2" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for Batch Create Questions */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="max-w-4xl bg-slate-50 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Soal Manual (Batch)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {batchQuestions.map((q, index) => (
              <div key={index} className="bg-white border rounded-xl p-3 shadow-sm relative space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-400 text-xs">Soal #{index + 1}</span>
                  {batchQuestions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveBatchRow(index)} className="h-6 w-6 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash className="h-3 w-3" /></Button>
                  )}
                </div>

                <div className="bg-white rounded-lg border flex flex-col flex-1">
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
                  <label className="flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg h-7 text-[11px] px-2 border font-medium transition-all">
                    <Image className="h-3.5 w-3.5" />
                    <span>{q.imageFile ? "Ganti Gambar" : "Tambah Gambar"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => updateBatchItem(index, 'imageFile', e.target.files?.[0] || null)}
                    />
                  </label>
                  {q.imageFile && (
                    <div className="flex items-center gap-1.5 border l-2 pl-2">
                      <img src={URL.createObjectURL(q.imageFile)} className="h-7 w-auto rounded border" alt="Preview" />
                      <Button variant="ghost" size="icon" onClick={() => updateBatchItem(index, 'imageFile', null)} className="h-5 w-5 text-red-400 hover:text-red-500 hover:bg-red-50 p-0"><Trash className="h-3 w-3" /></Button>
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
                        className={`w-full text-xs p-2 rounded-lg border border-slate-200/80 focus:outline-none focus:ring-1 focus:ring-blue-600 pr-8 ${q.correctKey === letter ? "bg-green-50/80 border-green-200 font-medium text-green-800" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateBatchItem(index, 'correctKey', letter)}
                        className={`absolute right-1.5 top-1.5 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${q.correctKey === letter ? "bg-green-600 text-white border-transparent" : "bg-white text-slate-400 border-slate-200"}`}
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
            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveBatch} disabled={isSavingBatch} className="bg-blue-600 hover:bg-blue-700">
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
      />
    </div>
  );
};

export default QuestionsPage;
