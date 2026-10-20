import { useState, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Plus, 
  Trash, 
  Loader2, 
  BookOpen, 
  FileSpreadsheet, 
  Download, 
  ChevronDown,
  FileText,
  Upload,
  Edit,
  Info
} from "lucide-react";
import { 
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorEmpty,
} from "../components/ui/NeonInspector";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useExamData } from "../context/ExamDataContext";
import { useTenant } from "../context/TenantContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { SubjectForm, SubjectFormValues } from "../components/forms/SubjectForm";
import { SubjectTable } from "../components/tables/SubjectTable";
import BatchProgressDialog from "../components/dialogs/BatchProgressDialog";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { downloadSubjectImportTemplate, exportSubjectToExcel, parseSubjectImportExcel } from "../lib/subjectExcel";
import type { SubjectData } from "../types/exam";
import { NeonStatGrid, NeonStatCard } from "../components/ui/NeonStats";

const SubjectsPage = () => {
  const { subjects, teachers, loading, createSubject, updateSubject, deleteSubject } = useExamData();
  const { terminology, school } = useTenant();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(null);
  const [inspectedSubjectId, setInspectedSubjectId] = useState<string | null>(null);

  const inspectedSubject = useMemo(() => {
    return subjects.find(s => s.id === inspectedSubjectId) || subjects[0] || null;
  }, [subjects, inspectedSubjectId]);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    message: string;
    title: string;
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: "Proses Data",
  });

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "danger" | "warning" | "info";
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setAlertDialog({ isOpen: true, title, description, type, onConfirm, showCancel, confirmLabel });
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedSubject(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (subject: SubjectData) => {
    setDialogMode("edit");
    setSelectedSubject(subject);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (subject: SubjectData) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedSubject(null);
  };

  const handleSubmitSubject = async (values: SubjectFormValues) => {
    try {
      if (dialogMode === "edit" && selectedSubject) {
        await updateSubject(selectedSubject.id, values);
      } else {
        await createSubject(values);
      }
      closeDialog();
    } catch (error) {
      console.error(`Gagal menyimpan data ${terminology.subject.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menyimpan data ${terminology.subject.toLowerCase()}.`, "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSubject(subjectToDelete.id);
    } catch (error) {
      console.error(`Gagal menghapus ${terminology.subject.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menghapus ${terminology.subject.toLowerCase()}.`, "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSubjectToDelete(null);
    }
  };

  const handleImportSubjects = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseSubjectImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      
      setBatchProgress({
        isOpen: true,
        total: parsed.length,
        current: 0,
        message: "Memulai import data...",
        title: `Import ${terminology.subject}`
      });

      const failures: string[] = [];
      for (let i = 0; i < parsed.length; i++) {
        try {
          await createSubject({ name: parsed[i].name });
          setBatchProgress(prev => ({
            ...prev,
            current: i + 1,
            message: `Mengimport ${terminology.subject.toLowerCase()} (${i + 1}/${parsed.length})`
          }));
        } catch (err: any) {
          console.error(`Gagal import ${parsed[i].name}:`, err);
          failures.push(`${parsed[i].name} - ${err.message || "Error"}`);
        }
      }

      let message = `${parsed.length - failures.length} ${terminology.subject} berhasil diimport.`;
      if (failures.length > 0) {
        message += `\n\n❌ ${failures.length} data gagal:\n- ${failures.slice(0, 5).join("\n- ")}`;
      }
      
      showAlert("Hasil Import", message, failures.length > 0 ? "warning" : "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || `Gagal mengimport ${terminology.subject.toLowerCase()}.`, "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleExportSubjects = () => {
    exportSubjectToExcel({ subjects, filename: "data-mapel.xlsx" });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Hapus ${terminology.subject} Massal`,
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} ${terminology.subject.toLowerCase()} terpilih?`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan penghapusan...",
          title: `Hapus ${terminology.subject} Massal`
        });
        
        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => deleteSubject(id)));
            
            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Menghapus data ${terminology.subject.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error(`Gagal menghapus ${terminology.subject.toLowerCase()} massal`, error);
          showAlert("Gagal", `Gagal menghapus ${terminology.subject.toLowerCase()} massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const defaultValues = useMemo(() => 
    selectedSubject ? { name: selectedSubject.name } : { name: "" }, 
  [selectedSubject]);

  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <input
        id="subject-import-input"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportSubjects(file);
          e.target.value = "";
        }}
      />
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Data {terminology.subject}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">{schoolSlug}</span>
              <span>/</span>
              <span className="text-neutral-500 dark:text-neutral-400">master-data</span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">subjects</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </>
            ) : (
              <>
                {selectedIds.length > 0 && (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 animate-in fade-in"
                    onClick={handleBatchDelete}
                  >
                    <Trash className="h-3.5 w-3.5" />
                    <span>Hapus ({selectedIds.length})</span>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Opsi Data</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2.5 py-1">
                      Kelola {terminology.subject}
                    </DropdownMenuLabel>
                    <DropdownMenuItem 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      onClick={() => {
                        const input = document.getElementById("subject-import-input") as HTMLInputElement;
                        if (input) input.click();
                      }}
                    >
                      <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {isImporting ? "Mengimport..." : "Import dari Excel"}
                        </span>
                        <span className="text-[10px] text-neutral-400">Unggah file {terminology.subject.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleExportSubjects} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export ke Excel</span>
                        <span className="text-[10px] text-neutral-400">Unduh daftar {terminology.subject.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem 
                      onClick={() => downloadSubjectImportTemplate()} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-neutral-500" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Unduh Template</span>
                        <span className="text-[10px] text-neutral-400">Format file import Excel</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => { setSelectedSubject(null); setIsDialogOpen(true); }}
                      size="sm"
                      className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah {terminology.subject}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-white">
                        {dialogMode === "edit" ? `Edit Data ${terminology.subject}` : `Tambah Data ${terminology.subject}`}
                      </DialogTitle>
                    </DialogHeader>
                    <SubjectForm
                      defaultValues={defaultValues}
                      onSubmit={handleSubmitSubject}
                      submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* ── Top Stats Strip (3 Kartu Ringkas) ── */}
        <NeonStatGrid cols={3}>
          <NeonStatCard
            label={`Total ${terminology.subject}`}
            value={String(subjects.length)}
            unit="mapel"
            subText="Kurikulum aktif terdaftar"
            isLoading={loading}
          />
          <NeonStatCard
            label={`Total ${terminology.teacher} Terdaftar`}
            value={String(teachers.length)}
            unit="guru"
            indicator={true}
            subText="Tenaga pendidik pengampu"
            isLoading={loading}
          />
          <NeonStatCard
            label="Status Kurikulum"
            value="Tersinkron"
            unit=""
            indicator={true}
            subText="Siap dialokasikan ke Bank Soal"
            isLoading={loading}
          />
        </NeonStatGrid>

        {/* ── Main Content Grid: Table + Right Inspector ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0 space-y-6">
            <SubjectTable 
              subjects={subjects} 
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              onEdit={handleEditClick} 
              onDelete={handleDeleteClick} 
              isLoading={loading}
              activeKey={inspectedSubject?.id}
              onRowClick={(s) => setInspectedSubjectId(s.id)}
            />
          </div>

          {/* ── Right Sidebar / Inspector Panel ── */}
          <NeonInspector>
            <InspectorSection>
              <InspectorHeader
                title={`Detail ${terminology.subject}`}
                icon={BookOpen}
                badge={inspectedSubject ? "Terpilih" : "Ringkasan"}
              />

              {inspectedSubject ? (
                <div className="space-y-3 text-xs">
                  <InspectorField label={`Nama ${terminology.subject}`}>
                    <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {inspectedSubject.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                      ID Mapel: {inspectedSubject.id?.slice(0, 10)}
                    </div>
                  </InspectorField>

                  <InspectorGrid>
                    <InspectorField
                      label="Kurikulum"
                      value={
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          Aktif
                        </span>
                      }
                    />
                    <InspectorField
                      label="Kategori"
                      value="Mata Pelajaran"
                    />
                  </InspectorGrid>

                  <InspectorActions>
                    <InspectorButton
                      variant="primary"
                      icon={Edit}
                      onClick={() => handleEditClick(inspectedSubject)}
                    >
                      Edit {terminology.subject}
                    </InspectorButton>
                    <InspectorButton
                      variant="danger"
                      icon={Trash}
                      onClick={() => handleDeleteClick(inspectedSubject)}
                    >
                      Hapus {terminology.subject}
                    </InspectorButton>
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty
                  title={`Belum ada ${terminology.subject.toLowerCase()}`}
                  description={`Klik salah satu baris ${terminology.subject.toLowerCase()} pada tabel untuk menginspeksi rincian.`}
                />
              )}
            </InspectorSection>

            <InspectorSection divided>
              <InspectorHeader title="Panduan Kurikulum" icon={Info} />
              <div className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                <p>
                  Mata pelajaran menjadi acuan pembuatan Bank Soal CBT dan distribusi paket ujian kepada guru pengampu.
                </p>
                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-[11px]">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 block mb-0.5">💡 Integrasi Soal:</span>
                  Setelah menambahkan mapel di sini, guru dapat langsung memilih mapel ini saat membuat paket Bank Soal baru.
                </div>
              </div>
            </InspectorSection>
          </NeonInspector>
        </div>

        <ConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          type="danger"
          title={`Hapus ${terminology.subject}`}
          description={`Apakah Anda yakin ingin menghapus data ${terminology.subject.toLowerCase()} "${subjectToDelete?.name || ""}"?`}
          confirmLabel="Hapus"
          isLoading={isDeleting}
        />

        <ConfirmationDialog
          isOpen={alertDialog.isOpen}
          onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
          onConfirm={() => {
            if (alertDialog.onConfirm) alertDialog.onConfirm();
            setAlertDialog({ ...alertDialog, isOpen: false });
          }}
          title={alertDialog.title}
          description={alertDialog.description}
          type={alertDialog.type}
          confirmLabel={alertDialog.confirmLabel || "OK"}
          showCancel={alertDialog.showCancel}
        />

        <BatchProgressDialog progress={batchProgress} colorClass="bg-indigo-600" />
      </div>
    </div>
  );
};

export default SubjectsPage;

