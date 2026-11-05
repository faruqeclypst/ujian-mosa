import PocketBase from "pocketbase";
import { jsonrepair } from "jsonrepair";
import globalPb from "./pocketbase";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 Token Usage Tracking (localStorage-based, per API key)
// ═══════════════════════════════════════════════════════════════════════════════
const TOKEN_USAGE_KEY = "ai_token_usage";

export interface AITokenUsage {
  date: string;
  used: number;
  limit: number;
  lastUpdated: number;
  keyHash: string;
}

const hashKey = (key: string): string => key.slice(-8);

export const getTokenUsage = (apiKeyHint?: string): AITokenUsage => {
  try {
    const stored = localStorage.getItem(TOKEN_USAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split("T")[0];
      const currentHash = apiKeyHint ? hashKey(apiKeyHint) : data.keyHash || "";
      if (data.date === today && data.keyHash === currentHash) return data;
    }
  } catch { }
  return { date: new Date().toISOString().split("T")[0], used: 0, limit: 100000, lastUpdated: Date.now(), keyHash: "" };
};

export const trackTokenUsage = (tokens: number, knownLimit?: number, apiKey?: string): AITokenUsage => {
  const currentHash = apiKey ? hashKey(apiKey) : "";
  const current = getTokenUsage(apiKey);
  const today = new Date().toISOString().split("T")[0];
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
  const updated: AITokenUsage = { ...current, limit, used: used ?? current.used, lastUpdated: Date.now(), keyHash: currentHash || current.keyHash };
  localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(updated));
};

export const resetTokenUsage = (): void => { localStorage.removeItem(TOKEN_USAGE_KEY); };

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIGeneratedQuestion {
  text: string;
  type: string;
  imageUrl?: string;
  choices?: Record<string, { text: string; isCorrect: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string }>;
  statements?: Array<{ id: string; text: string; answer?: any }>;
  categories?: Array<{ id: string; text: string }>;
  columns?: Array<{ id: string; text: string }>;
  blanks?: Array<{ id: string; answers: string[]; caseSensitive?: boolean }>;
  shuffleStatements?: boolean;
  answerKey?: string;
  groupId?: string;
  groupText?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ Robust JSON Parser (with jsonrepair fallback)
// ═══════════════════════════════════════════════════════════════════════════════
export const robustJSONParse = (text: string): any => {
  if (!text || !text.trim()) throw new Error("AI memberikan respon kosong.");

  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");

  let startIdx = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  const isArray = clean[startIdx] === '[';
  const lastClose = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}');
  clean = (lastClose !== -1 && lastClose > startIdx) ? clean.substring(startIdx, lastClose + 1) : clean.substring(startIdx);

  // Fast path
  try { return JSON.parse(clean); } catch { }
  // jsonrepair
  try { return JSON.parse(jsonrepair(clean)); } catch { }
  // Cleanup + repair
  try {
    const cleaned = clean.replace(/\r\n/g, "\\n").replace(/\r/g, "\\n").replace(/(?<!\\)\n/g, "\\n").replace(/(?<!\\)\t/g, "\\t").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    return JSON.parse(jsonrepair(cleaned));
  } catch { }
  // Truncated recovery
  try {
    const lastComplete = clean.lastIndexOf('"answerKey"');
    if (lastComplete !== -1) {
      const afterAnswer = clean.indexOf('}', lastComplete);
      if (afterAnswer !== -1) {
        let truncated = clean.substring(0, afterAnswer + 1);
        if (!truncated.endsWith(']}')) truncated += ']}';
        return JSON.parse(jsonrepair(truncated));
      }
    }
  } catch { }
  // Last resort
  try { return JSON.parse(jsonrepair(clean.replace(/[\n\r\t]/g, " "))); } catch { }

  console.error("All JSON repair failed. Raw (500 chars):", clean.substring(0, 500));
  throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");
};


// ═══════════════════════════════════════════════════════════════════════════════
// 📋 AI Models Registry
// ═══════════════════════════════════════════════════════════════════════════════
export const AI_MODELS = [
  // --- BYOK / CUSTOM GATEWAY (OpenAI, Anthropic Claude, DeepSeek, Agnes AI, dll.) ---
  { id: "gpt-4o-mini", name: "GPT-4o Mini (OpenAI Cepat & Hemat)", speed: "Fast", status: "production", provider: "custom" },
  { id: "gpt-4o", name: "GPT-4o (OpenAI Unggulan)", speed: "Smart", status: "production", provider: "custom" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Anthropic)", speed: "Superior", status: "production", provider: "custom" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Anthropic Kilat)", speed: "Hyper Fast", status: "production", provider: "custom" },
  { id: "deepseek-chat", name: "DeepSeek Chat (V3)", speed: "Logic", status: "production", provider: "custom" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)", speed: "Deep Thinking", status: "production", provider: "custom" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", speed: "Open Source", status: "production", provider: "custom" },
  { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash (Super Kilat ~0.7s)", speed: "Hyper Fast", status: "production", provider: "custom" },
  { id: "agnes-3.0-flash", name: "Agnes 3.0 Flash", speed: "Kilat", status: "production", provider: "custom" },
  { id: "agnes-3.0-pro", name: "Agnes 3.0 Pro", speed: "Komprehensif", status: "production", provider: "custom" },
];


// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 Puter.js SDK Loader & Helper
// ═══════════════════════════════════════════════════════════════════════════════
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

const callPuterAI = async (model: string, messages: Array<{ role: string; content: string }>, maxTokens?: number): Promise<string> => {
  await loadPuterSDK();
  const puter = (window as any).puter;
  if (!puter?.ai?.chat) throw new Error("Puter.js SDK tidak tersedia. Pastikan popup tidak diblokir.");
  try {
    const isSignedIn = await puter.auth.isSignedIn();
    if (!isSignedIn) await puter.auth.signIn();
  } catch { }

  const response = await puter.ai.chat(
    messages.map(m => ({ role: m.role, content: m.content })),
    { model: model || "gpt-4o-mini", ...(maxTokens ? { max_tokens: maxTokens } : {}), temperature: 0.8 }
  );

  if (typeof response === "string") return response;
  if (response?.message?.content) return response.message.content;
  if (response?.text) return response.text;
  if (response?.content) return response.content;
  if (response?.toString && response.toString() !== "[object Object]") return response.toString();
  throw new Error("Puter AI tidak memberikan respon yang valid. Pastikan Anda sudah login ke akun Puter.");
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 AI Config Resolution (OpenAI-Compatible & Anthropic Claude Support)
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIConfig {
  apiKey: string;
  useProxy: boolean;
  model: string;
  baseUrl: string;
  provider: string;
  isAnthropic: boolean;
}

export const isAnthropicEndpoint = (url: string = "", key: string = ""): boolean => {
  const u = (url || "").toLowerCase();
  const k = (key || "").trim();
  return u.includes("anthropic.com") || u.includes("/messages") || k.startsWith("sk-ant-");
};

export const resolveCleanUrl = (url: string = "", isAnthropic: boolean = false): string => {
  if (!url || !url.trim()) {
    return isAnthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions";
  }
  let clean = url.trim().replace(/\/$/, "");
  if (isAnthropic) {
    if (clean.includes("/messages")) return clean;
    if (clean.endsWith("/v1")) return `${clean}/messages`;
    return `${clean}/v1/messages`;
  } else {
    if (clean.includes("/chat/completions") || clean.includes("/api/chat")) return clean;
    return `${clean}/chat/completions`;
  }
};

// Cache config for 30 seconds to avoid repeated DB calls
let configCache: { data: AIConfig; timestamp: number } | null = null;
const CONFIG_CACHE_TTL = 30000;

export const invalidateAIConfigCache = (): void => {
  configCache = null;
};

const getAIConfig = async (pb: PocketBase): Promise<AIConfig> => {
  if (configCache && Date.now() - configCache.timestamp < CONFIG_CACHE_TTL) {
    return configCache.data;
  }

  const user = pb.authStore.model;
  const userApiKey = (user as any)?.ai_api_key;
  const userRole = (user as any)?.role || "teacher";

  const settings = await pb.collection("settings").getFullList({ limit: 1 });
  const config = settings[0];

  let rawModel = AI_MODELS[0].id;
  let rawProvider = "custom";

  if (userRole === "admin") {
    rawModel = config?.ai_model || AI_MODELS[0].id;
    rawProvider = config?.ai_provider && config?.ai_provider !== "groq" ? config.ai_provider : "custom";
  } else {
    // Cek apakah admin punya key aktif — kalau ya, pakai setting admin
    const tempSettings = config;
    const adminHasKey = (tempSettings?.ai_gateway_key || tempSettings?.groq_api_key)?.trim();
    if (adminHasKey) {
      // Pakai provider & model dari admin
      rawModel = config?.ai_model || AI_MODELS[0].id;
      rawProvider = config?.ai_provider && config?.ai_provider !== "groq" ? config.ai_provider : "custom";
    } else {
      // Fallback ke setting user sendiri
      rawModel = (user as any)?.ai_model || config?.ai_model || AI_MODELS[0].id;
      rawProvider = (user as any)?.ai_provider && (user as any)?.ai_provider !== "groq" ? (user as any).ai_provider : (config?.ai_provider || "custom");
    }
  }

  const finalModel = rawModel || AI_MODELS[0].id;
  const finalProvider = "custom";

  let apiKey = "";
  if (userRole === "admin") {
    apiKey = config?.ai_gateway_key || config?.groq_api_key || "";
    if (!apiKey?.trim()) throw new Error("API Key belum diatur di Pengaturan AI.");
  } else {
    // Guru: admin key diprioritaskan, user key hanya fallback jika admin key kosong
    const adminKey = config?.ai_gateway_key || config?.groq_api_key;
    const teacherHasOwnKey = userApiKey && userApiKey.trim();
    const isAIAccess = config?.teacher_ai_access ?? false;

    if (adminKey?.trim()) {
      apiKey = adminKey;
    } else if (teacherHasOwnKey) {
      apiKey = userApiKey;
    } else if (isAIAccess) {
      throw new Error("Admin belum mengatur API Key AI di Pengaturan.");
    } else {
      throw new Error("Anda belum memiliki API Key AI. Hubungi Admin atau masukkan API Key pribadi di Pengaturan AI.");
    }
  }

  const gatewayUrl = config?.ai_gateway_url?.trim() || "";
  const isAnthropic = isAnthropicEndpoint(gatewayUrl, apiKey);
  const baseUrl = resolveCleanUrl(gatewayUrl, isAnthropic);

  // Direct fetch dari browser untuk gateway publik agar respon 1-2s.
  // Otomatis pakai proxy hanya jika server lokal (localhost / LAN).
  const isLocalOrLAN = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes(":11434");
  const useProxy = isLocalOrLAN;

  const result: AIConfig = { apiKey, useProxy, model: finalModel, baseUrl, provider: finalProvider, isAnthropic };
  configCache = { data: result, timestamp: Date.now() };
  return result;
};


// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 Unified AI Fetch Helper (supports OpenAI & Anthropic Claude)
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIFetchOptions {
  pb: PocketBase;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean; // Request JSON output format
  modelOverride?: string;
  signal?: AbortSignal;
}

export const fetchAI = async (opts: AIFetchOptions): Promise<string> => {
  const { pb, messages, maxTokens, temperature = 0.7, jsonMode = true, modelOverride, signal } = opts;
  const config = await getAIConfig(pb);
  const { apiKey, useProxy, baseUrl, isAnthropic } = config;
  const model = modelOverride || config.model;

  let response: Response;

  if (isAnthropic) {
    // 🧠 ANTHROPIC CLAUDE MESSAGES API
    const systemMessages = messages.filter(m => m.role === "system");
    const systemPrompt = systemMessages.map(m => m.content).join("\n\n");
    const nonSystem = messages.filter(m => m.role === "user" || m.role === "assistant");

    // Pastikan percakapan dimulai oleh user dan tidak ada dua pesan berturut-turut dengan role sama
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of nonSystem) {
      const role = m.role === "assistant" ? "assistant" : "user";
      if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === role) {
        anthropicMessages[anthropicMessages.length - 1].content += "\n\n" + m.content;
      } else {
        anthropicMessages.push({ role, content: m.content });
      }
    }
    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== "user") {
      anthropicMessages.unshift({ role: "user", content: "Mulai pembuatan butir soal." });
    }

    const anthropicBody: any = {
      model,
      max_tokens: maxTokens || 4000,
      temperature,
      messages: anthropicMessages
    };
    if (systemPrompt) anthropicBody.system = systemPrompt;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };

    if (!useProxy) {
      try {
        response = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(anthropicBody),
          signal
        });
      } catch (directErr: any) {
        if (directErr.name === "AbortError") throw directErr;
        // Fallback otomatis ke proxy PocketBase jika browser diblokir CORS
        response = await fetch(pb.baseUrl + "/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
          body: JSON.stringify({
            baseUrl,
            apiKey,
            model,
            messages,
            max_tokens: maxTokens || 4000,
            temperature,
            isAnthropic: true
          }),
          signal
        });
      }
    } else {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          model,
          messages,
          max_tokens: maxTokens || 4000,
          temperature,
          isAnthropic: true
        }),
        signal
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || errData?.error || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    const data = await response.json();
    if (data?.usage) {
      const total = (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0);
      if (total) trackTokenUsage(total, undefined, apiKey);
    }

    const content = data?.content?.map((b: any) => b.text || "").join("") || "";
    if (!content) {
      throw new Error(`Anthropic tidak memberikan respon teks yang valid. (model: ${model})`);
    }
    return content;
  }

  // 🤖 OPENAI-COMPATIBLE FORMAT (OpenAI, Agnes AI, AppVerse, DeepSeek, Ollama, Together, vLLM, dll.)
  const supportsJsonMode = baseUrl.includes("api.openai.com") || baseUrl.includes("openrouter.ai");
  const body: any = { model, messages, temperature };
  if (maxTokens) body.max_tokens = maxTokens;
  if (jsonMode && supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }

  // Timeout controller (25s) agar browser tidak menggantung tanpa batas jika upstream macet
  const timeoutMs = 25000;
  let timeoutId: any = null;
  const internalAbort = new AbortController();

  if (signal) {
    signal.addEventListener("abort", () => internalAbort.abort(signal.reason));
  }
  timeoutId = setTimeout(() => {
    internalAbort.abort(new Error("AI_GATEWAY_TIMEOUT"));
  }, timeoutMs);

  try {
    if (!useProxy) {
      try {
        response = await fetch(baseUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: internalAbort.signal
        });
      } catch (directErr: any) {
        if (directErr.name === "AbortError" && signal?.aborted) throw directErr;
        if (directErr?.message === "AI_GATEWAY_TIMEOUT" || directErr.name === "AbortError") {
          if (model.includes("3.0") && baseUrl.includes("agnes")) {
            console.warn("[AI] Timeout pada model 3.0, mencoba fallback otomatis ke agnes-2.5-flash...");
            clearTimeout(timeoutId);
            return fetchAI({ ...opts, modelOverride: "agnes-2.5-flash" });
          }
          throw new Error("Respon server upstream AI melebihi batas waktu (25 detik). Silakan coba lagi atau gunakan model lain.");
        }
        // Fallback otomatis ke proxy PocketBase jika browser diblokir CORS pada server custom
        response = await fetch(pb.baseUrl + "/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
          body: JSON.stringify({
            baseUrl,
            apiKey,
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: false,
            response_format: (jsonMode && supportsJsonMode) ? { type: "json_object" } : undefined
          }),
          signal: internalAbort.signal
        });
      }
    } else {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
          response_format: (jsonMode && supportsJsonMode) ? { type: "json_object" } : undefined
        }),
        signal: internalAbort.signal
      });
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // Handle rate limit
  if (response.status === 429) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message || "";
    // Otomatis coba fallback jika model Agnes AI 3.0 terkena max connection throttle
    if (model.includes("3.0") && baseUrl.includes("agnes")) {
      console.warn("[AI] Agnes 3.0 terkena limit/throttle, otomatis fallback ke agnes-2.5-flash...");
      return fetchAI({
        ...opts,
        modelOverride: "agnes-2.5-flash"
      });
    }
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

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || errData?.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data?.usage?.total_tokens) trackTokenUsage(data.usage.total_tokens, undefined, apiKey);

  // Extract content (supports OpenAI, Ollama, and various custom formats)
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.response ||
    data?.output?.content ||
    data?.output?.text ||
    data?.result?.response ||
    data?.content ||
    data?.text ||
    "";

  if (!content) {
    console.error("[AI] Empty content from response. Full data:", JSON.stringify(data).substring(0, 500));
    throw new Error(`AI tidak memberikan respon teks yang valid. (model: ${model})`);
  }

  return content;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 Modular Prompt System (only include relevant instructions)
