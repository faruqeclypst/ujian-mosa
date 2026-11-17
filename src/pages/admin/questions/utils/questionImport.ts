import { parseQuestionsFromWord } from "../../../../lib/questionWordParser";
import { parseQuestionImportExcel } from "../../../../lib/questionExcel";

export const IMPORT_TYPE_MAP: Record<string, string> = {
  pilihan_ganda: "multiple_choice",
  pilihan_ganda_kompleks: "complex_choice",
  menjodohkan: "matching",
  benar_salah: "true_false",
  isian_singkat: "short_answer",
  uraian: "essay",
  urutkan: "sequence",
  drag_drop: "drag_drop",
  klasifikasi: "klasifikasi",
  hotspot: "hotspot",
  isian_rumpang: "isian_rumpang",
  matriks: "matriks",
  multiple_choice: "multiple_choice",
  complex_choice: "complex_choice",
  matching: "matching",
  true_false: "true_false",
  short_answer: "short_answer",
  essay: "essay",
  sequence: "sequence",
};

export interface BaseImportOptions {
  file: File;
  pb: any;
  examId: string;
  allowedTypes?: Record<string, boolean>;
  onProgress?: (progress: { current: number; total: number; message: string; title: string; percent?: number }) => void;
  localizeImage?: (url: string, prefix: string) => Promise<string>;
  localizeInlineImages?: (html: string) => Promise<string>;
}

export interface ImportResult {
  importedCount: number;
  skippedCount?: number;
  skippedByType?: number;
}

