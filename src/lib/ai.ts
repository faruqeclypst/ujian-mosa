  import PocketBase from "pocketbase";
import { jsonrepair } from "jsonrepair";
import globalPb from "./pocketbase";

// 📊 Token Usage Tracking (localStorage-based, per API key)
const TOKEN_USAGE_KEY = "ai_token_usage";

export interface AITokenUsage {
  date: string; // YYYY-MM-DD
  used: number;
  limit: number; // from last known rate limit error or default
  lastUpdated: number; // timestamp
  keyHash: string; // hash of API key to detect changes
}

const hashKey = (key: string): string => {
  // Simple hash: last 8 chars of API key (enough to detect change, no security risk)
  return key.slice(-8);
};

export const getTokenUsage = (apiKeyHint?: string): AITokenUsage => {
  try {
    const stored = localStorage.getItem(TOKEN_USAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split("T")[0];
      const currentHash = apiKeyHint ? hashKey(apiKeyHint) : data.keyHash || "";
      // Reset if different day OR different API key
      if (data.date === today && data.keyHash === currentHash) return data;
    }
  } catch {}
  return { date: new Date().toISOString().split("T")[0], used: 0, limit: 100000, lastUpdated: Date.now(), keyHash: "" };
};

export const trackTokenUsage = (tokens: number, knownLimit?: number, apiKey?: string): AITokenUsage => {
  const currentHash = apiKey ? hashKey(apiKey) : "";
  const current = getTokenUsage(apiKey);
  const today = new Date().toISOString().split("T")[0];
  // Reset if different day or different key
  const shouldReset = current.date !== today || (currentHash && current.keyHash !== currentHash);
  const updated: AITokenUsage = {
    date: today,
    used: shouldReset ? tokens : current.used + tokens,
    limit: knownLimit || current.limit,
    lastUpdated: Date.now(),
    keyHash: currentHash || current.keyHash
  };
  localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const setTokenLimit = (limit: number, used?: number, apiKey?: string): void => {
  const currentHash = apiKey ? hashKey(apiKey) : "";
  const current = getTokenUsage(apiKey);
  const updated: AITokenUsage = {
    ...current,
    limit,
    used: used ?? current.used,
    lastUpdated: Date.now(),
    keyHash: currentHash || current.keyHash
  };
  localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(updated));
};

export const resetTokenUsage = (): void => {
  localStorage.removeItem(TOKEN_USAGE_KEY);
};

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
 * Menggunakan library jsonrepair untuk handle malformed JSON dari LLM:
 * - Unescaped quotes dalam string (terjemahan Arab dengan kutip)
 * - Newlines/tabs literal dalam string
 * - Trailing commas
 * - Markdown code fence
 * - LaTeX backslashes
 * - Single quotes
 */
const robustJSONParse = (text: string): any => {
  if (!text || !text.trim()) {
    throw new Error("AI memberikan respon kosong.");
  }
  
  let clean = text.trim();
  
  // 1. Hapus markdown code fence
  clean = clean.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  
  // 2. Ekstrak blok JSON
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  
  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");
  }
  
  let startIdx: number;
  if (firstBrace === -1) startIdx = firstBracket;
  else if (firstBracket === -1) startIdx = firstBrace;
  else startIdx = Math.min(firstBrace, firstBracket);
  
  const isArray = clean[startIdx] === '[';
  const lastClose = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}');
  
  if (lastClose !== -1 && lastClose > startIdx) {
    clean = clean.substring(startIdx, lastClose + 1);
  } else {
    // Response terpotong — ambil dari start saja
    clean = clean.substring(startIdx);
  }

  // 3. Try direct parse (fast path)
  try {
    return JSON.parse(clean);
  } catch {
    // Fall through
  }

  // 4. Use jsonrepair
  try {
    const repaired = jsonrepair(clean);
    return JSON.parse(repaired);
  } catch {
    // Fall through
  }

  // 5. Cleanup + jsonrepair
  try {
    let cleaned = clean
      .replace(/\r\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\t/g, "\\t")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    
    return JSON.parse(jsonrepair(cleaned));
  } catch {
    // Fall through
  }

  // 6. Truncated response recovery: cari soal terakhir yang lengkap
  // Pattern: cari "answerKey":"X"} yang menandakan akhir soal lengkap
  try {
    const lastCompleteQuestion = clean.lastIndexOf('"answerKey"');
    if (lastCompleteQuestion !== -1) {
      // Cari } setelah answerKey yang menutup soal
      const afterAnswer = clean.indexOf('}', lastCompleteQuestion);
      if (afterAnswer !== -1) {
        // Potong sampai situ dan tutup structure
        let truncated = clean.substring(0, afterAnswer + 1);
        // Tutup array dan wrapper
        if (!truncated.endsWith(']}')) {
          truncated += ']}';
        }
        // Pastikan dimulai dengan {"questions":[
        if (!truncated.startsWith('{"questions"')) {
          if (truncated.startsWith('[') || truncated.startsWith('{')) {
            // Mungkin sudah benar
          }
        }
        const repaired = jsonrepair(truncated);
        return JSON.parse(repaired);
      }
    }
  } catch {
    // Fall through
  }

  // 7. Last resort: coba ambil apapun yang bisa di-parse
  try {
    // Hapus semua newlines dan coba repair
    const flat = clean.replace(/\n/g, " ").replace(/\r/g, " ").replace(/\t/g, " ");
    return JSON.parse(jsonrepair(flat));
  } catch {
    // Fall through
  }

  console.error("All JSON repair strategies failed. Raw content (first 500 chars):", clean.substring(0, 500));
  throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");
};

