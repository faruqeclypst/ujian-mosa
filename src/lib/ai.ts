import PocketBase from "pocketbase";
import globalPb from "./pocketbase";

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

/**
 * 🛠️ Robust JSON Parser & Repair
 * Mencoba memproses output AI yang seringkali rusak karena karakter spesial atau LaTeX.
 */
const robustJSONParse = (text: string): any => {
  let clean = text.trim();
  
  // 1. Ekstrak blok JSON terpaku
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  // 1.5. Amankan perintah LaTeX yang bertabrakan dengan JSON control characters (r, n, t, f, b, u)
  // Misalnya \rightarrow dianggap sebagai Carriage Return (\r) + ightarrow
  const latexProblemCommands = [
    // r
    'rightarrow', 'Rightarrow', 'rho', 'right', 'rangle', 'rm', 
    // t
    'text', 'tan', 'theta', 'times', 'tau', 'triangle', 'to', 'top', 
    // n
    'neq', 'nu', 'nabla', 'nleq', 'ngeq', 'notin', 'ni', 
    // f
    'frac', 'forall', 
    // b
    'beta', 'bar', 'bf', 'bigcup', 'bigcap', 'bot', 'bullet', 'bmod', 'bra', 'bigcirc',
    // u
    'uparrow', 'Uparrow', 'updownarrow', 'Updownarrow', 'underbar', 'underbrace', 'uplus'
  ];
  
  const latexRegex = new RegExp(`(?<!\\\\)\\\\(${latexProblemCommands.join('|')})`, 'g');
  clean = clean.replace(latexRegex, "\\\\$1");

  try {
    // Jalur cepat: Jika AI memberikan JSON murni (seperti Groq json_object)
    return JSON.parse(clean);
  } catch (e) {
    console.warn("Standard JSON parse failed, attempting repair heuristics...");
    
    try {
      // Jalur pemulihan: Masalah umum AI adalah newline di tengah string
      // dan backslash LaTeX yang tidak di-escape dalam JSON
      let repaired = clean
        .replace(/\n/g, "\\n") // Ganti newline asli dengan \n literal
        .replace(/\\(?!["\\\/bfnrtu])/g, "\\\\"); // Escape backslash yang bukan bagian dari JSON control chars
      
      // Kembalikan karakter bracket yang mungkin rusak karena replace \n
      repaired = repaired.replace(/\\n\s*}/g, "}")
                         .replace(/\\n\s*]/g, "]")
                         .replace(/{\\n/g, "{")
                         .replace(/\[\\n/g, "[");

      return JSON.parse(repaired);
    } catch (err) {
      console.error("Critical JSON Parsing Error:", err);
      // Fallback terakhir: Coba regex primitif untuk mengekstrak field teks jika diperlukan (opsional)
      throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");
    }
  }
};

export const AI_MODELS = [
  // --- GROQ CLOUD (High Speed) ---
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Greatest)", speed: "High Performance", status: "production", provider: "groq" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Llama 70B (Reasoning)", speed: "Powerful", status: "production", provider: "groq" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (Balanced)", speed: "Fast", status: "production", provider: "groq" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", speed: "Fast", status: "production", provider: "groq" },
  { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", speed: "Balanced", status: "production", provider: "groq" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", speed: "Fast", status: "production", provider: "groq" },
  { id: "llama-3.2-1b-preview", name: "Llama 3.2 1B (Micro Fast)", speed: "Hyper Fast", status: "preview", provider: "groq" },
  { id: "llama-3.2-3b-preview", name: "Llama 3.2 3B (Compact)", speed: "Efficient", status: "preview", provider: "groq" },
  { id: "llama-3.2-11b-vision-preview", name: "Llama 3.2 11B (Vision)", speed: "Fast", status: "preview", provider: "groq" },
  { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B (Vision)", speed: "Powerful", status: "preview", provider: "groq" },

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
  
  // --- GOOGLE AI STUDIO (Gemini) ---
  { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro (Experimental)", speed: "Ultimate Brain", status: "preview", provider: "google" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Next-Gen)", speed: "Hyper Fast", status: "production", provider: "google" },
  { id: "gemini-2.0-flash-lite-preview-02-05", name: "Gemini 2.0 Flash Lite (Preview)", speed: "Instant", status: "preview", provider: "google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Powerful)", speed: "Balanced", status: "production", provider: "google" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Fast)", speed: "Instant", status: "production", provider: "google" },
  { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B", speed: "Hyper Fast", status: "production", provider: "google" },
  
  // --- CLOUDFLARE WORKERS AI (Requires Account ID) ---
  // Sumber: https://developers.cloudflare.com/workers-ai/models/ (Text Generation only, non-deprecated)
  // --- 🔥 Model Flagship & Terbaru ---
  { id: "@cf/moonshotai/kimi-k2.5", name: "Kimi K2.5 (256k ctx)", speed: "Powerful", status: "production", provider: "cloudflare" },
  { id: "@cf/zai-org/glm-4.7-flash", name: "GLM-4.7 Flash", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/openai/gpt-oss-120b", name: "GPT OSS 120B (Reasoning)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/openai/gpt-oss-20b", name: "GPT OSS 20B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Vision)", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Gemma 4 26B (Vision)", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/nvidia/nemotron-3-120b-a12b", name: "Nemotron 3 120B (MoE)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/ibm/granite-4.0-h-micro", name: "Granite 4.0 Micro (Function)", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it", name: "SEA-LION 27B (SE Asian)", speed: "Balanced", status: "production", provider: "cloudflare" },
  // --- Qwen Series ---
  { id: "@cf/qwen/qwq-32b", name: "QwQ 32B (Reasoning)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "Qwen3 30B MoE (FP8)", speed: "Powerful", status: "production", provider: "cloudflare" },
  { id: "@cf/qwen/qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", speed: "Balanced", status: "production", provider: "cloudflare" },
  // --- Mistral Series ---
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/mistralai/mistral-7b-instruct-v0.2", name: "Mistral 7B v0.2", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/mistralai/mistral-7b-instruct-v0.1", name: "Mistral 7B v0.1", speed: "Fast", status: "production", provider: "cloudflare" },
  // --- DeepSeek Series ---
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B (Reasoning)", speed: "Powerful", status: "production", provider: "cloudflare" },
  // --- Google Gemma Series ---
  { id: "@cf/google/gemma-3-12b-it", name: "Gemma 3 12B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/google/gemma-7b-it", name: "Gemma 7B", speed: "Fast", status: "production", provider: "cloudflare" },
  // --- Meta Llama 3.x Series ---
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B FP8 (Fast)", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B", speed: "Instant", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.2-1b-instruct", name: "Llama 3.2 1B (Ultra Tiny)", speed: "Instant", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.1-8b-instruct-fast", name: "Llama 3.1 8B (Fast)", speed: "Hyper Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.1-8b-instruct-awq", name: "Llama 3.1 8B AWQ", speed: "Hyper Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3.1-8b-instruct-fp8", name: "Llama 3.1 8B FP8", speed: "Hyper Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3-8b-instruct", name: "Llama 3 8B Instruct", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-3-8b-instruct-awq", name: "Llama 3 8B AWQ", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/meta-llama-3-8b-instruct", name: "Meta Llama 3 8B", speed: "Fast", status: "production", provider: "cloudflare" },
  // --- Nous Research ---
  { id: "@hf/nousresearch/hermes-2-pro-mistral-7b", name: "Hermes 2 Pro Mistral 7B", speed: "Fast", status: "production", provider: "cloudflare" },
  // --- IBM ---
  { id: "@cf/defog/sqlcoder-7b-2", name: "SQLCoder 7B (SQL)", speed: "Fast", status: "production", provider: "cloudflare" },
  
  // --- OPENROUTER (Experimental & Flagship) ---
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Next-Gen)", speed: "Instant", status: "preview", provider: "openrouter" },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B (Latest)", speed: "Powerful", status: "preview", provider: "openrouter" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (OpenAI Architecture)", speed: "Colossal", status: "preview", provider: "openrouter" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", speed: "Fast", status: "preview", provider: "openrouter" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash", speed: "Fast", status: "production", provider: "openrouter" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", speed: "Powerful", status: "production", provider: "openrouter" },

  // --- GROQ EXPERIMENTAL ---
  { id: "groq/compound", name: "Groq Compound (Research)", speed: "Fast", status: "preview", provider: "groq" },
  { id: "groq/compound-mini", name: "Groq Compound Mini", speed: "Hyper Fast", status: "preview", provider: "groq" },
  
  // --- TOGETHER AI (Fallbacks) ---
  { id: "meta-llama/Llama-3-70b-chat-hf", name: "Llama 3 70B", speed: "Fast", status: "production", provider: "together" },
  { id: "meta-llama/Llama-3-8b-chat-hf", name: "Llama 3 8B", speed: "Instant", status: "production", provider: "together" },
  
  // --- GITHUB MODELS (Requires Azure/GitHub Token) ---
  { id: "gpt-4o", name: "GPT-4o (GitHub)", speed: "Ultimate", status: "production", provider: "github" },
  { id: "gpt-4o-mini", name: "GPT-4o mini (Fast)", speed: "Fast", status: "production", provider: "github" },
  { id: "meta-llama-3.1-405b-instruct", name: "Llama 3.1 405B (Extreme)", speed: "Heavyweight", status: "production", provider: "github" },
  { id: "meta-llama-3.1-70b-instruct", name: "Llama 3.1 70B", speed: "Powerful", status: "production", provider: "github" },
  { id: "meta-llama-3.1-8b-instruct", name: "Llama 3.1 8B", speed: "Fast", status: "production", provider: "github" },
  { id: "phi-3-medium-128k-instruct", name: "Phi-3 Medium", speed: "Balanced", status: "production", provider: "github" },
  { id: "phi-3-mini-128k-instruct", name: "Phi-3 Mini", speed: "Fast", status: "production", provider: "github" },
  { id: "phi-3-small-128k-instruct", name: "Phi-3 Small", speed: "Fast", status: "production", provider: "github" },
  
  // --- HUGGING FACE (Fallbacks) ---
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Llama 3 8B Instruct", speed: "Fast", status: "production", provider: "huggingface" },
];