export const importQuestionsFromWord = async ({
  file,
  pb,
  examId,
  allowedTypes = {},
  onProgress,
  localizeImage = async (url) => url,
  localizeInlineImages = async (html) => html,
}: BaseImportOptions): Promise<ImportResult> => {
  onProgress?.({
    current: 0,
    total: 0,
    message: "Menganalisis file Word...",
    title: "Import file Word",
  });

  const parsed = await parseQuestionsFromWord(file);
  if (parsed.length === 0) throw new Error("Tidak ada soal yang dikenali dalam file.");

  // Filter by allowed types
  const filteredByType = parsed.filter((q) => {
    const qType = q.type || "pilihan_ganda";
    return allowedTypes[qType] !== false;
  });

  const skippedByType = parsed.length - filteredByType.length;
  if (filteredByType.length === 0) {
    const disabledTypes = parsed
      .map((q) => q.type)
      .filter((v, i, a) => a.indexOf(v) === i && allowedTypes[v || "pilihan_ganda"] === false);
    throw new Error(
      `Semua soal bertipe ${disabledTypes.join(", ")} yang belum diaktifkan admin. Aktifkan tipe soal tersebut di Pengaturan terlebih dahulu.`
    );
  }

  // Duplicate detection & unique groupId
  const existingQuestions = await pb.collection("questions").getFullList({ filter: `examId = "${examId}"` });
  const existingTexts = new Set(
    existingQuestions.map((q: any) =>
      (q.text || "").replace(/<[^>]*>/g, "").trim().toLowerCase().substring(0, 80)
    )
  );
  const existingGroupIds = new Set(
    existingQuestions.map((q: any) => q.groupId || q.group_id || "").filter(Boolean)
  );
  const maxExistingOrder = existingQuestions.reduce((max: number, q: any) => Math.max(max, q.order || 0), 0);

  const uniqueParsed = filteredByType.filter((q) => {
    const cleanText = (q.text || "").replace(/<[^>]*>/g, "").trim().toLowerCase().substring(0, 80);
    return cleanText.length > 0 && !existingTexts.has(cleanText);
  });

  const groupIdRemap = new Map<string, string>();
  uniqueParsed.forEach((q) => {
    if (q.groupId && !groupIdRemap.has(q.groupId)) {
      let newId = q.groupId;
      if (existingGroupIds.has(newId)) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        newId = `${q.groupId}-${suffix}`;
      }
      groupIdRemap.set(q.groupId, newId);
      existingGroupIds.add(newId);
    }
  });

  uniqueParsed.forEach((q) => {
    if (q.groupId && groupIdRemap.has(q.groupId)) {
      q.groupId = groupIdRemap.get(q.groupId)!;
    }
  });

  const skippedCount = filteredByType.length - uniqueParsed.length;

  onProgress?.({
    current: 0,
    total: uniqueParsed.length,
    message: `Menyiapkan import ${uniqueParsed.length} soal${skippedCount > 0 ? ` (${skippedCount} duplikat dilewati)` : ""}${skippedByType > 0 ? ` (${skippedByType} tipe tidak aktif)` : ""}...`,
    title: "Import file Word",
  });

  let importedCount = 0;
  const chunkSize = 5;

  for (let i = 0; i < uniqueParsed.length; i += chunkSize) {
    const chunk = uniqueParsed.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (q, index) => {
        const actualIndex = i + index;

        const imageUrl = q.imageUrl ? await localizeImage(q.imageUrl, `word_q_${actualIndex}`) : "";

        const choices: Record<string, any> = {};
        await Promise.all(
          Object.entries(q.choices).map(async ([key, val]: [string, any]) => {
            const choiceImgUrl = val.imageUrl ? await localizeImage(val.imageUrl, `word_opt_${actualIndex}_${key}`) : "";
            const choiceText = val.text ? await localizeInlineImages(val.text) : "";

            choices[key.toLowerCase()] = {
              text: choiceText,
              isCorrect: val.isCorrect || false,
              imageUrl: choiceImgUrl,
            };
          })
        );

        const answerKey = Object.entries(choices).find(([_, v]) => v.isCorrect)?.[0] || "";
        const questionType = q.type || "pilihan_ganda";
        const fieldType = IMPORT_TYPE_MAP[questionType] || "multiple_choice";

        const localizedQText = await localizeInlineImages(q.text || "");
        const localizedGroupText = q.groupText ? await localizeInlineImages(q.groupText) : "";

        const payload: any = {
          examId,
          text: localizedQText,
          field: fieldType,
          type: questionType,
          options: questionType === "pilihan_ganda" ? choices : {},
          correctAnswer: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : q.answerKey || "",
          answerKey: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : q.answerKey || "",
          groupId: q.groupId || "",
          groupText: localizedGroupText,
          order: maxExistingOrder + actualIndex + 1,
          imageUrl: imageUrl,
        };

        try {
          await pb.collection("questions").create(payload);
          importedCount++;
        } catch (createErr) {
          console.error("Gagal membuat soal Word pada index:", actualIndex, createErr);
        }
      })
    );

    const currentProcessed = Math.min(i + chunkSize, uniqueParsed.length);
    const progress = Math.round((currentProcessed / uniqueParsed.length) * 100);
    onProgress?.({
      current: currentProcessed,
      total: uniqueParsed.length,
      message: `Mengimport soal (${currentProcessed}/${uniqueParsed.length})`,
      title: "Import file Word",
      percent: progress,
    });
  }

  return { importedCount, skippedCount, skippedByType };
};