export const AI_MODELS = [
  // --- GROQ CLOUD (High Speed) ---
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Latest Reasoning)", speed: "Powerful", status: "production", provider: "groq", dailyLimit: "~100k token/hari" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Fast Reasoning)", speed: "Fast", status: "production", provider: "groq", dailyLimit: "~100k token/hari" },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B", speed: "High Performance", status: "production", provider: "groq", dailyLimit: "~100k token/hari" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", speed: "Fast", status: "production", provider: "groq", dailyLimit: "~500k token/hari" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", speed: "High Performance", status: "production", provider: "groq", dailyLimit: "~100k token/hari" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Llama 70B (Reasoning)", speed: "Powerful", status: "production", provider: "groq", dailyLimit: "~100k token/hari" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", speed: "Fast", status: "production", provider: "groq", dailyLimit: "~500k token/hari" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", speed: "Hyper Fast", status: "production", provider: "groq", dailyLimit: "~500k token/hari" },

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
  { id: "groq/compound", name: "Groq Compound (Research)", speed: "Fast", status: "preview", provider: "groq", dailyLimit: "~8k token/hari ⚠️" },
  { id: "groq/compound-mini", name: "Groq Compound Mini", speed: "Hyper Fast", status: "preview", provider: "groq", dailyLimit: "~8k token/hari ⚠️" },
  
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

  // --- PUTER (Gratis, tanpa API Key, limit terbatas) ---
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Puter)", speed: "Heavyweight", status: "production", provider: "puter" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Puter)", speed: "Fast", status: "production", provider: "puter" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano (Puter)", speed: "Hyper Fast", status: "production", provider: "puter" },
  { id: "gpt-5.3-chat", name: "GPT-5.3 Chat (Puter)", speed: "Balanced", status: "production", provider: "puter" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (Puter)", speed: "Powerful", status: "production", provider: "puter" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Puter)", speed: "Fast", status: "production", provider: "puter" },
  { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout (Puter)", speed: "Fast", status: "production", provider: "puter" },
];

/**
 * 🌐 Puter.js SDK Loader & Helper
 * Loads puter.js dynamically and provides chat interface.
 * No API key needed - uses "User-Pays" model.
 */
let puterLoaded = false;
const loadPuterSDK = (): Promise<void> => {
  if (puterLoaded && (window as any).puter) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if ((window as any).puter) { puterLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.onload = () => { puterLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Gagal memuat Puter.js SDK"));
    document.head.appendChild(script);
  });
};

