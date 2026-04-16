import pb from "./pocketbase";

export interface AIGeneratedQuestion {
  text: string;
  type: string;
  choices?: Record<string, { text: string; isCorrect: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string }>;
  answerKey?: string;
  groupId?: string;
  groupText?: string;
}

export const AI_MODELS = [
  // --- GROQ CLOUD (Official Production Models) ---
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Versatile Expert)", speed: "High Performance", status: "production", provider: "groq" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (Large Context)", speed: "Fast", status: "production", provider: "groq" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Instant)", speed: "Blink Speed", status: "production", provider: "groq" },
  { id: "gemma2-9b-it", name: "Google Gemma 2 9B", speed: "Smart", status: "production", provider: "groq" },
  
  // --- GROQ CLOUD (Preview Models) ---
  { id: "llama-3.2-1b-preview", name: "Llama 3.2 1B (Micro Fast)", speed: "Hyper Fast", status: "preview", provider: "groq" },
  { id: "llama-3.2-3b-preview", name: "Llama 3.2 3B (Compact)", speed: "Efficient", status: "preview", provider: "groq" },

  // --- OLLAMA CLOUD (Verified from api/tags) ---
  { id: "mistral-large-3:675b", name: "Mistral Large 3 (675B Monster)", speed: "Colossal", status: "production", provider: "ollama" },
  { id: "glm-5.1", name: "GLM 5.1 (Colossal Research)", speed: "Ultimate Brain", status: "production", provider: "ollama" },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2 (Super Logic)", speed: "God-Tier", status: "production", provider: "ollama" },
  { id: "kimi-k2.5", name: "Kimi K2.5 (Thinking Expert)", speed: "Reasoning", status: "production", provider: "ollama" },
  { id: "qwen3.5:397b", name: "Qwen 3.5 397B (Huge Database)", speed: "Vast Knowledge", status: "production", provider: "ollama" },
  { id: "gpt-oss:120b", name: "Ollama GPT-OSS 120B", speed: "Mastermind", status: "production", provider: "ollama" },
  { id: "devstral-2:123b", name: "Devstral 2 (123B)", speed: "Pro Developer", status: "production", provider: "ollama" },
  { id: "qwen3-next:80b", name: "Qwen 3 Next 80B", speed: "Balanced Strong", status: "production", provider: "ollama" },
  { id: "gemma4:31b", name: "Google Gemma 4 31B", speed: "Smart Small", status: "production", provider: "ollama" },
  { id: "nemotron-3-super", name: "Nemotron 3 Super (230B)", speed: "Heavyweight", status: "production", provider: "ollama" },
  { id: "ministral-3:14b", name: "Ministral 3 14B", speed: "Efficient", status: "production", provider: "ollama" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", speed: "Hyper Speed", status: "preview", provider: "ollama" },
  { id: "gemma3:4b", name: "Gemma 3 4B (Small)", speed: "Eco-Friendly", status: "production", provider: "ollama" },
];

