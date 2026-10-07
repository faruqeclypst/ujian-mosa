import re

with open(r'D:\PROJECT\ujian\src\components\dialogs\PrintExamCardsDialog.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """  const renderCardContent = (student: StudentData) => {
    const studentClass = classes.find(c => c.id === student.classId);
    const classNameText = studentClass?.name || student.className || "Kelas";
    const displayUsername = student.examNumber || (student as any).username || student.nisn;
    const displayPassword = showPassword ? (student.password || "12345678") : "*********";
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
          fontFamily: "'Arial', 'Helvetica', sans-serif",
          border: "1px solid #1e293b",
          borderRadius: "8px",
          padding: is4Cards ? "14px 18px" : "10px 14px",
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
            gap: "10px",
            borderBottom: "3px double #0f172a",
            paddingBottom: "8px",
            marginBottom: is4Cards ? "12px" : "8px"
          }}
        >
          {/* Logo Kiri */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {renderLeftLogoComponent(is4Cards ? 42 : 36)}
          </div>

          {/* Teks Kop Tengah */}
          <div style={{ flex: 1, textAlign: "center", lineHeight: "1.2" }}>
            <div style={{ fontSize: is4Cards ? "13px" : "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", color: "#000000" }}>
              KARTU TANDA PESERTA UJIAN
            </div>
            <div style={{ fontSize: is4Cards ? "10px" : "8.5px", fontWeight: 700, textTransform: "uppercase", color: "#334155", marginTop: "2px" }}>
              {examTitle}
            </div>
            <div style={{ fontSize: is4Cards ? "12px" : "10px", fontWeight: 900, textTransform: "uppercase", color: "#000000", marginTop: "1px" }}>
              {school?.name || "SATUAN PENDIDIKAN"}
            </div>
            <div style={{ fontSize: is4Cards ? "8px" : "7px", fontWeight: 600, color: "#475569", marginTop: "2px" }}>
              TAHUN PELAJARAN {academicYear}
            </div>
          </div>

          {/* Logo Kanan */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {renderRightLogoComponent(is4Cards ? 42 : 36)}
          </div>
        </div>

        {/* 2. BODY ATAS: PASFOTO (KIRI) & BIODATA SISWA (KANAN) */}
        <div 
          style={{ 
            display: "flex", 
            alignItems: "flex-start", 
            gap: "16px", 
            marginBottom: is4Cards ? "12px" : "8px"
          }}
        >
          {/* Pasfoto 3x4 */}
          <div 
            style={{ 
              width: is4Cards ? "26mm" : "21mm", 
              height: is4Cards ? "34mm" : "27mm", 
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: "2px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#64748b" }}>
                  FOTO
                </span>
                <span style={{ fontSize: "7px", fontWeight: 600, color: "#94a3b8" }}>
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
              fontSize: is4Cards ? "10px" : "9px",
              lineHeight: is4Cards ? "1.4" : "1.3"
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: is4Cards ? "85px" : "70px", fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                  Nama Peserta
                </td>
                <td style={{ width: "8px", fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                <td style={{ fontWeight: 800, textTransform: "uppercase", color: "#000000", padding: "2px 0", wordBreak: "break-word" }}>
                  {student.name}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                  No. Peserta / NISN
                </td>
                <td style={{ fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                <td style={{ fontWeight: 800, color: "#000000", padding: "2px 0" }}>
                  {displayUsername}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                  {terminology.class}
                </td>
                <td style={{ fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                <td style={{ fontWeight: 800, color: "#000000", padding: "2px 0" }}>
                  {classNameText}
                </td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                  Jenis Kelamin
                </td>
                <td style={{ fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                <td style={{ fontWeight: 700, color: "#000000", padding: "2px 0" }}>
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
                </td>
              </tr>

              {showBirthInfo && birthText && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                    Tmpt, Tgl Lahir
                  </td>
                  <td style={{ fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                  <td style={{ fontWeight: 700, color: "#000000", padding: "2px 0", wordBreak: "break-word" }}>
                    {birthText}
                  </td>
                </tr>
              )}

              {showRoomSession && (
                <tr>
                  <td style={{ fontWeight: 600, color: "#475569", padding: "2px 0", whiteSpace: "nowrap" }}>
                    Ruang / Sesi
                  </td>
                  <td style={{ fontWeight: 600, color: "#475569", textAlign: "center", padding: "2px 0" }}>:</td>
                  <td style={{ fontWeight: 800, color: "#000000", padding: "2px 0" }}>
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
            border: "1px dashed #94a3b8",
            borderRadius: "6px",
            padding: is4Cards ? "8px 12px" : "6px 10px",
            marginBottom: is4Cards ? "12px" : "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}
        >
          {/* Akun Login Text */}
          <div style={{ flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", width: is4Cards ? "85px" : "70px", paddingBottom: "4px" }}>
                    Username
                  </td>
                  <td style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 700, color: "#64748b", width: "8px", textAlign: "center", paddingBottom: "4px" }}>:</td>
                  <td style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: is4Cards ? "13px" : "11px", fontWeight: 900, color: "#000000", letterSpacing: "1px", paddingBottom: "4px" }}>
                    {displayUsername}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", paddingBottom: "4px" }}>
                    Password Default
                  </td>
                  <td style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 700, color: "#64748b", textAlign: "center", paddingBottom: "4px" }}>:</td>
                  <td style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: is4Cards ? "13px" : "11px", fontWeight: 900, color: "#000000", letterSpacing: "1px", paddingBottom: "4px" }}>
                    {displayPassword}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: is4Cards ? "7px" : "6.5px", color: "#64748b", lineHeight: "1.3", marginTop: "4px", paddingTop: "4px", borderTop: "1px dotted #cbd5e1" }}>
              *) Gunakan password di atas. Jika sudah diubah gunakan password pribadi Anda. Jika lupa hubungi Proktor.
            </div>
          </div>

          {/* QR Code di sebelah kanan kredensial */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {qrCodes[student.id] ? (
              <img 
                src={qrCodes[student.id]} 
                alt="QR Login" 
                style={{ 
                  width: is4Cards ? "28mm" : "22mm", 
                  height: is4Cards ? "28mm" : "22mm", 
                  display: "block" 
                }} 
              />
            ) : (
              <div 
                style={{ 
                  width: is4Cards ? "28mm" : "22mm", 
                  height: is4Cards ? "28mm" : "22mm", 
                  border: "1px dashed #cbd5e1",
                  borderRadius: "4px"
                }} 
              />
            )}
            <span style={{ fontSize: "6.5px", fontWeight: 700, color: "#64748b", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              QR Login
            </span>
          </div>
        </div>

        {/* 4. FOOTER: INSTRUKSI & TANDA TANGAN */}
        <div 
          style={{ 
            borderTop: "1px solid #cbd5e1",
            paddingTop: "8px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "auto"
          }}
        >
          {/* Instruksi Penggunaan */}
          <div style={{ fontSize: is4Cards ? "8px" : "7px", lineHeight: "1.3", color: "#475569", maxWidth: "60%" }}>
            <p style={{ fontWeight: 800, color: "#0f172a", margin: "0 0 2px 0", textTransform: "uppercase" }}>Ketentuan Peserta:</p>
            <ol style={{ margin: 0, paddingLeft: "12px" }}>
              <li>Membawa kartu ini selama ujian berlangsung.</li>
              <li>Menjaga kerahasiaan Username & Password.</li>
              <li>Dilarang mencoret/merusak kartu ujian ini.</li>
            </ol>
          </div>

          {/* Kolom Tanda Tangan */}
          <div style={{ textAlign: "center", minWidth: is4Cards ? "110px" : "90px", lineHeight: "1.2" }}>
            <p style={{ fontSize: is4Cards ? "8.5px" : "7.5px", color: "#334155", margin: 0 }}>
              {cityDate}
            </p>
            <p style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 800, color: "#0f172a", margin: "2px 0 0 0" }}>
              {signerRole},
            </p>
            <div style={{ height: is4Cards ? "30px" : "24px" }} />
            <p style={{ fontSize: is4Cards ? "9px" : "8px", fontWeight: 800, textDecoration: "underline", color: "#0f172a", margin: 0 }}>
              {signerName || "( ........................................ )"}
            </p>
            <p style={{ fontSize: is4Cards ? "7.5px" : "6.5px", color: "#64748b", margin: "2px 0 0 0" }}>
              {signerNip ? `NIP. ${signerNip}` : "NIP. -"}
            </p>
          </div>
        </div>
      </div>
    );
  };"""

start_str = "const renderCardContent = (student: StudentData) => {"

start_idx = content.find(start_str)
end_idx = content.find("};", content.find("          </div>\n        </div>\n      </div>\n    );\n  ", start_idx)) + 2

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_func + content[end_idx:]
    with open(r'D:\PROJECT\ujian\src\components\dialogs\PrintExamCardsDialog.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success replacing function")
else:
    print("Failed to find boundaries")