/**
 * 🧠 Helper untuk mengambil konfigurasi AI yang dinamis.
 * Prioritas:
 * 1. API Key milik User sendiri (jika ada di Profile)
 * 2. API Key Admin (hanya jika User adalah Admin)
 */
const getAIConfig = async (pb: PocketBase) => {
  const user = pb.authStore.model;
  const userApiKey = (user as any)?.ai_api_key;
  const userRole = (user as any)?.role || "teacher";

  const settings = await pb.collection("settings").getFullList({ limit: 1 });
  const config = settings[0];

  // 🎯 Resolusi Paksa (Force Resolution):
  let rawModel = AI_MODELS[0].id;
  let rawProvider = "groq";
  
  if (userRole === "admin") {
    rawModel = config?.ai_model || AI_MODELS[0].id;
    rawProvider = config?.ai_provider || "groq";
  } else {
    rawModel = (user as any)?.ai_model || config?.ai_model || AI_MODELS[0].id;
    rawProvider = (user as any)?.ai_provider || config?.ai_provider || "groq";
  }

  const isCustom = rawProvider === "custom";
  const actualModelDef = AI_MODELS.find((m) => m.id === rawModel);
  
  // Jika provider adalah custom, abaikan pencarian presetas. Jika tidak, validasi model terdaftar.
  const finalModel = isCustom ? rawModel : (actualModelDef ? actualModelDef.id : AI_MODELS[0].id);
  const finalProvider = isCustom ? "custom" : (actualModelDef ? actualModelDef.provider : "groq");
  const isOllama = finalProvider === "ollama";

  let apiKey = "";

  const resolveBaseUrl = (provider: string, gatewayUrl: string) => {
    switch (provider) {
       case "google": return "https://generativelanguage.googleapis.com/v1beta/openai";
       case "openrouter": return "https://openrouter.ai/api/v1";
       case "together": return "https://api.together.xyz/v1";
       case "huggingface": return "https://api-inference.huggingface.co/v1";
       case "fireworks": return "https://api.fireworks.ai/inference/v1";
       case "github": return "https://models.inference.ai.azure.com";
       case "cloudflare": 
          // 🚀 CLOUDFLARE FIX: Gunakan endpoint v1 yang lebih stabil
          return gatewayUrl ? `https://api.cloudflare.com/client/v4/accounts/${gatewayUrl}/ai/v1` : "";
       case "custom": return gatewayUrl;
       case "ollama": return pb.baseUrl + "/api/ai-proxy";
       case "groq": return "https://api.groq.com/openai/v1";
       default: return "https://api.groq.com/openai/v1";
    }
  };

  // Helper untuk membersihkan & menggabungkan URL agar tidak double /chat/completions
  const cleanUrl = (base: string) => {
    if (!base) return "";
    let url = base.trim();
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (url.includes("/chat/completions")) return url;
    return `${url}/chat/completions`;
  };

  const gatewayUrl = (config?.ai_gateway_url && config.ai_gateway_url.trim() !== "") ? config.ai_gateway_url : "";
  let baseUrl = resolveBaseUrl(finalProvider, gatewayUrl);
  const finalFullUrl = cleanUrl(baseUrl);

  // 🎯 UNIFORM PROXY LOGIC:
  // Semua provider (kecuali Groq) dilewatkan melalui proxy untuk menghindari CORS.
  const useProxy = finalProvider !== "groq";

  if (userRole === "admin") {
    apiKey = finalProvider === "groq" ? config?.groq_api_key : config?.ai_gateway_key;
    if (!apiKey || apiKey.trim() === "") throw new Error(`API Key untuk Provider ${finalProvider.toUpperCase()} belum diatur.`);
  } else {
    apiKey = userApiKey;
  }

  return {
    apiKey,
    useProxy,
    model: finalModel,
    baseUrl: finalFullUrl, // Kirim URL yang sudah lengkap & bersih
    provider: finalProvider
  };
};


