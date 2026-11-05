import React, { useState, useEffect, useMemo, useRef } from "react";
import QRCode from "qrcode";
import { 
  Printer, 
  Eye, 
  EyeOff, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  SlidersHorizontal,
  X
} from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import type { StudentData, ClassData } from "../../types/exam";
import { useTenant } from "../../context/TenantContext";

interface PrintExamCardsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  classes: ClassData[];
  selectedStudentIds?: string[];
  filterClassId?: string;
}

// Logo Resmi Kemdikbud / Tut Wuri Handayani (Vektor SVG Presisi - Zero Margin Atas Bawah)
const TutWuriHandayaniLogo = ({ height = 54 }: { height?: number }) => (
  <svg 
    viewBox="8 4 84 85" 
    style={{ height: height + 'px', width: Math.round(height * (84/85)) + 'px', display: 'block' }} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon points="50,5 92,35 77,88 23,88 8,35" fill="#00529C" stroke="#FFD700" strokeWidth="2.5" />
    <polygon points="50,9 88,37 74,84 26,84 12,37" fill="#005AA9" />
    <path d="M26 62 C 32 46, 42 42, 50 56 C 58 42, 68 46, 74 62 C 65 60, 56 65, 50 75 C 44 65, 35 60, 26 62 Z" fill="#FFFFFF" />
    <path d="M32 68 Q 50 71 50 78 Q 50 71 68 68 Q 50 63 32 68 Z" fill="#FFD700" />
    <path d="M50 22 C 53 30, 60 34, 55 42 C 53 45, 49 46, 47 43 C 44 38, 47 32, 50 22 Z" fill="#FF3B30" />
    <path d="M50 28 C 51 33, 55 36, 53 40 C 51 42, 49 42, 48 40 C 47 37, 49 34, 50 28 Z" fill="#FFCC00" />
    <circle cx="50" cy="53" r="2.5" fill="#FFD700" />
  </svg>
);

// Logo Kementerian Agama (Vektor SVG - Zero Margin Atas Bawah)
const KemenagLogo = ({ height = 54 }: { height?: number }) => (
  <svg 
    viewBox="7 3 86 87" 
    style={{ height: height + 'px', width: Math.round(height * (86/87)) + 'px', display: 'block' }} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon points="50,4 93,35 77,89 23,89 7,35" fill="#1B5E20" stroke="#FFD700" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="32" fill="#2E7D32" stroke="#FFD700" strokeWidth="1.5" />
    <rect x="47" y="28" width="6" height="34" fill="#FFD700" />
    <line x1="30" y1="36" x2="70" y2="36" stroke="#FFD700" strokeWidth="3" />
    <polygon points="30,36 24,50 36,50" fill="#FFD700" />
    <polygon points="70,36 64,50 76,50" fill="#FFD700" />
    <path d="M35 62 Q 50 66 50 72 Q 50 66 65 62 Q 50 58 35 62 Z" fill="#FFFFFF" />
  </svg>
);

