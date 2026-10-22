import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { StudentTable } from "../components/tables/StudentTable";
import { ExportButton } from "../components/ui/export-button";
import { exportStudentToExcel } from "../lib/studentExcel";
import { ArrowLeftRight, Check, X, RotateCw, Trash, Users, GraduationCap, Sparkles, User, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import { Select } from "../components/ui/select";
import type { StudentData } from "../types/exam";
import { NeonStatGrid, NeonStatCard } from "../components/ui/NeonStats";
import { cn } from "../lib/utils";
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

const AlumniPage = () => {
  const { students, classes, loading, deleteStudent, updateStudent, updateStudentClassBatch } = useExamData();
  const { terminology, school } = useTenant();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");

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

  const mappedStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === "ALUMNI")
      .map((s) => ({ ...s, className: "Alumni / Lulus" }));
  }, [students]);

  // ── Inspector State & Memo ──
  const [inspectedAlumniId, setInspectedAlumniId] = useState<string | null>(null);

  const inspectedAlumni = useMemo(() => {
    if (inspectedAlumniId) {
      const found = mappedStudents.find((s) => s.id === inspectedAlumniId);
      if (found) return found;
    }
    return mappedStudents[0] || null;
  }, [inspectedAlumniId, mappedStudents]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleDeleteClick = (std: StudentData) => {
    setStudentToDelete(std);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleRestore = async (id: string) => {
    showAlert(
      `Pulihkan ${terminology.student}`,
      `Kembalikan ${terminology.student} ini ke status Aktif (Tanpa ${terminology.class})?`,
      "warning",
      async () => {
        try {
          await updateStudent(id, { classId: "" });
        } catch (err) {
          console.error(err);
          showAlert("Gagal", `Gagal memulihkan ${terminology.student}.`, "danger");
        }
      },
      true,
      "Ya, Pulihkan"
    );
  };

  const handleBatchUpdateClass = async () => {
    if (!targetClassId || selectedIds.length === 0) return;
    try {
      await updateStudentClassBatch(selectedIds, targetClassId);
      setIsBatchOpen(false);
      setSelectedIds([]);
      setTargetClassId("");
    } catch (error) {
      console.error(`Gagal memindahkan ${terminology.student.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal memindahkan ${terminology.student.toLowerCase()}.`, "danger");
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Pulihkan ${terminology.student} Massal`,
      `Kembalikan ${selectedIds.length} ${terminology.student.toLowerCase()} ini ke status Aktif (Tanpa ${terminology.class})?`,
      "warning",
      async () => {
        try {
          await updateStudentClassBatch(selectedIds, "");
          setSelectedIds([]);
        } catch (error) {
          console.error(`Gagal memulihkan ${terminology.student.toLowerCase()}`, error);
          showAlert("Gagal", `Gagal memulihkan ${terminology.student.toLowerCase()}.`, "danger");
        }
      },
      true,
      "Ya, Pulihkan"
    );
  };

  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Data Alumni / Lulusan
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:hidden">
              Arsip data siswa yang telah menyelesaikan masa pendidikan.
            </p>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">{schoolSlug}</span>
              <span>/</span>
              <span className="text-neutral-500 dark:text-neutral-400">master-data</span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">alumni</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {loading ? (
              <Skeleton className="h-8 w-28 rounded-lg" />
            ) : (
              <ExportButton 
                onExport={() => exportStudentToExcel({ students: mappedStudents, classes, filename: "data-alumni.xlsx" })} 
              />
            )}
          </div>
        </div>

        {/* ── Top Stats Strip (3 Kartu Ringkas) ── */}
        <NeonStatGrid cols={3}>
          <NeonStatCard
            label="Total Alumni"
            value={String(mappedStudents.length)}
            unit="alumni"
            subText="Siswa yang telah menyelesaikan pendidikan"
            isLoading={loading}
          />
          <NeonStatCard
            label="Status Data"
            value="Arsip Lulus"
            unit=""
            indicator={true}
            subText="Bisa dipulihkan kapan saja ke rombel aktif"
            isLoading={loading}
          />
          <NeonStatCard
            label={`Rombel ${terminology.class} Tersedia`}
            value={String(sortedClasses.length)}
            unit="kelas"
            subText="Pilihan tujuan pemulihan kelas"
            isLoading={loading}
          />
        </NeonStatGrid>

        {selectedIds.length > 0 && (
          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex flex-wrap items-center gap-2.5">
            <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>Pindah/Kembalikan ke {terminology.class} ({selectedIds.length})</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-white">
                    Kembalikan ke {terminology.class}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Pindahkan {selectedIds.length} {terminology.student.toLowerCase()} terpilih ke {terminology.class.toLowerCase()} tujuan.
                </p>
                
                <div className="space-y-4 pt-4">
                  <FormField id="batch-class" label={`${terminology.class} Tujuan`}>
                    <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                      <option value="">Pilih {terminology.class} Tujuan</option>
                      {sortedClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </Select>
                  </FormField>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsBatchOpen(false)}>Batal</Button>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs" 
                      onClick={handleBatchUpdateClass} 
                      disabled={!targetClassId}
                    >
                      Proses
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              onClick={handleBatchRestore}
            >
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Pulihkan Tanpa {terminology.class}</span>
            </Button>
          </div>
        )}

        {/* ── Main Content Grid: Table + Right Inspector ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0 space-y-6">
            <StudentTable 
              students={mappedStudents} 
              classes={classes}
              selectedIds={selectedIds} 
              onSelectChange={setSelectedIds} 
              onEdit={() => {}} 
              onDelete={handleDeleteClick} 
              title="Daftar Alumni"
              tableLoading={loading}
              activeKey={inspectedAlumni?.id}
              onRowClick={(std) => setInspectedAlumniId(std.id)}
              customActions={(student) => (
                <div className="flex justify-end gap-1.5 items-center">
                  <button 
                    className="p-1.5 bg-neutral-50 dark:bg-neutral-850 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
                    onClick={() => handleRestore(student.id)}
                    title={`Pulihkan ${terminology.student}`}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    className="p-1.5 bg-neutral-50 dark:bg-neutral-850 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
                    onClick={() => handleDeleteClick(student)}
                    title={`Hapus ${terminology.student}`}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            />
          </div>

          {/* ── Right Sidebar / Inspector Panel ── */}
          <NeonInspector>
            <InspectorSection>
              <InspectorHeader
                title="Detail Alumni"
                icon={GraduationCap}
                badge={inspectedAlumni ? "Terpilih" : "Ringkasan"}
              />

              {inspectedAlumni ? (
                <div className="space-y-3.5 text-xs">
                  {/* Alumni Profile Card */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border",
                      inspectedAlumni.gender === "P"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    )}>
                      {inspectedAlumni.name?.charAt(0)?.toUpperCase() || "A"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {inspectedAlumni.name}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                        NISN: {inspectedAlumni.nisn}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          Alumni / Lulus
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                          inspectedAlumni.gender === "P"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        )}>
                          {inspectedAlumni.gender === "P" ? "Perempuan" : "Laki-laki"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <InspectorGrid>
                    <InspectorField
                      label="Tempat, Tgl Lahir"
                      value={
                        inspectedAlumni.birthPlace || inspectedAlumni.birthDate
                          ? `${inspectedAlumni.birthPlace || "-"}, ${inspectedAlumni.birthDate || "-"}`
                          : "-"
                      }
                    />
                    <InspectorField
                      label="No. Peserta Arsip"
                      value={inspectedAlumni.examNumber || "-"}
                    />
                  </InspectorGrid>

                  <InspectorField label="Status Arsip CBT">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                      Arsip Non-Aktif (Bebas Kuota)
                    </span>
                  </InspectorField>

                  <InspectorActions>
                    <InspectorButton
                      variant="primary"
                      icon={RotateCw}
                      onClick={() => handleRestore(inspectedAlumni.id)}
                    >
                      Pulihkan ke Aktif
                    </InspectorButton>
                    <InspectorButton
                      variant="danger"
                      icon={Trash}
                      onClick={() => handleDeleteClick(inspectedAlumni)}
                    >
                      Hapus Permanen
                    </InspectorButton>
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty
                  icon={GraduationCap}
                  title="Pilih Alumni"
                  description="Klik salah satu baris alumni di tabel untuk melihat arsip lengkap atau memulihkan statusnya."
                />
              )}
            </InspectorSection>

            <InspectorSection divided>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/40 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Informasi Data Alumni</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Data alumni tersimpan sebagai arsip historis nilai dan sertifikat tanpa mengurangi kapasitas kuota aktif institusi Anda.
                </p>
              </div>
            </InspectorSection>
          </NeonInspector>
        </div>

        <ConfirmationDialog 
          isOpen={deleteDialogOpen} 
          onClose={() => setDeleteDialogOpen(false)} 
          onConfirm={handleConfirmDelete} 
          type="danger"
          title="Hapus Alumni" 
          description={`Apakah Anda yakin ingin menghapus data alumni "${studentToDelete?.name || ""}"?`} 
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
      </div>
    </div>
  );
};

export default AlumniPage;





