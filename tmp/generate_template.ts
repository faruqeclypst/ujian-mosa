import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType, BorderStyle } from "docx";
import * as fs from "fs";
import * as path from "path";

const createQuestionTable = (number: number, correctLetter: string) => {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph(number.toString())] }),
                    new TableCell({ width: { size: 95, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `Ini adalah soal nomor ${number}.`, bold: true })] }), new Paragraph("Teks soal atau narasi literasi diletakkan di sini.")] }),
                ],
            }),
            ...["A", "B", "C", "D", "E"].map(letter => (
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(letter)] }),
                        new TableCell({ children: [new Paragraph(letter === correctLetter ? "Ini adalah jawaban" : `Pilihan ${letter}`)] }),
                    ],
                })
            )),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("")] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Kunci Jawaban: ${correctLetter}`, bold: true })] })] }),
                ],
            }),
        ],
    });
};

const generate = async () => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: "Nama Guru", bold: true }),
                        new TextRun({ text: " : (Isi Nama Anda)" }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Kelas", bold: true }),
                        new TextRun({ text: " : (Isi Nama Kelas)" }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Mapel", bold: true }),
                        new TextRun({ text: " : (Isi Nama Mata Pelajaran)" }),
                    ],
                }),
                new Paragraph({ text: "" }), // Spacer

                createQuestionTable(1, "A"),
                new Paragraph({ text: "" }),
                createQuestionTable(2, "B"),
                new Paragraph({ text: "" }),
                createQuestionTable(3, "C"),
                new Paragraph({ text: "" }),
                createQuestionTable(4, "D"),
                new Paragraph({ text: "" }),
                createQuestionTable(5, "E"),

                new Paragraph({ text: "" }),
                new Paragraph({ children: [new TextRun({ text: "PENTING: Gunakan baris 'Kunci Jawaban: X' sebagai penentu kunci jawaban utama oleh sistem.", italics: true, bold: true, color: "0000FF" })] }),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync("d:/AUQ/ujian-mosa/public/templates/Template_Soal_Tabel.docx", buffer);
    console.log("Template generated at public/templates/Template_Soal_Tabel.docx with 5 questions.");
};

generate();