export const PrintExamCardsDialog = ({
  isOpen,
  onClose,
  students,
  classes,
  selectedStudentIds = [],
  filterClassId = "ALL",
}: PrintExamCardsDialogProps) => {
  const { school, terminology } = useTenant();

  // Pengaturan Cepat
  const [layoutMode, setLayoutMode] = useState<"4" | "6">("4"); // 4 kartu (2x2) atau 6 kartu (2x3)
  const [printScope, setPrintScope] = useState<"selected" | "class" | "all">(
    selectedStudentIds.length > 0 ? "selected" : (filterClassId !== "ALL" ? "class" : "all")
  );
  const [examTitle, setExamTitle] = useState("ASESMEN SUMATIF SEKOLAH");
  const [showPassword, setShowPassword] = useState(true);

  // Tab Pengaturan (Simpel & Rapi)
  const [activeTab, setActiveTab] = useState<"quick" | "advanced">("quick");

  // Pengaturan Lanjutan
  const [academicYear, setAcademicYear] = useState(() => {
    const curYear = new Date().getFullYear();
    return `${curYear}/${curYear + 1}`;
  });
  const [cityDate, setCityDate] = useState(() => {
    const now = new Date();
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  });
  const [signerRole, setSignerRole] = useState<"Kepala Sekolah" | "Ketua Panitia" | "Proktor">("Kepala Sekolah");
  const [signerName, setSignerName] = useState("");
  const [signerNip, setSignerNip] = useState("");

  const [showRoomSession, setShowRoomSession] = useState(false);
  const [defaultRoom, setDefaultRoom] = useState("");
  const [defaultSession, setDefaultSession] = useState("");
  const [showBirthInfo, setShowBirthInfo] = useState(false);

  // Logo Kiri & Logo Kanan
  const [leftLogoType, setLeftLogoType] = useState<"tutwuri" | "kemenag" | "school" | "custom" | "none">("tutwuri");
  const [customLeftLogoUrl, setCustomLeftLogoUrl] = useState<string>("");
  const [rightLogoType, setRightLogoType] = useState<"school" | "tutwuri" | "kemenag" | "custom" | "none">("school");
  const [customRightLogoUrl, setCustomRightLogoUrl] = useState<string>("");
  const [schoolLogoFailed, setSchoolLogoFailed] = useState(false);

  // Zoom Pratinjau
  const [previewZoom, setPreviewZoom] = useState(0.8);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);

  const leftFileInputRef = useRef<HTMLInputElement>(null);
  const rightFileInputRef = useRef<HTMLInputElement>(null);

  // QR Codes Map
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  // Sinkronisasi target cetak saat props berubah
  useEffect(() => {
    if (selectedStudentIds.length > 0) {
      setPrintScope("selected");
    } else if (filterClassId !== "ALL") {
      setPrintScope("class");
    } else {
      setPrintScope("all");
    }
  }, [selectedStudentIds, filterClassId, isOpen]);

  // Filter daftar siswa
  const studentsToPrint = useMemo(() => {
    if (printScope === "selected" && selectedStudentIds.length > 0) {
      return students.filter(s => selectedStudentIds.includes(s.id));
    }
    if (printScope === "class" && filterClassId !== "ALL") {
      return students.filter(s => s.classId === filterClassId);
    }
    return students;
  }, [students, printScope, selectedStudentIds, filterClassId]);

  const is4Cards = layoutMode === "4";
  const cardsPerPage = is4Cards ? 4 : 6;
  const totalPages = Math.ceil(studentsToPrint.length / cardsPerPage);

  // Jaga batasan halaman aktif
  useEffect(() => {
    if (currentPreviewPage >= totalPages && totalPages > 0) {
      setCurrentPreviewPage(totalPages - 1);
    }
  }, [totalPages, currentPreviewPage]);

  // Generate QR Code untuk seluruh siswa
  useEffect(() => {
    if (!isOpen || studentsToPrint.length === 0) return;

    let isMounted = true;
    const generateAllQrs = async () => {
      const entries: Record<string, string> = {};
      for (const st of studentsToPrint) {
        try {
          const qrText = st.examNumber || (st as any).username || st.nisn;
          const url = await QRCode.toDataURL(qrText, {
            width: 120,
            margin: 0,
            color: { dark: "#000000", light: "#ffffff" }
          });
          entries[st.id] = url;
        } catch {
          // ignore
        }
      }
      if (isMounted) setQrCodes(entries);
    };

    generateAllQrs();
    return () => { isMounted = false; };
  }, [isOpen, studentsToPrint]);

  // Handler Upload Logo Kiri
  const handleLeftLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      setCustomLeftLogoUrl(re.target?.result as string);
      setLeftLogoType("custom");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Handler Upload Logo Kanan
  const handleRightLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      setCustomRightLogoUrl(re.target?.result as string);
      setRightLogoType("custom");
      setSchoolLogoFailed(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Format Tanggal Lahir
  const formatBirthInfo = (birthPlace?: string, birthDate?: string) => {
    const place = birthPlace ? birthPlace.trim() : "";
    let dateStr = "";
    if (birthDate) {
      try {
        const d = new Date(birthDate);
        if (!isNaN(d.getTime())) {
          const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
          dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        } else {
          dateStr = birthDate;
        }
      } catch {
        dateStr = birthDate;
      }
    }
    if (place && dateStr) return `${place}, ${dateStr}`;
    return place || dateStr || "";
  };

  // Render Logo Presisi yang Menempel Rata Atas & Bawah Teks Kop
  const renderLogoNode = (
    type: "tutwuri" | "kemenag" | "school" | "custom" | "none",
    customUrl: string,
    heightPx: number
  ) => {
    if (type === "none") return null;

    if (type === "school") {
      const schoolLogoUrl = (school as any)?.logo_url || (school as any)?.logo;
      if (schoolLogoUrl && !schoolLogoFailed) {
        return (
          <img 
            src={schoolLogoUrl} 
            alt="Logo Sekolah" 
            onError={() => setSchoolLogoFailed(true)}
            style={{ 
              height: heightPx + 'px', 
              width: "auto", 
              maxHeight: heightPx + 'px',
              maxWidth: Math.round(heightPx * 1.35) + 'px',
              objectFit: "contain", 
              display: "block" 
            }} 
          />
        );
      }
      return null;
    }

    if (type === "custom") {
      if (customUrl) {
        return (
          <img 
            src={customUrl} 
            alt="Logo" 
            style={{ 
              height: heightPx + 'px', 
              width: "auto", 
              maxHeight: heightPx + 'px',
              maxWidth: Math.round(heightPx * 1.35) + 'px',
              objectFit: "contain", 
              display: "block" 
            }} 
          />
        );
      }
      return null;
    }

    if (type === "kemenag") {
      return <KemenagLogo height={heightPx} />;
    }

    // Default: tutwuri (Kemdikbud)
    return <TutWuriHandayaniLogo height={heightPx} />;
  };

  // 🖨️ FUNGSI CETAK BULLETPROOF VIA ISOLATED IFRAME
  const handlePrint = () => {
    const printArea = document.getElementById("anbk-print-payload-hidden");
    if (!printArea) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kartu Peserta Ujian - ${examTitle}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: 210mm 297mm;
              margin: 6mm 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            }
            .a4-page {
              width: 100%;
              height: 282mm;
              max-height: 282mm;
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: ${is4Cards ? "1fr 1fr" : "1fr 1fr 1fr"};
              gap: 4mm;
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              box-sizing: border-box;
              overflow: hidden;
              margin: 0;
              padding: 0;
            }
            .a4-page:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            .card-item {
              border: 1.2px solid #000000;
              border-radius: 0px;
              padding: ${is4Cards ? "10px 14px" : "8px 10px"};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 100%;
              max-height: 100%;
              background: #ffffff;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }, 400);
  };

  if (!isOpen) return null;

  // 🏛️ TEMPLATE KARTU FORMAL ANBK / KEDINASAN RESMI
  const renderCardContent = (student: StudentData) => {
    const studentClass = classes.find(c => c.id === student.classId);
    const classNameText = studentClass?.name || student.className || "Kelas";
    const displayUsername = student.examNumber || (student as any).username || student.nisn;
    const displayPassword = showPassword ? (student.password || "12345678") : "*********";
    const birthText = formatBirthInfo(student.birthPlace, student.birthDate);
    
    const roomVal = student.room || defaultRoom;
    const sessionVal = student.session || defaultSession;
    const roomSessionDisplay = [roomVal, sessionVal].filter(Boolean).join(" / ");

    const headerHeight = is4Cards ? 54 : 44;
    const leftLogoNode = renderLogoNode(leftLogoType, customLeftLogoUrl, headerHeight);
    const rightLogoNode = renderLogoNode(rightLogoType, customRightLogoUrl, headerHeight);
    const hasLeft = leftLogoNode !== null;
    const hasRight = rightLogoNode !== null;

    return (
      <div 
        key={student.id}
        className="card-item"
        style={{ 
          boxSizing: "border-box", 
          backgroundColor: "#ffffff",
          color: "#000000",
          fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
          border: "1.2px solid #000000",
          borderRadius: "0px",
          padding: is4Cards ? "10px 14px" : "7px 10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden"
        }}
      >
        {/* 1. KOP KARTU RESMI KEDINASAN (UKURAN LOGO PRESISI SAMA DENGAN ATAS & BAWAH TEKS) */}
        <div style={{ marginBottom: is4Cards ? "8px" : "5px" }}>
          <div 
            style={{ 
              display: "flex",
              alignItems: "stretch",
              justifyContent: "space-between",
              gap: is4Cards ? "10px" : "8px",
              height: headerHeight + "px",
              minHeight: headerHeight + "px"
            }}
          >
            {/* Logo Kiri */}
            {hasLeft && (
              <div 
                style={{ 
                  flexShrink: 0, 
                  height: headerHeight + "px",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                {leftLogoNode}
              </div>
            )}

            {/* Teks Kop (Sejajar Atas & Bawah Bersama Logo) */}
            <div 
              style={{ 
                flex: 1, 
                height: headerHeight + "px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                textAlign: (hasLeft && hasRight) ? "center" : (hasLeft && !hasRight) ? "left" : (!hasLeft && hasRight) ? "right" : "center",
                padding: (hasLeft && hasRight) ? "0 4px" : "0",
                overflow: "hidden"
              }}
            >
              <div style={{ 
                fontSize: is4Cards ? "11.5px" : "9.5px", 
                fontWeight: 800, 
                textTransform: "uppercase", 
                letterSpacing: "0.5px", 
                color: "#000000",
                lineHeight: 1,
                margin: 0,
                padding: 0
              }}>
                KARTU TANDA PESERTA UJIAN
              </div>
              <div style={{ 
                fontSize: is4Cards ? "9.5px" : "8px", 
                fontWeight: 700, 
                textTransform: "uppercase", 
                color: "#1e293b",
                lineHeight: 1,
                margin: 0,
                padding: 0
              }}>
                {examTitle}
              </div>
              <div style={{ 
                fontSize: is4Cards ? "11.5px" : "9.5px", 
                fontWeight: 800, 
                textTransform: "uppercase", 
                color: "#000000",
                lineHeight: 1,
                margin: 0,
                padding: 0
              }}>
                {school?.name || "SATUAN PENDIDIKAN"}
              </div>
              <div style={{ 
                fontSize: is4Cards ? "8.5px" : "7px", 
                fontWeight: 600, 
                color: "#475569",
                lineHeight: 1,
                margin: 0,
                padding: 0
              }}>
                TAHUN PELAJARAN {academicYear}
              </div>
            </div>

            {/* Logo Kanan */}
            {hasRight && (
              <div 
                style={{ 
                  flexShrink: 0, 
                  height: headerHeight + "px",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                {rightLogoNode}
              </div>
            )}
          </div>

          {/* Garis Kop Ganda Kedinasan */}
          <div style={{ marginTop: is4Cards ? "5px" : "4px" }}>
            <div style={{ borderBottom: "1.8px solid #000000" }} />
            <div style={{ borderBottom: "0.5px solid #000000", marginTop: "1.5px" }} />
          </div>
        </div>

        {/* 2. BODY ATAS: PASFOTO 3X4 & BIODATA SISWA */}
        <div 
          style={{ 
            display: "flex", 
            alignItems: "flex-start", 
            gap: is4Cards ? "12px" : "8px", 
            marginBottom: is4Cards ? "8px" : "5px"
          }}
        >
          {/* Pasfoto 3x4 Formal */}
          <div 
            style={{ 
              width: is4Cards ? "24mm" : "20mm", 
              height: is4Cards ? "32mm" : "26mm", 
              border: "1px solid #64748b",
              borderRadius: "0px",
              backgroundColor: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0
            }}
          >
            {student.photo ? (
              <img 
                src={student.photo} 
                alt={student.name} 
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2px", textAlign: "center", color: "#94a3b8" }}>
                <span style={{ fontSize: is4Cards ? "8.5px" : "7.5px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#475569" }}>
                  FOTO
                </span>
                <span style={{ fontSize: is4Cards ? "7.5px" : "6.5px", fontWeight: 600, color: "#64748b" }}>
                  3 × 4
                </span>
              </div>
            )}
          </div>

          {/* Tabel Biodata Siswa */}
          <table 
            style={{ 
              flex: 1,
              width: "100%", 
              borderCollapse: "collapse",
              fontSize: is4Cards ? "9.5px" : "8.5px",
              lineHeight: is4Cards ? "1.35" : "1.25"
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: is4Cards ? "88px" : "72px", fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                  No. Peserta
                </td>
                <td style={{ width: "8px", fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                <td style={{ fontWeight: 800, color: "#000000", padding: "1.5px 0", fontFamily: "monospace", fontSize: is4Cards ? "10px" : "9px" }}>
                  {displayUsername}
                </td>
              </tr>

              {student.nisn && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                    NISN
                  </td>
                  <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                  <td style={{ fontWeight: 700, color: "#000000", padding: "1.5px 0", fontFamily: "monospace" }}>
                    {student.nisn}
                  </td>
                </tr>
              )}

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                  Nama Peserta
                </td>
                <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                <td style={{ fontWeight: 800, textTransform: "uppercase", color: "#000000", padding: "1.5px 0", wordBreak: "break-word" }}>
                  {student.name}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                  {terminology.class} / Rombel
                </td>
                <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                <td style={{ fontWeight: 700, color: "#000000", padding: "1.5px 0" }}>
                  {classNameText}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                  Jenis Kelamin
                </td>
                <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                <td style={{ fontWeight: 600, color: "#000000", padding: "1.5px 0" }}>
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
                </td>
              </tr>

              {showBirthInfo && birthText && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                    Tempat, Tgl Lahir
                  </td>
                  <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                  <td style={{ fontWeight: 600, color: "#000000", padding: "1.5px 0", wordBreak: "break-word" }}>
                    {birthText}
                  </td>
                </tr>
              )}

              {showRoomSession && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#334155", padding: "1.5px 0", whiteSpace: "nowrap" }}>
                    Ruang / Sesi
                  </td>
                  <td style={{ fontWeight: 600, color: "#334155", textAlign: "center", padding: "1.5px 0" }}>:</td>
                  <td style={{ fontWeight: 800, color: "#000000", padding: "1.5px 0" }}>
                    {roomSessionDisplay || "-"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. KOTAK KREDENSIAL LOGIN CBT (BERSIH & FORMAL TANPA KOTAK PUTUS-PUTUS) */}
        <div 
          style={{
            border: "1px solid #334155",
            borderRadius: "0px",
            backgroundColor: "#f8fafc",
            padding: is4Cards ? "6px 10px" : "4px 8px",
            marginBottom: is4Cards ? "8px" : "5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px"
          }}
        >
          {/* Akun Login Text */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: is4Cards ? "7.5px" : "6.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569", marginBottom: "3px" }}>
              Kredensial Login Komputer (CBT / Exambro)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: is4Cards ? "9px" : "8px" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, color: "#1e293b", width: is4Cards ? "65px" : "55px", padding: "1px 0" }}>
                    Username
                  </td>
                  <td style={{ fontWeight: 700, color: "#1e293b", width: "8px", textAlign: "center", padding: "1px 0" }}>:</td>
                  <td style={{ fontFamily: "monospace", fontSize: is4Cards ? "11.5px" : "10px", fontWeight: 900, color: "#000000", padding: "1px 0", letterSpacing: "0.5px" }}>
                    {displayUsername}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: "#1e293b", padding: "1px 0" }}>
                    Password
                  </td>
                  <td style={{ fontWeight: 700, color: "#1e293b", textAlign: "center", padding: "1px 0" }}>:</td>
                  <td style={{ fontFamily: "monospace", fontSize: is4Cards ? "11.5px" : "10px", fontWeight: 900, color: "#000000", padding: "1px 0", letterSpacing: "0.5px" }}>
                    {displayPassword}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* QR Code Login */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {qrCodes[student.id] ? (
              <img 
                src={qrCodes[student.id]} 
                alt="QR Login" 
                style={{ 
                  width: is4Cards ? "23mm" : "18mm", 
                  height: is4Cards ? "23mm" : "18mm", 
                  display: "block" 
                }} 
              />
            ) : (
              <div 
                style={{ 
                  width: is4Cards ? "23mm" : "18mm", 
                  height: is4Cards ? "23mm" : "18mm", 
                  border: "1px solid #cbd5e1"
                }} 
              />
            )}
            <span style={{ fontSize: "6px", fontWeight: 700, color: "#475569", marginTop: "1px", textTransform: "uppercase" }}>
              QR Login
            </span>
          </div>
        </div>

        {/* 4. FOOTER: KETENTUAN PESERTA & PENGESAHAN */}
        <div 
          style={{ 
            borderTop: "1px solid #000000",
            paddingTop: is4Cards ? "5px" : "3px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "10px",
            marginTop: "auto"
          }}
        >
          {/* Ketentuan Peserta */}
          <div style={{ fontSize: is4Cards ? "7.5px" : "6.5px", lineHeight: "1.3", color: "#334155", maxWidth: "58%" }}>
            <div style={{ fontWeight: 800, color: "#000000", textTransform: "uppercase", marginBottom: "1px" }}>Ketentuan Peserta:</div>
            <ul style={{ margin: 0, paddingLeft: "10px" }}>
              <li>Kartu wajib dibawa selama pelaksanaan asesmen.</li>
              <li>Jaga kerahasiaan username & password ujian.</li>
            </ul>
          </div>

          {/* Kolom Tanda Tangan */}
          <div style={{ textAlign: "center", minWidth: is4Cards ? "105px" : "85px", lineHeight: "1.2" }}>
            <div style={{ fontSize: is4Cards ? "7.5px" : "6.5px", color: "#1e293b" }}>
              {cityDate}
            </div>
            <div style={{ fontSize: is4Cards ? "8px" : "7px", fontWeight: 800, color: "#000000", marginTop: "1px" }}>
              {signerRole},
            </div>
            <div style={{ height: is4Cards ? "24px" : "18px" }} />
            <div style={{ fontSize: is4Cards ? "8px" : "7px", fontWeight: 800, textDecoration: "underline", color: "#000000" }}>
              {signerName || "( ........................................ )"}
            </div>
            <div style={{ fontSize: is4Cards ? "6.5px" : "5.5px", color: "#475569", marginTop: "1px" }}>
              {signerNip ? `NIP. ${signerNip}` : ""}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[98vw] h-[94vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl rounded-2xl">
        {/* Header Dialog */}
        <div className="px-5 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white leading-tight">
                  Cetak Kartu Peserta Ujian
                </h2>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Format Resmi ANBK / CBT
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Pratinjau lembar cetak A4 presisi siap potong
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NeonButton
              variant="secondary"
              size="xs"
              onClick={onClose}
              className="gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </NeonButton>
            <NeonButton
              variant="primary"
              color="brand"
              size="sm"
              onClick={handlePrint}
              disabled={studentsToPrint.length === 0}
              className="gap-1.5 font-bold"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang ({studentsToPrint.length} Siswa)</span>
            </NeonButton>
          </div>
        </div>

        {/* 2-COLUMN STUDIO LAYOUT */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* ======================================================== */}
          {/* PANEL KIRI: PENGATURAN KARTU (RINGKAS & SIMPEL)           */}
          {/* ======================================================== */}
          <div className="w-full lg:w-[320px] xl:w-[340px] flex-shrink-0 bg-neutral-950 border-b lg:border-r lg:border-b-0 border-neutral-800 flex flex-col overflow-y-auto p-4 space-y-3.5 text-xs h-1/2 lg:h-auto">
            
            {/* Navigasi Tab Pengaturan: Cepat vs Lanjutan */}
            <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("quick")}
                className={`py-1.5 rounded-md font-semibold text-xs transition-colors ${
                  activeTab === "quick" 
                    ? "bg-neutral-800 text-white shadow-xs" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Pengaturan Utama
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("advanced")}
                className={`py-1.5 rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-1 ${
                  activeTab === "advanced" 
                    ? "bg-neutral-800 text-white shadow-xs" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Kop & TTD</span>
              </button>
            </div>

            {/* TAB 1: PENGATURAN UTAMA (SIMPEL & CEPAT) */}
            {activeTab === "quick" && (
              <div className="space-y-3">
                {/* 1. Target Siswa */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Target Cetak {terminology.student}
                  </label>
                  <Select 
                    value={printScope} 
                    onChange={(e) => setPrintScope(e.target.value as any)}
                    className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                  >
                    {selectedStudentIds.length > 0 && (
                      <option value="selected">{terminology.student} Terpilih ({selectedStudentIds.length})</option>
                    )}
                    {filterClassId !== "ALL" && (
                      <option value="class">{terminology.class} ({classes.find(c => c.id === filterClassId)?.name || filterClassId})</option>
                    )}
                    <option value="all">Semua {terminology.student} ({students.length})</option>
                  </Select>
                </div>

                {/* 2. Jumlah Kartu per Lembar A4 */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Format Kertas A4
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setLayoutMode("4")}
                      className={`py-1.5 px-2 rounded-md font-bold text-xs transition-colors flex flex-col items-center justify-center ${
                        layoutMode === "4"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <span>4 Kartu</span>
                      <span className="text-[9px] font-normal opacity-85">Standar (2×2)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode("6")}
                      className={`py-1.5 px-2 rounded-md font-bold text-xs transition-colors flex flex-col items-center justify-center ${
                        layoutMode === "6"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <span>6 Kartu</span>
                      <span className="text-[9px] font-normal opacity-85">Hemat (2×3)</span>
                    </button>
                  </div>
                </div>

                {/* 3. Judul Ujian */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Nama Asesmen / Ujian
                  </label>
                  <Input
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Contoh: ASESMEN SUMATIF SEKOLAH"
                    className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                  />
                </div>

                {/* 4. Opsi Tampilkan Password */}
                <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-neutral-200">Tampilkan Password</div>
                    <div className="text-[10px] text-neutral-400">Tampilkan teks password di kartu</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`h-6 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                      showPassword 
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                        : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                    }`}
                  >
                    {showPassword ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{showPassword ? "Tampil" : "Sensor"}</span>
                  </button>
                </div>

                {/* Ringkasan Cetak */}
                <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Total Siswa:</span>
                    <strong className="text-neutral-200 font-mono">{studentsToPrint.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Kebutuhan Kertas:</span>
                    <strong className="text-emerald-400 font-mono">{totalPages} Lembar A4</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PENGATURAN KOP & PENGESAHAN */}
            {activeTab === "advanced" && (
              <div className="space-y-3">
                {/* Tahun Ajaran */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Tahun Pelajaran
                  </label>
                  <Input
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                  />
                </div>

                {/* Logo Kiri & Logo Kanan */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Logo Kiri
                    </label>
                    <Select
                      value={leftLogoType}
                      onChange={(e) => setLeftLogoType(e.target.value as any)}
                      className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                    >
                      <option value="tutwuri">Kemdikbud</option>
                      <option value="kemenag">Kemenag</option>
                      <option value="custom">Upload File</option>
                    </Select>
                    <input
                      type="file"
                      ref={leftFileInputRef}
                      accept="image/*"
                      onChange={handleLeftLogoUpload}
                      className="hidden"
                    />
                    {leftLogoType === "custom" && !customLeftLogoUrl && (
                      <NeonButton
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => leftFileInputRef.current?.click()}
                        className="mt-1 w-full text-[10px]"
                      >
                        <Upload className="w-3 h-3 mr-1" /> Pilih Gambar
                      </NeonButton>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Logo Kanan
                    </label>
                    <Select
                      value={rightLogoType}
                      onChange={(e) => setRightLogoType(e.target.value as any)}
                      className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                    >
                      <option value="school">Logo Sekolah</option>
                      <option value="custom">Upload File</option>
                      <option value="none">Tanpa Logo</option>
                    </Select>
                    <input
                      type="file"
                      ref={rightFileInputRef}
                      accept="image/*"
                      onChange={handleRightLogoUpload}
                      className="hidden"
                    />
                    {rightLogoType === "custom" && !customRightLogoUrl && (
                      <NeonButton
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => rightFileInputRef.current?.click()}
                        className="mt-1 w-full text-[10px]"
                      >
                        <Upload className="w-3 h-3 mr-1" /> Pilih Gambar
                      </NeonButton>
                    )}
                  </div>
                </div>

                {/* Kolom Tambahan */}
                <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-300">Kolom Tambahan Biodata</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">Tempat & Tgl Lahir:</span>
                    <button
                      type="button"
                      onClick={() => setShowBirthInfo(!showBirthInfo)}
                      className={`h-5 px-2 rounded text-[10px] font-semibold transition-colors ${
                        showBirthInfo ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {showBirthInfo ? "Aktif" : "Sembunyi"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">Ruang & Sesi:</span>
                    <button
                      type="button"
                      onClick={() => setShowRoomSession(!showRoomSession)}
                      className={`h-5 px-2 rounded text-[10px] font-semibold transition-colors ${
                        showRoomSession ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {showRoomSession ? "Aktif" : "Sembunyi"}
                    </button>
                  </div>

                  {showRoomSession && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <Input
                        value={defaultRoom}
                        onChange={(e) => setDefaultRoom(e.target.value)}
                        placeholder="Ruang Default"
                        className="h-7 text-[11px] bg-neutral-900 border-neutral-750 text-neutral-100"
                      />
                      <Input
                        value={defaultSession}
                        onChange={(e) => setDefaultSession(e.target.value)}
                        placeholder="Sesi Default"
                        className="h-7 text-[11px] bg-neutral-900 border-neutral-750 text-neutral-100"
                      />
                    </div>
                  )}
                </div>

                {/* Pengesahan & Tanda Tangan */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Kota & Tanggal
                    </label>
                    <Input
                      value={cityDate}
                      onChange={(e) => setCityDate(e.target.value)}
                      className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Jabatan TTD
                      </label>
                      <Select
                        value={signerRole}
                        onChange={(e) => setSignerRole(e.target.value as any)}
                        className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                      >
                        <option value="Kepala Sekolah">Kepala Sekolah</option>
                        <option value="Ketua Panitia">Ketua Panitia</option>
                        <option value="Proktor">Proktor</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Nama Pejabat
                      </label>
                      <Input
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Nama Lengkap"
                        className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      NIP Pejabat (Opsional)
                    </label>
                    <Input
                      value={signerNip}
                      onChange={(e) => setSignerNip(e.target.value)}
                      placeholder="NIP. 19..."
                      className="h-8 text-xs bg-neutral-900 border-neutral-750 text-neutral-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* PANEL KANAN: KANVAS PRATINJAU LIVE LEMBAR A4              */}
          {/* ======================================================== */}
          <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
            {/* Toolbar Kanvas Pratinjau (Zoom & Halaman) */}
            <div className="px-5 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
              {/* Info Halaman */}
              <div className="flex items-center gap-1.5">
                <NeonButton
                  variant="secondary"
                  size="xs"
                  iconOnly
                  aria-label="Halaman Sebelumnya"
                  disabled={currentPreviewPage <= 0}
                  onClick={() => setCurrentPreviewPage(p => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </NeonButton>
                <span className="text-xs text-neutral-300 font-semibold px-1 font-mono">
                  {totalPages > 0 ? currentPreviewPage + 1 : 0} / {totalPages} Lembar
                </span>
                <NeonButton
                  variant="secondary"
                  size="xs"
                  iconOnly
                  aria-label="Halaman Berikutnya"
                  disabled={currentPreviewPage >= totalPages - 1}
                  onClick={() => setCurrentPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </NeonButton>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <NeonButton
                  variant="secondary"
                  size="xs"
                  iconOnly
                  aria-label="Perkecil"
                  onClick={() => setPreviewZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                  title="Perkecil"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </NeonButton>
                <span className="text-xs font-mono text-neutral-300 min-w-[38px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <NeonButton
                  variant="secondary"
                  size="xs"
                  iconOnly
                  aria-label="Perbesar"
                  onClick={() => setPreviewZoom(z => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
                  title="Perbesar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </NeonButton>
                <NeonButton
                  variant="ghost"
                  size="xs"
                  onClick={() => setPreviewZoom(0.75)}
                >
                  Pas Layar
                </NeonButton>
              </div>
            </div>

            {/* Kanvas Pratinjau Lembar Kertas A4 Realistis */}
            <div className="flex-1 overflow-auto p-6 flex justify-center items-start bg-neutral-900/50">
              {studentsToPrint.length === 0 ? (
                <div className="m-auto flex flex-col items-center justify-center text-neutral-400 text-center py-20">
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 text-neutral-500 flex items-center justify-center mb-3">
                    <Printer className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-sm text-neutral-200">Tidak ada siswa yang dipilih</p>
                  <p className="text-xs text-neutral-400 mt-1">Silakan sesuaikan target siswa di panel sebelah kiri.</p>
                </div>
              ) : (
                <div 
                  style={{ 
                    transform: `scale(${previewZoom})`, 
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out" 
                  }}
                  className="transition-all"
                >
                  {/* Tampilan 1 Lembar A4 yang Sedang Aktif di Pratinjau */}
                  {(() => {
                    const pageStudents = studentsToPrint.slice(
                      currentPreviewPage * cardsPerPage, 
                      (currentPreviewPage + 1) * cardsPerPage
                    );

                    return (
                      <div 
                        className="bg-white text-black shadow-2xl rounded-none border border-neutral-300"
                        style={{ 
                          width: "210mm", 
                          height: "282mm",
                          maxHeight: "282mm",
                          padding: "6mm 6mm",
                          boxSizing: "border-box",
                          fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gridTemplateRows: is4Cards ? "1fr 1fr" : "1fr 1fr 1fr",
                          gap: "4mm",
                          backgroundColor: "#ffffff",
                          overflow: "hidden"
                        }}
                      >
                        {pageStudents.map((st) => renderCardContent(st))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PAYLOAD LENGKAP TERSEMBUNYI UNTUK IFRAME CETAK (MENCETAK SELURUH HALAMAN) */}
        <div id="anbk-print-payload-hidden" style={{ display: "none" }}>
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageStudents = studentsToPrint.slice(
              pageIdx * cardsPerPage, 
              (pageIdx + 1) * cardsPerPage
            );

            return (
              <div 
                key={pageIdx}
                className="a4-page"
                style={{ 
                  width: "100%", 
                  height: "282mm",
                  maxHeight: "282mm",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: is4Cards ? "1fr 1fr" : "1fr 1fr 1fr",
                  gap: "4mm",
                  pageBreakAfter: pageIdx === totalPages - 1 ? "avoid" : "always",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  padding: "0"
                }}
              >
                {pageStudents.map((st) => renderCardContent(st))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintExamCardsDialog;
