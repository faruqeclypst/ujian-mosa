// src/lib/imageSearch.ts
// Layanan Pencarian Gambar Web Edukasi & Validasi Relevansi dengan AI
// Menjaga kualitas visual soal ujian dan mencegah kebocoran kunci jawaban (anti-spoiler)

import PocketBase from "pocketbase";
import { fetchAI, robustJSONParse } from "./ai";

export interface OnlineImageCandidate {
  id: string;
  title: string;
  rawTitle: string;
  thumbUrl: string;
  url: string;
  width?: number;
  height?: number;
  mime?: string;
  descriptionUrl: string;
  source: "web";
}

export interface AIImageValidationResult {
  id: string;
  score: number; // 0 - 100
  isRecommended: boolean;
  isSpoiler: boolean;
  reason: string;
  badge: "Sangat Cocok" | "Cukup Relevan" | "Bocor Jawaban" | "Kurang Relevan";
}

/**
 * Mencari gambar visual edukatif & diagram materi pelajaran langsung dari Web (Google / Bing Edukasi)
 * Menghasilkan gambar yang sangat relevan untuk materi sekolah (Ruangguru, Zenius, Kemdikbud, Wikipedia, blog materi sekolah)
 */
export async function searchWebImages(
  pb: PocketBase,
  query: string,
  limit: number = 24
): Promise<OnlineImageCandidate[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  try {
    const endpoint = `${pb.baseUrl}/api/search-web-images?q=${encodeURIComponent(cleanQ)}&count=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (pb.authStore && pb.authStore.token) {
      headers["Authorization"] = `Bearer ${pb.authStore.token}`;
    }

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn("Web image search failed with status:", res.status);
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      id: r.id || `web_${Math.random().toString(36).substring(2, 8)}`,
      title: r.title || cleanQ,
      rawTitle: r.title || cleanQ,
      thumbUrl: r.thumbUrl || r.imageUrl,
      url: r.imageUrl,
      width: r.width,
      height: r.height,
      mime: "image/jpeg",
      descriptionUrl: r.sourcePage || r.imageUrl,
      source: "web" as const
    }));
  } catch (err: any) {
    console.warn("Gagal mencari gambar web edukasi:", err);
    return [];
  }
}

/**
 * Menyarankan kata kunci pencarian visual menggunakan AI berdasarkan teks soal
 */
export async function suggestKeywordsWithAI(
  pb: PocketBase,
  questionText: string,
  topic?: string,
  subject?: string
): Promise<string[]> {
  const cleanQ = questionText.replace(/<[^>]+>/g, " ").trim();
  if (!cleanQ && !topic) return [];

  try {
    const prompt = `Analisis pertanyaan ujian berikut dan berikan 3 sampai 4 kata kunci pencarian gambar terbaik untuk mencari ilustrasi/diagram/foto materi pelajaran di web internet.
Berikan kata kunci dalam Bahasa Indonesia yang spesifik dan jelas (contoh: "diagram siklus air", "struktur sel hewan lengkap", "peta asia tenggara").

MATA PELAJARAN: ${subject || "Umum"}
TOPIK: ${topic || "-"}
SOAL: ${cleanQ.slice(0, 300)}

Balas HANYA JSON array string, contoh: ["struktur sel hewan", "bagian sel hewan dan fungsinya", "organel sel biologi"]`;

    const content = await fetchAI({
      pb,
      messages: [
        { role: "system", content: "Anda adalah asisten cerdas pencarian materi visual edukasi. Balas HANYA JSON array string." },
        { role: "user", content: prompt }
      ],
      maxTokens: 120,
      temperature: 0.3,
      jsonMode: false
    });

    const parsed = robustJSONParse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((k: any) => String(k).trim()).filter(k => k.length > 1).slice(0, 5);
    }
    return [];
  } catch (err) {
    console.warn("Gagal menyarankan kata kunci dengan AI:", err);
    const fallback = [topic, subject].filter(Boolean) as string[];
    return fallback;
  }
}

/**
 * Memvalidasi kandidat gambar terhadap pertanyaan dan jawaban ujian dengan AI:
 * - Cek kesesuaian konsep materi
 * - Cek pedagogik visual
 * - Cek anti-spoiler (apakah teks/label pada gambar membocorkan kunci jawaban kepada siswa)
 */
export async function validateImagesWithAI(
  pb: PocketBase,
  questionContext: {
    text: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
  },
  candidates: OnlineImageCandidate[]
): Promise<Record<string, AIImageValidationResult>> {
  if (!candidates || candidates.length === 0) return {};

  const cleanQ = questionContext.text.replace(/<[^>]+>/g, " ").trim();
  const candidateList = candidates.slice(0, 12).map((c, i) => ({
    id: c.id,
    no: i + 1,
    title: c.title,
    filename: c.rawTitle
  }));

  const systemPrompt = `Anda adalah validator materi visual edukasi untuk soal ujian sekolah.
Tugas Anda adalah menilai apakah setiap gambar kandidat cocok dipakai sebagai ilustrasi soal ujian.

KRITERIA PENILAIAN:
1. Relevansi Materi (skor 0-100): Apakah konsep gambar sesuai dengan topik yang ditanyakan?
2. Kualitas Pedagogis: Apakah gambar memperjelas pemahaman siswa atau menjadi stimulus berpikir?
3. ATURAN KETAT ANTI-SPOILER / BOCOR KUNCI JAWABAN:
   - Jika gambar secara gamblang menampilkan jawaban dari pertanyaan (misalnya gambar diagram anatomi yang sudah ada nama label jawabannya secara jelas sementara pertanyaannya menanyakan nama bagian tersebut), maka gambar tersebut DIANGGAP BOCOR JAWABAN (isSpoiler: true).
   - Gambar yang membocorkan kunci jawaban TIDAK BOLEH direkomendasikan (isRecommended: false) dan skornya harus di bawah 40.

Format output WAJIB JSON array objek dengan properti:
- id: string (sesuai id kandidat)
- score: number (0 - 100)
- isRecommended: boolean (true jika score >= 70 dan tidak spoiler)
- isSpoiler: boolean (true jika membocorkan kunci jawaban soal)
- reason: string (penjelasan singkat bahasa Indonesia 1 kalimat)`;

  const userPrompt = `KONTEKS SOAL UJIAN:
- Pertanyaan: ${cleanQ.slice(0, 350)}
- Opsi Jawaban: ${questionContext.options ? questionContext.options.join(" | ") : "-"}
- Kunci Jawaban Benar: ${questionContext.correctAnswer || "-"}
- Pembahasan: ${questionContext.explanation || "-"}

DAFTAR KANDIDAT GAMBAR DARI WEB:
${JSON.stringify(candidateList, null, 2)}

Evaluasi setiap kandidat gambar. Balas HANYA JSON array objek.`;

  try {
    const rawRes = await fetchAI({
      pb,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 500,
      temperature: 0.2,
      jsonMode: true
    });

    const parsed = robustJSONParse(rawRes);
    const results: any[] = Array.isArray(parsed) ? parsed : (parsed?.results || parsed?.candidates || []);
    const resultMap: Record<string, AIImageValidationResult> = {};

    for (const r of results) {
      if (!r || !r.id) continue;
      const score = Math.min(100, Math.max(0, Number(r.score) || 0));
      const isSpoiler = !!r.isSpoiler;
      const isRecommended = !!r.isRecommended && score >= 70 && !isSpoiler;

      let badge: AIImageValidationResult["badge"] = "Kurang Relevan";
      if (isSpoiler) {
        badge = "Bocor Jawaban";
      } else if (score >= 85) {
        badge = "Sangat Cocok";
      } else if (score >= 65) {
        badge = "Cukup Relevan";
      }

      resultMap[r.id] = {
        id: String(r.id),
        score: score,
        isRecommended: isRecommended,
        isSpoiler: isSpoiler,
        reason: r.reason || (isSpoiler ? "Berpotensi membocorkan kunci jawaban" : "Sesuai dengan materi soal"),
        badge: badge
      };
    }

    return resultMap;
  } catch (err) {
    console.warn("Gagal memvalidasi gambar dengan AI:", err);
    return {};
  }
}

/**
 * Mencari dan memvalidasi gambar secara otomatis untuk pembuatan soal AI
 * Mengembalikan gambar terbaik jika skor validasi >= 75 dan tidak bocor kunci jawaban
 */
export async function autoFindValidatedImage(
  pb: PocketBase,
  questionText: string,
  topic?: string,
  subject?: string,
  options?: string[],
  correctAnswer?: string
): Promise<{ image: OnlineImageCandidate; validation: AIImageValidationResult } | null> {
  try {
    // 1. Dapatkan kata kunci pencarian
    const keywords = await suggestKeywordsWithAI(pb, questionText, topic, subject);
    if (keywords.length === 0) return null;

    // 2. Cari gambar dari Web Edukasi
    let candidates: OnlineImageCandidate[] = [];
    for (const kw of keywords) {
      try {
        const found = await searchWebImages(pb, kw, 8);
        if (found.length > 0) {
          candidates = found;
          break;
        }
      } catch (_) {}
    }

    if (candidates.length === 0) return null;

    // 3. Validasi dengan AI
    const validations = await validateImagesWithAI(
      pb,
      { text: questionText, options, correctAnswer },
      candidates.slice(0, 6)
    );

    // 4. Pilih kandidat dengan skor tertinggi yang direkomendasikan
    let bestCandidate: OnlineImageCandidate | null = null;
    let bestValidation: AIImageValidationResult | null = null;
    let bestScore = -1;

    for (const c of candidates) {
      const v = validations[c.id];
      if (v && v.isRecommended && !v.isSpoiler && v.score >= 75) {
        if (v.score > bestScore) {
          bestScore = v.score;
          bestCandidate = c;
          bestValidation = v;
        }
      }
    }

    if (bestCandidate && bestValidation) {
      return { image: bestCandidate, validation: bestValidation };
    }

    return null;
  } catch (err) {
    console.warn("autoFindValidatedImage failed:", err);
    return null;
  }
}

/**
 * Menyisipkan gambar edukasi langsung ke dalam pertanyaan utama (HTML).
 * Posisi disesuaikan secara cerdas:
 * - Jika ada kalimat pengantar stimulus di awal (misal: "Perhatikan gambar...", "Perhatikan diagram..."),
 *   gambar disisipkan tepat di bawah kalimat tersebut.
 * - Jika tidak ada pengantar khusus, gambar ditempatkan di bagian paling atas pertanyaan.
 */
export function insertImageIntoQuestionText(
  questionText: string,
  imageUrl: string,
  title?: string
): string {
  const cleanUrl = (imageUrl || "").trim();
  if (!cleanUrl) return questionText;
  if (questionText.includes(cleanUrl)) return questionText; // Cegah duplikasi

  const cleanTitle = (title || "Ilustrasi Soal").replace(/"/g, "&quot;");
  // Container gambar yang rapi, responsif, terpusat, dengan border radius modern
  const imgBlock = `<p style="text-align: center; margin: 12px 0;"><img src="${cleanUrl}" alt="${cleanTitle}" style="max-height: 340px; max-width: 100%; border-radius: 12px; margin: 0 auto; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.06);" /></p>`;

  const trimmed = (questionText || "").trim();
  if (!trimmed) return imgBlock;

  // Pola kalimat pengantar stimulus di awal:
  // Contoh:
  // "<p>Perhatikan gambar berikut ini!</p>"
  // "Perhatikan diagram siklus air di bawah ini:"
  // "<p>Cermati struktur sel berikut:</p>"
  const stimulusIntroRegex = /^((?:<p[^>]*>)?\s*(?:Perhatikan|Cermati|Amati|Berdasarkan|Periksalah)\s+(?:gambar|diagram|bagan|grafik|peta|tabel|ilustrasi|foto|struktur)[^.!?:\n<]*[.!?:]\s*(?:<\/p>)?)/i;
  const match = trimmed.match(stimulusIntroRegex);

  if (match) {
    const introSentence = match[0];
    const remainingText = trimmed.slice(introSentence.length).trim();
    if (remainingText) {
      return `${introSentence}\n${imgBlock}\n${remainingText}`;
    }
    return `${introSentence}\n${imgBlock}`;
  }

  // Jika tidak ada kalimat stimulus khusus, letakkan gambar di bagian atas pertanyaan
  return `${imgBlock}\n${trimmed}`;
}