export const generateQuestionsAI = async (
  topic: string, 
  count: number = 5, 
  level: string = "Umum", 
  subject: string = "",
  type: string = "pilihan_ganda",
  isLiteracy: boolean = false,
  passageLength: string = "sedang",
  difficulty: string = "sedang",
  focus: string = "umum"
): Promise<AIGeneratedQuestion[]> => {
  try {
    const settings = await pb.collection("settings").getFullList({ limit: 1 });
    const config = settings[0];
    
    // 🧠 Dynamic API Configuration
    const isOllama = config?.ai_provider === "ollama";
    const apiKey = isOllama ? (config?.ai_gateway_key || config?.groq_api_key) : config?.groq_api_key;
    const baseUrl = isOllama 
      ? (pb.baseUrl + "/api/ai-proxy") 
      : "https://api.groq.com/openai/v1";

    if (!apiKey) {
      throw new Error("API Key belum diatur di Pengaturan Aplikasi.");
    }

    const model = (config?.ai_model || AI_MODELS[0].id);
    console.log(`🚀 [AI ENGINE] Menggunakan Model: ${model} via ${isOllama ? 'OLLAMA PROXY' : 'GROQ DIRECT'}`);

    const lengthMap: Record<string, string> = {
      pendek: "sekitar 250-300 kata, lugas & informatif",
      sedang: "sekitar 500-600 kata, kaya data & analitis",
      panjang: "sekitar 800-1000 kata, kompleks & multi-dimensi"
    };

    const typeDesc = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah",
      isian_singkat: "Isian Singkat",
      uraian: "Uraian HOTS"
    }[type] || "Pilihan Ganda";

    let wacanaResult = "";

    // 🚀 STEP 1: GENERATE WACANA (ONLY IF LITERACY)
    if (isLiteracy) {
      const wacanaPrompt = `Anda adalah Sastrawan & Ahli Literasi AKM. 
Tugas: Buat teks bacaan berkualitas tinggi bertema "${topic}" untuk jenjang ${level} - ${subject}.
Target: Panjang ${lengthMap[passageLength]}, Kesulitan ${difficulty}.

FORMAT HTML WAJIB (DILARANG KERAS MENGGUNAKAN MARKDOWN SEPERTI **):
- <h2 style="text-align:center; color:#1e3a8a; margin-bottom:32px; font-weight:900;">[JUDUL]</h2>
- WAJIB gunakan beberapa blok <p> untuk setiap paragraf baru (JANGAN DISATUKAN).
- SETIAP <p> harus memiliki style="text-indent: 48px; margin-bottom: 24px; line-height: 1.8; text-align: justify;".
- Gunakan <strong>...</strong> untuk penebalan teks, JANGAN GUNAKAN **.
- JANGAN sertakan baris 'Sumber' di bagian akhir.

Hanya berikan teks HTML tersebut tanpa salam pembuka/penutup.`;

      // 🚀 FETCH PROXY OR DIRECT
      let responseWacana;
      if (isOllama) {
        responseWacana = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
          body: JSON.stringify({
            baseUrl: "https://ollama.com",
            apiKey: apiKey,
            body: { 
               model, 
               messages: [{ role: "user", content: wacanaPrompt }],
               stream: false,
               options: { temperature: 0.7 }
            }
          })
        });
      } else {
        responseWacana = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: wacanaPrompt }],
            temperature: 0.7
          })
        });
      }

      if (responseWacana.status === 429) throw new Error("AI_RATE_LIMIT");
      if (!responseWacana.ok) throw new Error("Gagal membuat teks wacana.");
      const dataWacana = await responseWacana.json();
      
      // Ollama format returns message object, OpenAI returns choices[0].message
      wacanaResult = isOllama ? dataWacana.message.content : dataWacana.choices[0].message.content;
    }

    // 🎯 STEP 2: GENERATE QUESTIONS
    const systemPrompt = `Anda adalah Ahli Evaluasi Pendidikan & Ahli Matematika/Sains.
Tugas: Buat ${count} soal ${typeDesc} untuk jenjang ${level} - ${subject} berdasarkan stimulus yang diberikan.
Kesulitan: ${difficulty}, Fokus: ${focus.toUpperCase()}.

PEDOMAN FORMATTING (SANGAT KETAT):
1. ZERO TOLERANCE: Dilarang keras menulis simbol matematika (∫, ^, x, f(x), dll) di bagian TEKS SOAL tanpa pembungkus LaTeX \( ... \). 
2. GAYA PROFESIONAL: Gunakan perintah LaTeX standar seperti \int_{a}^{b}, \frac{a}{b}, \sqrt{x}.
   Gunakan \displaystyle jika rumus cukup kompleks agar terlihat besar dan jelas.
   CONTOH: "Hitunglah nilai dari \( \int_{0}^{1} (3x^2 + 2x) dx \)."
3. JSON ESCAPING: Setiap garis miring ("\\") dalam LaTeX WAJIB di-escape ganda ("\\\\") di dalam JSON.

STRUKTUR JSON:
{
  "questions": [
    {
      "text": "Pertanyaan dalam HTML dengan LaTeX \( ... \)",
      "choices": { "a": { "text": "...", "isCorrect": true }, ... },
      "answerKey": "..."
    }
  ]
}
Hanya berikan JSON murni. Jangan berikan penjelasan apapun di luar JSON.`;

    const mathHint = "\nWAJIB: Gunakan tanda dolar $ ... $ untuk SEMUA simbol matematika (contoh: $\\int_0^2 x^2 dx$ atau $\\frac{1}{2}$).";
    const userPrompt = isLiteracy 
      ? `INI ADALAH WACANA STIMULUS:\n${wacanaResult}\n\nBerdasarkan wacana di atas, buatkan ${count} soal ${typeDesc}.${mathHint}`
      : `Buat soal ${typeDesc} untuk jenjang ${level} - ${subject} tentang topik: "${topic}".${mathHint}`;

    let responseQuestions;
    if (isOllama) {
      responseQuestions = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: "https://ollama.com",
          apiKey: apiKey,
          body: {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ]
          }
        })
      });
    } else {
      responseQuestions = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,
          response_format: { type: "json_object" }
        })
      });
    }

    if (responseQuestions.status === 429) throw new Error("AI_RATE_LIMIT");
    if (!responseQuestions.ok) throw new Error("Gagal membuat butir soal.");
    
    const dataQs = await responseQuestions.json();
    const contentQs = isOllama ? (dataQs?.message?.content || "") : (dataQs?.choices?.[0]?.message?.content || "");
    
    if (!contentQs) throw new Error("AI tidak memberikan respon teks yang valid.");

    let cleanContent = contentQs.trim();
    
    // 🔍 Smart JSON Extraction: Find the first { and last }
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    }
    
    // 🔥 Radical Fix for LaTeX
    cleanContent = cleanContent.replace(/\\/g, "\\\\")
                               .replace(/\\\\\\\\/g, "\\\\")
                               .replace(/\\(?=["\\\/bfnrtu])/g, "\\");

    const parsed = JSON.parse(cleanContent);
    const questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);

    if (questionsRaw.length === 0) throw new Error("Format soal tidak valid.");

    const uniqueId = isLiteracy ? `LIT-${Math.random().toString(36).substr(2, 6).toUpperCase()}` : "";
    
    return questionsRaw.map((q: any) => ({
      ...q,
      groupId: uniqueId,
      groupText: isLiteracy ? wacanaResult : ""
    }));

  } catch (err: any) {
    console.error("Advanced AI System Error:", err);
    throw err;
  }
};