const callPuterAI = async (model: string, messages: Array<{role: string; content: string}>, maxTokens?: number): Promise<string> => {
  await loadPuterSDK();
  const puter = (window as any).puter;
  if (!puter?.ai?.chat) throw new Error("Puter.js SDK tidak tersedia. Pastikan popup tidak diblokir.");

  // Ensure user is authenticated with Puter
  try {
    const isSignedIn = await puter.auth.isSignedIn();
    if (!isSignedIn) {
      await puter.auth.signIn();
    }
  } catch (e) {
    // If auth check fails, try to proceed anyway (some versions auto-auth)
  }

  // Build messages array for puter.ai.chat
  const puterMessages = messages.map(m => ({ role: m.role, content: m.content }));

  const response = await puter.ai.chat(puterMessages, {
    model: model || "gpt-4o-mini",
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    temperature: 0.8
  });

  // puter.ai.chat returns different formats
  if (typeof response === "string") return response;
  if (response?.message?.content) return response.message.content;
  if (response?.text) return response.text;
  if (response?.content) return response.content;
  if (response?.toString && typeof response.toString() === "string" && response.toString() !== "[object Object]") return response.toString();
  throw new Error("Puter AI tidak memberikan respon yang valid. Pastikan Anda sudah login ke akun Puter.");
};

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
  const actualModelDef = AI_MODELS.find((m) => m.id === rawModel && m.provider === rawProvider) || AI_MODELS.find((m) => m.id === rawModel);
  
  // Jika provider adalah custom, abaikan pencarian presetas. Jika tidak, validasi model terdaftar.
  const finalModel = isCustom ? rawModel : (actualModelDef ? actualModelDef.id : AI_MODELS[0].id);
  const finalProvider = isCustom ? "custom" : (rawProvider === "puter" ? "puter" : (actualModelDef ? actualModelDef.provider : "groq"));
  const isOllama = finalProvider === "ollama";

  let apiKey = "";

  const resolveBaseUrl = (provider: string, gatewayUrl: string) => {
    switch (provider) {
       case "puter": return "__PUTER__"; // Special marker - uses puter.js SDK
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
  // Semua provider (kecuali Groq dan Puter) dilewatkan melalui proxy untuk menghindari CORS.
  const useProxy = finalProvider !== "groq" && finalProvider !== "puter";

  if (finalProvider === "puter") {
    // Puter doesn't need API key - uses User-Pays model
    apiKey = "puter-no-key-needed";
  } else if (userRole === "admin") {
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
      pendek: "1-2 paragraf (sekitar 150-250 kata), lugas & informatif",
      sedang: "2-4 paragraf (sekitar 300-500 kata), cukup kaya data namun tetap ringkas",
      panjang: "4-6 paragraf (sekitar 600-900 kata), kompleks & multi-dimensi"
    };

    const typeDesc = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah",
      isian_singkat: "Isian Singkat",
      uraian: "Uraian HOTS"
    }[type] || "Pilihan Ganda";

    let wacanaResult = "";

    // 🎯 Deteksi tipe mata pelajaran (dipakai untuk stimulus DAN soal)
    const isExact = (subject.toLowerCase().includes('matematika') || subject.toLowerCase().includes('ipa') || subject.toLowerCase().includes('fisika') || subject.toLowerCase().includes('kimia') || subject.toLowerCase().includes('ekonomi') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('it'));
    const isProgramming = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('coding'));
    const isReligiousTopic = (subject.toLowerCase().includes('agama') || subject.toLowerCase().includes('arab') || subject.toLowerCase().includes('islam') || subject.toLowerCase().includes('quran') || topic.toLowerCase().includes('surah') || topic.toLowerCase().includes('ayat') || topic.toLowerCase().includes('hadist') || topic.toLowerCase().includes('hadits'));
    // Deteksi apakah user secara eksplisit minta ayat/teks Arab di topik
    const topicLower = topic.toLowerCase();
    const explicitlyWantsArabic = (topicLower.includes('ayat') || topicLower.includes('surah') || topicLower.includes('surat') || topicLower.includes('lampirkan') || topicLower.includes('hadits') || topicLower.includes('hadist') || topicLower.includes('al-quran') || topicLower.includes('alquran') || topicLower.includes('bahasa arab') || topicLower.includes('arab teks') || topicLower.includes('teks arab') || topicLower.includes('pakai arab') || topicLower.includes('translate') || topicLower.includes('terjemah'));

    // 🚀 STEP 1: GENERATE STIMULUS (ONLY IF LITERACY)
    if (isLiteracy) {
      // Instruksi tambahan berdasarkan mata pelajaran (opsional, tidak wajib)
      const wacanaExtraHints = [
        isProgramming ? 'Jika topik membahas kode/algoritma, boleh sertakan potongan kode program dalam tag <pre class="ql-syntax" data-language="BAHASA">...</pre>. Tidak wajib jika tidak relevan.' : "",
        explicitlyWantsArabic ? 'WAJIB sertakan ayat Al-Quran/Hadits yang relevan dalam TEKS ARAB ASLI ber-harakat lengkap di dalam stimulus. Gunakan tag <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;font-family:Amiri,serif;">AYAT ARAB</p>.' : (isReligiousTopic ? "Jika topik membahas ayat/hadits tertentu, boleh sertakan teks Arab asli ber-harakat dalam tag <p dir=\"rtl\">. Tidak wajib di setiap bacaan." : ""),
        isExact ? "Jika topik membahas rumus/persamaan, boleh sertakan dalam format LaTeX $...$. Tidak wajib jika konteksnya naratif." : ""
      ].filter(Boolean).join("\n");

      const wacanaPrompt = `Buat stimulus literasi bertema "${topic}" untuk ${level} - ${subject}. Panjang WAJIB ${lengthMap[passageLength]}, kesulitan ${difficulty}.
Sajikan sebagai artikel/studi kasus yang menarik (bukan rangkuman definisi). PASTIKAN jumlah paragraf sesuai ketentuan dan teks SELESAI SEMPURNA (tidak terpotong).
${wacanaExtraHints}
FORMAT HTML: <h2 style="text-align:center;color:#1e3a8a;margin-bottom:32px;font-weight:900;">[JUDUL]</h2> lalu paragraf-paragraf <p style="text-indent:30px;margin-bottom:24px;line-height:1.8;text-align:justify;">. Gunakan <strong> untuk penebalan. Jangan gunakan markdown. Hanya berikan HTML.`;

      // 🚀 FETCH PROXY OR DIRECT
      let responseWacana;
      const { apiKey, useProxy, model, baseUrl, provider: wacanaProvider } = await getAIConfig(pb);
      
      // Tentukan max_tokens untuk wacana berdasarkan panjang yang diminta
      // pendek: 1-2 paragraf (~250 kata ≈ 500 tok + HTML buffer)
      // sedang: 2-4 paragraf (~500 kata ≈ 1000 tok + HTML buffer)
      // panjang: 4-6 paragraf (~900 kata ≈ 1800 tok + HTML buffer)
      // Kode program & teks Arab makan lebih banyak token
      const extraTokenBuffer = (isProgramming || isReligiousTopic) ? 400 : 0;
      const wacanaTokens = ({ pendek: 700, sedang: 1300, panjang: 2200 }[passageLength] || 1300) + extraTokenBuffer;

      if (wacanaProvider === "puter") {
        wacanaResult = await callPuterAI(model, [{ role: "user", content: wacanaPrompt }], wacanaTokens);
      } else if (useProxy) {
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

      if (wacanaProvider !== "puter") {
        if (responseWacana!.status === 429) throw new Error("AI_RATE_LIMIT");
        if (!responseWacana!.ok) throw new Error("Gagal membuat stimulus / literasi.");
        const dataWacana = await responseWacana!.json();
        
        // ✅ Always check both Ollama (message.content) AND OpenAI/Cloudflare (choices[0].message.content)
        wacanaResult = dataWacana?.message?.content || dataWacana?.choices?.[0]?.message?.content || "";
      }
    }

    // 🎯 STEP 2: GENERATE QUESTIONS
    const arabicInstruction = explicitlyWantsArabic 
      ? 'WAJIB sertakan potongan ayat Al-Quran/Hadits dalam TEKS ARAB ASLI ber-harakat lengkap di setiap soal. PISAHKAN dari teks Latin — tulis pertanyaan dulu, lalu ayat Arab di baris baru dalam tag: <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT ARAB BER-HARAKAT LENGKAP</p>. JANGAN campur teks Arab dan Latin dalam satu kalimat. JANGAN hanya tulis nama surah tanpa ayat aslinya.'
      : (isReligiousTopic ? 'Jika relevan, sertakan ayat Arab ber-harakat. PISAHKAN dari teks Latin di baris baru dalam tag: <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT</p>. JANGAN campur Arab dan Latin dalam satu kalimat.' : '');

    const formatRules = [
      "Teks polos (tanpa HTML/markdown kecuali tag ayat Arab).",
      isExact ? "Rumus: gunakan $...$ inline. Pecahan/integral: $\\\\displaystyle ...$. Double backslash di JSON." : "",
      isProgramming ? 'Kode: <pre class="ql-syntax" data-language="python">...</pre> (ganti python dengan bahasa yang sesuai: python, javascript, java, cpp, php, html, sql).' : "",
      arabicInstruction
    ].filter(Boolean).join(" ");

    const systemPrompt = explicitlyWantsArabic 
      ? `Buat ${count} soal ${typeDesc}, ${level} - ${subject}, kesulitan ${difficulty}.
Format: ${formatRules}
Aturan: Variasi pola (konsep, aplikasi, analisis, evaluasi). Opsi A-E ringkas & logis. Kunci jawaban acak.

KONTEN ARAB/AGAMA (WAJIB KERAS):
- Setiap soal WAJIB mengandung potongan ayat Al-Quran/Hadits dalam TEKS ARAB ASLI ber-harakat lengkap (syakal).
- DILARANG KERAS hanya menulis nama surah atau transliterasi latin tanpa teks Arab asli.
- Contoh BENAR: "إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ"
- Contoh SALAH: "Innallaha yuhibbut tawwabin" atau "QS. Al-Baqarah: 222"
- FORMAT WAJIB (urutan):
  1. Ayat Arab dalam tag: <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT ARAB</p>
  2. Terjemahan dalam tag: <p style="font-style:italic;margin:8px 0;color:#555;">Terjemahan: "..."</p>
  3. Pertanyaan dalam tag: <p style="margin-top:12px;font-weight:600;">Pertanyaan di sini...</p>

CONTOH SOAL:
{"text":"Perhatikan ayat berikut:<p dir=\\"rtl\\" style=\\"text-align:right;font-size:1.3em;line-height:2;margin:12px 0;\\">إِنَّ اللَّهَ لَطِيفٌ بِعِبَادِهِ يَرْزُقُ مَن يَشَاءُ وَهُوَ الْقَوِيُّ الْعَزِيزُ</p><p style=\\"font-style:italic;margin:8px 0;color:#555;\\">Terjemahan: \\"Sesungguhnya Allah Maha Lembut terhadap hamba-hamba-Nya; Dia memberi rezeki kepada siapa yang Dia kehendaki dan Dia Maha Kuat lagi Maha Perkasa.\\"</p><p style=\\"margin-top:12px;font-weight:600;\\">Ayat di atas menjelaskan sifat Allah yaitu...</p>","choices":{"a":{"text":"Al-Lathif dan Ar-Razzaq","isCorrect":true},"b":{"text":"Al-Alim dan Al-Hakim","isCorrect":false},"c":{"text":"Ar-Rahman dan Ar-Rahim","isCorrect":false},"d":{"text":"Al-Malik dan Al-Quddus","isCorrect":false},"e":{"text":"Al-Ghaffar dan At-Tawwab","isCorrect":false}},"answerKey":"a"}

JSON:{"questions":[...]}
Hanya JSON.`
      : `Buat ${count} soal ${typeDesc}, ${level} - ${subject}, kesulitan ${difficulty}.
Format: ${formatRules}
Aturan: Variasi panjang stem (pendek 1 kalimat, sedang 2 kalimat, panjang maks 3 kalimat). Variasi pola (konsep, aplikasi, analisis, evaluasi). Opsi A-E ringkas & logis. Kunci jawaban acak.
JSON:{"questions":[{"text":"...","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}]}
Hanya JSON.`;

    const arabicUserHint = explicitlyWantsArabic 
      ? ' WAJIB sertakan teks ayat Arab asli ber-harakat di setiap soal dalam tag <p dir="rtl">. Jangan hanya sebut nama surah. Sertakan juga terjemahan/arti dalam bahasa Indonesia.'
      : (isReligiousTopic ? ' Jika ada ayat Arab, pisahkan di baris baru dengan tag <p dir="rtl">.' : '');

    // Jika topik berisi instruksi panjang (>50 char), perlakukan sebagai instruksi langsung
    const isTopicAnInstruction = topic.length > 50 || topic.includes(',') || topicLower.includes('buat') || topicLower.includes('berikan') || topicLower.includes('pakai');
    
    const userPrompt = isLiteracy 
      ? `STIMULUS LITERASI:\n${wacanaResult}\n\nBuat ${count} soal ${typeDesc} dari stimulus di atas. Variasi panjang & tipe. Opsi ringkas. Jangan copy-paste dari teks.${arabicUserHint}`
      : isTopicAnInstruction
        ? `INSTRUKSI PENGGUNA: ${topic}\n\nBuat ${count} soal ${typeDesc}, ${level} - ${subject}. Ikuti instruksi pengguna di atas sebagai prioritas utama. Opsi A-E ringkas & logis.${arabicUserHint}`
        : `Buat ${count} soal ${typeDesc}, ${level} - ${subject}, topik: "${topic}". Variasi panjang stem & tipe pertanyaan. Opsi ringkas.${arabicUserHint}`;

    // Token per soal: soal agama/Arab butuh BANYAK karena ayat + harakat + terjemahan + HTML tags
    // Literasi juga butuh lebih karena soal cenderung lebih panjang (referensi ke stimulus).
    const baseTokens = (isReligiousTopic || explicitlyWantsArabic) ? 800 : (isLiteracy ? 450 : 350);
    const questionTokens = Math.min(Math.max(count * baseTokens, 1500), 8000);

    let responseQuestions;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    if (provider === "puter") {
      // 🌐 Puter.js SDK call - no fetch needed
      const puterContent = await callPuterAI(model, messages, questionTokens);
      const parsed = robustJSONParse(puterContent);
      let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
      if (questionsRaw.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
        questionsRaw = [parsed];
      }
      if (questionsRaw.length === 0) throw new Error("Format soal tidak valid.");
      const uniqueId = isLiteracy ? `LIT-${Math.random().toString(36).substr(2, 6).toUpperCase()}` : "";
      return questionsRaw.map((q: any) => {
        // Pastikan text hanya berisi pertanyaan, bukan wacana
        let questionText = q.text || q.question || "";
        // Jika literacy dan AI memasukkan wacana ke text, gunakan groupText dari AI atau wacanaResult
        const aiGroupText = q.groupText || q.passage || q.wacana || "";
        return {
          ...q,
          text: questionText,
          groupId: uniqueId || q.groupId || "",
          groupText: isLiteracy ? (wacanaResult || aiGroupText) : ""
        };
      });
    } else if (useProxy) {
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
          max_tokens: questionTokens
        })
      });
    }

    if (responseQuestions.status === 429) {
      const errBody = await responseQuestions.json().catch(() => ({}));
      const msg = errBody?.error?.message || "";
      // Extract token info from Groq error message if available
      const limitMatch = msg.match(/Limit (\d+)/);
      const usedMatch = msg.match(/Used (\d+)/);
      const requestedMatch = msg.match(/Requested (\d+)/);
      if (limitMatch && usedMatch) {
        const limit = parseInt(limitMatch[1]);
        const used = parseInt(usedMatch[1]);
        const remaining = Math.max(0, limit - used);
        const requested = requestedMatch ? parseInt(requestedMatch[1]) : 0;
        setTokenLimit(limit, used, apiKey);
        throw new Error(`AI_RATE_LIMIT|${limit}|${used}|${remaining}|${requested}`);
      }
      throw new Error("AI_RATE_LIMIT");
    }
    if (!responseQuestions.ok) {
      const errData = await responseQuestions.json().catch(() => ({}));
      throw new Error(errData?.error?.message || errData?.error || `HTTP ${responseQuestions.status}`);
    }
    
    const dataQs = await responseQuestions.json();
    // Track token usage from response
    if (dataQs?.usage?.total_tokens) {
      trackTokenUsage(dataQs.usage.total_tokens, undefined, apiKey);
    }
    // ✅ Always check both Ollama (message.content) AND OpenAI/Cloudflare (choices[0].message.content)
    const contentQs = dataQs?.message?.content || dataQs?.choices?.[0]?.message?.content || "";
    
    console.log("[AI DEBUG] dataQs keys:", Object.keys(dataQs || {}));
    const finishReason = dataQs?.choices?.[0]?.finish_reason || dataQs?.done_reason || "unknown";
    console.log("[AI DEBUG] contentQs length:", contentQs?.length, "| finish_reason:", finishReason, "| preview:", contentQs?.slice(0, 100));
    if (finishReason === "length") {
      console.warn("[AI DEBUG] ⚠️ Response TERPOTONG karena max_tokens habis! questionTokens was:", questionTokens);
    }
    
    if (!contentQs) {
      console.error("[AI DEBUG] Full dataQs:", JSON.stringify(dataQs).slice(0, 500));
      throw new Error(`AI tidak memberikan respon teks yang valid. (model: ${model})`);
    }

    const parsed = robustJSONParse(contentQs);
    let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    
    // Fallback: jika AI return single object (bukan array), bungkus jadi array
    if (questionsRaw.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
      questionsRaw = [parsed];
    }

    if (questionsRaw.length === 0) throw new Error("Format soal tidak valid.");

    const uniqueId = isLiteracy ? `LIT-${Math.random().toString(36).substr(2, 6).toUpperCase()}` : "";
    
    return questionsRaw.map((q: any) => {
      let questionText = q.text || q.question || "";
      const aiGroupText = q.groupText || q.passage || q.wacana || "";
      return {
        ...q,
        text: questionText,
        groupId: uniqueId || q.groupId || "",
        groupText: isLiteracy ? (wacanaResult || aiGroupText) : ""
      };
    });

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
    const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);

    const typeDesc = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah",
      isian_singkat: "Isian Singkat",
      uraian: "Uraian HOTS"
    }[type] || "Pilihan Ganda";

    const isExact = (subject.toLowerCase().includes('matematika') || subject.toLowerCase().includes('ipa') || subject.toLowerCase().includes('fisika') || subject.toLowerCase().includes('kimia'));
    const isProg = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('coding'));
    const isRelig = (subject.toLowerCase().includes('agama') || subject.toLowerCase().includes('arab') || subject.toLowerCase().includes('islam') || subject.toLowerCase().includes('quran') || topic.toLowerCase().includes('surah') || topic.toLowerCase().includes('ayat') || topic.toLowerCase().includes('hadist'));

    const fmtRules = [
      "Teks polos.",
      isExact ? "Rumus: $...$, pecahan: $\\\\displaystyle ...$." : "",
      isProg ? 'Kode: <pre class="ql-syntax" data-language="python">...</pre> (ganti python dengan bahasa yang sesuai: python, javascript, java, cpp, php).' : "",
      isRelig ? 'Ayat Arab: FORMAT WAJIB: 1) Ayat dalam <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT</p> 2) Terjemahan dalam <p style="font-style:italic;margin:8px 0;color:#555;">Terjemahan: "..."</p> 3) Pertanyaan dalam <p style="margin-top:12px;font-weight:600;">...</p>. JANGAN campur Arab dan Latin dalam satu baris.' : ""
    ].filter(Boolean).join(" ");

    const systemPrompt = `Buat 1 soal ${typeDesc}, ${level} - ${subject}, kesulitan ${difficulty}.
${fmtRules} Opsi A-E ringkas. Kunci jawaban acak.
JSON:{"text":"...","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}
Hanya JSON.`;

    const userPrompt = existingWacana 
      ? `STIMULUS LITERASI:\n${existingWacana}\n\nBuat 1 soal ${typeDesc} baru dari stimulus di atas.${isRelig ? ' Jika ada ayat Arab, pisahkan di baris baru dengan <p dir="rtl">.' : ''} Jangan tanya definisi.`
      : `Buat 1 soal ${typeDesc} topik: "${topic}".${isRelig ? ' Jika ada ayat Arab, pisahkan di baris baru dengan <p dir="rtl">. Jangan campur inline.' : ''} Variasi bentuk pertanyaan.`;

    let response;
    const singleMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const singleMaxTokens = isRelig ? 900 : 500;

    if (provider === "puter") {
      const puterContent = await callPuterAI(model, singleMessages);
      const result = robustJSONParse(puterContent);
      return { ...result, groupId: "", groupText: existingWacana };
    } else if (useProxy) {
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
                    stream: false,
                    max_tokens: singleMaxTokens,
                    temperature: 0.8
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
                max_tokens: singleMaxTokens
            })
        });
    }

    if (response.status === 429) throw new Error("AI_RATE_LIMIT");
    if (!response.ok) throw new Error("Gagal regenerasi soal.");
    const data = await response.json();
    if (data?.usage?.total_tokens) trackTokenUsage(data.usage.total_tokens, undefined, apiKey);
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
    const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);
    console.log(`💡 [AI TOPIC] Menyarankan topik menggunakan: ${model}`);

    const literasiNote = isLiteracy ? " (topik kaya teks bacaan)" : "";
    const systemPrompt = `Berikan 5 topik/materi pelajaran yang sesuai kurikulum untuk ${level} - ${subject}, kesulitan ${difficulty}, standar ${focus}.${literasiNote}
Topik harus berupa NAMA MATERI/BAB (bukan judul soal atau judul program). Contoh format: "Pengenalan Algoritma Dasar", "Tipe Data & Variabel", "Operasi Hitung Pecahan".
Balas JSON: {"topics":["...","..."]}`;

    if (provider === "puter") {
      try {
        const puterContent = await callPuterAI(model, [{ role: "system", content: systemPrompt }]);
        const parsed = robustJSONParse(puterContent);
        const rawTopics = parsed.topics || parsed.data || (Array.isArray(parsed) ? parsed : []);
        return rawTopics.map((t: any) => typeof t === "string" ? t : (t?.topic || t?.text || String(t))).slice(0, 5);
      } catch { return []; }
    }

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
            stream: false,
            max_tokens: 200,
            temperature: 0.7
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
          max_tokens: 200
        })
      });
    }

    if (response.status === 429) return ["AI_RATE_LIMIT"];
    if (!response.ok) return [];
    
    const data = await response.json();
    if (data?.usage?.total_tokens) trackTokenUsage(data.usage.total_tokens, undefined, apiKey);
    const content = useProxy ? (data?.message?.content || data?.choices?.[0]?.message?.content || "") : (data?.choices?.[0]?.message?.content || "");
    
    if (!content) return [];
    
    const parsed = robustJSONParse(content);
    const rawTopics = parsed.topics || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    
    // 🛡️ Ensure everything is a clean string
    return rawTopics.map((t: any) => {
      if (typeof t === "string") return t;
      if (typeof t === "object" && t !== null) {
        // Try known keys first
        const known = t.nama || t.topic || t.topik || t.text || t.title || t.Title || t.name;
        if (known && typeof known === "string") return known;
        // Fallback: grab first string value from object
        const vals = Object.values(t);
        const firstStr = vals.find((v: any) => typeof v === "string" && v.length > 3);
        if (firstStr) return firstStr as string;
        return "";
      }
      return String(t);
    }).filter((s: string) => s.length > 0).slice(0, 5);
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
    const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);

    const systemPrompt = `Anda adalah Ahli Digitalisasi Dokumen Pendidikan & Spesialis Evaluasi STEM/Literasi.
Tugas: Ekstrak semua soal dari teks mentah (hasil copy-paste PDF/Word) menjadi JSON valid.

KETENTUAN EKSTRAKSI:
1. IDENTIFIKASI LITERASI/STIMULUS: 
   - Jika ada teks bacaan panjang, cerita, atau stimulus yang digunakan untuk beberapa soal, letakkan di field 'groupText'.
   - Berikan 'groupId' yang unik (misal: "LIT-001") untuk soal-soal yang menggunakan stimulus tersebut.
   - Jika stimulus hanya untuk 1 soal, letakkan langsung di field 'text' soal tersebut saja.
2. EKSAKTA (Matematika/Sains): Gunakan LaTeX HANYA dengan pembungkus $ ... $ tunggal agar rumus menyatu dengan teks (JANGAN gunakan $$ atau \\displaystyle sebagai teks polos).
   - Simbol bertingkat (integral/pecahan): Gunakan $\\displaystyle ...$ (WAJIB double backslash di dalam JSON agar tidak error).
3. IDENTIFIKASI SOAL & OPSI: Pisahkan pertanyaan dengan pilihan jawaban (a, b, c, d, e).
4. IDENTIFIKASI KUNCI JAWABAN: Deteksi kunci jawaban dari tanda (bold, bintang (*), atau huruf yang dilingkari). 
5. TIPE SOAL: Gunakan 'pilihan_ganda' (default), 'pilihan_ganda_kompleks', 'benar_salah', 'isian_singkat', atau 'uraian'.
6. JANGAN gunakan markdown seperti ** atau __. Gunakan tag HTML <strong> jika perlu penekanan.

STRUKTUR JSON (WAJIB):
{
  "questions": [
    {
      "text": "Pertanyaan (HTML, gunakan $ untuk rumus)",
      "type": "pilihan_ganda",
      "groupId": "ID_GRUP_JIKA_ADA",
      "groupText": "TEKS_WACANA_JIKA_ADA",
      "choices": { 
        "a": { "text": "...", "isCorrect": false }, 
        "b": { "text": "...", "isCorrect": true },
        ... 
      },
      "answerKey": "b"
    }
  ]
}

Aturan Ketat: Pastikan JSON valid. Setiap garis miring ("\\" tunggal) dalam LaTeX WAJIB di-escape ganda ("\\\\") di dalam JSON.`;

    const mathHint = (subject.toLowerCase().includes('matematika') || subject.toLowerCase().includes('ipa') || subject.toLowerCase().includes('fisika') || subject.toLowerCase().includes('kimia')) 
      ? "\nKONTEN STEM: Deteksi semua rumus dan ubah ke format LaTeX $ ... $. Pastikan penulisan pecahan menggunakan $\\displaystyle \\frac{a}{b}$." 
      : "";

    const programmingHint = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika'))
      ? `\nKONTEN PEMROGRAMAN: Gunakan tag <pre class="ql-syntax" data-language="NAMA_BAHASA">...</pre> untuk potongan kode program.`
      : "";

    const arabicHint = (subject.toLowerCase().includes('agama') || subject.toLowerCase().includes('arab') || subject.toLowerCase().includes('islam') || rawText.includes('ayat') || rawText.includes('surah') || rawText.includes('hadits') || rawText.includes('hadist'))
      ? `\nKONTEN ARAB/AGAMA (WAJIB): Setiap penggalan ayat Al-Qur'an, Hadits, atau doa WAJIB ditulis dalam TEKS ARAB ASLI (ber-harakat lengkap). DILARANG KERAS hanya menulis transliterasi latin.`
      : "";

    const userPrompt = `INPUT DOKUMEN (${subject} - ${level}):\n\n${rawText}\n\n
    TUGAS: Ekstrak soal-soal dari dokumen di atas. 
    PENTING: 
    - JANGAN memaksa membuat soal Literasi/Stimulus jika soal asli bersifat mandiri. 
    - Jika ada instruksi khusus dalam teks (misal: "Ubah ke HOTS"), ikuti instruksi tersebut. 
    - Pastikan kunci jawaban terdeteksi akurat.${mathHint}${programmingHint}${arabicHint}`;

    let response;
    if (provider === "puter") {
      const puterContent = await callPuterAI(model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);
      const parsed = robustJSONParse(puterContent);
      const questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
      if (questionsRaw.length === 0) throw new Error("AI tidak menemukan soal dalam teks.");
      return questionsRaw.map((q: any) => ({
        text: q.text || q.question || "",
        type: q.type || "pilihan_ganda",
        choices: q.choices || q.options || {},
        pairs: q.pairs,
        items: q.items,
        answerKey: q.answerKey || q.answer_key || q.answer || "",
        groupId: q.groupId || "",
        groupText: q.groupText || ""
      }));
    } else if (useProxy) {
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
            temperature: 0.1 // Sangat rendah agar ekstraksi presisi
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
          temperature: 0.1
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
    const actualModelDef = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];
    const finalProvider = provider || actualModelDef.provider;

    // 🌐 Puter: No API key needed, test via SDK
    if (finalProvider === "puter") {
      try {
        await loadPuterSDK();
        const puter = (window as any).puter;
        if (!puter?.ai?.chat) return { success: false, message: "Puter.js SDK tidak tersedia." };
        // Ensure signed in
        try {
          const isSignedIn = await puter.auth.isSignedIn();
          if (!isSignedIn) await puter.auth.signIn();
        } catch {}
        const res = await puter.ai.chat("Say hi", { model: modelId, max_tokens: 10 });
        return { success: true, message: `Koneksi Puter Berhasil! (Model: ${modelId})` };
      } catch (e: any) {
        return { success: false, message: e.message || "Gagal koneksi ke Puter AI. Pastikan login dan popup tidak diblokir." };
      }
    }

    if (!apiKey) throw new Error("API Key Kosong");
    
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

