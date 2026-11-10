import { useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Printer, KeyRound, ArrowLeft, GraduationCap } from "lucide-react";
import { useExamData } from "../../context/ExamDataContext";
import { useTenant } from "../../context/TenantContext";
import { NeonPageHeader, NeonBadge, NeonButton } from "../../components/ui";
import { PrintExamCardsDialog } from "../../components/dialogs/PrintExamCardsDialog";

const PrintExamCardsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { students, classes, loading } = useExamData();
  const { terminology } = useTenant();

  const queryClassId = searchParams.get("classId") || "ALL";
  const queryStudentId = searchParams.get("studentId");
  const selectedStudentIds = useMemo(
    () => (queryStudentId ? [queryStudentId] : []),
    [queryStudentId]
  );

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {/* ── 1. Top Header Bar ── */}
        <NeonPageHeader
          bordered
          onBack={() => navigate("/admin/student")}
          backTitle="Kembali ke Data Siswa"
          title="Cetak Kartu Peserta Ujian"
          subtitle="Studio pratinjau dan pencetakan lembar kartu ujian resmi ANBK/CBT presisi ukuran A4 siap potong."
          badge={
            <NeonBadge variant="purple">
              Dokumen Cetak
            </NeonBadge>
          }
          breadcrumbs={
            <>
              <Link
                to="/admin/student"
                className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors shrink-0"
              >
                {terminology.student}
              </Link>
              <span>/</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                Cetak Kartu
              </span>
            </>
          }
        />

        {/* ── 2. Full-Page Studio Canvas ── */}
        <div className="w-full">
          <PrintExamCardsDialog
            isOpen={true}
            onClose={() => navigate("/admin/student")}
            students={students}
            classes={classes}
            filterClassId={queryClassId}
            selectedStudentIds={selectedStudentIds}
            isStandalonePage={true}
          />
        </div>
      </div>
    </div>
  );
};

export default PrintExamCardsPage;