export const generateSingleQuestionAI = async (
  topic: string,
  type: string = "pilihan_ganda",
  level: string = "Umum",
  subject: string = "",
  difficulty: string = "sedang",
  focus: string = "akm",
  existingWacana: string = ""
): Promise<AIGeneratedQuestion> => {
  try {
    const settings = await pb.collection("settings").getFullList({ limit: 1 });
    const config = settings[0];
    if (!config?.groq_api_key) throw new Error("API Key belum diatur.");
    
    // 🧠 Dynamic API Configuration
    const isOllama = config?.ai_provider === "ollama";
    const apiKey = isOllama ? (config?.ai_gateway_key || config?.groq_api_key) : config?.groq_api_key;
    const baseUrl = isOllama 
      ? (pb.baseUrl + "/api/ai-proxy") 
      : "https://api.groq.com/openai/v1";

    const model = (config?.ai_model || AI_MODELS[0].id).replace("openclaw/", "");

    const typeDesc = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah",
      isian_singkat: "Isian Singkat",
      uraian: "Uraian HOTS"
    }[type] || "Pilihan Ganda";

    const systemPrompt = `Anda adalah Ahli Evaluasi Pendidikan.
Tugas: Buat TEPAT SATU butir soal ${typeDesc} untuk jenjang ${level} - ${subject}.
Kesulitan: ${difficulty}, Fokus: ${focus.toUpperCase()}.

STRUKTUR JSON (WAJIB):
{
  "text": "Pertanyaan (HTML)",
  "choices": { "a": { "text": "...", "isCorrect": true }, ... },
  "answerKey": "Kunci (untuk isian/uraian)"
}
Aturan: Variasikan struktur kalimat (jangan kaku), dilarang menggunakan markdown **.`;

    const userPrompt = existingWacana 
      ? `INI ADALAH WACANA STIMULUS:\n${existingWacana}\n\nBerdasarkan wacana di atas, BUAT TEPAT SATU soal ${typeDesc}. JANGAN menggunakan placeholder.`
      : `Buat TEPAT SATU soal ${typeDesc} tentang materi/topik: "${topic}". JANGAN menggunakan placeholder.`;

    let response;
    if (isOllama) {
        response = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
            body: JSON.stringify({
                baseUrl: "https://ollama.com",
                apiKey: apiKey,
                body: { 
                    model, 
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    stream: false
                }
            })
        });
    } else {
        response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8,
                response_format: { type: "json_object" }
            })
        });
    }

    if (response.status === 429) throw new Error("AI_RATE_LIMIT");
    if (!response.ok) throw new Error("Gagal regenerasi soal.");
    const data = await response.json();
    const content = isOllama ? data.message.content : data.choices[0].message.content;
    
    let cleanContent = content.trim();
    // 🔍 Smart Extraction
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    }

    // 🔥 Radical Fix for LaTeX
    cleanContent = cleanContent.replace(/\\/g, "\\\\")
                               .replace(/\\\\\\\\/g, "\\\\")
                               .replace(/\\(?=["\\\/bfnrtu])/g, "\\");

    const result = JSON.parse(cleanContent);
    
    return {
      ...result,
      groupId: "", // Will be assigned by Page logic
      groupText: existingWacana
    };
  } catch (err: any) {
    console.error("AI Single Gen Error:", err);
    throw err;
  }
};

export const getTopicSuggestionsAI = async (
  level: string,
  subject: string,
  difficulty: string = "sedang",
  type: string = "pilihan_ganda",
  focus: string = "umum",
  isLiteracy: boolean = false
): Promise<string[]> => {
  try {
    const settings = await pb.collection("settings").getFullList({ limit: 1 });
    const config = settings[0];
    if (!config?.groq_api_key) return [];
    
    const isOllama = config?.ai_provider === "ollama";
    const apiKey = isOllama ? (config?.ai_gateway_key || config?.groq_api_key) : config?.groq_api_key;
    const baseUrl = isOllama ? (pb.baseUrl + "/api/ai-proxy") : "https://api.groq.com/openai/v1";

    const model = (config?.ai_model || AI_MODELS[0].id);
    console.log(`💡 [AI TOPIC] Menyarankan topik menggunakan: ${model}`);

    const literasiNote = isLiteracy ? "(UTAMAKAN topik yang kaya teks bacaan/fenomena karena Mode Literasi AKTIF)" : "";
    const systemPrompt = `Anda adalah Ahli Kurikulum Nasional. Berikan 5 contoh topik/materi spesifik yang PALING RELEVAN untuk jenjang ${level}, mata pelajaran ${subject}, tingkat kesulitan ${difficulty}, dan standar ${focus.toUpperCase()}.
Tipe soal yang akan dibuat adalah ${type}. ${literasiNote}
Pastikan materi tersebut sesuai dengan tingkat kognitif jenjang ${level}.
Balas hanya dengan JSON format: { "topics": ["Topik A", "Topik B", ...] }`;

    let response;
    if (isOllama) {
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: "https://ollama.com",
          apiKey: apiKey,
          body: {
            model: model,
            messages: [{ role: "system", content: systemPrompt }],
            stream: false
          }
        })
      });
    } else {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }],
          temperature: 0.7,
          max_tokens: 300,
          response_format: { type: "json_object" }
        })
      });
    }

    if (response.status === 429) return ["AI_RATE_LIMIT"];
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = isOllama ? (data?.message?.content || "") : (data?.choices?.[0]?.message?.content || "");
    
    if (!content) return [];
    
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
    const rawTopics = parsed.topics || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    
    // 🛡️ Ensure everything is a string
    return rawTopics.map((t: any) => {
      if (typeof t === "string") return t;
      if (typeof t === "object" && t !== null) {
        return t.nama || t.topic || t.text || t.title || t.Title || JSON.stringify(t);
      }
      return String(t);
    }).slice(0, 5); // Limit to 5
  } catch (err) {
    console.error("AI Suggestion Error:", err);
    return [];
  }
};

