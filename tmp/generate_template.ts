import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType, BorderStyle } from "docx";
import * as fs from "fs";
import * as path from "path";

const generate = async () => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: "Nama Guru", bold: true }),
                        new TextRun({ text: " : (Nama Anda)" }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Kelas", bold: true }),
                        new TextRun({ text: " : (Nama Kelas)" }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Mapel", bold: true }),
                        new TextRun({ text: " : (Mata Pelajaran)" }),
                    ],
                }),
                new Paragraph({ text: "" }), // Spacer

                // Table 1
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph("1")] }),
                                new TableCell({ width: { size: 95, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Ini adalah soal no. 1 (support dengan Bold italic dan lainnya). Bisa juga mengisi literasi dan gambar disini.", bold: true })] }), new Paragraph("Blablablabla")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("A")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan A")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("B")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan B")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("C")] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ini adalah jawaban", color: "FF0000" })] })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("D")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan D")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("E")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan E")] }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "" }), // Spacer

                // Table 2
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph("2")] }),
                                new TableCell({ width: { size: 95, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Ini adalah soal no. 2 (support dengan Bold italic dan lainnya). Bisa juga mengisi literasi dan gambar disini.", bold: true })] }), new Paragraph("Blablablabla")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("A")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan A")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("B")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan B")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("C")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan C")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("D")] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ini adalah jawaban", color: "FF0000" })] })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("E")] }),
                                new TableCell({ children: [new Paragraph("Ini pilihan E")] }),
                            ],
                        }),
                    ],
                }),
                
                new Paragraph({ text: "" }),
                new Paragraph({ children: [new TextRun({ text: "PENTING: Gunakan teks berwarna MERAH untuk menandai kunci jawaban jika tidak menggunakan baris 'Kunci Jawaban: X'.", italic: true, color: "666666" })] }),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync("d:/AUQ/ujian-mosa/public/templates/Template_Soal_Tabel.docx", buffer);
    console.log("Template generated at public/templates/Template_Soal_Tabel.docx");
};

generate();