export const importQuestionsFromExcel = async ({
  file,
  pb,
  examId,
  onProgress,
  localizeImage = async (url) => url,
  localizeInlineImages = async (html) => html,
}: BaseImportOptions): Promise<ImportResult> => {
  onProgress?.({
    current: 0,
    total: 0,
    message: "Membaca file Excel...",
    title: "Import dari Excel",
  });

  const parsed = await parseQuestionImportExcel(file);
  if (parsed.length === 0) {
    throw new Error("Tidak ada soal yang ditemukan dalam file Excel tersebut.");
  }

  onProgress?.({
    current: 0,
    total: parsed.length,
    message: "Memulai import...",
    title: "Import dari Excel",
  });

  const excelExisting = await pb.collection("questions").getFullList({ filter: `examId = "${examId}"`, fields: "order" });
  const maxExistingOrder = excelExisting.reduce((max: number, q: any) => Math.max(max, q.order || 0), 0);

  let importedCount = 0;
  const chunkSize = 10;
  for (let i = 0; i < parsed.length; i += chunkSize) {
    const chunk = parsed.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (q, index) => {
        const actualIndex = i + index;

        const localizedQText = await localizeInlineImages(q.text || "");
        const localizedGroupText = q.groupText ? await localizeInlineImages(q.groupText) : "";

        const choices: Record<string, any> = {};
        if (q.choices) {
          await Promise.all(
            Object.entries(q.choices).map(async ([key, val]: [string, any]) => {
              const choiceImgUrl = val.imageUrl ? await localizeImage(val.imageUrl, `excel_opt_${actualIndex}_${key}`) : "";
              const choiceText = val.text ? await localizeInlineImages(val.text) : "";

              choices[key.toLowerCase()] = {
                text: choiceText,
                isCorrect: val.isCorrect || false,
                imageUrl: choiceImgUrl,
              };
            })
          );
        }

        let answerKey = "";
        if (q.type === "isian_singkat" || q.type === "uraian") {
          answerKey = q.answerKey || "";
        } else {
          answerKey = Object.entries(choices).find(([_, v]: any) => v.isCorrect)?.[0] || q.answerKey || "";
        }

        const payload = {
          examId,
          type: q.type,
          field: IMPORT_TYPE_MAP[q.type] || "multiple_choice",
          text: localizedQText,
          imageUrl: q.imageUrl || "",
          options: choices,
          correctAnswer: answerKey,
          answerKey: answerKey,
          order: maxExistingOrder + actualIndex + 1,
          groupId: q.groupId || "",
          groupText: localizedGroupText,
        };

        try {
          await pb.collection("questions").create(payload);
          importedCount++;
        } catch (createErr) {
          console.error("Gagal membuat soal Excel pada index:", actualIndex, createErr);
        }
      })
    );

    const currentProcessed = Math.min(i + chunkSize, parsed.length);
    const progress = Math.round((currentProcessed / parsed.length) * 100);
    onProgress?.({
      current: currentProcessed,
      total: parsed.length,
      message: `Mengimport soal (${currentProcessed}/${parsed.length})`,
      title: "Import dari Excel",
      percent: progress,
    });
  }

  return { importedCount };
};