export const parseQuestionsAI = async (
  rawText: string,
  subject: string = "",
  level: string = "Umum"
): Promise<AIGeneratedQuestion[]> => {
  try {
    const settings = await pb.collection("settings").getFullList({ limit: 1 });
    const config = settings[0];
    if (!config?.groq_api_key) throw new Error("API Key belum diatur.");
    
    const isOllama = config?.ai_provider === "ollama";
    const apiKey = isOllama ? (config?.ai_gateway_key || config?.groq_api_key) : config?.groq_api_key;
    const baseUrl = isOllama ? (pb.baseUrl + "/api/ai-proxy") : "https://api.groq.com/openai/v1";

    const model = (config?.ai_model || AI_MODELS[0].id);

    const systemPrompt = `Anda adalah Ahli Digitalisasi Dokumen Pendidikan.
Tugas: Ekstrak semua soal dari teks mentah (hasil copy-paste PDF/Word) menjadi JSON valid.

KETENTUAN EKSTRAKSI:
1. Identifikasi Teks Stimulus/Wacana (SHARED): Gunakan field 'groupText' dan 'groupId' HANYA JIKA satu teks panjang digunakan untuk beberapa soal sekaligus (misal: "Bacaan untuk nomor 1-3").
2. Soal Mandiri (STANDALONE): Jika soal tidak memiliki teks bacaan bersama, pastikan 'groupText' dan 'groupId' adalah string KOSONG (""). Jangan memasukkan stimulus ke dalam 'groupText' jika itu hanya berlaku untuk satu soal tersebut saja.
3. Identifikasi Soal & Opsi: Pisahkan pertanyaan dengan pilihan jawaban (a, b, c, d, e).
4. Identifikasi Kunci Jawaban: Deteksi kunci jawaban dari tanda (bold, bintang, dll). Jika tidak ada, biarkan isCorrect: false.
5. Tipe Soal: Default adalah 'pilihan_ganda'.

STRUKTUR JSON (WAJIB):
{
  "questions": [
    {
      "text": "Pertanyaan (HTML)",
      "type": "pilihan_ganda",
      "groupId": "",
      "groupText": "",
      "choices": { "a": { "text": "...", "isCorrect": true }, ... }
    }
  ]
}

Aturan Ketat: Gunakan HTML untuk formatting (<strong> JANGAN **), pastikan JSON valid dan utuh.`;

    const userPrompt = `DOKUMEN MENTAH (${subject} - ${level}):\n\n${rawText}\n\nSilakan ekstrak soal-soal di atas.`;

    let response;
    if (isOllama) {
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: "https://ollama.com",
          apiKey: apiKey,
          body: {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ]
          }
        })
      });
    } else {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3, // Low temperature for extraction accuracy
          response_format: { type: "json_object" }
        })
      });
    }

    if (response.status === 429) throw new Error("AI_RATE_LIMIT");
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Gagal menghubungi server AI.");
    }
    
    const data = await response.json();
    let content = isOllama ? data.message.content : data.choices[0].message.content;
    content = content.replace(/```json|```/g, "").trim();
    
    // 🛠️ Robust JSON Parsing & Mapping
    try {
      const parsed = JSON.parse(content);
      
      // 📝 Mapping logic untuk mendukung berbagai format (termasuk format "literasi" dari user)
      let questionsRaw: any[] = [];

      if (parsed.literasi && Array.isArray(parsed.literasi)) {
        // Format Khusus User: { literasi: [ { judul, teks, soal: [ { soal, opsi, jawaban } ] } ] }
        parsed.literasi.forEach((group: any) => {
          const groupId = group.judul || `LIT-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          const groupText = group.teks || "";
          
          if (Array.isArray(group.soal)) {
            group.soal.forEach((s: any) => {
              const choices: any = {};
              if (s.opsi) {
                Object.entries(s.opsi).forEach(([key, val]) => {
                  choices[key.toLowerCase()] = {
                    text: String(val),
                    isCorrect: String(key).toLowerCase() === String(s.jawaban).toLowerCase()
                  };
                });
              }
              
              questionsRaw.push({
                text: s.soal || s.text || "Pertanyaan Tanpa Judul",
                type: "pilihan_ganda",
                groupId: groupId,
                groupText: groupText,
                choices: choices
              });
            });
          }
        });
      } else {
        // Format Standar
        questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
      }

      if (questionsRaw.length === 0) throw new Error("AI tidak menemukan butir soal dalam teks tersebut.");
      return questionsRaw;
    } catch (e) {
      // Fallback regex jika AI memberikan string JSON di dalam markdown block
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
         // Recursive call dengan string yang sudah dibersihkan
         const retryData = await parseQuestionsAI(jsonMatch[0], subject, level);
         return retryData;
      }
      throw new Error("Gagal mengolah format data dari AI.");
    }
  } catch (err: any) {
    if (err.message.includes("maximum context length")) {
      throw new Error("Teks terlalu panjang. Silakan masukkan beberapa soal saja per sekali proses.");
    }
    console.error("AI Parser Error:", err);
    throw err;
  }
};

export const testAIConnection = async (apiKey: string, modelId: string, customUrl?: string, provider: string = "groq"): Promise<{ success: boolean; message: string }> => {
  try {
    if (!apiKey) throw new Error("API Key Kosong");
    
    const isOllama = provider === "ollama";
    
    let response;
    if (isOllama) {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: "https://ollama.com",
          apiKey: apiKey,
          body: { 
            model: modelId, 
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
            stream: false
          }
        })
      });
    } else {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        })
      });
    }

    if (response.ok) {
      return { success: true, message: "Koneksi Berhasil!" };
    }
    
    const err = await response.json();
    return { success: false, message: err.error?.message || err.error || "Gagal menghubungi AI" };
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menghubungi server AI." };
  }
};