/**
 * 📚 Generate Questions from Raw Material Text
 * Transforms raw reading material/text into structured questions.
 */
export const generateFromMaterialAI = async (
  pb: PocketBase,
  material: string,
  count: number = 5,
  difficulty: string = "sedang",
  subject: string = "Umum",
  level: string = "Umum",
  type: string = "pilihan_ganda"
): Promise<AIGeneratedQuestion[]> => {
  try {
    const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);

    const typeMap: Record<string, string> = {
      pilihan_ganda: "Pilihan Ganda (1 jawaban benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (lebih dari 1 jawaban benar)",
      isian_singkat: "Isian Singkat",
      uraian: "Uraian / Essay",
      benar_salah: "Benar atau Salah",
      menjodohkan: "Menjodohkan (Matching)",
    };

    const typeDesc = typeMap[type] || "Pilihan Ganda";

    const systemPrompt = `Anda adalah Spesialis Kurikulum & Evaluasi Pendidikan.
Tugas: Buat ${count} soal ${typeDesc} berdasarkan MATERI BACAAN yang diberikan.
Jenjang: ${level}, Mata Pelajaran: ${subject}, Kesulitan: ${difficulty}.

KETENTUAN:
1. AKURASI: Soal WAJIB berdasarkan fakta/informasi yang ada di dalam materi yang diberikan.
2. HOTS & VARIASI (WAJIB ANTI-MONOTON): 
   - WAJIB menggunakan standar HOTS (Analisis, Evaluasi, Kreasi) dan bervariasi.
   - DILARANG KERAS menggunakan pola kalimat tanya yang seragam atau berulang (misal: "Apa yang dimaksud...", "Jelaskan kelebihan...").
   - SETIAP SOAL WAJIB MENGGUNAKAN SUDUT PANDANG, KONTEKS, & POLA STEM YANG BERBEDA:
     * Gunakan skenario kasus atau simulasi masalah nyata yang relevan dengan materi.
     * Gunakan pertanyaan yang menuntut analisis perbandingan atau hubungan sebab-akibat.
     * Gunakan pertanyaan evaluasi terhadap efektivitas suatu metode/keputusan dalam materi.
     * Gunakan pertanyaan prediksi/implikasi jika suatu kondisi dalam materi mengalami perubahan.
   - LITERASI PANJANG: Jika diminta soal literasi, buatkan teks wacana/stimulus yang mendalam, analitis, berupa studi kasus/problematika nyata (minimal 2-3 paragraf) agar tidak sekadar berupa definisi ensiklopedis.
   - OPSI JAWABAN: Untuk Pilihan Ganda, WAJIB menyediakan 5 pilihan jawaban (A, B, C, D, E) yang variatif, logis, dan tidak berpola sama antar soal. Setiap opsi SEBAIKNYA diawali huruf kapital (kecuali rumus/kode).
3. FORMAT: Gunakan LaTeX $ ... $ untuk rumus jika ada. Gunakan HTML <strong> untuk penekanan.
4. JSON ESCAPING: Setiap garis miring ("\\" tunggal) dalam LaTeX WAJIB di-escape ganda ("\\\\") di dalam JSON.

STRUKTUR JSON (WAJIB):
{
  "questions": [
    {
      "text": "Pertanyaan SAJA (HOTS) - JANGAN masukkan wacana di sini",
      "type": "${type}",
      "choices": { 
        "a": { "text": "...", "isCorrect": false }, 
        "b": { "text": "...", "isCorrect": false },
        "c": { "text": "...", "isCorrect": false },
        "d": { "text": "...", "isCorrect": false },
        "e": { "text": "...", "isCorrect": true }
      },
      "answerKey": "e",
      "groupId": "ID_GRUP (misal LIT-001) jika soal literasi, kosongkan jika bukan",
      "groupText": "TEKS WACANA/STIMULUS jika soal literasi (minimal 2-3 paragraf). Kosongkan jika bukan literasi."
    }
  ]
}
PENTING: Field "text" HANYA berisi pertanyaan. Wacana/stimulus WAJIB di "groupText".
Hanya berikan JSON murni.`;

    const mathHint = (subject.toLowerCase().includes('matematika') || subject.toLowerCase().includes('ipa') || subject.toLowerCase().includes('fisika') || subject.toLowerCase().includes('kimia') || subject.toLowerCase().includes('ekonomi') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('it')) 
      ? "\nGunakan $ ... $ untuk SEMUA rumus agar tidak terpisah dari teks. Untuk integral/fraksi yang bagus, gunakan $\\displaystyle ...$. WAJIB gunakan \\\\ (double backslash) di JSON." 
      : "";

    const programmingHint = (subject.toLowerCase().includes('pemrograman') || subject.toLowerCase().includes('it') || subject.toLowerCase().includes('informatika') || subject.toLowerCase().includes('coding'))
      ? `\nKONTEN PEMROGRAMAN: Gunakan tag <pre class="ql-syntax" data-language="NAMA_BAHASA">...</pre> untuk setiap potongan kode program.`
      : "";

    const arabicHint = (subject.toLowerCase().includes('agama') || subject.toLowerCase().includes('arab') || subject.toLowerCase().includes('islam') || material.toLowerCase().includes('ayat') || material.toLowerCase().includes('surah') || material.toLowerCase().includes('hadist') || material.toLowerCase().includes('hadits') || material.toLowerCase().includes('quran') || material.toLowerCase().includes('al-qur'))
      ? `\nKONTEN ARAB/AGAMA (WAJIB): Setiap penggalan ayat Al-Qur'an, Hadits, atau doa WAJIB ditulis dalam TEKS ARAB ASLI (ber-harakat lengkap/syakal). DILARANG KERAS hanya menulis transliterasi latin. Contoh BENAR: "إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ". Contoh SALAH: "Innallaha yuhibbut...". Teks Arab harus ditampilkan jelas.`
      : "";

    const userPrompt = `INPUT PENGGUNA (Materi/Instruksi):\n\n${material}\n\n
    TUGAS:
    1. Jika teks berisi instruksi spesifik (misal: "Buatkan soal literasi...", "Buat 10 soal..."), ikuti instruksi tersebut sebagai prioritas utama.
    2. Jika teks hanya berisi materi, buatkan ${count} soal ${typeDesc} dengan tingkat kesulitan ${difficulty}.
    3. PENTING (WAJIB BERAGAM & ANTI-MONOTON): DILARANG KERAS membuat soal dengan pola kalimat yang seragam (misal: jangan semua soal bertanya "Apa yang dimaksud..." atau "Jelaskan kelebihan..."). Buat variasi skenario, studi kasus, analisis dampak, dan pemecahan masalah nyata pada setiap butir soal.
    4. LITERASI/STIMULUS: Jika diminta soal literasi atau stimulus, WAJIB masukkan teks wacana/bacaan ke field "groupText" (BUKAN di "text"). Field "text" HANYA berisi pertanyaan. Berikan "groupId" yang sama (misal "LIT-001") untuk semua soal yang menggunakan wacana yang sama. Pastikan wacana berbentuk artikel analitis atau studi kasus (minimal 2-3 paragraf).
    5. Pastikan kelima opsi jawaban (A, B, C, D, E) pada setiap soal ditulis secara variatif dan tidak mengulang pola yang sama. Setiap opsi SEBAIKNYA diawali huruf kapital.${mathHint}${programmingHint}${arabicHint}`;

    let response;
    if (provider === "puter") {
      const puterContent = await callPuterAI(model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], count * 1200);
      const parsed = robustJSONParse(puterContent);
      let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
      if (questionsRaw.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
        questionsRaw = [parsed];
      }
      if (questionsRaw.length === 0) throw new Error("Format soal tidak valid.");
      return questionsRaw.map((q: any) => ({
        text: q.text || q.question || "",
        type: q.type || type,
        choices: q.choices || q.options || {},
        pairs: q.pairs,
        items: q.items,
        answerKey: q.answerKey || q.answer_key || q.answer || "",
        groupId: q.groupId || "",
        groupText: q.groupText || ""
      }));
    } else if (useProxy) {
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
            temperature: 0.7,
            max_tokens: count * 1500
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
          temperature: 0.7,
          max_tokens: count * 1500
        })
      });
    }

    if (!response.ok) {
      const errData = await response.json();
      if (errData.error?.message?.includes("rate limit")) throw new Error("AI_RATE_LIMIT");
      throw new Error(errData.error?.message || "AI Error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.message?.content || "";
    const parsed = robustJSONParse(content);
    
    let questionsResult = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    if (questionsResult.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
      questionsResult = [parsed];
    }
    return questionsResult;
  } catch (err: any) {
    console.error("Generate from Material Error:", err);
    throw err;
  }
};