export const generateQuestionsAI = async (
  pb: PocketBase,
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
    const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);
    console.log(`🚀 [AI ENGINE] Menggunakan Model: ${model} via ${useProxy ? 'SECURE PROXY' : 'DIRECT'}`);

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
- SETIAP <p> harus memiliki style="text-indent: 30px; margin-bottom: 24px; line-height: 1.8; text-align: justify;".
- Gunakan <strong>...</strong> untuk penebalan teks, JANGAN GUNAKAN **.
- JANGAN sertakan baris 'Sumber' di bagian akhir.

Hanya berikan teks HTML tersebut tanpa salam pembuka/penutup.`;

      // 🚀 FETCH PROXY OR DIRECT
      let responseWacana;
      const { apiKey, useProxy, model, baseUrl } = await getAIConfig(pb);
      
      // Tentukan max_tokens untuk wacana berdasarkan panjang yang diminta
      const wacanaTokens = { pendek: 600, sedang: 1000, panjang: 1600 }[passageLength] || 1000;

      if (useProxy) {
        responseWacana = await fetch(pb.baseUrl + "/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
          body: JSON.stringify({
            baseUrl: baseUrl,
            apiKey: apiKey,
            body: { 
               model, 
               messages: [{ role: "user", content: wacanaPrompt }],
               stream: false,
               max_tokens: wacanaTokens,
               temperature: 0.7
            }
          })
        });
      } else {
        responseWacana = await fetch(baseUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: wacanaPrompt }],
            temperature: 0.7,
            max_tokens: wacanaTokens
          })
        });
      }

      if (responseWacana.status === 429) throw new Error("AI_RATE_LIMIT");
      if (!responseWacana.ok) throw new Error("Gagal membuat teks wacana.");
      const dataWacana = await responseWacana.json();
      
      // ✅ Always check both Ollama (message.content) AND OpenAI/Cloudflare (choices[0].message.content)
      wacanaResult = dataWacana?.message?.content || dataWacana?.choices?.[0]?.message?.content || "";
    }

    // 🎯 STEP 2: GENERATE QUESTIONS
    const systemPrompt = `Anda adalah Ahli Evaluasi Pendidikan & Spesialis Kurikulum.