// ═══════════════════════════════════════════════════════════════════════════════
interface SubjectContext {
  isExact: boolean;
  isProgramming: boolean;
  isReligious: boolean;
  isChemistry: boolean;
  explicitlyWantsArabic: boolean;
}

const detectSubjectContext = (subject: string, topic: string = ""): SubjectContext => {
  const s = subject.toLowerCase();
  const t = topic.toLowerCase();
  return {
    isExact: /matematika|fisika|kimia/.test(s) || (/ipa/.test(s) && /rumus|hitung|energi|gaya|gerak|listrik|kalor/.test(t)),
    isProgramming: /pemrograman|\bit\b|informatika|coding/.test(s),
    isReligious: /agama|arab|islam|quran/.test(s) || /surah|ayat|hadist|hadits/.test(t),
    isChemistry: /kimia|chemistry/.test(s) || /reaksi|senyawa|unsur|mol|larutan/.test(t),
    explicitlyWantsArabic: /ayat|surah|surat|lampirkan|hadits|hadist|al-quran|alquran|bahasa arab|teks arab|pakai arab|translate|terjemah/.test(t)
  };
};

const buildFormatRules = (ctx: SubjectContext): string => {
  const rules: string[] = [];

  if (ctx.isExact || ctx.isChemistry) {
    rules.push("RUMUS & SIMBOL (LaTeX):\n" +
      "- Gunakan LaTeX inline $...$ atau display $$...$$ HANYA untuk rumus/simbol ilmiah, BUKAN angka biasa (contoh: 5 siswa tetap teks biasa).\n" +
      "- Notasi: Pecahan $\\frac{a}{b}$, Pangkat $10^{22}$, Koma desimal $9{,}8$, Derajat $90^\\circ$, Logaritma ${}^a\\log b$.\n" +
      "- Di JSON, tulis double-backslash: \"$\\\\frac{1}{2}$\"");
  }

  if (ctx.isChemistry) {
    rules.push("KIMIA: Rumus/senyawa/reaksi kimia WAJIB menggunakan $\\ce{...}$ (contoh: $\\ce{H2SO4}$, $\\ce{2H2 + O2 -> 2H2O}$). Di JSON: \"$\\\\ce{H2SO4}$\"");
  }

  if (ctx.isProgramming) {
    rules.push(`KODE: Gunakan <pre class="ql-syntax" data-language="BAHASA">...</pre> HANYA untuk potongan kode program. Penjelasan gunakan teks biasa.`);
  }
  if (ctx.explicitlyWantsArabic) {
    rules.push(`Sertakan ayat Arab ber-harakat: <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT</p> lalu terjemahan di bawahnya.`);
  } else if (ctx.isReligious) {
    rules.push(`Jika relevan, sertakan ayat Arab ber-harakat dalam <p dir="rtl" style="text-align:right;font-size:1.3em;">AYAT</p>.`);
  }

  return rules.length > 0 ? rules.join("\n\n") : "Tulis soal dalam teks biasa (plain text/HTML) tanpa simbol LaTeX $ jika bukan mapel eksakta.";
};

// Few-shot examples for different subject types
const getFewShotExample = (ctx: SubjectContext): string => {
  if (ctx.isChemistry) {
    return `
CONTOH OUTPUT BENAR (Kimia):
{"text":"Berapa mol gas $\\\\ce{O2}$ dalam $2\\\\text{ L}$ pada suhu $0\\\\,^\\\\circ\\\\text{C}$ dan tekanan $1\\\\text{ atm}$? ($R = 0{,}0821\\\\text{ L atm/mol K}$)","choices":{"a":{"text":"$6{,}022 \\\\times 10^{22}$","isCorrect":false},"b":{"text":"$6{,}022 \\\\times 10^{23}$","isCorrect":true},"c":{"text":"$6{,}022 \\\\times 10^{24}$","isCorrect":false},"d":{"text":"$1{,}2 \\\\times 10^{23}$","isCorrect":false},"e":{"text":"$3{,}011 \\\\times 10^{23}$","isCorrect":false}},"answerKey":"b"}`;
  }
  if (ctx.isExact) {
    return `
CONTOH OUTPUT BENAR (Eksakta):
{"text":"Sebuah benda bergerak dengan kecepatan awal $5\\\\text{ m/s}$ dan percepatan $2\\\\text{ m/s}^2$. Berapakah kecepatan benda setelah $3\\\\text{ detik}$?","choices":{"a":{"text":"$11\\\\text{ m/s}$","isCorrect":true},"b":{"text":"$12\\\\text{ m/s}$","isCorrect":false},"c":{"text":"$13\\\\text{ m/s}$","isCorrect":false},"d":{"text":"$14\\\\text{ m/s}$","isCorrect":false},"e":{"text":"$15\\\\text{ m/s}$","isCorrect":false}},"answerKey":"a"}`;
  }
  return "";
};

