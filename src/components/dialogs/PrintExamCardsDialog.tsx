import { useState, useEffect, useMemo, useRef } from "react";
import QRCode from "qrcode";
import { 
  Printer, 
  Eye, 
  EyeOff, 
  Upload, 
  User, 
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  X
} from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
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

// Logo Resmi Kemdikbud / Tut Wuri Handayani (Vector SVG Tajam)
const TutWuriHandayaniLogo = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,5 92,35 77,88 23,88 8,35" fill="#00529C" stroke="#FFD700" strokeWidth="2.5" />
    <polygon points="50,9 88,37 74,84 26,84 12,37" fill="#005AA9" />
    <path d="M26 62 C 32 46, 42 42, 50 56 C 58 42, 68 46, 74 62 C 65 60, 56 65, 50 75 C 44 65, 35 60, 26 62 Z" fill="#FFFFFF" />
    <path d="M32 68 Q 50 71 50 78 Q 50 71 68 68 Q 50 63 32 68 Z" fill="#FFD700" />
    <path d="M50 22 C 53 30, 60 34, 55 42 C 53 45, 49 46, 47 43 C 44 38, 47 32, 50 22 Z" fill="#FF3B30" />
    <path d="M50 28 C 51 33, 55 36, 53 40 C 51 42, 49 42, 48 40 C 47 37, 49 34, 50 28 Z" fill="#FFCC00" />
    <circle cx="50" cy="53" r="2.5" fill="#FFD700" />
  </svg>
);