export const importQuestionsFromJson = async ({
  file,
  pb,
  examId,
  onProgress,
  localizeImage = async (url) => url,
  localizeInlineImages = async (html) => html,
}: BaseImportOptions): Promise<ImportResult> => {
  onProgress?.({
    current: 0,
    total: 0,
    message: "Membaca file JSON...",
    title: "Import dari JSON",
  });

  const text = await file.text();
  const data = JSON.parse(text);

  const questionsArr: any[] = Array.isArray(data) ? data : data.questions || data.soal || data.data || [];

  if (questionsArr.length === 0) {
    throw new Error("File JSON tidak berisi soal yang valid.");
  }

  onProgress?.({
    current: 0,
    total: questionsArr.length,
    message: `Mengimport ${questionsArr.length} soal...`,
    title: "Import dari JSON",
  });

  const existingForOrder = await pb.collection("questions").getFullList({ filter: `examId = "${examId}"`, fields: "order" });
  const jsonMaxOrder = existingForOrder.reduce((max: number, q: any) => Math.max(max, q.order || 0), 0);

  let importedCount = 0;
  for (let i = 0; i < questionsArr.length; i++) {
    const q = questionsArr[i];
    if (!q.text && !q.question) continue;

    const qType = q.type || "pilihan_ganda";
    const choices = q.choices || q.options || {};
    let correctAnswer = q.correctAnswer || q.answerKey || "";

    if (!correctAnswer && typeof choices === "object") {
      const correctKeys = Object.entries(choices)
        .filter(([_, c]: [string, any]) => c && typeof c === "object" && c.isCorrect)
        .map(([k]) => k.toLowerCase());
      if (correctKeys.length > 0) correctAnswer = correctKeys.join(",");
    }

    const qImageUrl = q.imageUrl || q.image_url || "";
    const localizedQImageUrl = qImageUrl ? await localizeImage(qImageUrl, `json_q_${i}`) : "";
    const finalQImageUrl = localizedQImageUrl || qImageUrl;
    let localizedQText = await localizeInlineImages(q.text || q.question || "");
    if (finalQImageUrl && !localizedQText.includes(finalQImageUrl)) {
      localizedQText = `<p><img src="${finalQImageUrl}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` + localizedQText;
    }

    const rawGroupText = q.groupText || q.group_text || "";
    const localizedGroupText = rawGroupText ? await localizeInlineImages(rawGroupText) : "";

    const payload: any = {
      examId,
      examid: examId,
      text: localizedQText,
      type: qType,
      field: IMPORT_TYPE_MAP[qType] || "multiple_choice",
      options: {},
      correctAnswer: correctAnswer,
      imageUrl: localizedQImageUrl,
      order: q.order || jsonMaxOrder + i + 1,
      groupId: q.groupId || q.group_id || "",
      group_id: q.groupId || q.group_id || "",
      groupText: localizedGroupText,
      group_text: localizedGroupText,
    };

    if ((qType === "benar_salah" || qType === "true_false") && q.statements && Array.isArray(q.statements) && q.statements.length > 0) {
      const validStatements = await Promise.all(
        q.statements.map(async (st: any) => ({
          id: String(st.id || Math.random()),
          text: await localizeInlineImages(st.text || ""),
          answer: st.answer === "benar" || st.answer === "salah" ? st.answer : "benar",
        }))
      );
      payload.options = { statements: validStatements };
      if (!correctAnswer) {
        payload.correctAnswer = validStatements.map((s: any) => `${s.id}:${s.answer}`).join(",");
      }
    } else if (choices && Object.keys(choices).length > 0) {
      const localizedChoices: Record<string, any> = {};
      const keys = Object.keys(choices);
      for (const k of keys) {
        const val = choices[k];
        if (typeof val === "object" && val !== null) {
          const choiceImg = val.imageUrl || val.image_url || "";
          const localizedChoiceImg = choiceImg ? await localizeImage(choiceImg, `json_opt_${i}_${k}`) : "";
          localizedChoices[k] = {
            text: await localizeInlineImages(val.text || ""),
            isCorrect: !!val.isCorrect,
            imageUrl: localizedChoiceImg || choiceImg,
          };
        } else {
          localizedChoices[k] = { text: await localizeInlineImages(String(val || "")), isCorrect: false };
        }
      }
      payload.options = localizedChoices;
      payload.choices = localizedChoices;
    }

    if (q.pairs && Array.isArray(q.pairs)) {
      const localizedPairs = await Promise.all(
        q.pairs.map(async (p: any) => ({
          id: p.id || String(Math.random()),
          left: await localizeInlineImages(p.left || ""),
          right: await localizeInlineImages(p.right || ""),
        }))
      );
      payload.options.pairs = localizedPairs;
      payload.pairs = localizedPairs;
    }

    if (q.items && Array.isArray(q.items)) {
      const localizedItems = await Promise.all(
        q.items.map(async (it: any) => {
          const itemImg = it.imageUrl || it.image_url || "";
          const localizedItemImg = itemImg ? await localizeImage(itemImg, `json_item_${i}_${it.id}`) : "";
          return {
            id: it.id || String(Math.random()),
            text: await localizeInlineImages(it.text || ""),
            imageUrl: localizedItemImg || itemImg,
          };
        })
      );
      payload.options.items = localizedItems;
      payload.items = localizedItems;
    }

    payload.answerKey = payload.correctAnswer;

    try {
      await pb.collection("questions").create(payload);
      importedCount++;
    } catch (createErr) {
      console.error("Gagal membuat soal JSON pada index:", i, createErr);
    }

    const currentProcessed = i + 1;
    const progress = Math.round((currentProcessed / questionsArr.length) * 100);
    onProgress?.({
      current: currentProcessed,
      total: questionsArr.length,
      message: `Mengimport soal (${currentProcessed}/${questionsArr.length})`,
      title: "Import dari JSON",
      percent: progress,
    });
  }

  return { importedCount };
};