// Sanitasi teks materi agar hemat token dan cepat diproses AI (dibatasi max 5000 karakter)
const cleanMaterialPromptText = (text: string): string => {
  if (!text) return "";
  const cleaned = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return cleaned.length > 5000 ? cleaned.slice(0, 5000) + "\n...[Materi diringkas untuk efisiensi token]" : cleaned;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ Post-Generation Validation
// ═══════════════════════════════════════════════════════════════════════════════

// Strip unwanted LaTeX $ from text when subject is NOT math/physics/chemistry
const stripUnwantedLatex = (text: string, isExactSubject: boolean): string => {
  if (!text || isExactSubject) return text;

  // If the text contains $ signs but subject is not exact, try to clean them
  if (!text.includes('$')) return text;

  // Remove simple $number$ patterns (e.g. "$5$" → "5", "$1945$" → "1945")
  let cleaned = text.replace(/\$(\d[\d.,]*)\$/g, '$1');

  // Remove $simple text$ that doesn't look like real math (no backslash, no ^, no _, no {})
  cleaned = cleaned.replace(/\$([^$\\^_{}]+)\$/g, (match, inner) => {
    // If it's just plain text/numbers without math operators, strip the $
    if (!/[+\-*/=<>]/.test(inner) || /^\d+$/.test(inner.trim())) {
      return inner;
    }
    return match; // Keep it if it looks like actual math
  });

  return cleaned;
};

const validateQuestions = (questions: any[], isExactSubject: boolean = false, requestedType?: string): AIGeneratedQuestion[] => {
  // Helper: unescape double backslashes that may remain after JSON parsing edge cases
  const unescapeLatex = (text: string): string => {
    if (!text) return text;
    // Fix \\frac -> \frac, \\pi -> \pi, etc. (double backslash to single)
    return text.replace(/\\\\([a-zA-Z{}\[\]^_])/g, '\\$1');
  };

  // Helper: auto-wrap bare LaTeX commands in HTML text with $...$
  const wrapLatexInHtml = (html: string): string => {
    if (!html) return html;
    // If already has $ delimiters, just return as-is
    if (html.includes('$')) return html;
    // Look for bare LaTeX commands like \frac, \sin, \sqrt etc. inside HTML text nodes
    // Replace text outside HTML tags that contains LaTeX commands
    return html.replace(/>([^<]+)</g, (match, textContent) => {
      if (!textContent.trim()) return match;
      const hasLatex = /\\[a-zA-Z]+/.test(textContent);
      if (!hasLatex) return match;
      // Wrap segments that look like LaTeX expressions
      const wrapped = textContent.replace(
        /((?:\\[a-zA-Z]+(?:\{[^}]*\})*(?:\^[{^]?[^}\s]+}?)?(?:_[{_]?[^}\s]+}?)?)+)/g,
        '$$$1$$'
      );
      return `>${wrapped}<`;
    });
  };
  return questions.filter(q => {
    // Must have text
    if (!q.text?.trim() && !q.question?.trim()) return false;
    const qType = q.type || requestedType || "pilihan_ganda";

    // For multiple choice: must have at least 2 choices
    if ((qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") && q.choices && typeof q.choices === "object") {
      const keys = Object.keys(q.choices);
      if (keys.length < 2) return false;
      // Ensure answer key exists in choices
      if (q.answerKey && !q.choices[q.answerKey.toLowerCase()]) {
        const correctKey = keys.find(k => q.choices[k]?.isCorrect);
        if (correctKey) q.answerKey = correctKey;
      }
      // Check for duplicate options
      const texts = keys.map(k => q.choices[k]?.text?.toLowerCase?.()?.trim()).filter(Boolean);
      const uniqueTexts = new Set(texts);
      if (uniqueTexts.size < texts.length * 0.7) return false;
    }

    // For menjodohkan: should have pairs (left = premis, right = pasangan kunci)
    if (qType === "menjodohkan") {
      const rawText = q.text || q.question || "";
      const textLines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const listItemsFromText: string[] = [];
      const cleanMainLines: string[] = [];

      for (const line of textLines) {
        const match = line.match(/^([a-zA-Z0-9][.)\-:]\s*)(.+)$/);
        if (match) {
          listItemsFromText.push(match[2].trim());
        } else {
          cleanMainLines.push(line);
        }
      }

      const rawChoiceTexts = q.choices
        ? Object.values(q.choices).map((c: any) => (typeof c === "object" ? (c.text || "") : String(c)).trim()).filter(Boolean)
        : [];

      const hasValidPairs = Array.isArray(q.pairs) && q.pairs.length >= 2 && q.pairs.some((p: any) => p.left?.trim() && p.right?.trim());

      if (!hasValidPairs) {
        const existingPairs = Array.isArray(q.pairs) ? q.pairs : [];
        if (listItemsFromText.length >= 2 && rawChoiceTexts.length >= 2) {
          // Salvage: choices adalah item kiri, baris teks adalah definisi kanan!
          const count = Math.min(listItemsFromText.length, rawChoiceTexts.length);
          q.pairs = [];
          for (let i = 0; i < count; i++) {
            q.pairs.push({
              id: String(i + 1),
              left: rawChoiceTexts[i],
              right: listItemsFromText[i]
            });
          }
          if (cleanMainLines.length > 0) {
            q.text = cleanMainLines.join("\n").replace(/Definisi:?\s*$/i, "").trim() || "Jodohkan setiap istilah berikut dengan definisinya yang tepat:";
          }
        } else if (listItemsFromText.length >= 2) {
          q.pairs = listItemsFromText.map((item, idx) => {
            const rawLeft = existingPairs[idx]?.left?.trim() || "";
            const isNumberMarker = /^\d+[.)\-:]?\s*$/.test(rawLeft);
            return {
              id: String(idx + 1),
              left: (!isNumberMarker && rawLeft) ? rawLeft : (rawChoiceTexts[idx] || `Premis ${idx + 1}`),
              right: item
            };
          });
          if (cleanMainLines.length > 0) {
            q.text = cleanMainLines.join("\n").replace(/Definisi:?\s*$/i, "").trim() || "Jodohkan setiap istilah berikut dengan pasangannya yang tepat:";
          }
        } else if (q.choices && (!q.pairs || q.pairs.length === 0)) {
          const keys = Object.keys(q.choices);
          if (keys.length >= 2) {
            q.pairs = keys.map((k, idx) => ({
              id: String(idx + 1),
              left: (q.choices[k]?.text || k).trim(),
              right: ""
            }));
          }
        }
      }

      if (q.pairs && Array.isArray(q.pairs)) {
        const validPairs = q.pairs.filter((p: any) => p.left?.trim() || p.right?.trim());
        if (validPairs.length >= 2) {
          q.pairs = validPairs.map((p: any, idx: number) => ({
            id: p.id || String(idx + 1),
            left: (p.left || "").trim(),
            right: (p.right || "").trim()
          }));
        } else {
          q.pairs = [];
        }
      } else {
        q.pairs = [];
      }
    }

    // For urutkan/drag_drop: should have items (but allow empty for manual editing)
    if (qType === "urutkan" || qType === "drag_drop") {
      if (q.items && Array.isArray(q.items)) {
        const validItems = q.items.filter((item: any) => item.text?.trim());
        if (validItems.length >= 2) {
          q.items = validItems.map((item: any, idx: number) => ({
            id: item.id || String(idx + 1),
            text: item.text.trim(),
            imageUrl: item.imageUrl || ""
          }));
        } else {
          // Keep items even if incomplete
          q.items = q.items.map((item: any, idx: number) => ({
            id: item.id || String(idx + 1),
            text: (item.text || "").trim(),
            imageUrl: item.imageUrl || ""
          }));
        }
      } else {
        q.items = [];
      }
    }

    // For klasifikasi: must have categories + statements with valid answers
    if (qType === "klasifikasi") {
      let cats = q.categories || q.options?.categories;
      let stmts = q.statements || q.options?.statements;
      if (!Array.isArray(cats) || cats.length < 2) return false;
      if (!Array.isArray(stmts) || stmts.length < 1) return false;

      q.categories = cats.map((c: any, i: number) => {
        if (typeof c === "string") return { id: `c${i + 1}`, text: c.trim() };
        return { id: String(c.id || `c${i + 1}`), text: String(c.text || c.name || "").trim() };
      }).filter((c: any) => c.text);

      if (q.categories.length < 2) return false;

      const catMap = new Map<string, string>();
      q.categories.forEach((c: any) => {
        catMap.set(c.id.toLowerCase(), c.id);
        catMap.set(c.text.toLowerCase(), c.id);
      });

      q.statements = stmts.map((s: any, i: number) => {
        const text = typeof s === "string" ? s.trim() : String(s.text || s.statement || "").trim();
        const rawAns = typeof s === "object" ? String(s.answer || s.category || s.kategori || "").toLowerCase().trim() : "";
        const matchedId = catMap.get(rawAns) || q.categories[0]?.id || "c1";
        return {
          id: String(s.id || `s${i + 1}`),
          text,
          answer: matchedId
        };
      }).filter((s: any) => s.text);

      if (q.statements.length === 0) return false;
    }

    // For matriks: must have columns + statements with valid answers
    if (qType === "matriks") {
      let cols = q.columns || q.options?.columns;
      let stmts = q.statements || q.options?.statements;
      if (!Array.isArray(cols) || cols.length < 2) {
        cols = [{ id: "benar", text: "Benar" }, { id: "salah", text: "Salah" }];
      }
      if (!Array.isArray(stmts) || stmts.length < 1) return false;

      q.columns = cols.map((col: any, i: number) => {
        if (typeof col === "string") {
          const lower = col.toLowerCase();
          const colId = lower.includes("salah") ? "salah" : (lower.includes("benar") ? "benar" : `col${i + 1}`);
          return { id: colId, text: col.trim() };
        }
        return { id: String(col.id || `col${i + 1}`), text: String(col.text || col.name || "").trim() };
      }).filter((c: any) => c.text);

      if (q.columns.length < 2) return false;

      const colMap = new Map<string, string>();
      q.columns.forEach((c: any) => {
        colMap.set(c.id.toLowerCase(), c.id);
        colMap.set(c.text.toLowerCase(), c.id);
      });
      colMap.set("true", "benar");
      colMap.set("false", "salah");

      q.statements = stmts.map((s: any, i: number) => {
        const text = typeof s === "string" ? s.trim() : String(s.text || s.statement || "").trim();
        const rawAns = typeof s === "object" ? String(s.answer || s.jawaban || s.column || "").toLowerCase().trim() : "";
        const matchedId = colMap.get(rawAns) || q.columns[0]?.id || "col1";
        return {
          id: String(s.id || `s${i + 1}`),
          text,
          answer: matchedId
        };
      }).filter((s: any) => s.text);

      if (q.statements.length === 0) return false;
    }

    // For isian_rumpang: must have text with [[n]] + blanks
    if (qType === "isian_rumpang") {
      let txt = String(q.text || q.question || "");
      let blanks = q.blanks || q.options?.blanks;

      txt = txt.replace(/\[(\d+)\](?!\s*\])/g, '[[$1]]');

      if (!/\[\[\d+\]\]/.test(txt)) {
        let bCount = 1;
        txt = txt.replace(/_{3,}|\.{3,}/g, () => `[[${bCount++}]]`);
      }
      q.text = txt;

      if (!/\[\[\d+\]\]/.test(txt)) return false;

      if (!Array.isArray(blanks) || blanks.length === 0) {
        if (blanks && typeof blanks === "object") {
          blanks = Object.keys(blanks).map(k => ({
            id: k,
            answers: Array.isArray(blanks[k]) ? blanks[k] : [String(blanks[k])]
          }));
        } else if (q.answerKey || q.answers) {
          const rawAnswers = String(q.answerKey || q.answers || "").split(",").map((a: string) => a.trim()).filter(Boolean);
          blanks = rawAnswers.map((ans: string, i: number) => ({
            id: String(i + 1),
            answers: [ans]
          }));
        }
      }

      if (Array.isArray(blanks)) {
        q.blanks = blanks.map((b: any, i: number) => {
          let ansList: string[] = [];
          if (Array.isArray(b.answers)) ansList = b.answers.map((a: any) => String(a).trim()).filter(Boolean);
          else if (b.answer) ansList = [String(b.answer).trim()];
          else if (typeof b === "string") ansList = [b.trim()];
          return {
            id: String(b.id || i + 1),
            answers: ansList.length > 0 ? ansList : ["jawaban"],
            caseSensitive: Boolean(b.caseSensitive)
          };
        }).filter((b: any) => b.answers.length > 0);
      }

      if (!q.blanks || q.blanks.length === 0) return false;
    }

    // For isian_singkat: must have answerKey
    if (qType === "isian_singkat" && !q.answerKey?.trim() && !q.answer_key?.trim() && !q.answer?.trim()) return false;

    return true;
  }).map(q => ({
    text: stripUnwantedLatex(unescapeLatex(q.text || q.question || ""), isExactSubject),
    type: q.type || requestedType || "pilihan_ganda",
    choices: (() => {
      const c = q.choices || q.options || undefined;
      const qType = q.type || requestedType || "pilihan_ganda";
      if (c && typeof c === 'object') {
        const cleaned: any = {};
        Object.keys(c).forEach(k => {
          const val = c[k];
          const rawText = typeof val === 'object' ? (val.text || "") : String(val);
          const isCorr = typeof val === 'object' ? !!val.isCorrect : false;
          cleaned[k.toLowerCase()] = {
            ...val,
            text: isExactSubject ? unescapeLatex(rawText) : stripUnwantedLatex(unescapeLatex(rawText), isExactSubject),
            isCorrect: isCorr
          };
        });
        // Jaminan 5 Opsi A-E untuk Pilihan Ganda
        if ((qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") && Object.keys(cleaned).length >= 2) {
          ["a", "b", "c", "d", "e"].forEach(letter => {
            if (!cleaned[letter]) {
              cleaned[letter] = { text: "", isCorrect: false };
            }
          });
        }
        return cleaned;
      }
      return c;
    })(),
    pairs: q.pairs || undefined,
    items: q.items || undefined,
    statements: q.statements || (q.options?.statements ? q.options.statements : undefined),
    categories: q.categories || (q.options?.categories ? q.options.categories : undefined),
    columns: q.columns || (q.options?.columns ? q.options.columns : undefined),
    blanks: q.blanks || (q.options?.blanks ? q.options.blanks : undefined),
    shuffleStatements: q.shuffleStatements !== undefined ? q.shuffleStatements : undefined,
    imageUrl: q.imageUrl || q.image_url || undefined,
    answerKey: q.answerKey || q.answer_key || q.answer || "",
    groupId: q.groupId || "",
    groupText: wrapLatexInHtml(unescapeLatex(q.groupText || ""))
  }));
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 Taxonomy & Thinking Level Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════════
const buildTaxonomyInstruction = (taxonomy: string): string => {
  const levels = taxonomy.split(",").map(s => s.trim()).filter(Boolean);
  const sorted = [...levels].sort();
  const isFull = sorted.join(",") === "C1,C2,C3,C4,C5,C6";
  if (isFull || levels.length === 0) {
    return "TAKSONOMI: Variasi level kognitif C1-C6 (campuran LOTS dan HOTS).";
  }
  if (sorted.join(",") === "C1,C2,C3") {
    return "TAKSONOMI: LOTS (C1-C3: mengingat fakta, memahami, menerapkan). Soal langsung & jelas.";
  }
  if (sorted.join(",") === "C4,C5,C6") {
    return "TAKSONOMI: HOTS (C4-C6: analisis, evaluasi, kreasi). Gunakan konteks/skenario.";
  }
  return `TAKSONOMI: Fokus pada level ${levels.join(", ")}.`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN: Generate Questions with AI (OPTIMIZED)
// - Single API call for literacy (combined stimulus + questions)
// - Parallel batch for large counts (>7)
// - JSON mode for reliable output
// - Modular prompts (only relevant instructions)
// ═══════════════════════════════════════════════════════════════════════════════
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
  focus: string = "umum",
  taxonomy: string = "C1,C2,C3,C4,C5,C6",
  materialReference: string = "",
  objectives: string[] = []
): Promise<AIGeneratedQuestion[]> => {
  // hotspot tidak didukung AI (butuh gambar + koordinat manual)
  if (type === "hotspot") {
    throw new Error("Tipe soal hotspot tidak didukung generator AI karena membutuhkan gambar dan penandaan area manual. Gunakan editor soal di aplikasi.");
  }
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await _generateQuestionsAIInternal(pb, topic, count, level, subject, type, isLiteracy, passageLength, difficulty, focus, taxonomy, materialReference, objectives);
      return result;
    } catch (err: any) {
      lastError = err;
      // Don't retry rate limit errors
      if (err.message?.includes("AI_RATE_LIMIT")) throw err;
      // Don't retry if aborted
      if (err.name === "AbortError") throw err;

      console.warn(`[AI] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}. ${attempt < MAX_RETRIES ? "Retrying..." : "Giving up."}`);

      if (attempt < MAX_RETRIES) {
        // Wait before retry (exponential backoff: 1s, 2s)
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw lastError;
};

const _generateQuestionsAIInternal = async (
  pb: PocketBase,
  topic: string,
  count: number = 5,
  level: string = "Umum",
  subject: string = "",
  type: string = "pilihan_ganda",
  isLiteracy: boolean = false,
  passageLength: string = "sedang",
  difficulty: string = "sedang",
  focus: string = "umum",
  taxonomy: string = "C1,C2,C3,C4,C5,C6",
  materialReference: string = "",
  objectives: string[] = []
): Promise<AIGeneratedQuestion[]> => {
  try {
    const ctx = detectSubjectContext(subject, topic);
    const formatRules = buildFormatRules(ctx);

    console.log(`🚀 [AI ENGINE] Generating ${count} questions | Literacy: ${isLiteracy} | Subject: ${subject}`);

    const typeDesc: Record<string, string> = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi A-E, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah (5 pernyataan, jawab Benar atau Salah)",
      isian_singkat: "Isian Singkat (jawaban 1-3 kata)",
      uraian: "Uraian HOTS (jawaban panjang/essay)",
      menjodohkan: "Menjodohkan/Matching (pasangkan item kiri dengan kanan)",
      urutkan: "Mengurutkan/Sequencing (susun item dalam urutan benar)",
      drag_drop: "Drag & Drop (susun/kelompokkan item ke posisi benar)",
      matriks: "Matriks (tabel pernyataan x kolom Benar/Salah)",
      isian_rumpang: "Isian Rumpang/Cloze (lengkapi kata yang hilang dalam teks)"
    };
    const typeLabel = typeDesc[type] || "Pilihan Ganda";

    // ═══ PARALLEL BATCH for large counts (>12 soal) ═══
    if (count > 12 && !isLiteracy) {
      const batchSize = Math.ceil(count / 2);
      const batches = [batchSize, count - batchSize];
      console.log(`⚡ [PARALLEL] Splitting ${count} into batches: ${batches.join(', ')}`);

      const results = await Promise.allSettled(
        batches.map(batchCount =>
          generateQuestionsAI(pb, topic, batchCount, level, subject, type, false, passageLength, difficulty, focus, taxonomy, materialReference, objectives)
        )
      );

      const allQuestions: AIGeneratedQuestion[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") allQuestions.push(...result.value);
      }

      if (allQuestions.length === 0) throw new Error("Semua batch gagal menghasilkan soal.");
      return allQuestions;
    }

    // ═══ SINGLE COMBINED CALL for Literacy ═══
    if (isLiteracy) {
      const lengthMap: Record<string, string> = {
        pendek: "1-2 paragraf (150-250 kata)",
        sedang: "2-4 paragraf (300-500 kata)",
        panjang: "4-6 paragraf (600-900 kata)"
      };

      const fewShotLit = getFewShotExample(ctx);

      // Build type-specific output format for literacy mode
      const getLiteracyTypeFormat = (questionType: string): string => {
        switch (questionType) {
          case "pilihan_ganda":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"pertanyaan","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":true},"c":{"text":"...","isCorrect":false},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"b"}]}`;
          case "pilihan_ganda_kompleks":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"pertanyaan","type":"pilihan_ganda_kompleks","choices":{"a":{"text":"...","isCorrect":true},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"a,c"}]}`;
          case "benar_salah":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"<pernyataan>","type":"benar_salah","choices":{"a":{"text":"Benar","isCorrect":true},"b":{"text":"Salah","isCorrect":false}},"answerKey":"a"}]}`;
          case "isian_singkat":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"pertanyaan","type":"isian_singkat","answerKey":"jawaban singkat"}]}`;
          case "uraian":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"pertanyaan HOTS","type":"uraian","answerKey":"pedoman penilaian"}]}`;
          case "menjodohkan":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Jodohkan item berikut berdasarkan bacaan:","type":"menjodohkan","pairs":[{"id":"1","left":"...","right":"..."},{"id":"2","left":"...","right":"..."},{"id":"3","left":"...","right":"..."},{"id":"4","left":"...","right":"..."}],"answerKey":"1-1,2-2,3-3,4-4"}]}`;
          case "urutkan":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Urutkan berdasarkan bacaan:","type":"urutkan","items":[{"id":"1","text":"..."},{"id":"2","text":"..."},{"id":"3","text":"..."},{"id":"4","text":"..."}],"answerKey":"1,2,3,4"}]}`;
          case "drag_drop":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Susun item berdasarkan bacaan:","type":"drag_drop","items":[{"id":"1","text":"..."},{"id":"2","text":"..."},{"id":"3","text":"..."},{"id":"4","text":"..."}],"answerKey":"1,2,3,4"}]}`;
          case "klasifikasi":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Tentukan kategori yang sesuai untuk setiap pernyataan berdasarkan bacaan:","type":"klasifikasi","categories":[{"id":"c1","text":"..."},{"id":"c2","text":"..."},{"id":"c3","text":"..."}],"statements":[{"id":"s1","text":"...","answer":"c1"},{"id":"s2","text":"...","answer":"c2"},{"id":"s3","text":"...","answer":"c3"}],"shuffleStatements":true,"answerKey":""}]}`;
          case "matriks":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Tentukan Benar atau Salah untuk setiap pernyataan berdasarkan bacaan:","type":"matriks","columns":[{"id":"benar","text":"Benar"},{"id":"salah","text":"Salah"}],"statements":[{"id":"s1","text":"...","answer":"benar"},{"id":"s2","text":"...","answer":"salah"}],"answerKey":""}]}`;
          case "isian_rumpang":
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"Lengkapi bagian yang hilang: ... [[1]] ... [[2]] ...","type":"isian_rumpang","blanks":[{"id":"1","answers":["..."],"caseSensitive":false},{"id":"2","answers":["..."],"caseSensitive":false}],"answerKey":""}]}`;
          default:
            return `{"groupText":"<HTML stimulus lengkap>","groupId":"LIT-001","questions":[{"text":"pertanyaan","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":true},"c":{"text":"...","isCorrect":false},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"b"}]}`;
        }
      };

      const litTypeFormat = getLiteracyTypeFormat(type);
      const litTypeInstructions = (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks")
        ? "Opsi A-E ringkas & logis. Kunci jawaban acak."
        : (type === "menjodohkan" ? "Buat 4-6 pasangan yang logis berdasarkan stimulus."
          : (type === "urutkan" || type === "drag_drop") ? "Buat 4-6 item yang harus disusun berdasarkan stimulus."
            : "");

      const taxonomyInstruction = buildTaxonomyInstruction(taxonomy);
      const objectivesSection = objectives.length > 0 ? `\nTUJUAN PEMBELAJARAN (soal WAJIB mengukur pencapaian tujuan ini):\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n` : "";

      // Sanitasi dan optimasi teks referensi materi
      const cleanMaterial = cleanMaterialPromptText(materialReference);
      const hasMaterial = cleanMaterial.length > 10;
      const stimulusInstruction = hasMaterial
        ? `1. Buat stimulus/literasi berdasarkan MATERI REFERENSI yang diberikan, sepanjang ${lengthMap[passageLength] || lengthMap.sedang}. Olah materi menjadi artikel/studi kasus menarik yang memuat fakta & informasi dari materi. WAJIB menyinggung isi materi referensi. Format HTML: <h2 style="text-align:center;color:#1e3a8a;margin-bottom:32px;font-weight:900;">[JUDUL]</h2> lalu <p style="text-indent:30px;margin-bottom:24px;line-height:1.8;text-align:justify;">paragraf</p>.`
        : `1. Buat stimulus/literasi bertema "${topic}" sepanjang ${lengthMap[passageLength] || lengthMap.sedang}. Sajikan sebagai artikel/studi kasus menarik (bukan definisi). Format HTML: <h2 style="text-align:center;color:#1e3a8a;margin-bottom:32px;font-weight:900;">[JUDUL]</h2> lalu <p style="text-indent:30px;margin-bottom:24px;line-height:1.8;text-align:justify;">paragraf</p>.`;

      const systemPrompt = `Spesialis Evaluasi Pendidikan: Buat stimulus literasi + ${count} soal ${typeLabel}.