// Logo Kementerian Agama (Vector SVG)
const KemenagLogo = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  // Pengaturan Layout & Konten
  const [layoutMode, setLayoutMode] = useState<"4" | "6">("4"); // 4 kartu (2x2) atau 6 kartu (2x3)
  const [printScope, setPrintScope] = useState<"selected" | "class" | "all">(
    selectedStudentIds.length > 0 ? "selected" : (filterClassId !== "ALL" ? "class" : "all")
  );
  const [showPassword, setShowPassword] = useState(true);
  const [showRoomSession, setShowRoomSession] = useState(false);
  const [defaultRoom, setDefaultRoom] = useState("");
  const [defaultSession, setDefaultSession] = useState("");
  const [showBirthInfo, setShowBirthInfo] = useState(false);

  const [examTitle, setExamTitle] = useState("ASESMEN SUMATIF SEKOLAH");
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

  // Logo Kiri & Logo Kanan
  const [leftLogoType, setLeftLogoType] = useState<"tutwuri" | "kemenag" | "custom">("tutwuri");
  const [customLeftLogoUrl, setCustomLeftLogoUrl] = useState<string>("");

  const [rightLogoType, setRightLogoType] = useState<"school" | "custom" | "none">("school");
  const [customRightLogoUrl, setCustomRightLogoUrl] = useState<string>("");
  const [schoolLogoFailed, setSchoolLogoFailed] = useState(false);

  // Zoom Pratinjau (75% default agar lembar A4 terlihat utuh tanpa scroll terpotong)
  const [previewZoom, setPreviewZoom] = useState(0.8);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);

  const leftFileInputRef = useRef<HTMLInputElement>(null);
  const rightFileInputRef = useRef<HTMLInputElement>(null);

  // QR Codes Map
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  // Filter siswa
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

  // Batasi currentPreviewPage jika totalPages berubah
  useEffect(() => {
    if (currentPreviewPage >= totalPages && totalPages > 0) {
      setCurrentPreviewPage(totalPages - 1);
    }
  }, [totalPages, currentPreviewPage]);

  // Generate QR Code untuk seluruh siswa yang dicetak
  useEffect(() => {
    if (!isOpen || studentsToPrint.length === 0) return;

    let isMounted = true;
    const generateAllQrs = async () => {
      const entries: Record<string, string> = {};
      for (const st of studentsToPrint) {
        try {
          const qrText = st.examNumber || (st as any).username || st.nisn;
          const url = await QRCode.toDataURL(qrText, {
            width: 100,
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

  // Render Logo Kiri
  const renderLeftLogoComponent = (sizePx: number) => {
    if (leftLogoType === "custom" && customLeftLogoUrl) {
      return (
        <img 
          src={customLeftLogoUrl} 
          alt="Logo" 
          style={{ width: `${sizePx}px`, height: `${sizePx}px`, objectFit: "contain" }} 
        />
      );
    }
    if (leftLogoType === "kemenag") {
      return <KemenagLogo size={sizePx} />;
    }
    return <TutWuriHandayaniLogo size={sizePx} />;
  };

  // Render Logo Kanan
  const renderRightLogoComponent = (sizePx: number) => {
    if (rightLogoType === "none") {
      return <div style={{ width: `${sizePx}px`, height: `${sizePx}px` }} />;
    }

    if (rightLogoType === "custom" && customRightLogoUrl) {
      return (
        <img 
          src={customRightLogoUrl} 
          alt="Logo Sekolah" 
          style={{ width: `${sizePx}px`, height: `${sizePx}px`, objectFit: "contain" }} 
        />
      );
    }

    const schoolLogoUrl = (school as any)?.logo_url || (school as any)?.logo;
    if (schoolLogoUrl && !schoolLogoFailed) {
      return (
        <img 
          src={schoolLogoUrl} 
          alt="" 
          onError={() => setSchoolLogoFailed(true)}
          style={{ width: `${sizePx}px`, height: `${sizePx}px`, objectFit: "contain" }} 
        />
      );
    }

    return <div style={{ width: `${sizePx}px`, height: `${sizePx}px` }} />;
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
              margin: 7mm 6mm;
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
              height: 278mm;
              max-height: 278mm;
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
              border: 1.5px solid #000000;
              border-radius: 4px;
              padding: ${is4Cards ? "6px 8px" : "4px 6px"};
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

  const logoSizePx = is4Cards ? 38 : 30;

  // Template Tunggal Render Kartu Peserta
  const renderCardContent = (student: StudentData) => {
    const studentClass = classes.find(c => c.id === student.classId);
    const classNameText = studentClass?.name || student.className || "Kelas";
    const displayUsername = student.examNumber || (student as any).username || student.nisn;
    const displayPassword = showPassword ? (student.password || "12345678") : "••••••••";
    const birthText = formatBirthInfo(student.birthPlace, student.birthDate);
    
    const roomVal = student.room || defaultRoom;
    const sessionVal = student.session || defaultSession;
    const roomSessionDisplay = [roomVal, sessionVal].filter(Boolean).join(" / ");

    return (
      <div 
        key={student.id}
        className="card-item"
        style={{ 
          boxSizing: "border-box", 
          backgroundColor: "#ffffff",
          color: "#000000",
          border: "1.5px solid #000000",
          borderRadius: "4px",
          padding: is4Cards ? "7px 9px" : "5px 7px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden"
        }}
      >
        {/* 1. KOP KARTU */}
        <div 
          style={{ 
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            borderBottom: "2px solid #000000",
            borderBottomStyle: "double",
            paddingBottom: "3px",
            marginBottom: is4Cards ? "5px" : "3px"
          }}
        >
          {/* Logo Kiri */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {renderLeftLogoComponent(logoSizePx)}
          </div>

          {/* Teks Kop Tengah */}
          <div style={{ flex: 1, textAlign: "center", lineHeight: "1.15" }}>
            <div style={{ fontSize: is4Cards ? "11px" : "9.5px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              KARTU TANDA PESERTA UJIAN
            </div>
            <div style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 800, textTransform: "uppercase", color: "#1e40af" }}>
              {examTitle}
            </div>
            <div style={{ fontSize: is4Cards ? "9.5px" : "8.5px", fontWeight: 900, textTransform: "uppercase", color: "#000000" }}>
              {school?.name || "SATUAN PENDIDIKAN"}
            </div>
            <div style={{ fontSize: is4Cards ? "7.5px" : "6.5px", fontWeight: 600, color: "#475569" }}>
              TAHUN PELAJARAN {academicYear}
            </div>
          </div>

          {/* Logo Kanan */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {renderRightLogoComponent(logoSizePx)}
          </div>
        </div>

        {/* 2. BODY ATAS: PASFOTO (KIRI) & BIODATA SISWA (KANAN) */}
        <div 
          style={{ 
            display: "flex", 
            alignItems: "flex-start", 
            gap: "8px", 
            marginBottom: is4Cards ? "6px" : "3px"
          }}
        >
          {/* Pasfoto 3x4 */}
          <div 
            style={{ 
              width: is4Cards ? "23mm" : "18mm", 
              height: is4Cards ? "29mm" : "23mm", 
              border: "1px solid #000000",
              borderRadius: "2px",
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
                <User style={{ width: "18px", height: "18px", opacity: 0.4, marginBottom: "1px" }} />
                <span style={{ fontSize: "7px", fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b" }}>
                  FOTO
                </span>
                <span style={{ fontSize: "6px", fontWeight: 600, color: "#94a3b8" }}>
                  3 x 4
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
              fontSize: is4Cards ? "9.5px" : "8px",
              lineHeight: is4Cards ? "1.3" : "1.2"
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: is4Cards ? "72px" : "58px", fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                  Nama Peserta
                </td>
                <td style={{ width: "6px", fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                <td style={{ fontWeight: 800, textTransform: "uppercase", color: "#000000", padding: "1px 0", wordBreak: "break-word" }}>
                  {student.name}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                  No. Peserta / NISN
                </td>
                <td style={{ fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                <td style={{ fontWeight: 700, color: "#000000", padding: "1px 0" }}>
                  {displayUsername}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                  {terminology.class}
                </td>
                <td style={{ fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                <td style={{ fontWeight: 700, color: "#000000", padding: "1px 0" }}>
                  {classNameText}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                  Jenis Kelamin
                </td>
                <td style={{ fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                <td style={{ fontWeight: 600, color: "#000000", padding: "1px 0" }}>
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
                </td>
              </tr>

              {showBirthInfo && birthText && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                    Tempat, Tgl Lahir
                  </td>
                  <td style={{ fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                  <td style={{ fontWeight: 500, color: "#000000", padding: "1px 0", wordBreak: "break-word" }}>
                    {birthText}
                  </td>
                </tr>
              )}

              {showRoomSession && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#334155", padding: "1px 0", whiteSpace: "nowrap" }}>
                    Ruang / Sesi
                  </td>
                  <td style={{ fontWeight: 700, textAlign: "center", padding: "1px 0" }}>:</td>
                  <td style={{ fontWeight: 700, color: "#000000", padding: "1px 0" }}>
                    {roomSessionDisplay || "-"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. BODY TENGAH: KOTAK AKUN LOGIN + QR CODE RESMI */}
        <div 
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #94a3b8",
            borderRadius: "3px",
            padding: is4Cards ? "4px 8px" : "3px 6px",
            marginBottom: is4Cards ? "5px" : "3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px"
          }}
        >
          {/* Akun Login Text */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
              <span style={{ fontSize: is4Cards ? "8.5px" : "7.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", width: is4Cards ? "75px" : "60px" }}>
                Username
              </span>
              <span style={{ fontSize: is4Cards ? "8.5px" : "7.5px", fontWeight: 700, color: "#475569" }}>:</span>
              <span style={{ fontFamily: "monospace", fontSize: is4Cards ? "11.5px" : "10px", fontWeight: 900, color: "#000000", letterSpacing: "0.5px" }}>
                {displayUsername}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
              <span style={{ fontSize: is4Cards ? "8.5px" : "7.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", width: is4Cards ? "75px" : "60px" }}>
                Password Default
              </span>
              <span style={{ fontSize: is4Cards ? "8.5px" : "7.5px", fontWeight: 700, color: "#475569" }}>:</span>
              <span style={{ fontFamily: "monospace", fontSize: is4Cards ? "11.5px" : "10px", fontWeight: 900, color: "#1e40af", letterSpacing: "0.5px" }}>
                {displayPassword}
              </span>
            </div>

            <div style={{ fontSize: is4Cards ? "7px" : "6px", color: "#64748b", lineHeight: "1.15", marginTop: "2px", borderTop: "1px dashed #cbd5e1", paddingTop: "2px" }}>
              *) Gunakan password di atas. Jika sudah diubah gunakan password pribadi Anda. Jika lupa hubungi Proktor.
            </div>
          </div>

          {/* QR Code di sebelah kanan kredensial */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {qrCodes[student.id] ? (
              <img 
                src={qrCodes[student.id]} 
                alt="QR" 
                style={{ 
                  width: is4Cards ? "24mm" : "18mm", 
                  height: is4Cards ? "24mm" : "18mm", 
                  display: "block" 
                }} 
              />
            ) : (
              <div 
                style={{ 
                  width: is4Cards ? "24mm" : "18mm", 
                  height: is4Cards ? "24mm" : "18mm", 
                  border: "1px dashed #cbd5e1" 
                }} 
              />
            )}
            <span style={{ fontSize: "6px", fontWeight: 600, color: "#64748b", marginTop: "1px" }}>
              QR Login
            </span>
          </div>
        </div>

        {/* 4. FOOTER: INSTRUKSI & TANDA TANGAN */}
        <div 
          style={{ 
            borderTop: "1.5px solid #000000",
            paddingTop: "3px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "8px"
          }}
        >
          {/* Instruksi Penggunaan */}
          <div style={{ fontSize: is4Cards ? "7.5px" : "6.5px", lineHeight: "1.25", color: "#475569", maxWidth: "55%" }}>
            <p style={{ fontWeight: 700, color: "#000000", margin: 0 }}>Ketentuan Peserta:</p>
            <p style={{ margin: 0 }}>Kartu wajib dibawa dan diletakkan di atas meja selama asesmen berlangsung.</p>
          </div>

          {/* Kolom Tanda Tangan */}
          <div style={{ textAlign: "center", minWidth: is4Cards ? "105px" : "90px", lineHeight: "1.15" }}>
            <p style={{ fontSize: is4Cards ? "7.5px" : "6.5px", color: "#334155", margin: 0 }}>
              {cityDate}
            </p>
            <p style={{ fontSize: is4Cards ? "8px" : "7px", fontWeight: 700, color: "#000000", margin: "1px 0" }}>
              {signerRole},
            </p>
            <div style={{ height: is4Cards ? "20px" : "15px" }} />
            <p style={{ fontSize: is4Cards ? "8px" : "7px", fontWeight: 800, textDecoration: "underline", color: "#000000", margin: 0 }}>
              {signerName || "( .................................... )"}
            </p>
            <p style={{ fontSize: is4Cards ? "7px" : "6px", color: "#475569", margin: "1px 0 0 0" }}>
              {signerNip ? `NIP. ${signerNip}` : "NIP. -"}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[98vw] h-[94vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl">
        {/* Header Dialog Elegan & Bersih */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Studio Cetak Kartu Peserta Ujian
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Standar ANBK / CBT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atur tata letak di panel kiri dan lihat hasil pratinjau langsung di kanvas kanan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 px-3 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Tutup
            </Button>
            <Button
              onClick={handlePrint}
              disabled={studentsToPrint.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 px-5 gap-1.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang ({studentsToPrint.length} Siswa)
            </Button>
          </div>
        </div>

        {/* 2-COLUMN STUDIO LAYOUT */}
        <div className="flex-1 flex overflow-hidden">
          {/* ======================================================== */}
          {/* PANEL KIRI: PENGATURAN KARTU (LEBAR 340px, SCROLLABLE)    */}
          {/* ======================================================== */}
          <div className="w-[340px] xl:w-[360px] flex-shrink-0 bg-slate-950/80 border-r border-slate-800 flex flex-col overflow-y-auto p-4 space-y-4 text-xs">
            {/* Bagian 1: Sasaran & Format Kertas */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Format Halaman</span>
              </div>

              {/* Target Siswa */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Target Cetak Siswa
                </label>
                <Select 
                  value={printScope} 
                  onChange={(e) => setPrintScope(e.target.value as any)}
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                >
                  {selectedStudentIds.length > 0 && (
                    <option value="selected">Siswa Terpilih ({selectedStudentIds.length})</option>
                  )}
                  {filterClassId !== "ALL" && (
                    <option value="class">Kelas ({classes.find(c => c.id === filterClassId)?.name || filterClassId})</option>
                  )}
                  <option value="all">Semua Siswa ({students.length})</option>
                </Select>
              </div>

              {/* Mode Kartu per Halaman (Segmented Control Mewah) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Jumlah Kartu per Lembar A4
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLayoutMode("4")}
                    className={`py-1.5 rounded-md font-bold text-xs transition-all flex flex-col items-center justify-center ${
                      layoutMode === "4"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>4 Kartu</span>
                    <span className="text-[9px] font-normal opacity-80">Standar (2×2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode("6")}
                    className={`py-1.5 rounded-md font-bold text-xs transition-all flex flex-col items-center justify-center ${
                      layoutMode === "6"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>6 Kartu</span>
                    <span className="text-[9px] font-normal opacity-80">Hemat (2×3)</span>
                  </button>
                </div>
              </div>

              {/* Password Switch */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-400">Tampilan Password:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-7 text-xs px-2.5 border-slate-700 bg-slate-950 text-slate-200"
                >
                  {showPassword ? <Eye className="w-3 h-3 text-blue-400 mr-1.5" /> : <EyeOff className="w-3 h-3 text-slate-500 mr-1.5" />}
                  <span>{showPassword ? "Tampil" : "Sensor"}</span>
                </Button>
              </div>
            </div>

            {/* Bagian 2: Kop & Instansi */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kop & Identitas Ujian</span>
              </div>

              {/* Judul Ujian */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nama Asesmen / Ujian
                </label>
                <Input
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Contoh: PENILAIAN AKHIR SEMESTER"
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                />
              </div>

              {/* Tahun Ajaran */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tahun Pelajaran
                </label>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                />
              </div>

              {/* Logo Kiri & Logo Kanan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Logo Kiri
                  </label>
                  <Select
                    value={leftLogoType}
                    onChange={(e) => setLeftLogoType(e.target.value as any)}
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => leftFileInputRef.current?.click()}
                      className="mt-1 w-full h-7 text-[10px] border-dashed border-slate-700 text-slate-400"
                    >
                      <Upload className="w-3 h-3 mr-1" /> Pilih Gambar
                    </Button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Logo Kanan
                  </label>
                  <Select
                    value={rightLogoType}
                    onChange={(e) => setRightLogoType(e.target.value as any)}
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => rightFileInputRef.current?.click()}
                      className="mt-1 w-full h-7 text-[10px] border-dashed border-slate-700 text-slate-400"
                    >
                      <Upload className="w-3 h-3 mr-1" /> Pilih Gambar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Bagian 3: Opsi Baris Data Siswa */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <span className="text-blue-400 font-bold text-xs uppercase tracking-wider block">
                Opsi Kolom Tambahan
              </span>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">Tempat & Tgl Lahir:</span>
                <button
                  type="button"
                  onClick={() => setShowBirthInfo(!showBirthInfo)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                    showBirthInfo ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {showBirthInfo ? "Aktif" : "Sembunyi"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">Ruang & Sesi:</span>
                <button
                  type="button"
                  onClick={() => setShowRoomSession(!showRoomSession)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                    showRoomSession ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-slate-800 text-slate-400"
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
                    className="h-7 text-[11px] bg-slate-950 border-slate-700 text-slate-200"
                  />
                  <Input
                    value={defaultSession}
                    onChange={(e) => setDefaultSession(e.target.value)}
                    placeholder="Sesi Default"
                    className="h-7 text-[11px] bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Bagian 4: Pengesahan & Tanda Tangan */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <span className="text-blue-400 font-bold text-xs uppercase tracking-wider block">
                Pengesahan & Titimangsa
              </span>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Kota & Tanggal
                </label>
                <Input
                  value={cityDate}
                  onChange={(e) => setCityDate(e.target.value)}
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Pejabat TTD
                  </label>
                  <Select
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value as any)}
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                  >
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Ketua Panitia">Ketua Panitia</option>
                    <option value="Proktor">Proktor</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Nama Pejabat
                  </label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  NIP Pejabat (Opsional)
                </label>
                <Input
                  value={signerNip}
                  onChange={(e) => setSignerNip(e.target.value)}
                  placeholder="NIP. 19..."
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* PANEL KANAN: KANVAS PRATINJAU LIVE LEMBAR A4              */}
          {/* ======================================================== */}
          <div className="flex-1 flex flex-col bg-slate-950/50 overflow-hidden">
            {/* Toolbar Kanvas Pratinjau (Zoom & Halaman) */}
            <div className="px-6 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              {/* Info Halaman */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPreviewPage <= 0}
                  onClick={() => setCurrentPreviewPage(p => Math.max(0, p - 1))}
                  className="h-7 w-7 p-0 border-slate-700 bg-slate-800 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-300 font-semibold px-1">
                  Halaman {totalPages > 0 ? currentPreviewPage + 1 : 0} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPreviewPage >= totalPages - 1}
                  onClick={() => setCurrentPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                  className="h-7 w-7 p-0 border-slate-700 bg-slate-800 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                  className="h-7 w-7 p-0 border-slate-700 bg-slate-800 text-slate-300"
                  title="Perkecil"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-mono text-slate-400 min-w-[42px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewZoom(z => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
                  className="h-7 w-7 p-0 border-slate-700 bg-slate-800 text-slate-300"
                  title="Perbesar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewZoom(0.75)}
                  className="h-7 text-[11px] text-slate-400 hover:text-white px-2"
                >
                  Pas Layar
                </Button>
              </div>
            </div>

            {/* Kanvas Pratinjau Lembar Kertas A4 */}
            <div className="flex-1 overflow-auto p-6 flex justify-center items-start bg-slate-900/40">
              {studentsToPrint.length === 0 ? (
                <div className="m-auto flex flex-col items-center justify-center text-slate-500 text-center py-20">
                  <AlertCircle className="w-12 h-12 mb-3 opacity-40 text-blue-400" />
                  <p className="font-bold text-base text-slate-300">Tidak ada siswa yang dipilih</p>
                  <p className="text-xs text-slate-500 mt-1">Silakan sesuaikan target siswa di panel sebelah kiri.</p>
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
                        className="bg-white text-black shadow-2xl rounded-sm border border-slate-300"
                        style={{ 
                          width: "210mm", 
                          height: "278mm",
                          maxHeight: "278mm",
                          padding: "7mm 6mm",
                          boxSizing: "border-box",
                          fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
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
                  height: "278mm",
                  maxHeight: "278mm",
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
