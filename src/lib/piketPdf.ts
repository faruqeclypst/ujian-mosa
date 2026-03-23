import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { get, ref } from "firebase/database";
import { database } from "./firebase";

export async function exportPiketToPdf(selectedDate: string, range: "harian" | "mingguan" | "bulanan" = "harian", piketOfficer = "Admin") {
  try {
    const attSnap = await get(ref(database, "piket_attendances"));
    const schedSnap = await get(ref(database, "piket_schedules"));

    const attData = attSnap.exists() ? attSnap.val() : {};
    const schedData = schedSnap.exists() ? schedSnap.val() : {};

    const targetDate = new Date(selectedDate);
    
    // Setup Date filtering limits
    let startDate = targetDate;
    let endDate = targetDate;

    if (range === "mingguan") {
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() - targetDate.getDay()); // Sunday
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Saturday
    } else if (range === "bulanan") {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    }

    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);
    const startStr = formatYMD(startDate);
    const endStr = formatYMD(endDate);

    // Build Rows
    const rows: any[] = [];

    Object.values(attData).forEach((att: any) => {
      const attDate = att.date;
      if (attDate < startStr || attDate > endStr) return;

      const sched = schedData[att.scheduleId];
      if (!sched) return;

      Object.entries(att.attendances || {}).forEach(([hour, status]) => {
        // FILTER: ONLY TEACHERS NOT PRESENT
        if (status === true || status === "hadir") return;

        const teacherName = sched.teacherName;
        const subject = sched.subject;
        const className = sched.className;
        const notes = att.notes || "-";

        let statusText = "Alfa";
        if (status === "sakit") statusText = "Sakit";
        if (status === "izin") statusText = "Izin";

        rows.push([
          attDate,
          teacherName,
          `${subject} - ${className}`,
          `Jam ${hour}`,
          `${statusText}`,
          notes
        ]);
      });
    });

    // Sort order: by Date then Teacher
    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

    const finalRows = rows.map((r, i) => [i + 1, ...r]);

    // Generate PDF
    const doc = new jsPDF() as any;
    
    doc.setFontSize(16);
    doc.text("Laporan Guru Tidak Masuk", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${range.toUpperCase()} (${startStr} s/d ${endStr})`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["No.", "Tanggal", "Nama Guru", "Mapel - Kelas", "Jam", "Status", "Keterangan"]],
      body: finalRows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });

    // Add Signature Footer
    const lastY = (doc as any).lastAutoTable.finalY || 28;
    const finalY = lastY + 20;
    
    // Check if we need a new page for signature
    if (finalY > 270) {
      doc.addPage();
      doc.setFontSize(10);
      doc.text("Mengetahui,", 140, 20);
      doc.text("Petugas Piket,", 140, 25);
      doc.text(piketOfficer, 140, 50);
    } else {
      doc.setFontSize(10);
      doc.text("Mengetahui,", 140, finalY);
      doc.text("Petugas Piket,", 140, finalY + 5);
      doc.text(piketOfficer, 140, finalY + 30);
    }

    doc.save(`Laporan_Tidak_Masuk_${range}_${selectedDate}.pdf`);

  } catch (error) {
    console.error("PDF Export Error:", error);
    alert("Gagal mengexport PDF.");
  }
}