Jenjang: ${level}, Mapel: ${subject}, Kesulitan: ${difficulty}.
${taxonomyInstruction}
${objectivesSection}INSTRUKSI:
${stimulusInstruction}
2. Buat ${count} soal ${typeLabel} berdasarkan stimulus.${hasMaterial ? " Menguji pemahaman materi referensi." : ""} ${litTypeInstructions}

STANDAR KUALITAS:
- Stem kontekstual & lugas menguji pemahaman bacaan.
- Pengecoh masuk akal (miskonsepsi siswa). Panjang opsi A-E seimbang.
- Kunci jawaban akurat berdasarkan bacaan.
${formatRules ? `\nFORMAT:\n${formatRules}` : ""}${fewShotLit ? `\n${fewShotLit}` : ""}

OUTPUT JSON:
${litTypeFormat}
Hanya JSON. Pastikan stimulus selesai sempurna.`;

      const materialSection = hasMaterial ? `MATERI REFERENSI (WAJIB jadi dasar stimulus & soal):\n${cleanMaterial}\n\n` : "";
      const topicLower = topic.toLowerCase();
      const isTopicInstruction = topic.length > 50 || topicLower.includes('buat') || topicLower.includes('berikan');
      const userPrompt = isTopicInstruction
        ? `${materialSection}INSTRUKSI: ${topic}\nBuat stimulus berdasarkan materi + ${count} soal sesuai instruksi di atas.`
        : `${materialSection}Topik: "${topic}". Buat stimulus literasi${hasMaterial ? " berdasarkan materi referensi di atas" : ""} + ${count} soal ${typeLabel}.`;

      // Token estimation: stimulus + questions combined (lean & optimized)
      const stimulusTokens = ({ pendek: 500, sedang: 900, panjang: 1500 }[passageLength] || 900);
      const questionTokens = count * (ctx.isReligious || ctx.explicitlyWantsArabic ? 500 : 320);
      const totalTokens = Math.min(stimulusTokens + questionTokens + 250, 6144);

      const content = await fetchAI({
        pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        maxTokens: totalTokens, temperature: 0.6
      });

      const parsed = robustJSONParse(content);
      const groupText = parsed.groupText || parsed.stimulus || parsed.wacana || "";
      const groupId = `LIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);

      if (questionsRaw.length === 0 && parsed.text) questionsRaw = [parsed];

      const validated = validateQuestions(questionsRaw, ctx.isExact || ctx.isChemistry, type);
      if (validated.length === 0) throw new Error("AI tidak menghasilkan soal yang valid.");

      return validated.map(q => ({ ...q, groupId, groupText }));
    }

    // ═══ STANDARD (Non-Literacy) Generation ═══
    const fewShot = getFewShotExample(ctx);

    // Build type-specific output format instructions
    const getTypeOutputFormat = (questionType: string): string => {
      switch (questionType) {
        case "pilihan_ganda":
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}]}`;
        case "pilihan_ganda_kompleks":
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"pilihan_ganda_kompleks","choices":{"a":{"text":"...","isCorrect":true},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"a,c"}]}
CATATAN: Lebih dari 1 jawaban benar (2-3 jawaban benar). answerKey berisi huruf-huruf benar dipisah koma.`;
        case "benar_salah":
          return `OUTPUT JSON: {"questions":[{"text":"<p>Pernyataan yang harus dinilai Benar atau Salah</p>","type":"benar_salah","choices":{"a":{"text":"Benar","isCorrect":true},"b":{"text":"Salah","isCorrect":false}},"answerKey":"a"}]}
CATATAN: Setiap soal adalah PERNYATAAN yang harus dinilai Benar atau Salah. Choices hanya 2: a=Benar, b=Salah. Variasi jawaban benar/salah.`;
        case "isian_singkat":
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"isian_singkat","answerKey":"jawaban singkat 1-3 kata"}]}
CATATAN: Tidak ada choices. answerKey berisi jawaban singkat (1-3 kata). Soal harus punya jawaban pasti dan jelas.`;
        case "uraian":
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"uraian","answerKey":"Pedoman penilaian: (1) poin pertama (2) poin kedua (3) poin ketiga"}]}
CATATAN: Tidak ada choices. answerKey berisi pedoman/rubrik penilaian singkat. Soal bersifat HOTS (analisis, evaluasi, kreasi).`;
        case "menjodohkan":
          return `OUTPUT JSON: {"questions":[{"text":"Jodohkan item di kolom kiri dengan pasangannya di kolom kanan.","type":"menjodohkan","pairs":[{"id":"1","left":"Item kiri 1","right":"Pasangan kanan 1"},{"id":"2","left":"Item kiri 2","right":"Pasangan kanan 2"},{"id":"3","left":"Item kiri 3","right":"Pasangan kanan 3"},{"id":"4","left":"Item kiri 4","right":"Pasangan kanan 4"},{"id":"5","left":"Item kiri 5","right":"Pasangan kanan 5"}],"answerKey":"1-1,2-2,3-3,4-4,5-5"}]}
CATATAN: Setiap soal memiliki 4-6 pasangan (pairs). "left" adalah item/pertanyaan, "right" adalah jawaban/pasangannya. Buat pasangan yang logis dan edukatif.`;
        case "urutkan":
          return `OUTPUT JSON: {"questions":[{"text":"Urutkan langkah-langkah berikut dengan benar:","type":"urutkan","items":[{"id":"1","text":"Langkah pertama"},{"id":"2","text":"Langkah kedua"},{"id":"3","text":"Langkah ketiga"},{"id":"4","text":"Langkah keempat"},{"id":"5","text":"Langkah kelima"}],"answerKey":"1,2,3,4,5"}]}
CATATAN: items berisi 4-6 item yang harus diurutkan. Urutan dalam array "items" adalah URUTAN BENAR. answerKey berisi urutan ID yang benar. Buat soal tentang proses/tahapan/kronologi.`;
        case "drag_drop":
          return `OUTPUT JSON: {"questions":[{"text":"Kelompokkan/susun item berikut ke posisi yang benar:","type":"drag_drop","items":[{"id":"1","text":"Item pertama"},{"id":"2","text":"Item kedua"},{"id":"3","text":"Item ketiga"},{"id":"4","text":"Item keempat"},{"id":"5","text":"Item kelima"}],"answerKey":"1,2,3,4,5"}]}
CATATAN: items berisi 4-6 item yang harus disusun/dikelompokkan. Urutan dalam array "items" adalah URUTAN BENAR. Buat soal tentang klasifikasi/pengelompokan/penyusunan.`;
        case "klasifikasi":
          return `OUTPUT JSON: {"questions":[{"text":"Tentukan kategori yang sesuai untuk setiap pernyataan berikut:","type":"klasifikasi","categories":[{"id":"c1","text":"Kategori A"},{"id":"c2","text":"Kategori B"},{"id":"c3","text":"Kategori C"}],"statements":[{"id":"s1","text":"Pernyataan pertama","answer":"c1"},{"id":"s2","text":"Pernyataan kedua","answer":"c2"},{"id":"s3","text":"Pernyataan ketiga","answer":"c3"},{"id":"s4","text":"Pernyataan keempat","answer":"c1"}],"shuffleStatements":true,"answerKey":""}]}
CATATAN: categories berisi 2-4 kategori. statements berisi 3-5 pernyataan, masing-masing punya "answer" berupa id kategori yang benar. Kategori boleh dipakai berulang. "text" adalah instruksi soal.`;
        case "matriks":
          return `OUTPUT JSON: {"questions":[{"text":"Tentukan Benar atau Salah untuk setiap pernyataan berikut:","type":"matriks","columns":[{"id":"benar","text":"Benar"},{"id":"salah","text":"Salah"}],"statements":[{"id":"s1","text":"Pernyataan pertama","answer":"benar"},{"id":"s2","text":"Pernyataan kedua","answer":"salah"},{"id":"s3","text":"Pernyataan ketiga","answer":"benar"}],"answerKey":""}]}
CATATAN: columns berisi 2-3 kolom opsi (mis. Benar/Salah atau Ya/Tidak). statements berisi 3-5 pernyataan, masing-masing punya "answer" berupa id kolom yang benar.`;
        case "isian_rumpang":
          return `OUTPUT JSON: {"questions":[{"text":"Bacalah teks berikut lalu lengkapi bagian yang hilang: Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]].","type":"isian_rumpang","blanks":[{"id":"1","answers":["Jakarta"],"caseSensitive":false},{"id":"2","answers":["Rupiah","Rp"],"caseSensitive":false}],"answerKey":""}]}
CATATAN: Tulis "text" sebagai kalimat/paragraf dengan [[1]], [[2]], dst untuk bagian rumpang. "blanks" berisi kunci tiap rumpang; "answers" boleh lebih dari 1 (jawaban alternatif). caseSensitive false berarti tidak peka huruf besar/kecil.`;
        default:
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}]}`;
      }
    };

    const typeOutputFormat = getTypeOutputFormat(type);

    const taxonomyInstruction = buildTaxonomyInstruction(taxonomy);
    const cleanMaterial = cleanMaterialPromptText(materialReference);
    const hasMaterial = cleanMaterial.length > 10;
    const objectivesSection = objectives.length > 0 ? `\nTUJUAN PEMBELAJARAN (soal WAJIB mengukur pencapaian tujuan ini):\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n` : "";

    const systemPrompt = `Buat ${count} soal ${typeLabel}, ${level} - ${subject}, kesulitan ${difficulty}.
${taxonomyInstruction}
${objectivesSection}${hasMaterial ? "Soal WAJIB berdasarkan materi referensi.\n" : ""}Variasi stem.${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? " Opsi A-E ringkas & logis, kunci acak." : ""}

STANDAR KUALITAS:
- Pokok soal kontekstual & tidak multitafsir.
- Pengecoh masuk akal (miskonsepsi siswa), bukan asal-asalan.
- Panjang opsi A-E seimbang (kunci tidak mencolok). Kunci jawaban akurat.
${formatRules ? `\n${formatRules}\n` : ""}${fewShot ? `\n${fewShot}\n` : ""}
${typeOutputFormat}
Hanya JSON.`;

    const materialSection = hasMaterial ? `MATERI REFERENSI (soal WAJIB berdasarkan isi materi ini):\n${cleanMaterial}\n\n` : "";
    const topicLower = topic.toLowerCase();
    const isTopicInstruction = topic.length > 50 || topic.includes(',') || topicLower.includes('buat') || topicLower.includes('berikan') || topicLower.includes('pakai');

    const userPrompt = isTopicInstruction
      ? `${materialSection}INSTRUKSI PENGGUNA: ${topic}\nBuat ${count} soal ${typeLabel}, ${level} - ${subject}. Soal harus menyinggung isi materi.`
      : `${materialSection}Topik: "${topic}". Buat ${count} soal ${typeLabel}, ${level} - ${subject}.${hasMaterial ? " Soal WAJIB berdasarkan & menyinggung isi materi referensi di atas." : " Variasi panjang stem & tipe pertanyaan."}`;

    // Token estimation: tailored & lean per question type
    const typeTokensMap: Record<string, number> = {
      pilihan_ganda: 320,
      pilihan_ganda_kompleks: 360,
      benar_salah: 220,
      isian_singkat: 160,
      uraian: 280,
      menjodohkan: 350,
      urutkan: 300,
      drag_drop: 300,
      klasifikasi: 350,
      matriks: 300,
      isian_rumpang: 280
    };
    const basePerQuestion = (typeTokensMap[type] || 320) + (ctx.isReligious || ctx.explicitlyWantsArabic ? 250 : 0);
    const maxTokens = Math.min(Math.max(count * basePerQuestion + 250, 1000), 5120);

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      maxTokens, temperature: 0.6
    });

    const parsed = robustJSONParse(content);
    let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    if (questionsRaw.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
      questionsRaw = [parsed];
    }

    const validated = validateQuestions(questionsRaw, ctx.isExact || ctx.isChemistry, type);
    if (validated.length === 0) throw new Error("Format soal tidak valid.");
    return validated;

  } catch (err: any) {
    console.error("AI Generation Error:", err);
    throw err;
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 Generate Single Question (for regeneration)
// ═══════════════════════════════════════════════════════════════════════════════
export const generateSingleQuestionAI = async (
  pb: PocketBase,
  topic: string,
  type: string = "pilihan_ganda",
  level: string = "Umum",
  subject: string = "",
  difficulty: string = "sedang",
  focus: string = "akm",
  existingLiterasi: string = ""
): Promise<AIGeneratedQuestion> => {
  if (type === "hotspot") {
    throw new Error("Tipe soal hotspot tidak didukung generator AI karena membutuhkan gambar dan penandaan area manual. Gunakan editor soal di aplikasi.");
  }
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _generateSingleQuestionInternal(pb, topic, type, level, subject, difficulty, focus, existingLiterasi);
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes("AI_RATE_LIMIT")) throw err;
      console.warn(`[AI Single] Attempt ${attempt}/${MAX_RETRIES} failed. ${attempt < MAX_RETRIES ? "Retrying..." : ""}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
};

