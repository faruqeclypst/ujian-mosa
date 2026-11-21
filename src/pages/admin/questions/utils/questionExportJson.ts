import type { QuestionData } from "../types";

export interface ExportJsonOptions {
  questions: any[];
  examTitle?: string;
  selectedIds?: string[];
}

export const exportQuestionsToJson = ({
  questions,
  examTitle = "Ujian",
  selectedIds,
}: ExportJsonOptions): { count: number; fileName: string } => {
  const targetQuestions = selectedIds && selectedIds.length > 0
    ? questions.filter((q) => selectedIds.includes(q.id))
    : questions;

  if (targetQuestions.length === 0) {
    return { count: 0, fileName: "" };
  }

  const exportData = targetQuestions.map((q) => {
    const clean: any = { text: q.text || "", type: q.type || "pilihan_ganda" };
    if (q.imageUrl) clean.imageUrl = q.imageUrl;
    if (q.groupId) clean.groupId = q.groupId;
    if (q.groupText) clean.groupText = q.groupText;
    if (q.choices && Object.keys(q.choices).length > 0) clean.choices = q.choices;
    if (q.pairs && q.pairs.length > 0) clean.pairs = q.pairs;
    if (q.items && q.items.length > 0) clean.items = q.items;
    if (q.statements && q.statements.length > 0) clean.statements = q.statements;
    if (q.categories && q.categories.length > 0) clean.categories = q.categories;
    if (q.columns && q.columns.length > 0) clean.columns = q.columns;
    if (q.blanks && q.blanks.length > 0) clean.blanks = q.blanks;
    if (q.shuffleStatements !== undefined) clean.shuffleStatements = q.shuffleStatements;
    if (q.answerKey) clean.answerKey = q.answerKey;
    if (q.order) clean.order = q.order;
    return clean;
  });

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date()
    .toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");

  const fileName = selectedIds && selectedIds.length > 0
    ? `SOAL_TERPILIH_${targetQuestions.length}_${dateStr}.json`
    : `BANK_SOAL_${examTitle.replace(/\s+/g, "_")}_${dateStr}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: targetQuestions.length, fileName };
};