Tugas: Buat ${count} soal ${typeDesc} untuk jenjang ${level} - ${subject}.
Kesulitan: ${difficulty}, PEDOMAN FORMAT:
1. GUNAKAN TEKS POLOS: Utamakan teks biasa tanpa tag HTML (seperti <em>, <p>, atau <strong>) agar editor tetap bersih.
2. EKSAKTA (Matematika/Sains): Gunakan LaTeX HANYA dengan pembungkus $ ... $ tunggal agar rumus menyatu dengan teks (JANGAN gunakan $$ atau \displaystyle sebagai teks polos).
   - Agar simbol besar (integral/pecahan) terlihat bagus dalam teks, gunakan: $\\displaystyle ...$
   - PENTING (JSON ESCAPE): Di dalam JSON, setiap backslash (\) harus ditulis GANDA (\\). Jadi tulis: "$\\displaystyle \\frac{a}{b}$" (BUKAN \displaystyle).
   - DILARANG KERAS menggunakan $$ ... $$ karena akan memutus baris (terpisah).
3. JANGAN gunakan markdown seperti ** atau __.
4. JSON ESCAPING: Setiap garis miring ("\\" tunggal) dalam LaTeX WAJIB di-escape ganda ("\\\\") di dalam JSON.

STRUKTUR JSON (WAJIB):
{
  "questions": [
    {
      "text": "Teks pertanyaan (Gunakan $ untuk rumus)",
      "choices": { "a": { "text": "...", "isCorrect": true }, ... },
      "answerKey": "Kunci jawaban"
    }
  ]
}
Hanya berikan JSON murni tanpa penjelasan.`;

    const mathHint = (subject.toLowerCase().includes('matematika') || subject.toLowerCase().includes('ipa') || subject.toLowerCase().includes('fisika') || subject.toLowerCase().includes('kimia') || subject.toLowerCase().includes('ekonomi') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('it')) 
      ? "\nGunakan $ ... $ untuk SEMUA rumus agar tidak terpisah dari teks. Untuk integral/fraksi yang bagus, gunakan $\\displaystyle ...$. WAJIB gunakan \\\\ (double backslash) di JSON." 
      : "";

    const programmingHint = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('coding'))
      ? `\nKONTEN PEMROGRAMAN: Sangat disarankan untuk menyertakan potongan kode (code snippets) di dalam teks pertanyaan maupun pilihan jawaban. Gunakan tag <pre class="ql-syntax" data-language="NAMA_BAHASA">...</pre> untuk setiap potongan kode program. GANTI NAMA_BAHASA dengan bahasa yang sesuai (misal: javascript, python, cpp, html, css). DILARANG MENGGUNAKAN "auto".`
      : "";

    const isReligiousTopic = (
      subject.toLowerCase().includes('agama') || 
      subject.toLowerCase().includes('arab') || 
      subject.toLowerCase().includes('islam') || 
      subject.toLowerCase().includes('quran') ||
      topic.toLowerCase().includes('surah') ||
      topic.toLowerCase().includes('ayat') ||
      topic.toLowerCase().includes('hadist')
    );

    const arabicHint = isReligiousTopic
      ? `\nKONTEN ARAB/AGAMA: WAJIB menyertakan potongan (snippet) ayat Al-Qur'an atau Hadits dalam TEKS ARAB ASLI (ber-harakat lengkap) sebagai bagian dari soal atau stimulus. DILARANG KERAS menggunakan tanda kutip jenis apapun di sekitar ayat. Tampilkan teks Arab tersebut dengan jelas.`
      : "";

    const userPrompt = isLiteracy 
      ? `INI ADALAH WACANA STIMULUS:\n${wacanaResult}\n\nBerdasarkan wacana di atas, buatkan ${count} soal ${typeDesc}.${mathHint}${programmingHint}${arabicHint}`
      : `Buat soal ${typeDesc} untuk jenjang ${level} - ${subject} tentang topik: "${topic}".${mathHint}${programmingHint}${arabicHint}`;

    // Kalkulasi max_tokens: ~1200 token per soal (model reasoning butuh lebih banyak)
    // Kimi K2.5, DeepSeek R1, QwQ perlu ruang untuk "berpikir" sebelum menjawab
    const questionTokens = Math.max(count * 1200, 2000);

    let responseQuestions;
    if (useProxy) {
      responseQuestions = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: baseUrl,
          apiKey: apiKey,
          body: {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_tokens: questionTokens,
            temperature: 0.8
          }
        })
      });
    } else {
      responseQuestions = await fetch(baseUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: questionTokens,
          response_format: { type: "json_object" }
        })
      });
    }

    if (responseQuestions.status === 429) throw new Error("AI_RATE_LIMIT");
    if (!responseQuestions.ok) {
      const errData = await responseQuestions.json().catch(() => ({}));
      throw new Error(errData?.error?.message || errData?.error || `HTTP ${responseQuestions.status}`);
    }
    
    const dataQs = await responseQuestions.json();
    // ✅ Always check both Ollama (message.content) AND OpenAI/Cloudflare (choices[0].message.content)
    const contentQs = dataQs?.message?.content || dataQs?.choices?.[0]?.message?.content || "";
    
    console.log("[AI DEBUG] dataQs keys:", Object.keys(dataQs || {}));
    console.log("[AI DEBUG] contentQs length:", contentQs?.length, "| preview:", contentQs?.slice(0, 100));
    
    if (!contentQs) {
      console.error("[AI DEBUG] Full dataQs:", JSON.stringify(dataQs).slice(0, 500));
      throw new Error(`AI tidak memberikan respon teks yang valid. (model: ${model})`);
    }

    const parsed = robustJSONParse(contentQs);
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
  pb: PocketBase,
  topic: string,
  type: string = "pilihan_ganda",
  level: string = "Umum",
  subject: string = "",
  difficulty: string = "sedang",
  focus: string = "akm",
  existingWacana: string = ""
): Promise<AIGeneratedQuestion> => {
  try {
    const { apiKey, useProxy, model, baseUrl } = await getAIConfig(pb);
    const cleanModel = model.replace("openclaw/", "");

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

PEDOMAN FORMAT:
1. GUNAKAN TEKS POLOS: Utamakan teks biasa tanpa tag HTML agar editor tetap bersih.
2. EKSAKTA: Gunakan LaTeX HANYA dengan pembungkus $ ... $ tunggal agar menyatu dengan kalimat (JANGAN gunakan $$).
   - Simbol bertingkat (integral/pecahan): Gunakan $\\displaystyle ...$ (WAJIB double backslash di dalam JSON agar tidak error).
   - Contoh: "Berapakah hasil dari $\\displaystyle \\int_0^1 x^2 \\,dx$ ?"
3. JANGAN gunakan markdown (**).

STRUKTUR JSON:
{
  "text": "Teks pertanyaan",
  "choices": { "a": { "text": "...", "isCorrect": true }, ... },
  "answerKey": "Kunci jawaban"
}
Hanya berikan JSON murni.`;

    const programmingHint = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('coding'))
      ? `\nKONTEN PEMROGRAMAN: Sangat disarankan untuk menyertakan potongan kode (code snippets) di dalam teks pertanyaan maupun pilihan jawaban. Gunakan tag <pre class="ql-syntax" data-language="NAMA_BAHASA">...</pre> untuk setiap potongan kode program. GANTI NAMA_BAHASA dengan bahasa yang sesuai (misal: javascript, python, cpp, html, css). DILARANG MENGGUNAKAN "auto".`
      : "";

    const isReligiousTopic = (
      subject.toLowerCase().includes('agama') || 
      subject.toLowerCase().includes('arab') || 
      subject.toLowerCase().includes('islam') || 
      subject.toLowerCase().includes('quran') ||
      topic.toLowerCase().includes('surah') ||
      topic.toLowerCase().includes('ayat') ||
      topic.toLowerCase().includes('hadist')
    );

    const arabicHint = isReligiousTopic
      ? `\nKONTEN ARAB/AGAMA: WAJIB menyertakan potongan (snippet) ayat Al-Qur'an atau Hadits dalam TEKS ARAB ASLI (ber-harakat lengkap) sebagai bagian dari soal. DILARANG KERAS menggunakan tanda kutip di sekitar ayat. Tampilkan teks Arab tersebut dengan jelas.`
      : "";

    const userPrompt = existingWacana 
      ? `INI ADALAH WACANA STIMULUS:\n${existingWacana}\n\nBerdasarkan wacana di atas, BUAT TEPAT SATU soal ${typeDesc}. JANGAN menggunakan placeholder.${programmingHint}${arabicHint}`
      : `Buat TEPAT SATU soal ${typeDesc} tentang materi/topik: "${topic}". JANGAN menggunakan placeholder.${programmingHint}${arabicHint}`;

    let response;
    if (useProxy) {
        response = await fetch(pb.baseUrl + "/api/ai-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
            body: JSON.stringify({
                baseUrl: baseUrl,
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
        response = await fetch(baseUrl, {
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
    const content = useProxy ? (data?.message?.content || data?.choices?.[0]?.message?.content || "") : (data?.choices?.[0]?.message?.content || "");
    
    const result = robustJSONParse(content);
    
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
  pb: PocketBase,
  level: string,
  subject: string,
  difficulty: string = "sedang",
  type: string = "pilihan_ganda",
  focus: string = "umum",
  isLiteracy: boolean = false
): Promise<string[]> => {
  try {
    const { apiKey, useProxy, model, baseUrl } = await getAIConfig(pb);
    console.log(`💡 [AI TOPIC] Menyarankan topik menggunakan: ${model}`);

    const literasiNote = isLiteracy ? "(UTAMAKAN topik yang kaya teks bacaan/fenomena karena Mode Literasi AKTIF)" : "";
    const systemPrompt = `Anda adalah Ahli Kurikulum Nasional. Berikan 5 contoh topik/materi spesifik yang PALING RELEVAN untuk jenjang ${level}, mata pelajaran ${subject}, tingkat kesulitan ${difficulty}, dan standar ${focus.toUpperCase()}.
Tipe soal yang akan dibuat adalah ${type}. ${literasiNote}
Pastikan materi tersebut sesuai dengan tingkat kognitif jenjang ${level}.
Balas hanya dengan JSON format: { "topics": ["Topik A", "Topik B", ...] }`;

    let response;
    if (useProxy) {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: baseUrl,
          apiKey: apiKey,
          body: {
            model: model,
            messages: [{ role: "system", content: systemPrompt }],
            stream: false
          }
        })
      });
    } else {
      response = await fetch(baseUrl, {
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
    const content = useProxy ? (data?.message?.content || data?.choices?.[0]?.message?.content || "") : (data?.choices?.[0]?.message?.content || "");
    
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
  pb: PocketBase,
  rawText: string,
  subject: string = "",
  level: string = "Umum"
): Promise<AIGeneratedQuestion[]> => {
  try {
    const { apiKey, useProxy, model, baseUrl } = await getAIConfig(pb);

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
    if (useProxy) {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: baseUrl,
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
      response = await fetch(baseUrl, {
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
    let content = useProxy ? (data?.message?.content || data?.choices?.[0]?.message?.content || "") : (data?.choices?.[0]?.message?.content || "");
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
         const retryData = await parseQuestionsAI(pb, jsonMatch[0], subject, level);
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

export const testAIConnection = async (pb: PocketBase, apiKey: string, modelId: string, customUrl?: string, provider: string = "groq"): Promise<{ success: boolean; message: string }> => {
  try {
    if (!apiKey) throw new Error("API Key Kosong");
    
    const actualModelDef = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];
    const finalProvider = provider || actualModelDef.provider;
    const useProxy = finalProvider !== "groq";
    
    const resolveBaseUrl = (p: string, url: string) => {
      switch (p) {
         case "google": return "https://generativelanguage.googleapis.com/v1beta/openai";
         case "openrouter": return "https://openrouter.ai/api/v1";
         case "together": return "https://api.together.xyz/v1";
         case "huggingface": return "https://api-inference.huggingface.co/v1";
         case "fireworks": return "https://api.fireworks.ai/inference/v1";
         case "github": return "https://models.inference.ai.azure.com";
         case "cloudflare": return url ? `https://api.cloudflare.com/client/v4/accounts/${url}/ai/v1` : "";
         case "custom": return url;
         case "ollama": return pb.baseUrl + "/api/ai-proxy";
         case "groq": return "https://api.groq.com/openai/v1";
         default: return "https://api.groq.com/openai/v1";
      }
    };

    const cleanUrl = (base: string) => {
      if (!base) return "";
      let url = base.trim();
      if (url.endsWith("/")) url = url.slice(0, -1);
      if (url.includes("/chat/completions")) return url;
      return `${url}/chat/completions`;
    };

    const baseUrl = cleanUrl(resolveBaseUrl(finalProvider, customUrl || ""));
    if (!baseUrl) throw new Error("Base URL / Account ID belum lengkap.");

    let response;
    if (useProxy) {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({
          baseUrl: baseUrl,
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
      response = await fetch(baseUrl, {
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
    
    let errorMessage = "Gagal menghubungi AI";
    try {
      const err = await response.json();
      errorMessage = err.error?.message || err.error || err.message || JSON.stringify(err);
    } catch (e) {
      errorMessage = `Server Error: ${response.status} ${response.statusText}`;
    }
    
    return { success: false, message: errorMessage };
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menghubungi server AI." };
  }
};