const _generateSingleQuestionInternal = async (
  pb: PocketBase,
  topic: string,
  type: string = "pilihan_ganda",
  level: string = "Umum",
  subject: string = "",
  difficulty: string = "sedang",
  focus: string = "akm",
  existingLiterasi: string = ""
): Promise<AIGeneratedQuestion> => {
  try {
    const ctx = detectSubjectContext(subject, topic);
    const formatRules = buildFormatRules(ctx);

    const typeDesc: Record<string, string> = {
      pilihan_ganda: "Pilihan Ganda Tunggal (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (5 opsi, >1 benar)",
      benar_salah: "Benar/Salah (pernyataan, jawab Benar atau Salah)",
      isian_singkat: "Isian Singkat (jawaban 1-3 kata)",
      uraian: "Uraian HOTS (jawaban essay)",
      menjodohkan: "Menjodohkan/Matching (4-6 pasangan kiri-kanan)",
      urutkan: "Mengurutkan/Sequencing (4-6 item disusun urut)",
      drag_drop: "Drag & Drop (4-6 item disusun/dikelompokkan)",
      matriks: "Matriks (tabel pernyataan x kolom opsi)",
      isian_rumpang: "Isian Rumpang/Cloze (lengkapi kata hilang dalam teks)"
    };
    const typeLabel = typeDesc[type] || "Pilihan Ganda";

    // Build type-specific JSON format for single question
    const getSingleTypeFormat = (questionType: string): string => {
      switch (questionType) {
        case "pilihan_ganda":
          return `JSON:{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}`;
        case "pilihan_ganda_kompleks":
          return `JSON:{"text":"...","type":"pilihan_ganda_kompleks","choices":{"a":{"text":"...","isCorrect":true},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"a,c"}`;
        case "benar_salah":
          return `JSON:{"text":"<pernyataan>","type":"benar_salah","choices":{"a":{"text":"Benar","isCorrect":true},"b":{"text":"Salah","isCorrect":false}},"answerKey":"a"}`;
        case "isian_singkat":
          return `JSON:{"text":"...","type":"isian_singkat","answerKey":"jawaban singkat"}`;
        case "uraian":
          return `JSON:{"text":"...","type":"uraian","answerKey":"pedoman penilaian"}`;
        case "menjodohkan":
          return `JSON:{"text":"Jodohkan item berikut:","type":"menjodohkan","pairs":[{"id":"1","left":"...","right":"..."},{"id":"2","left":"...","right":"..."},{"id":"3","left":"...","right":"..."},{"id":"4","left":"...","right":"..."}],"answerKey":"1-1,2-2,3-3,4-4"}`;
        case "urutkan":
          return `JSON:{"text":"Urutkan berikut:","type":"urutkan","items":[{"id":"1","text":"..."},{"id":"2","text":"..."},{"id":"3","text":"..."},{"id":"4","text":"..."}],"answerKey":"1,2,3,4"}`;
        case "drag_drop":
          return `JSON:{"text":"Susun item berikut:","type":"drag_drop","items":[{"id":"1","text":"..."},{"id":"2","text":"..."},{"id":"3","text":"..."},{"id":"4","text":"..."}],"answerKey":"1,2,3,4"}`;
        case "klasifikasi":
          return `JSON:{"text":"Tentukan kategori yang sesuai:","type":"klasifikasi","categories":[{"id":"c1","text":"..."},{"id":"c2","text":"..."}],"statements":[{"id":"s1","text":"...","answer":"c1"},{"id":"s2","text":"...","answer":"c2"}],"shuffleStatements":true,"answerKey":""}`;
        case "matriks":
          return `JSON:{"text":"Tentukan Benar/Salah:","type":"matriks","columns":[{"id":"benar","text":"Benar"},{"id":"salah","text":"Salah"}],"statements":[{"id":"s1","text":"...","answer":"benar"},{"id":"s2","text":"...","answer":"salah"}],"answerKey":""}`;
        case "isian_rumpang":
          return `JSON:{"text":"... [[1]] ... [[2]] ...","type":"isian_rumpang","blanks":[{"id":"1","answers":["..."],"caseSensitive":false},{"id":"2","answers":["..."],"caseSensitive":false}],"answerKey":""}`;
        default:
          return `JSON:{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}`;
      }
    };

    const typeFormat = getSingleTypeFormat(type);

    const systemPrompt = `Buat 1 soal ${typeLabel}, ${level} - ${subject}, kesulitan ${difficulty}.
STANDAR KUALITAS SOAL:
- Pokok soal (stem) harus lugas dan kontekstual.
- Pilihan pengecoh WAJIB masuk akal dan mencerminkan miskonsepsi umum siswa, bukan jawaban asal-asalan.
- Panjang opsi harus seimbang. Kunci jawaban tidak boleh tampak paling mencolok atau paling panjang.
- Pastikan kunci jawaban mutlak benar.
${formatRules ? `\nFORMAT: ${formatRules}` : ""}${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? " Opsi A-E ringkas & logis. Kunci jawaban acak." : ""}
${typeFormat}
Hanya JSON.`;

    const userPrompt = existingLiterasi
      ? `STIMULUS LITERASI:\n${existingLiterasi}\n\nBuat 1 soal ${typeLabel} baru dari stimulus di atas. Jangan tanya definisi. Variasi bentuk pertanyaan.`
      : `Topik: "${topic}". Buat 1 soal ${typeLabel}. Variasi bentuk pertanyaan.`;

    const maxTokens = ctx.isReligious ? 850 : (type === "menjodohkan" || type === "urutkan" || type === "drag_drop" || type === "uraian" || type === "klasifikasi" || type === "matriks" || type === "isian_rumpang") ? 700 : 500;

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      maxTokens, temperature: 0.6
    });

    const result = robustJSONParse(content);
    const isExact = ctx.isExact || ctx.isChemistry;
    return {
      text: stripUnwantedLatex(result.text || result.question || "", isExact),
      type: result.type || type,
      choices: (() => {
        const c = result.choices || result.options || {};
        if (c && typeof c === 'object' && Object.keys(c).length > 0) {
          const cleaned: any = {};
          Object.keys(c).forEach(k => {
            const val = c[k];
            if (typeof val === 'string') {
              cleaned[k] = { text: stripUnwantedLatex(val, isExact), isCorrect: false };
            } else if (val && typeof val === 'object') {
              cleaned[k] = { ...val, text: stripUnwantedLatex(val.text || String(val) || "", isExact) };
            }
          });
          return cleaned;
        }
        return c;
      })(),
      pairs: result.pairs,
      items: result.items,
      categories: result.categories || (result.options?.categories ? result.options.categories : undefined),
      statements: result.statements || (result.options?.statements ? result.options.statements : undefined),
      columns: result.columns || (result.options?.columns ? result.options.columns : undefined),
      blanks: result.blanks || (result.options?.blanks ? result.options.blanks : undefined),
      shuffleStatements: result.shuffleStatements !== undefined ? result.shuffleStatements : undefined,
      answerKey: result.answerKey || result.answer_key || result.correctAnswer || "",
      groupId: "",
      groupText: existingLiterasi
    };
  } catch (err: any) {
    console.error("AI Single Gen Error:", err);
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💡 Topic Suggestions
// ═══════════════════════════════════════════════════════════════════════════════
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
    const literasiNote = isLiteracy ? " (topik kaya teks bacaan)" : "";
    const systemPrompt = `Anda adalah ahli kurikulum pendidikan Indonesia. Berikan topik/materi pelajaran sesuai kurikulum. Topik berupa NAMA MATERI/BAB (bukan judul soal). Contoh: "Pengenalan Algoritma Dasar", "Operasi Hitung Pecahan".
Output JSON: {"topics":["...","..."]}`;

    const userPrompt = `Berikan 5 topik untuk ${level} - ${subject}, kesulitan ${difficulty}, standar ${focus}.${literasiNote}`;

    const content = await fetchAI({
      pb, messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 200, temperature: 0.7
    });

    const parsed = robustJSONParse(content);
    const rawTopics = parsed.topics || parsed.data || (Array.isArray(parsed) ? parsed : []);

    return rawTopics.map((t: any) => {
      if (typeof t === "string") return t;
      if (typeof t === "object" && t !== null) {
        return t.nama || t.topic || t.topik || t.text || t.title || t.name || Object.values(t).find((v: any) => typeof v === "string" && v.length > 3) || "";
      }
      return String(t);
    }).filter((s: string) => s.length > 0).slice(0, 5);
  } catch (err: any) {
    if (err.message?.includes("AI_RATE_LIMIT")) return ["AI_RATE_LIMIT"];
    console.error("AI Suggestion Error:", err);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 Generate Learning Objectives (Tujuan Pembelajaran) based on Topic + Taxonomy
// ═══════════════════════════════════════════════════════════════════════════════
export const generateObjectivesAI = async (
  pb: PocketBase,
  topic: string,
  taxonomy: string[],
  level: string = "Umum",
  subject: string = "",
  materialReference: string = ""
): Promise<string[]> => {
  try {
    const taxonomyMap: Record<string, string> = {
      C1: "Mengingat", C2: "Memahami", C3: "Menerapkan",
      C4: "Menganalisis", C5: "Mengevaluasi", C6: "Mencipta"
    };

    const sorted = [...taxonomy].sort();
    const selectedLevels = sorted.map(c => `${c} (${taxonomyMap[c] || c})`).join(", ");

    // Detect fase from level
    const levelLower = level.toLowerCase();
    let fase = "";
    if (levelLower.includes("sd") || levelLower.includes("mi")) {
      if (/[1-2]/.test(levelLower)) fase = "Fase A";
      else if (/[3-4]/.test(levelLower)) fase = "Fase B";
      else fase = "Fase C";
    } else if (levelLower.includes("smp") || levelLower.includes("mts")) {
      fase = "Fase D";
    } else if (levelLower.includes("sma") || levelLower.includes("smk") || levelLower.includes("ma")) {
      if (/1[0-1]/.test(levelLower)) fase = "Fase E";
      else fase = "Fase F";
    }
    const faseInfo = fase ? ` (${fase} Kurikulum Merdeka)` : "";

    const materialContext = materialReference && materialReference.trim().length > 20
      ? `\nBahan Materi (gunakan sebagai konteks):\n${materialReference.substring(0, 1500)}\n` : "";

    const systemPrompt = `Anda adalah ahli kurikulum pendidikan Indonesia. Buat tujuan pembelajaran (indikator soal) yang spesifik dan terukur.
WAJIB buat 1 tujuan untuk SETIAP level taksonomi yang diminta. Format: "C[n]: Peserta didik mampu [kata kerja operasional] ..."
Kata kerja operasional Bloom:
- C1 (Mengingat): menyebutkan, mendefinisikan, mengidentifikasi, mengenali
- C2 (Memahami): menjelaskan, membedakan, menafsirkan, merangkum, memberi contoh
- C3 (Menerapkan): menghitung, menggunakan, menerapkan, melaksanakan, menyelesaikan
- C4 (Menganalisis): menganalisis, membandingkan, mengurai, menemukan hubungan, mengkategorikan
- C5 (Mengevaluasi): menilai, mengkritisi, mempertimbangkan, menyimpulkan, memutuskan
- C6 (Mencipta): merancang, merumuskan, menghasilkan, menyusun, mengembangkan

Output JSON: {"objectives":["C1: Peserta didik mampu ...","C4: Peserta didik mampu ..."]}
Buat tepat ${sorted.length} tujuan (1 per level). Singkat, jelas, terukur, relevan dengan topik/materi.`;

    const userPrompt = `Topik: "${topic}"
Jenjang: ${level}${faseInfo}
Mapel: ${subject || "Umum"}
Level Taksonomi yang diminta: ${selectedLevels}
${materialContext}
Buat tujuan pembelajaran/indikator soal untuk SETIAP level taksonomi di atas.`;

    const content = await fetchAI({
      pb, messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 400, temperature: 0.6
    });

    const parsed = robustJSONParse(content);
    const raw = parsed.objectives || parsed.tujuan || parsed.data || (Array.isArray(parsed) ? parsed : []);

    return raw.map((t: any) => typeof t === "string" ? t : (t.text || t.objective || t.tujuan || String(t)))
      .filter((s: string) => s.length > 5)
      .slice(0, 6);
  } catch (err: any) {
    if (err.message?.includes("AI_RATE_LIMIT")) return [];
    console.error("AI Objectives Error:", err);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 Parse/Extract Questions from Raw Text (AI-powered)
// ═══════════════════════════════════════════════════════════════════════════════
export const parseQuestionsAI = async (
  pb: PocketBase,
  rawText: string,
  subject: string = "",
  level: string = "Umum"
): Promise<AIGeneratedQuestion[]> => {
  try {
    const ctx = detectSubjectContext(subject, rawText);
    const formatRules = buildFormatRules(ctx);

    const systemPrompt = `Anda adalah Ahli Digitalisasi Dokumen Pendidikan.
Tugas: Ekstrak semua soal dari teks mentah menjadi JSON valid.

KETENTUAN:
1. LITERASI: Jika ada teks bacaan untuk beberapa soal → letakkan di "groupText" dengan "groupId" unik.
2. IDENTIFIKASI soal & opsi (a-e). Deteksi kunci jawaban dari bold/bintang/warna.
3. TIPE: pilihan_ganda (default), pilihan_ganda_kompleks, benar_salah, isian_singkat, uraian.
4. JANGAN gunakan markdown. Gunakan <strong> untuk penekanan.
${formatRules ? `5. KONVERSI RUMUS:\n${formatRules}` : ""}

JSON: {"questions":[{"text":"...","type":"pilihan_ganda","groupId":"","groupText":"","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":true},...},"answerKey":"b"}]}
Pastikan JSON valid. Di JSON, backslash ditulis ganda.`;

    const userPrompt = `INPUT DOKUMEN (${subject} - ${level}):\n\n${rawText}\n\nEkstrak soal-soal. WAJIB konversi semua rumus/angka+satuan ke format LaTeX $...$. Jangan memaksa literasi jika soal mandiri. Pastikan kunci jawaban akurat.`;

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.1 // Low temp for precise extraction
    });

    const parsed = robustJSONParse(content);
    let questionsRaw: any[] = [];

    // Support various AI output formats
    if (parsed.literasi && Array.isArray(parsed.literasi)) {
      parsed.literasi.forEach((group: any) => {
        const groupId = group.judul || `LIT-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const groupText = group.teks || "";
        if (Array.isArray(group.soal)) {
          group.soal.forEach((s: any) => {
            const choices: any = {};
            if (s.opsi) {
              Object.entries(s.opsi).forEach(([key, val]) => {
                choices[key.toLowerCase()] = { text: String(val), isCorrect: String(key).toLowerCase() === String(s.jawaban).toLowerCase() };
              });
            }
            questionsRaw.push({ text: s.soal || s.text || "", type: "pilihan_ganda", groupId, groupText, choices });
          });
        }
      });
    } else {
      questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    }

    if (questionsRaw.length === 0) throw new Error("AI tidak menemukan butir soal dalam teks tersebut.");
    return validateQuestions(questionsRaw, ctx.isExact || ctx.isChemistry);
  } catch (err: any) {
    if (err.message?.includes("maximum context length")) {
      throw new Error("Teks terlalu panjang. Silakan masukkan beberapa soal saja per sekali proses.");
    }
    console.error("AI Parser Error:", err);
    throw err;
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 Test AI Connection
// ═══════════════════════════════════════════════════════════════════════════════
export const testAIConnection = async (
  pb: PocketBase,
  apiKey: string,
  modelId: string,
  customUrl?: string,
  _provider?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const actualModelDef = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];
    if (!apiKey?.trim()) throw new Error("API Key / Token belum diisi.");

    const isAnthropic = isAnthropicEndpoint(customUrl, apiKey);
    const baseUrl = resolveCleanUrl(customUrl, isAnthropic);
    const finalModel = modelId?.trim() || (isAnthropic ? "claude-3-5-sonnet-20241022" : actualModelDef.id);
    if (!finalModel) throw new Error("ID Model belum diisi.");

    const isLocalOrLAN = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes(":11434");
    const useProxy = isLocalOrLAN;

    let response;
    if (isAnthropic) {
      const headers = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      };
      const body = JSON.stringify({
        model: finalModel,
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }]
      });

      if (!useProxy) {
        try {
          response = await fetch(baseUrl, { method: "POST", headers, body });
        } catch {
          response = await fetch(pb.baseUrl + "/api/ai-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
            body: JSON.stringify({
              baseUrl,
              apiKey,
              model: finalModel,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 10,
              isAnthropic: true
            })
          });
        }
      } else {
        response = await fetch(pb.baseUrl + "/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
          body: JSON.stringify({
            baseUrl,
            apiKey,
            model: finalModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 10,
            isAnthropic: true
          })
        });
      }
    } else {
      // OpenAI Compatible
      const headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
      const body = JSON.stringify({ model: finalModel, messages: [{ role: "user", content: "hi" }], max_tokens: 5 });

      if (!useProxy) {
        try {
          response = await fetch(baseUrl, { method: "POST", headers, body });
        } catch (directErr) {
          response = await fetch(pb.baseUrl + "/api/ai-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
            body: JSON.stringify({ baseUrl, apiKey, model: finalModel, messages: [{ role: "user", content: "hi" }], max_tokens: 5, stream: false })
          });
        }
      } else {
        response = await fetch(pb.baseUrl + "/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": pb.authStore.token },
          body: JSON.stringify({ baseUrl, apiKey, model: finalModel, messages: [{ role: "user", content: "hi" }], max_tokens: 5, stream: false })
        });
      }
    }

    if (response.ok) return { success: true, message: `Koneksi Berhasil! (Model: ${finalModel})` };

    let errorMessage = "Gagal menghubungi AI";
    try {
      const err = await response.json();
      errorMessage = err.error?.message || err.error || err.message || JSON.stringify(err);
    } catch { errorMessage = `Server Error: ${response.status} ${response.statusText}`; }

    if (typeof errorMessage === "string" && errorMessage.includes("LiteLLM Virtual Key expected")) {
      errorMessage = "Kunci ditolak gateway LiteLLM: Endpoint ini (AppVerse/Kenari) memerlukan Virtual Key yang diawali dengan 'sk-', bukan token master 'kn-'. Silakan generate Virtual Key baru di dashboard AppVerse/Kenari Anda atau gunakan OpenAI / Anthropic / Agnes AI.";
    }

    return { success: false, message: errorMessage };
  } catch (error: any) {
    let msg = error.message || "Gagal menghubungi server AI.";
    if (typeof msg === "string" && msg.includes("LiteLLM Virtual Key expected")) {
      msg = "Kunci ditolak gateway LiteLLM: Endpoint ini memerlukan Virtual Key diawali 'sk-', bukan 'kn-'.";
    }
    return { success: false, message: msg };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 Generate Questions from Material/Reading Text
// ═══════════════════════════════════════════════════════════════════════════════
export const generateFromMaterialAI = async (
  pb: PocketBase,
  material: string,
  count: number = 5,
  difficulty: string = "sedang",
  subject: string = "Umum",
  level: string = "Umum",
  type: string = "pilihan_ganda"
): Promise<AIGeneratedQuestion[]> => {
  if (type === "hotspot") {
    throw new Error("Tipe soal hotspot tidak didukung generator AI karena membutuhkan gambar dan penandaan area manual. Gunakan editor soal di aplikasi.");
  }
  try {
    const ctx = detectSubjectContext(subject, material);
    const formatRules = buildFormatRules(ctx);
    const fewShot = getFewShotExample(ctx);

    const typeMap: Record<string, string> = {
      pilihan_ganda: "Pilihan Ganda (5 opsi, 1 benar)",
      pilihan_ganda_kompleks: "Pilihan Ganda Kompleks (>1 benar)",
      isian_singkat: "Isian Singkat (jawaban 1-3 kata)",
      uraian: "Uraian / Essay",
      benar_salah: "Benar atau Salah (pernyataan, jawab Benar/Salah)",
      menjodohkan: "Menjodohkan/Matching (4-6 pasangan kiri-kanan)",
      urutkan: "Mengurutkan/Sequencing (4-6 item disusun urut)",
      drag_drop: "Drag & Drop (4-6 item disusun/dikelompokkan)",
      matriks: "Matriks (tabel pernyataan x kolom opsi)",
      isian_rumpang: "Isian Rumpang/Cloze (lengkapi kata hilang)",
    };
    const typeDesc = typeMap[type] || "Pilihan Ganda";

    // Build type-specific output format for material-based generation
    const getMaterialTypeFormat = (questionType: string): string => {
      switch (questionType) {
        case "pilihan_ganda":
          return `JSON: {"questions":[{"text":"pertanyaan SAJA","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},...,"e":{"text":"...","isCorrect":true}},"answerKey":"e","groupId":"","groupText":""}]}`;
        case "pilihan_ganda_kompleks":
          return `JSON: {"questions":[{"text":"pertanyaan","type":"pilihan_ganda_kompleks","choices":{"a":{"text":"...","isCorrect":true},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"a,c"}]}
Lebih dari 1 jawaban benar.`;
        case "benar_salah":
          return `JSON: {"questions":[{"text":"<pernyataan>","type":"benar_salah","choices":{"a":{"text":"Benar","isCorrect":true},"b":{"text":"Salah","isCorrect":false}},"answerKey":"a"}]}
Setiap soal adalah PERNYATAAN. Choices hanya 2: a=Benar, b=Salah.`;
        case "isian_singkat":
          return `JSON: {"questions":[{"text":"pertanyaan","type":"isian_singkat","answerKey":"jawaban singkat"}]}
Tidak ada choices. answerKey berisi jawaban pasti 1-3 kata.`;
        case "uraian":
          return `JSON: {"questions":[{"text":"pertanyaan HOTS","type":"uraian","answerKey":"pedoman penilaian"}]}
Tidak ada choices. answerKey berisi rubrik/pedoman penilaian.`;
        case "menjodohkan":
          return `JSON: {"questions":[{"text":"Jodohkan item berikut:","type":"menjodohkan","pairs":[{"id":"1","left":"...","right":"..."},{"id":"2","left":"...","right":"..."},{"id":"3","left":"...","right":"..."},{"id":"4","left":"...","right":"..."}],"answerKey":"1-1,2-2,3-3,4-4"}]}
Setiap soal memiliki 4-6 pasangan.`;
        case "urutkan":
          return `JSON: {"questions":[{"text":"Urutkan berikut:","type":"urutkan","items":[{"id":"1","text":"langkah 1"},{"id":"2","text":"langkah 2"},{"id":"3","text":"langkah 3"},{"id":"4","text":"langkah 4"}],"answerKey":"1,2,3,4"}]}
Urutan dalam array items adalah URUTAN BENAR. 4-6 item.`;
        case "drag_drop":
          return `JSON: {"questions":[{"text":"Susun item berikut:","type":"drag_drop","items":[{"id":"1","text":"item 1"},{"id":"2","text":"item 2"},{"id":"3","text":"item 3"},{"id":"4","text":"item 4"}],"answerKey":"1,2,3,4"}]}
Urutan dalam array items adalah URUTAN BENAR. 4-6 item.`;
        case "klasifikasi":
          return `JSON: {"questions":[{"text":"Tentukan kategori yang sesuai untuk setiap pernyataan:","type":"klasifikasi","categories":[{"id":"c1","text":"Kategori A"},{"id":"c2","text":"Kategori B"}],"statements":[{"id":"s1","text":"...","answer":"c1"},{"id":"s2","text":"...","answer":"c2"}],"shuffleStatements":true,"answerKey":""}]}
categories: 2-4 kategori. statements: 3-5 pernyataan dengan "answer" = id kategori benar.`;
        case "matriks":
          return `JSON: {"questions":[{"text":"Tentukan Benar atau Salah untuk setiap pernyataan:","type":"matriks","columns":[{"id":"benar","text":"Benar"},{"id":"salah","text":"Salah"}],"statements":[{"id":"s1","text":"...","answer":"benar"},{"id":"s2","text":"...","answer":"salah"}],"answerKey":""}]}
columns: 2-3 kolom opsi. statements: 3-5 pernyataan dengan "answer" = id kolom benar.`;
        case "isian_rumpang":
          return `JSON: {"questions":[{"text":"Lengkapi: ... [[1]] ... [[2]] ...","type":"isian_rumpang","blanks":[{"id":"1","answers":["..."],"caseSensitive":false},{"id":"2","answers":["..."],"caseSensitive":false}],"answerKey":""}]}
"text" berisi [[1]], [[2]] untuk rumpang. "blanks" berisi kunci tiap rumpang (boleh jawaban alternatif).`;
        default:
          return `JSON: {"questions":[{"text":"pertanyaan SAJA","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},...,"e":{"text":"...","isCorrect":true}},"answerKey":"e"}]}`;
      }
    };

    const materialTypeFormat = getMaterialTypeFormat(type);

    const cleanMaterial = cleanMaterialPromptText(material);

    const systemPrompt = `Anda adalah Spesialis Kurikulum & Evaluasi Pendidikan.
Tugas: Buat ${count} soal ${typeDesc} berdasarkan MATERI yang diberikan.
Jenjang: ${level}, Mapel: ${subject}, Kesulitan: ${difficulty}.

KETENTUAN:
1. AKURASI: Soal WAJIB berdasarkan fakta dalam materi.
2. HOTS & VARIASI: Wajib variasi pola (analisis, evaluasi, kreasi, skenario kasus). DILARANG pola seragam.
${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? "3. OPSI: 5 pilihan (A-E) variatif, logis, diawali huruf kapital." : "3. Pastikan format sesuai tipe soal."}
4. LITERASI: Jika diminta, masukkan stimulus literasi ke "groupText" (BUKAN "text"). Berikan "groupId" sama untuk soal satu paket literasi.

STANDAR KUALITAS:
- Pokok soal kontekstual & tidak multitafsir berdasarkan materi.
- Pengecoh masuk akal (miskonsepsi siswa). Panjang opsi seimbang.
- Kunci jawaban mutlak akurat berdasarkan materi.
${formatRules ? `\n${formatRules}` : ""}${fewShot ? `\n${fewShot}` : ""}

${materialTypeFormat}
Hanya JSON murni.`;

    const userPrompt = `MATERI:\n\n${cleanMaterial}\n\nBuat ${count} soal ${typeDesc}, kesulitan ${difficulty}. WAJIB variasi pola pertanyaan.`;

    // Parallel batch for large counts (>12 soal)
    if (count > 12) {
      const batchSize = Math.ceil(count / 2);
      const batches = [batchSize, count - batchSize];

      const results = await Promise.allSettled(
        batches.map(batchCount => {
          const batchUserPrompt = `MATERI:\n\n${cleanMaterial}\n\nBuat ${batchCount} soal ${typeDesc}, kesulitan ${difficulty}. WAJIB variasi pola pertanyaan.`;
          return fetchAI({
            pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: batchUserPrompt }],
            maxTokens: Math.min(batchCount * 380 + 300, 4096), temperature: 0.6
          }).then(content => {
            const parsed = robustJSONParse(content);
            let raw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
            if (raw.length === 0 && parsed.text) raw = [parsed];
            return validateQuestions(raw, ctx.isExact || ctx.isChemistry, type);
          });
        })
      );

      const allQuestions: AIGeneratedQuestion[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") allQuestions.push(...result.value);
      }
      if (allQuestions.length === 0) throw new Error("Gagal menghasilkan soal dari materi.");
      return allQuestions;
    }

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      maxTokens: Math.min(Math.max(count * 380 + 300, 1000), 5120), temperature: 0.6
    });

    const parsed = robustJSONParse(content);
    let questionsRaw = parsed.questions || parsed.data || parsed.soal || (Array.isArray(parsed) ? parsed : []);
    if (questionsRaw.length === 0 && parsed.text && (parsed.choices || parsed.answerKey)) {
      questionsRaw = [parsed];
    }

    const validated = validateQuestions(questionsRaw, ctx.isExact || ctx.isChemistry, type);
    if (validated.length === 0) throw new Error("Format soal tidak valid.");
    return validated;
  } catch (err: any) {
    console.error("Generate from Material Error:", err);
    throw err;
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
// 🎓 AI Essay/Short Answer Grading
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIGradeResult {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string;
}

export const gradeEssayWithAI = async (
  pb: PocketBase,
  question: string,
  studentAnswer: string,
  answerKey: string,
  type: "isian_singkat" | "uraian" = "uraian"
): Promise<AIGradeResult> => {
  try {
    if (!studentAnswer?.trim()) {
      return { isCorrect: false, score: 0, feedback: "Siswa tidak menjawab." };
    }

    const systemPrompt = type === "isian_singkat"
      ? `Anda adalah penilai ujian isian singkat. Periksa apakah jawaban siswa BENAR atau SALAH.
ATURAN PENILAIAN:
- Jawaban BENAR jika secara substansi/makna SAMA dengan kunci jawaban.
- Toleransi: typo kecil (1-2 huruf), sinonim, singkatan umum, huruf besar/kecil, spasi → tetap BENAR.
- Jawaban SALAH hanya jika maknanya BERBEDA dari kunci.
- Jika kunci jawaban kosong/tidak ada, nilai berdasarkan relevansi dengan pertanyaan.
Balas HANYA dengan JSON: {"isCorrect":true,"score":100,"feedback":"alasan"} atau {"isCorrect":false,"score":0,"feedback":"alasan"}`
      : `Anda adalah penilai ujian essay profesional. Nilai jawaban siswa berdasarkan pedoman penilaian.
ATURAN:
- Jika jawaban menyentuh poin-poin utama dari pedoman → BENAR (score >= 60).
- Tidak perlu kata-kata persis sama, yang penting substansi/konsep benar.
- Skor: 0=tidak relevan, 40=kurang, 60=cukup, 80=baik, 100=sempurna.
- isCorrect = true jika score >= 50.
Balas HANYA dengan JSON: {"isCorrect":true,"score":80,"feedback":"umpan balik singkat"}`;

    const userPrompt = `PERTANYAAN:\n${question}\n\nKUNCI JAWABAN:\n${answerKey || "(Tidak ada kunci khusus - nilai berdasarkan relevansi)"}\n\nJAWABAN SISWA:\n${studentAnswer}\n\nNilai jawaban di atas. Balas HANYA JSON, tanpa teks lain.`;

    let content: string;
    try {
      // Try with JSON mode first
      content = await fetchAI({
        pb,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        maxTokens: 200,
        temperature: 0.2,
        jsonMode: true
      });
    } catch (jsonModeErr: any) {
      // If JSON mode fails, retry without it
      if (jsonModeErr.message?.includes("AI_RATE_LIMIT")) throw jsonModeErr;
      content = await fetchAI({
        pb,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        maxTokens: 200,
        temperature: 0.2,
        jsonMode: false
      });
    }

    const parsed = robustJSONParse(content);
    return {
      isCorrect: parsed.isCorrect ?? parsed.is_correct ?? (parsed.score >= 50),
      score: Math.min(100, Math.max(0, parsed.score || 0)),
      feedback: parsed.feedback || parsed.umpan_balik || ""
    };
  } catch (err: any) {
    console.error("AI Grade Error:", err);
    if (err.message?.includes("AI_RATE_LIMIT")) {
      throw new Error("Kuota AI habis. Coba lagi nanti.");
    }
    throw new Error("Gagal menilai dengan AI: " + (err.message || ""));
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 Psychometric AI Revision for Question Options & Distractors
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIReviseOptionsRequest {
  pb: PocketBase;
  questionId: string;
  questionIndex?: number;
  questionText: string;
  literasiText?: string;
  type: string;
  answerKey: string;
  currentChoices: Record<string, { text: string; isCorrect?: boolean; imageUrl?: string }>;
  distractorAnalysis?: Array<{
    key: string;
    text: string;
    isCorrect: boolean;
    totalPercent: number;
    upperPercent: number;
    lowerPercent: number;
    status: string;
    note: string;
  }>;
  difficultyIndex?: number;
  discriminationIndex?: number;
  pointBiserial?: number;
  teacherNote?: string;
}

export interface AIReviseOptionsChoice {
  text: string;
  isCorrect: boolean;
  originalText?: string;
  status: "revised" | "kept" | "refined";
  rationale?: string;
}

export interface AIReviseOptionsResult {
  analysis: string;
  choices: Record<string, AIReviseOptionsChoice>;
  answerKey: string;
  pedagogicalTip?: string;
}

export const reviseQuestionOptionsAI = async (
  request: AIReviseOptionsRequest
): Promise<AIReviseOptionsResult> => {
  const {
    pb,
    questionText,
    literasiText,
    type,
    answerKey,
    currentChoices,
    distractorAnalysis,
    difficultyIndex,
    discriminationIndex,
    pointBiserial,
    teacherNote
  } = request;

  const cleanHtml = (s: string) => (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Format distractor analysis breakdown
  let distractorBreakdown = "";
  if (distractorAnalysis && distractorAnalysis.length > 0) {
    distractorBreakdown = distractorAnalysis.map(dis => {
      const corrBadge = dis.isCorrect ? "[KUNCI JAWABAN]" : "[PENGECOH]";
      return `- Opsi ${dis.key.toUpperCase()} ${corrBadge}: "${cleanHtml(dis.text)}"\n  Status: ${dis.status} (Dipilih ${dis.totalPercent}% siswa | Kelompok Atas: ${dis.upperPercent}%, Kelompok Bawah: ${dis.lowerPercent}%)\n  Evaluasi Psikometri: ${dis.note || "-"}`;
    }).join("\n\n");
  } else {
    distractorBreakdown = Object.entries(currentChoices).map(([k, c]) => {
      const isCorr = Boolean(c.isCorrect || answerKey.toLowerCase().split(/[,|; ]+/).includes(k.toLowerCase()));
      return `- Opsi ${k.toUpperCase()} ${isCorr ? "[KUNCI JAWABAN]" : "[PENGECOH]"}: "${cleanHtml(c.text)}"`;
    }).join("\n");
  }

  const pStr = difficultyIndex !== undefined ? `P = ${difficultyIndex.toFixed(2)} (${difficultyIndex > 0.70 ? "Mudah / Terlalu Mudah" : difficultyIndex < 0.30 ? "Sukar / Terlalu Sukar" : "Sedang (Ideal)"})` : "Belum dihitung";
  const dStr = discriminationIndex !== undefined ? `D = ${discriminationIndex >= 0 ? "+" : ""}${discriminationIndex.toFixed(2)} (${discriminationIndex >= 0.40 ? "Sangat Baik" : discriminationIndex >= 0.30 ? "Baik" : discriminationIndex >= 0.20 ? "Cukup" : "Rendah / Kurang Mampu Membedakan Siswa"})` : "Belum dihitung";
  const rpbStr = pointBiserial !== undefined ? `r_pb = ${pointBiserial >= 0 ? "+" : ""}${pointBiserial.toFixed(2)}` : "-";

  const systemPrompt = `Anda adalah pakar psikometri evaluasi pendidikan Classical Test Theory (CTT) dan penyusun butir soal HOTS terstandar.
Tugas Anda: Merevisi dan menyempurnakan pilihan jawaban (khususnya opsi pengecoh/distraktor) butir soal agar memiliki daya pembeda (D) tinggi, efektivitas pengecoh (DE) optimal, dan validitas isi yang kuat.

PEDOMAN REVISI OPSI JAWABAN BERBASIS PSIKOMETRI:
1. PERTAHANKAN KUNCI JAWABAN:
   - Opsi yang menjadi kunci jawaban HARUS tetap benar secara konsep dan substansi.
   - Perbaiki redaksinya jika sebelumnya membingungkan atau kurang baku, tetapi JANGAN ubah esensi jawaban yang benar.
   - Tandai isCorrect: true pada opsi kunci.
2. PERBAIKI PENGECOH PASIF / MATI (Fo < 5% pemilih):
   - Pengecoh yang hampir tidak ada pemilihnya (<5%) adalah pengecoh mati yang tidak berfungsi.
   - GANTI dengan opsi pengecoh baru yang masuk akal (plausible), bersumber dari teks/stimulus soal, dan menargetkan miskonsepsi umum (common misconception) atau kekeliruan bernalar yang biasa dialami peserta didik.
   - Opsi pengecoh baru harus cukup memikat bagi siswa kelompok bawah yang belum paham materi, namun tidak dipilih siswa kelompok atas yang benar-benar paham.
3. PERBAIKI PENGECOH MENYESATKAN (Kelompok Atas > Kelompok Bawah):
   - Jika siswa pandai (kelompok atas) lebih banyak terjebak daripada kelompok bawah, berarti ada ambiguitas kata, frasa bersayap, atau distraktor yang terlalu mirip dengan kebenaran faktual.
   - Redaksikan ulang agar tidak ambigu dan tidak mengecoh siswa yang menguasai materi.
4. HOMOGENITAS & KESEIMBANGAN STRUKTUR OPSI:
   - Seluruh pilihan jawaban (A sampai E) harus seimbang dalam:
     a) Panjang kalimat (hindari kunci jawaban paling panjang atau paling pendek).
     b) Struktur gramatikal (misal: jika kunci adalah frasa nomina, pengecoh juga berupa frasa nomina).
     c) Gaya bahasa, nada, dan terminologi yang setara.
   - Jangan ada "clue" gramatikal yang memudahkan tebakan acak.
5. INSTRUKSI GURU:
   - Jika guru memberikan catatan khusus, terapkan arahan tersebut sebagai prioritas utama.

FORMAT KELUARAN (WAJIB JSON MURNI TANPA MARKDOWN):
{
  "analysis": "Penjelasan singkat (2-3 kalimat) mengenai kelemahan psikometri opsi lama dan strategi perbaikan yang dilakukan.",
  "choices": {
    "a": {
      "text": "Teks opsi A yang baru atau disempurnakan",
      "isCorrect": false,
      "status": "revised", // "revised" (dirombak total), "refined" (disempurnakan redaksinya), atau "kept" (dipertahankan)
      "rationale": "Alasan pedagogis/miskonsepsi yang ditargetkan opsi ini"
    },
    "b": {
      "text": "...",
      "isCorrect": false,
      "status": "revised",
      "rationale": "..."
    },
    "c": {
      "text": "...",
      "isCorrect": false,
      "status": "revised",
      "rationale": "..."
    },
    "d": {
      "text": "...",
      "isCorrect": true,
      "status": "kept",
      "rationale": "Kunci jawaban resmi yang benar secara konsep"
    },
    "e": {
      "text": "...",
      "isCorrect": false,
      "status": "revised",
      "rationale": "..."
    }
  },
  "answerKey": "d",
  "pedagogicalTip": "Tips ringkas untuk guru mengenai miskonsepsi materi ini saat dibahas di kelas."
}`;

  const userPrompt = `DATA BUTIR SOAL YANG DIANALISIS:
${literasiText ? `[WACANA / STIMULUS LITERASI]:\n${cleanHtml(literasiText)}\n\n` : ""}[TEKS PERTANYAAN SOAL]:
${cleanHtml(questionText)}

TIPE SOAL: ${type === "pilihan_ganda_kompleks" ? "Pilihan Ganda Kompleks" : "Pilihan Ganda Tunggal"}
KUNCI JAWABAN SAAT INI: ${answerKey.toUpperCase()}

METRIK PSIKOMETRI EMPIRIS BUTIR SOAL:
- Tingkat Kesukaran (P): ${pStr}
- Daya Pembeda (D): ${dStr}
- Korelasi Point-Biserial (r_pb): ${rpbStr}

RINCIAN & ANOMALI OPSI JAWABAN SAAT INI:
${distractorBreakdown}

${teacherNote?.trim() ? `CATATAN KHUSUS / PERMINTAAN DARI GURU:\n"${teacherNote.trim()}"\n` : ""}
Lakukan revisi dan perbaikan pada pilihan jawaban di atas agar butir soal memenuhi kaidah psikometri yang ideal. Pastikan seluruh opsi (A sampai E) tersedia lengkap dalam format JSON yang diminta.`;

  let content = "";
  try {
    content = await fetchAI({
      pb,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 1200,
      temperature: 0.4,
      jsonMode: true
    });
  } catch (err: any) {
    if (err.message?.includes("AI_RATE_LIMIT")) throw err;
    // Fallback without strict json_object
    content = await fetchAI({
      pb,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 1200,
      temperature: 0.4,
      jsonMode: false
    });
  }

  const parsed = robustJSONParse(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI tidak menghasilkan struktur JSON yang valid.");
  }

  const rawChoices = parsed.choices || parsed.options || {};
  const cleanedChoices: Record<string, AIReviseOptionsChoice> = {};

  // Standardize keys (a, b, c, d, e)
  const targetKeys = Object.keys(currentChoices).length > 0
    ? Object.keys(currentChoices).map(k => k.toLowerCase())
    : ["a", "b", "c", "d", "e"];

  targetKeys.forEach(k => {
    const rawC = rawChoices[k] || rawChoices[k.toUpperCase()] || {};
    const origC = currentChoices[k] || currentChoices[k.toUpperCase()] || { text: "", isCorrect: false };

    // Determine isCorrect
    let isCorr = false;
    if (rawC.isCorrect !== undefined) {
      isCorr = Boolean(rawC.isCorrect);
    } else if (parsed.answerKey) {
      const keys = String(parsed.answerKey).toLowerCase().split(/[,|; ]+/).map(s => s.trim());
      isCorr = keys.includes(k);
    } else {
      isCorr = Boolean(origC.isCorrect);
    }

    cleanedChoices[k] = {
      text: typeof rawC.text === "string" && rawC.text.trim() ? rawC.text.trim() : (origC.text || ""),
      isCorrect: isCorr,
      originalText: origC.text || "",
      status: rawC.status || (isCorr ? "kept" : (rawC.text !== origC.text ? "revised" : "kept")),
      rationale: rawC.rationale || rawC.alasan || (isCorr ? "Kunci jawaban benar" : "Pengecoh disesuaikan")
    };
  });

  // Calculate final answer key string
  const correctKeys = Object.entries(cleanedChoices)
    .filter(([_, c]) => c.isCorrect)
    .map(([k]) => k)
    .join(",");

  return {
    analysis: parsed.analysis || parsed.ringkasan || "Pilihan jawaban berhasil dianalisis dan disempurnakan berdasarkan kaidah psikometri CTT.",
    choices: cleanedChoices,
    answerKey: correctKeys || (parsed.answerKey ? String(parsed.answerKey).toLowerCase() : answerKey.toLowerCase()),
    pedagogicalTip: parsed.pedagogicalTip || parsed.tips || parsed.saran || ""
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 AI Conversational Question Assistant (Chatbot Drawer)
// ═══════════════════════════════════════════════════════════════════════════════
export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  questions?: AIGeneratedQuestion[];
  timestamp: number;
}

export interface AIChatQuestionRequest {
  pb: PocketBase;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  currentQuestions?: AIGeneratedQuestion[];
  context?: {
    subject?: string;
    level?: string;
    examName?: string;
  };
  speedMode?: "fast" | "accurate";
  modelOverride?: string;
  signal?: AbortSignal;
}

export interface AIChatQuestionResponse {
  replyText: string;
  questions: AIGeneratedQuestion[];
}

const parseQuestionsFromRawText = (text: string, isExact: boolean = false): { replyText: string; questions: AIGeneratedQuestion[] } => {
  const questions: AIGeneratedQuestion[] = [];
  let replyText = "Berikut butir soalnya.";

  const firstQuestionIndex = text.search(/(?:\[Soal\s*\d+|(?:\n|^)\s*(?:Soal\s*)?\d+[\.\)])/i);
  if (firstQuestionIndex > 0) {
    replyText = text.slice(0, firstQuestionIndex).trim();
  }

  const questionBlocks = text
    .split(/(?=(?:\[Soal\s*\d+.*\]|(?:\n|^)\s*(?:Soal\s*)?\d+[\.\)]))/i)
    .filter(b => b.trim().length > 0);

  for (const block of questionBlocks) {
    if (!block.match(/(?:[A-E]\.|\([A-E]\))/i) && !block.match(/\[Soal/i)) continue;

    let cleaned = block
      .replace(/^\[Soal\s*\d+\s*(?:\([^)]+\))?\]:\s*/i, "")
      .replace(/^\s*(?:Soal\s*)?\d+[\.\)]\s*/i, "");

    let answerKey = "";
    const keyMatch = cleaned.match(/(?:Kunci(?:\s*jawaban)?|Jawaban\s*benar|Jawaban):\s*([A-Ea-e])/i);
    if (keyMatch) {
      answerKey = keyMatch[1].toLowerCase();
      cleaned = cleaned.replace(keyMatch[0], "");
    }

    const choiceSplitMatch = cleaned.search(/(?:\nPilihan:\s*\n?|\n\s*(?:[A-E]\.|\([A-E]\)|[A-E]\))\s+)/i);
    let questionText = cleaned;
    let choicesText = "";

    if (choiceSplitMatch !== -1) {
      questionText = cleaned.slice(0, choiceSplitMatch).trim();
      choicesText = cleaned.slice(choiceSplitMatch).trim();
      choicesText = choicesText.replace(/^Pilihan:\s*/i, "");
    }

    const choices: any = {};
    if (choicesText) {
      const choiceRegex = /(?:^|\n)\s*([A-Ea-e])[\.\)]\s*([\s\S]*?)(?=(?:\n\s*[A-Ea-e][\.\)]|$))/g;
      let m;
      while ((m = choiceRegex.exec(choicesText)) !== null) {
        const key = m[1].toLowerCase();
        let val = m[2].trim();
        let isCorrect = false;
        if (val.includes("[KUNCI]") || val.includes("(KUNCI)")) {
          isCorrect = true;
          val = val.replace(/\[KUNCI\]|\(KUNCI\)/g, "").trim();
          if (!answerKey) answerKey = key;
        }
        if (answerKey && key === answerKey) {
          isCorrect = true;
        }
        choices[key] = { text: stripUnwantedLatex(val, isExact), isCorrect };
      }
    }

    const hasValidChoices = Object.keys(choices).length >= 2;
    // Hanya anggap sebagai soal pilihan ganda jika minimal ada 2 pilihan (A & B)
    if (questionText.trim() && hasValidChoices) {
      ["a", "b", "c", "d", "e"].forEach(letter => {
        if (!choices[letter]) {
          choices[letter] = { text: "", isCorrect: false };
        }
      });
      questions.push({
        text: stripUnwantedLatex(questionText.trim(), isExact),
        type: "pilihan_ganda",
        choices,
        answerKey: answerKey || (Object.keys(choices).find(k => choices[k].isCorrect) || "a")
      });
    }
  }

  // Jika tidak ada soal yang berhasil diparsing, jadikan seluruh teks sebagai reply chat biasa
  if (questions.length === 0) {
    replyText = text.trim();
  }

  return { replyText, questions };
};

export const chatQuestionAssistantAI = async (
  req: AIChatQuestionRequest
): Promise<AIChatQuestionResponse> => {
  const { pb, messages, currentQuestions = [], context = {}, speedMode = "fast", modelOverride, signal } = req;
  const isFast = speedMode === "fast";
  const maxTokens = isFast ? 1400 : 2800;
  const temperature = isFast ? 0.2 : 0.6;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";

  // 🚀 Fast-path: Respon seketika (0ms) untuk sapaan, bantuan, & kemampuan asisten
  const trimmed = lastUserMsg.trim().toLowerCase();
  const isGreeting = /^(halo|hai|hi|hey|hei|assalamu['a-z]*|selamat\s+(pagi|siang|sore|malam)|sampurasun|salam)[\s!.,?]*$/i.test(trimmed);
  const isPing = /^(tes|test|testing|ping|p)[\s!.,?]*$/i.test(trimmed);
  const isThanks = /^(terima\s*kasih|makasih|thanks|thank\s*you|tq|thx)[\s!.,?]*$/i.test(trimmed);
  const isHelp = /^(bantuan|help|panduan|cara\s+pakai|menu)[\s!.,?]*$/i.test(trimmed);
  const isCapabilities = /^(kamu\s+(bisa|dapat)\s+apa|bisa\s+apa\s+aja|bisa\s+apa|fitur|kemampuan|apa\s+yang\s+bisa\s+kamu\s+lakukan|apa\s+saja\s+fitur(mu)?|kamu\s+siapa|siapa\s+kamu|apa\s+ini|anda\s+siapa)[\s!.,?]*$/i.test(trimmed);

  if (isGreeting || isPing || isThanks || isHelp || isCapabilities) {
    let replyText = "";
    if (isGreeting) {
      replyText = "Halo! Saya **Asisten AI Bank Soal Examku**. Saya siap membantu Anda membuat dan menyusun butir soal ujian.\n\nSilakan ketik materi dan jumlah soal yang ingin dibuat, contohnya:\n• *\"Buat 5 soal pilihan ganda tentang Jaringan Komputer SMA\"*\n• *\"Buat 3 butir soal HOTS informatika tentang algoritma percabangan\"*\n• *\"Buat 1 soal menjodohkan tentang perangkat keras input dan output\"*";
    } else if (isPing) {
      replyText = "Asisten AI aktif dan siap digunakan! Silakan berikan instruksi materi soal yang ingin dibuat.";
    } else if (isThanks) {
      replyText = "Sama-sama! Senang bisa membantu Anda. Jika ingin membuat butir soal lainnya, silakan ketik instruksinya.";
    } else if (isHelp || isCapabilities) {
      replyText = `Halo! Saya **Asisten AI Bank Soal Examku**. Saya dirancang untuk membantu pendidik menyusun butir soal ujian berkualitas tinggi secara cepat, terstruktur, dan presisi.

### 📝 1. Pembuatan Beragam Tipe Butir Soal
• **Pilihan Ganda (5 Opsi A–E)**: Standar wajib 5 opsi A, B, C, D, dan E lengkap dengan opsi pengecoh realistis & kunci jawaban.
• **Pilihan Ganda Kompleks (5 Opsi A–E)**: Standar 5 opsi A–E dengan lebih dari satu pilihan jawaban yang benar.
• **Benar / Salah**: Evaluasi konsep atau analisis pernyataan materi.
• **Menjodohkan**: Pemetaan premis kiri dan pasangan benar di kolom kanan.
• **Urutkan**: Mengurutkan tahapan proses, siklus peristiwa, atau logika algoritma.
• **Isian Singkat & Uraian**: Lengkap dengan rubrik penilaian esai.

### 💡 2. Bantuan Pembelajaran & Wacana
• **Pembuatan Soal HOTS**: Soal berbasis analisis tingkat tinggi, penalaran kritis, dan studi kasus.
• **Stimulus Literasi**: Pembuatan wacana bacaan kaya data, artikel sains, atau teks narasi.
• **Penjelasan Konsep**: Membantu menjelaskan materi atau memberikan contoh soal relevan.

### ⚡ 3. Revisi Cerdas (Multi-Turn Chat)
• Mengingat butir soal yang baru dibuat sebelumnya.
• Menyesuaikan opsi (contoh: *"jadikan pilihan A-E"*).
• Menambah butir soal (contoh: *"tambahkan 2 soal uraian"*).
• Mengubah tingkat kesulitan (contoh: *"buat tingkat kesulitan lebih menantang"*).

Silakan ketik materi atau topik soal yang ingin dibuat, contohnya:
👉 *"Buat 5 soal pilihan ganda tentang Jaringan Komputer SMA"*`;
    }
    return { replyText, questions: [] };
  }

  const ctx = detectSubjectContext(context.subject || "", lastUserMsg);
  const formatRules = buildFormatRules(ctx);

  // Ringkas soal yang ada agar hemat token dan respon kilat
  const existingQuestionsSnippet = currentQuestions.length > 0
    ? `\nDRAFT SOAL AKTIF:\n` +
    currentQuestions.map((q, idx) => `${idx + 1}. [${q.type}] ${q.text.slice(0, 100)}... (Kunci: ${q.answerKey || "-"})`).join("\n")
    : "";

  // Deteksi jumlah soal yang diminta user agar alokasi token hemat & respon super instan
  const isSingleQuestion = /\b(1|satu)\s*(butir\s*)?soal\b/i.test(lastUserMsg);
  const calculatedTokens = isSingleQuestion ? 1200 : (isFast ? 2000 : 3500);

  const systemPrompt = `Anda adalah Asisten Pembuat Soal Ujian Cepat & Presisi.
Mapel: ${context.subject || "Umum"}, Jenjang: ${context.level || "Umum"}.

WAJIB FORMAT JSON OBJECT:
{
  "reply": "Siap.",
  "questions": [
    ...butir soal sesuai tipe yang diminta...
  ]
}

PANDUAN PEMBEDA PERCAKAPAN & PEMBUATAN SOAL:
A. JIKA PENGGUNA MEMINTA MEMBUAT ATAU MENGUBAH SOAL (misal: "buat 5 soal...", "buatkan soal...", "soal pilihan ganda...", "jadikan A-E", dsb.):
   - Buat butir soal terstruktur di array 'questions'.
   - Isi 'reply': 'Berikut butir soalnya.'.
B. JIKA PENGGUNA BERTANYA UMUM, MEMINTA PENJELASAN KONSEP, ATAU MENANYAKAN KEMAMPUAN (BUKAN meminta membuat soal):
   - Set array 'questions': [] (WAJIB KOSONG).
   - Tulis jawaban penjelasan yang ramah, sangat rapi, dan terstruktur dengan format Markdown standar (gunakan ### untuk judul bagian, bullet points •, dan **bold**) di dalam field 'reply'.

PANDUAN FORMAT STRUKTUR BUTIR SOAL SESUAI PERMINTAAN:
1. Pilihan Ganda (type: "pilihan_ganda"):
   WAJIB SELALU 5 OPSI (A, B, C, D, E) — DILARANG HANYA 4 OPSI (A-D)!
   {"text": "Pertanyaan pokok...", "type": "pilihan_ganda", "choices": {"a": {"text": "...", "isCorrect": false}, "b": {"text": "...", "isCorrect": true}, "c": {"text": "...", "isCorrect": false}, "d": {"text": "...", "isCorrect": false}, "e": {"text": "...", "isCorrect": false}}, "answerKey": "b"}

2. Pilihan Ganda Kompleks (type: "pilihan_ganda_kompleks"):
   WAJIB SELALU 5 OPSI (A, B, C, D, E) — DILARANG HANYA 4 OPSI (A-D)!
   {"text": "Pernyataan/pertanyaan...", "type": "pilihan_ganda_kompleks", "choices": {"a": {"text": "...", "isCorrect": true}, "b": {"text": "...", "isCorrect": false}, "c": {"text": "...", "isCorrect": true}, "d": {"text": "...", "isCorrect": false}, "e": {"text": "...", "isCorrect": false}}, "answerKey": "a,c"}

3. Benar / Salah (type: "benar_salah"):
   {"text": "Pernyataan yang harus dinilai...", "type": "benar_salah", "choices": {"a": {"text": "Benar", "isCorrect": true}, "b": {"text": "Salah", "isCorrect": false}}, "answerKey": "a"}

4. Menjodohkan (type: "menjodohkan"):
   WAJIB array 'pairs' (left = premis kiri, right = jawaban benar kanan).
   DILARANG menaruh daftar definisi di dalam 'text'! 'text' hanya perintah singkat.
   {"text": "Jodohkan komponen elektronika berikut dengan fungsinya yang tepat:", "type": "menjodohkan", "pairs": [{"id": "1", "left": "Induktor", "right": "Menyimpan energi dalam medan magnet"}, {"id": "2", "left": "Dioda", "right": "Menyearahkan arus listrik"}, {"id": "3", "left": "Kapasitor", "right": "Menyimpan energi dalam medan listrik"}]}

5. Urutkan (type: "urutkan"):
   {"text": "Urutkan tahapan metode ilmiah berikut dari awal hingga akhir:", "type": "urutkan", "items": [{"id": "1", "text": "Merumuskan masalah"}, {"id": "2", "text": "Menyusun hipotesis"}, {"id": "3", "text": "Melakukan eksperimen"}]}

6. Isian Singkat (type: "isian_singkat"):
   {"text": "Komponen elektronika yang berfungsi menghambat arus listrik adalah...", "type": "isian_singkat", "answerKey": "resistor"}

7. Uraian (type: "uraian"):
   {"text": "Jelaskan prinsip kerja transformator...", "type": "uraian", "answerKey": "Rubrik: Menjelaskan induksi elektromagnetik dan perbandingan lilitan"}

ATURAN WAJIB JUMLAH OPSI PILIHAN GANDA (SANGAT KETAT):
- Untuk tipe Pilihan Ganda (pilihan_ganda) maupun Pilihan Ganda Kompleks (pilihan_ganda_kompleks), Anda WAJIB SELALU menghasilkan TEPAT 5 OPSI PILIHAN: A, B, C, D, dan E (keys: "a", "b", "c", "d", "e").
- JANGAN PERNAH hanya membuat 4 pilihan (A-D)! Opsi E WAJIB disertakan dengan teks pengecoh yang logis, masuk akal, dan proporsional panjangnya.

KEMAMPUAN PERCAKAPAN MULTI-TURN & FOLLOW-UP:
- Anda mengingat dan memahami seluruh riwayat percakapan dan butir soal di atas.
- Jika pengguna meminta perubahan atau tindak lanjut dari percakapan sebelumnya (misal: "tambah opsi E", "ubah ke tipe menjodohkan", "buat kunci pembahasan", "ganti materi", atau "buat soal serupa/sejenis"):
  RUJUK & GUNAKAN konteks soal sebelumnya dari riwayat percakapan untuk memenuhi permintaan pengguna dengan presisi!

ATURAN ULTRA KILAT:
1. LANGSUNG HASILKAN JSON! Jangan tulis teks pembuka, jangan gunakan tag proses berpikir (<think>), jangan tulis pembahasan.
2. Teks 'reply' cukup 1-3 kata saja (misal: "Siap." atau "Berikut soalnya.").
3. Pertanyaan dan pilihan to-the-point, akurat, dan bersih. Pilihan ganda WAJIB 5 opsi (A, B, C, D, E).
4. LaTeX: Gunakan $...$ HANYA jika berupa rumus eksakta.
${formatRules ? `\nFORMAT: ${formatRules}` : ""}
${existingQuestionsSnippet}
Kembalikan HANYA JSON murni tanpa pembungkus narasi apapun.`;

  const conversationHistory = messages.slice(-6).map(m => ({
    role: m.role,
    content: m.content
  }));

  let content = "";
  try {
    content = await fetchAI({
      pb,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory
      ],
      maxTokens: calculatedTokens,
      temperature,
      jsonMode: true,
      modelOverride,
      signal
    });
  } catch (err: any) {
    if (err.message?.includes("AI_RATE_LIMIT") || err.name === "AbortError") throw err;
    // Hanya retry tanpa jsonMode jika provider mengembalikan error response_format
    if (err.message?.includes("response_format") || err.message?.includes("json_object")) {
      content = await fetchAI({
        pb,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory
        ],
        maxTokens: calculatedTokens,
        temperature,
        jsonMode: false,
        modelOverride,
        signal
      });
    } else {
      throw err;
    }
  }

  let replyText = "";
  let questions: AIGeneratedQuestion[] = [];

  try {
    const parsed = robustJSONParse(content);
    if (parsed) {
      replyText = parsed.reply || parsed.message || parsed.text || "";
      const rawQuestions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
      if (rawQuestions.length > 0) {
        questions = validateQuestions(rawQuestions, ctx.isExact || ctx.isChemistry);
      }
    }
  } catch (parseErr) {
    // Fallback ekstraksi regex jika model menyelipkan markdown
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = robustJSONParse(jsonMatch[1]);
        replyText = parsed.reply || content.replace(/```(?:json)?\s*[\s\S]*?\s*```/, "").trim();
        const rawQuestions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
        if (rawQuestions.length > 0) {
          questions = validateQuestions(rawQuestions, ctx.isExact || ctx.isChemistry);
        }
      } catch { }
    } else {
      replyText = content.trim();
    }
  }

  // 🩹 Fallback Cerdas: Jika model menghasilkan teks bebas bukan JSON murni
  if (questions.length === 0 && content) {
    const fallbackResult = parseQuestionsFromRawText(content, ctx.isExact || ctx.isChemistry);
    if (fallbackResult.questions.length > 0) {
      questions = fallbackResult.questions;
      if (fallbackResult.replyText) {
        replyText = fallbackResult.replyText;
      }
    }
  }

  if (!replyText) {
    replyText = questions.length > 0
      ? `Saya telah menyusun ${questions.length} butir soal untuk Anda:`
      : "Permintaan Anda telah diproses.";
  }

  return { replyText, questions };
};
