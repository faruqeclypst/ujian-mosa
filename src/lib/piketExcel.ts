import * as XLSX from "xlsx-js-style";
import { get, ref } from "firebase/database";
import { database } from "./firebase";

export async function exportPiketToExcel(piketOfficer = "Admin", filename = "rekap-piket-dan-izin.xlsx") {
  try {
    const attSnap = await get(ref(database, "piket_attendances"));
    const permSnap = await get(ref(database, "piket_permissions"));
    const schedSnap = await get(ref(database, "piket_schedules"));

    const attData = attSnap.exists() ? attSnap.val() : {};
    const permData = permSnap.exists() ? permSnap.val() : {};
    const schedData = schedSnap.exists() ? schedSnap.val() : {};

    const guruSummary: Record<string, { name: string; hadir: number; alfa: number; dates: string[] }> = {}; // <--- added

    // 1. Build Absensi Sheet
    const absensiHeader = ["Tanggal", "Hari", "Nama Guru", "Sesi", "Mapel", "Kelas", "Status", "Keterangan"];
    const absensiRows: any[] = [];

    Object.values(attData).forEach((att: any) => {
      const sched = schedData[att.scheduleId];
      const teacherName = sched ? sched.teacherName : "Unknown";
      const subject = sched ? sched.subject : "Unknown";
      const className = sched ? sched.className : "Unknown";
      const day = sched ? sched.day : "-";

      const mapelGroups: Record<string, string[]> = {}; // <--- added

      Object.entries(att.attendances || {}).forEach(([hour, isPresent]) => {
        const isPresentText = isPresent === true || isPresent === "hadir" ? "Hadir" : isPresent === "sakit" ? "Sakit" : isPresent === "izin" ? "Izin" : "Alfa";
        absensiRows.push([
          att.date,
          day,
          teacherName,
          `Jam ${hour}`,
          subject,
          className,
          isPresentText,
          att.notes || "-",
        ]);

        if (!guruSummary[teacherName] && teacherName !== "Unknown") {
          guruSummary[teacherName] = { name: teacherName, hadir: 0, alfa: 0, dates: [] };
        }
        
        if (guruSummary[teacherName]) {
          if (isPresent) {
            guruSummary[teacherName].hadir += 1;
          } else {
            guruSummary[teacherName].alfa += 1;
            
            // Grouping hours by subject and class <--- added
            const key = `${subject} / ${className}`;
            if (!mapelGroups[key]) mapelGroups[key] = [];
            mapelGroups[key].push(hour);
          }
        }
      });

      const missesFormatted = Object.entries(mapelGroups).map(([key, hours]) => `Jam ${hours.join(", ")} (${key})`);

      if (missesFormatted.length > 0 && guruSummary[teacherName]) {
        guruSummary[teacherName].dates.push(`📅 ${att.date} ➡️ ${missesFormatted.join(", ")}`);
      }
    });

    absensiRows.sort((a, b) => b[0].localeCompare(a[0])); // Sort by date Descending

    const signatureRows = [
      [],
      [],
      ["", "", "", "", "", "Mengetahui,", ""],
      ["", "", "", "", "", "Petugas Piket,", ""],
      [],
      [],
      ["", "", "", "", "", piketOfficer, ""]
    ];

    const finalAbsensiRows = [...absensiRows, ...signatureRows];
    const wsAbsensi = XLSX.utils.aoa_to_sheet([absensiHeader, ...finalAbsensiRows]);

    // 2. Build Perizinan Sheet
    const izinHeader = ["Tanggal", "Siswa", "Kelas", "Keperluan", "Jam Keluar", "Jam Kembali", "Status"];
    const izinRows: any[] = [];

    Object.values(permData).forEach((perm: any) => {
      const studentsStr = (perm.students || []).map((s: any) => `${s.name} (${s.className})`).join(", ");
      const classesStr = Array.from(new Set((perm.students || []).map((s: any) => s.className))).join(", ");

      izinRows.push([
        perm.date,
        studentsStr,
        classesStr,
        perm.reason || "-",
        perm.timeOut || "-",
        perm.timeIn || "-",
        perm.status || "menunggu",
      ]);
    });

    izinRows.sort((a, b) => b[0].localeCompare(a[0]));
    const finalIzinRows = [...izinRows, ...signatureRows];
    const wsIzin = XLSX.utils.aoa_to_sheet([izinHeader, ...finalIzinRows]);

    const guruHeader = ["Nama Guru", "Total Jam Hadir", "Total Jam Alfa", "Rincian Ketidakhadiran (Temuan Alfa)"];
    const guruRows = Object.values(guruSummary)
      .sort((a, b) => b.alfa - a.alfa) // Sort by most Alfa
      .map(g => [
        g.name,
        g.hadir,
        g.alfa,
        Array.from(new Set(g.dates)).sort((a, b) => b.localeCompare(a)).join("\n")
      ]);
    const finalGuruRows = [...guruRows, ...signatureRows];
    const wsGuru = XLSX.utils.aoa_to_sheet([guruHeader, ...finalGuruRows]);

    // Apply Style
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
    };

    [wsAbsensi, wsIzin, wsGuru].forEach((ws) => {
      const headers = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.c : 10;
      for (let c = 0; c <= headers; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) (ws[addr] as any).s = headerStyle;
      }
    });

    // Specific wrapText alignment for guruRows
    const rangeGuru = XLSX.utils.decode_range(wsGuru["!ref"] || "A1:D100");
    for (let r = 1; r <= rangeGuru.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 3 }); // Column D
      if (wsGuru[addr]) {
        (wsGuru[addr] as any).s = { alignment: { wrapText: true, vertical: "top" } };
      }
    }

    (wsAbsensi as any)["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
    (wsIzin as any)["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    (wsGuru as any)["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 50 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsAbsensi, "Satu Rekap Absensi");
    XLSX.utils.book_append_sheet(wb, wsIzin, "Satu Rekap Perizinan");
    XLSX.utils.book_append_sheet(wb, wsGuru, "Rekap Per Guru");

    // Loop through each teacher and create detail sheet
    Object.values(guruSummary).forEach((g: any) => {
      const tHeader = ["Tanggal", "Hari", "Sesi", "Mapel", "Kelas", "Status", "Keterangan"];
      const tRows = absensiRows
        .filter(row => row[2] === g.name && row[6] !== "Hadir") // Only show "Absen"
        .map(row => [row[0], row[1], row[3], row[4], row[5], row[6], row[7]]); // [Tanggal, Hari, Sesi, Mapel, Kelas, Status, Keterangan]

      if (tRows.length === 0) return;

      const finalTeacherRows = [...tRows, ...signatureRows];
      const wsTeacher = XLSX.utils.aoa_to_sheet([tHeader, ...finalTeacherRows]);

      // Apply style
      const headers = wsTeacher["!ref"] ? XLSX.utils.decode_range(wsTeacher["!ref"]).e.c : 10;
      for (let c = 0; c <= headers; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsTeacher[addr]) (wsTeacher[addr] as any).s = headerStyle;
      }
      (wsTeacher as any)["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 10 }];

      // Clean sheet name (max 31 chars, no invalid chars : \ / ? * [ ] )
      const sheetName = String(g.name).substring(0, 31).replace(/[\*\?\/\:\\\[\]]/g, "");
      XLSX.utils.book_append_sheet(wb, wsTeacher, sheetName);
    });

    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error("Export Error:", error);
    alert("Gagal mengexport rekap Piket.");
  }
}

