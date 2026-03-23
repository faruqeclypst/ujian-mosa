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
  const [isImporting, setIsImporting] = useState(false); // <--- added

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
      alert("Gagal menyimpan data mata pelajaran.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!mapelToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMapel(mapelToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus mapel", error);
      alert("Gagal menghapus mata pelajaran.");
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
      if (parsed.length === 0) return alert("File kosong!");
      for (const row of parsed) {
        await createMapel({ name: row.name });
      }
      alert(`${parsed.length} mata pelajaran berhasil diimport.`);
    } catch (err: any) {
      alert(err.message || "Gagal mengimport mapel.");
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Mata Pelajaran</h2>
          <p className="text-sm text-muted-foreground">Kelola daftar mata pelajaran untuk jadwal piket.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="w-full sm:w-auto" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Mapel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{dialogMode === "edit" ? "Edit Data Mapel" : "Tambah Data Mapel"}</DialogTitle>
              </DialogHeader>
              <MapelForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitMapel}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
              />
            </DialogContent>
          </Dialog>
          <ImportButton onImport={handleImportMapels} isLoading={isImporting} />
          <ExportButton onExport={handleExportMapels} />
          <Button onClick={() => downloadMapelImportTemplate()} variant="outline">
            Download Template
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
    </div>
  );
};

export default MapelPage;
