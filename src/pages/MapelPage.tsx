import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { usePiket } from "../context/PiketContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import MapelForm, { MapelFormValues } from "../components/piket/MapelForm";
import MapelTable from "../components/tables/MapelTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadMapelImportTemplate, exportMapelToExcel, parseMapelImportExcel } from "../lib/mapelExcel";
import type { SubjectData } from "../types/piket";

const MapelPage = () => {
  const { mapels, loading, createMapel, updateMapel, deleteMapel } = usePiket();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedMapel, setSelectedMapel] = useState<SubjectData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mapelToDelete, setMapelToDelete] = useState<SubjectData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setAlertDialog({ isOpen: true, title, description, type });
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedMapel(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (mapel: SubjectData) => {
    setDialogMode("edit");
    setSelectedMapel(mapel);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (mapel: SubjectData) => {
    setMapelToDelete(mapel);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedMapel(null);
  };

  const handleSubmitMapel = async (values: MapelFormValues) => {
    try {
      if (dialogMode === "edit" && selectedMapel) {
        await updateMapel(selectedMapel.id, values);
      } else {
        await createMapel(values);
      }
      closeDialog();
    } catch (error) {
      console.error("Gagal menyimpan data mapel", error);
      showAlert("Gagal", "Gagal menyimpan data mata pelajaran.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!mapelToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMapel(mapelToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus mapel", error);
      showAlert("Gagal", "Gagal menghapus mata pelajaran.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMapelToDelete(null);
    }
  };

  const handleImportMapels = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseMapelImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      for (const row of parsed) {
        await createMapel({ name: row.name });
      }
      showAlert("Import Berhasil", `${parsed.length} mata pelajaran berhasil diimport.`, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport mapel.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportMapels = () => {
    exportMapelToExcel({ mapels, filename: "data-mapel.xlsx" });
  };

  const defaultValues = selectedMapel ? { name: selectedMapel.name } : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Data Mata Pelajaran
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar mata pelajaran untuk jadwal ujian.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10 rounded-xl" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Tambah Mapel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? "Edit Data Mapel" : "Tambah Data Mapel"}</DialogTitle>
              </DialogHeader>
              <MapelForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitMapel}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <ImportButton onImport={handleImportMapels} isLoading={isImporting} />
          <ExportButton onExport={handleExportMapels} />
          <Button onClick={() => downloadMapelImportTemplate()} variant="outline" size="sm" className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <MapelTable mapels={mapels} onEdit={handleEditClick} onDelete={handleDeleteClick} />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Mapel"
        description="Apakah Anda yakin ingin menghapus data mata pelajaran ini?"
        itemName={`Mapel ${mapelToDelete?.name || ""}`}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        description={alertDialog.description}
        type={alertDialog.type}
        confirmLabel="OK"
        showCancel={false}
      />
    </div>
  );
};

export default MapelPage;
