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
  } catch {}
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
  choices?: Record<string, { text: string; isCorrect: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string }>;
  answerKey?: string;
  groupId?: string;
  groupText?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ Robust JSON Parser (with jsonrepair fallback)
// ═══════════════════════════════════════════════════════════════════════════════
const robustJSONParse = (text: string): any => {
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
  try { return JSON.parse(clean); } catch {}
  // jsonrepair
  try { return JSON.parse(jsonrepair(clean)); } catch {}
  // Cleanup + repair
  try {
    const cleaned = clean.replace(/\r\n/g, "\\n").replace(/\r/g, "\\n").replace(/(?<!\\)\n/g, "\\n").replace(/(?<!\\)\t/g, "\\t").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    return JSON.parse(jsonrepair(cleaned));
  } catch {}
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
  } catch {}
  // Last resort
  try { return JSON.parse(jsonrepair(clean.replace(/[\n\r\t]/g, " "))); } catch {}
  
  console.error("All JSON repair failed. Raw (500 chars):", clean.substring(0, 500));
  throw new Error("AI memberikan format data yang tidak bisa dibaca sistem.");
};


// ═══════════════════════════════════════════════════════════════════════════════
// 📋 AI Models Registry
// ═══════════════════════════════════════════════════════════════════════════════
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

  // --- OLLAMA CLOUD ---
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
  
  // --- CLOUDFLARE WORKERS AI ---
  { id: "@cf/moonshotai/kimi-k2.5", name: "Kimi K2.5 (256k ctx)", speed: "Powerful", status: "production", provider: "cloudflare" },
  { id: "@cf/zai-org/glm-4.7-flash", name: "GLM-4.7 Flash", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/openai/gpt-oss-120b", name: "GPT OSS 120B (Reasoning)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/openai/gpt-oss-20b", name: "GPT OSS 20B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Vision)", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Gemma 4 26B (Vision)", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/nvidia/nemotron-3-120b-a12b", name: "Nemotron 3 120B (MoE)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/ibm/granite-4.0-h-micro", name: "Granite 4.0 Micro (Function)", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it", name: "SEA-LION 27B (SE Asian)", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/qwen/qwq-32b", name: "QwQ 32B (Reasoning)", speed: "Heavyweight", status: "production", provider: "cloudflare" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "Qwen3 30B MoE (FP8)", speed: "Powerful", status: "production", provider: "cloudflare" },
  { id: "@cf/qwen/qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/mistralai/mistral-7b-instruct-v0.2", name: "Mistral 7B v0.2", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/mistralai/mistral-7b-instruct-v0.1", name: "Mistral 7B v0.1", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B (Reasoning)", speed: "Powerful", status: "production", provider: "cloudflare" },
  { id: "@cf/google/gemma-3-12b-it", name: "Gemma 3 12B", speed: "Balanced", status: "production", provider: "cloudflare" },
  { id: "@cf/google/gemma-7b-it", name: "Gemma 7B", speed: "Fast", status: "production", provider: "cloudflare" },
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
  { id: "@hf/nousresearch/hermes-2-pro-mistral-7b", name: "Hermes 2 Pro Mistral 7B", speed: "Fast", status: "production", provider: "cloudflare" },
  { id: "@cf/defog/sqlcoder-7b-2", name: "SQLCoder 7B (SQL)", speed: "Fast", status: "production", provider: "cloudflare" },
  
  // --- OPENROUTER ---
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Next-Gen)", speed: "Instant", status: "preview", provider: "openrouter" },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B (Latest)", speed: "Powerful", status: "preview", provider: "openrouter" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (OpenAI Architecture)", speed: "Colossal", status: "preview", provider: "openrouter" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", speed: "Fast", status: "preview", provider: "openrouter" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash", speed: "Fast", status: "production", provider: "openrouter" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", speed: "Powerful", status: "production", provider: "openrouter" },

  // --- GROQ EXPERIMENTAL ---
  { id: "groq/compound", name: "Groq Compound (Research)", speed: "Fast", status: "preview", provider: "groq", dailyLimit: "~8k token/hari ⚠️" },
  { id: "groq/compound-mini", name: "Groq Compound Mini", speed: "Hyper Fast", status: "preview", provider: "groq", dailyLimit: "~8k token/hari ⚠️" },
  
  // --- TOGETHER AI ---
  { id: "meta-llama/Llama-3-70b-chat-hf", name: "Llama 3 70B", speed: "Fast", status: "production", provider: "together" },
  { id: "meta-llama/Llama-3-8b-chat-hf", name: "Llama 3 8B", speed: "Instant", status: "production", provider: "together" },
  
  // --- GITHUB MODELS ---
  { id: "gpt-4o", name: "GPT-4o (GitHub)", speed: "Ultimate", status: "production", provider: "github" },
  { id: "gpt-4o-mini", name: "GPT-4o mini (Fast)", speed: "Fast", status: "production", provider: "github" },
  { id: "meta-llama-3.1-405b-instruct", name: "Llama 3.1 405B (Extreme)", speed: "Heavyweight", status: "production", provider: "github" },
  { id: "meta-llama-3.1-70b-instruct", name: "Llama 3.1 70B", speed: "Powerful", status: "production", provider: "github" },
  { id: "meta-llama-3.1-8b-instruct", name: "Llama 3.1 8B", speed: "Fast", status: "production", provider: "github" },
  { id: "phi-3-medium-128k-instruct", name: "Phi-3 Medium", speed: "Balanced", status: "production", provider: "github" },
  { id: "phi-3-mini-128k-instruct", name: "Phi-3 Mini", speed: "Fast", status: "production", provider: "github" },
  { id: "phi-3-small-128k-instruct", name: "Phi-3 Small", speed: "Fast", status: "production", provider: "github" },
  
  // --- HUGGING FACE ---
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Llama 3 8B Instruct", speed: "Fast", status: "production", provider: "huggingface" },

  // --- PUTER (Free, no API Key) ---
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Puter)", speed: "Heavyweight", status: "production", provider: "puter" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Puter)", speed: "Fast", status: "production", provider: "puter" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano (Puter)", speed: "Hyper Fast", status: "production", provider: "puter" },
  { id: "gpt-5.3-chat", name: "GPT-5.3 Chat (Puter)", speed: "Balanced", status: "production", provider: "puter" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (Puter)", speed: "Powerful", status: "production", provider: "puter" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Puter)", speed: "Fast", status: "production", provider: "puter" },
  { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout (Puter)", speed: "Fast", status: "production", provider: "puter" },
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

const callPuterAI = async (model: string, messages: Array<{role: string; content: string}>, maxTokens?: number): Promise<string> => {
  await loadPuterSDK();
  const puter = (window as any).puter;
  if (!puter?.ai?.chat) throw new Error("Puter.js SDK tidak tersedia. Pastikan popup tidak diblokir.");
  try {
    const isSignedIn = await puter.auth.isSignedIn();
    if (!isSignedIn) await puter.auth.signIn();
  } catch {}

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
// 🧠 AI Config Resolution
// ═══════════════════════════════════════════════════════════════════════════════
interface AIConfig {
  apiKey: string;
  useProxy: boolean;
  model: string;
  baseUrl: string;
  provider: string;
}

// Cache config for 30 seconds to avoid repeated DB calls
let configCache: { data: AIConfig; timestamp: number } | null = null;
const CONFIG_CACHE_TTL = 30000;

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
  
  const finalModel = isCustom ? rawModel : (actualModelDef ? actualModelDef.id : AI_MODELS[0].id);
  const finalProvider = isCustom ? "custom" : (rawProvider === "puter" ? "puter" : (actualModelDef ? actualModelDef.provider : "groq"));

  const resolveBaseUrl = (provider: string, gatewayUrl: string) => {
    switch (provider) {
      case "puter": return "__PUTER__";
      case "google": return "https://generativelanguage.googleapis.com/v1beta/openai";
      case "openrouter": return "https://openrouter.ai/api/v1";
      case "together": return "https://api.together.xyz/v1";
      case "huggingface": return "https://api-inference.huggingface.co/v1";
      case "fireworks": return "https://api.fireworks.ai/inference/v1";
      case "github": return "https://models.inference.ai.azure.com";
      case "cloudflare": return gatewayUrl ? `https://api.cloudflare.com/client/v4/accounts/${gatewayUrl}/ai/v1` : "";
      case "custom": return gatewayUrl;
      case "ollama": return pb.baseUrl + "/api/ai-proxy";
      case "groq": return "https://api.groq.com/openai/v1";
      default: return "https://api.groq.com/openai/v1";
    }
  };

  const cleanUrl = (base: string) => {
    if (!base) return "";
    let url = base.trim().replace(/\/$/, "");
    return url.includes("/chat/completions") ? url : `${url}/chat/completions`;
  };

  const gatewayUrl = config?.ai_gateway_url?.trim() || "";
  const baseUrl = cleanUrl(resolveBaseUrl(finalProvider, gatewayUrl));
  const useProxy = finalProvider !== "groq" && finalProvider !== "puter";

  let apiKey = "";
  if (finalProvider === "puter") {
    apiKey = "puter-no-key-needed";
  } else if (userRole === "admin") {
    apiKey = finalProvider === "groq" ? config?.groq_api_key : config?.ai_gateway_key;
    if (!apiKey?.trim()) throw new Error(`API Key untuk Provider ${finalProvider.toUpperCase()} belum diatur.`);
  } else {
    // Guru: pakai key pribadi, fallback ke key admin jika teacher_ai_access aktif
    const teacherHasOwnKey = userApiKey && userApiKey.trim();
    const adminKey = finalProvider === "groq" ? config?.groq_api_key : config?.ai_gateway_key;
    const isAIAccess = config?.teacher_ai_access ?? false;

    if (teacherHasOwnKey) {
      apiKey = userApiKey;
    } else if (isAIAccess && adminKey?.trim()) {
      apiKey = adminKey;
    } else {
      throw new Error("Anda belum memiliki API Key AI. Hubungi Admin untuk mengaktifkan akses AI atau masukkan API Key pribadi di Pengaturan AI.");
    }
  }

  const result: AIConfig = { apiKey, useProxy, model: finalModel, baseUrl, provider: finalProvider };
  configCache = { data: result, timestamp: Date.now() };
  return result;
};


// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 Unified AI Fetch Helper (eliminates code duplication)
// ═══════════════════════════════════════════════════════════════════════════════
interface AIFetchOptions {
  pb: PocketBase;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean; // Request JSON output format
}

const fetchAI = async (opts: AIFetchOptions): Promise<string> => {
  const { pb, messages, maxTokens, temperature = 0.7, jsonMode = true } = opts;
  const { apiKey, useProxy, model, baseUrl, provider } = await getAIConfig(pb);

  // Puter path
  if (provider === "puter") {
    return await callPuterAI(model, messages, maxTokens);
  }

  // Build request body with JSON mode support
  const body: any = { model, messages, temperature };
  if (maxTokens) body.max_tokens = maxTokens;
  if (jsonMode) {
    // Providers that support response_format
    const supportsJsonMode = ["groq", "openrouter", "together", "github", "google", "custom"].includes(provider);
    if (supportsJsonMode) {
      body.response_format = { type: "json_object" };
    }
  }

  let response: Response;
  if (useProxy) {
    response = await fetch(pb.baseUrl + "/api/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
      body: JSON.stringify({ baseUrl, apiKey, body })
    });
  } else {
    response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  // Handle rate limit
  if (response.status === 429) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message || "";
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
    rules.push("ATURAN RUMUS & SIMBOL MATEMATIKA/FISIKA:\n" +
"- Gunakan LaTeX HANYA untuk rumus matematika, persamaan, dan simbol ilmiah.\n" +
"- Inline: $...$. Display/block: $$...$$\n" +
"- JANGAN gunakan LaTeX untuk angka biasa tanpa konteks rumus (contoh: \"5 siswa\", \"tahun 2024\", \"nomor 3\" tetap teks biasa).\n" +
"- GUNAKAN LaTeX untuk: rumus ($v = v_0 + at$), angka+satuan fisika ($10\\\\text{ m/s}^2$), simbol ($\\\\rho$, $\\\\Omega$).\n" +
"- NOTASI STANDAR:\n" +
"  * Logaritma: ${}^a\\\\log b$\n" +
"  * Pecahan: $\\\\frac{a}{b}$\n" +
"  * Perkalian: $\\\\times$\n" +
"  * Pangkat: $10^{22}$\n" +
"  * Koma desimal: $9{,}8$\n" +
"  * Derajat: $90^\\\\circ$\n" +
"- Di dalam JSON string, backslash ditulis ganda: \"$\\\\\\\\frac{1}{2}$\"");
  }
  
  if (ctx.isChemistry) {
    rules.push(`ATURAN WAJIB KIMIA:
- Semua rumus kimia WAJIB menggunakan $\\\\ce{...}$ (mhchem package).
- Senyawa: $\\\\ce{H2SO4}$, $\\\\ce{Ca(OH)2}$, $\\\\ce{NaHCO3}$
- Reaksi: $\\\\ce{2H2 + O2 -> 2H2O}$
- Ion: $\\\\ce{Na+}$, $\\\\ce{Fe^{2+}}$, $\\\\ce{SO4^{2-}}$
- Kesetimbangan: $\\\\ce{N2 + 3H2 <=> 2NH3}$
- DILARANG menulis reaksi kimia sebagai teks biasa. Contoh SALAH: "2H2 + O2 → 2H2O". Contoh BENAR: "$\\\\ce{2H2 + O2 -> 2H2O}$"
- Di JSON: "$\\\\\\\\ce{H2SO4}$"`);
  }
  
  if (ctx.isProgramming) {
    rules.push(`Kode program: <pre class="ql-syntax" data-language="BAHASA">...</pre>.`);
  }
  if (ctx.explicitlyWantsArabic) {
    rules.push(`WAJIB sertakan ayat Al-Quran/Hadits dalam TEKS ARAB ASLI ber-harakat. Format: <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT ARAB</p> lalu terjemahan dalam <p style="font-style:italic;margin:8px 0;color:#555;">Terjemahan: "..."</p>.`);
  } else if (ctx.isReligious) {
    rules.push(`Jika relevan, sertakan ayat Arab ber-harakat dalam <p dir="rtl" style="text-align:right;font-size:1.3em;line-height:2;margin:12px 0;">AYAT</p>. Pisahkan dari teks Latin.`);
  }
  
  return rules.length > 0 ? rules.join("\n\n") : "PENTING: Tulis soal dalam teks biasa (plain text/HTML). JANGAN gunakan simbol $ atau LaTeX kecuali mapel Matematika/Fisika/Kimia.";
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
  return questions.filter(q => {
    // Must have text
    if (!q.text?.trim() && !q.question?.trim()) return false;
    const qType = q.type || requestedType || "pilihan_ganda";
    
    // For multiple choice: must have at least 2 choices
    if ((qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") && q.choices && typeof q.choices === "object") {
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
    
    // For menjodohkan: should have pairs (but allow empty for manual editing)
    if (qType === "menjodohkan") {
      // Try to extract pairs from choices if pairs is missing (AI sometimes returns wrong format)
      if ((!q.pairs || !Array.isArray(q.pairs) || q.pairs.length === 0) && q.choices) {
        // Convert choices to pairs: key=left, text=right
        const keys = Object.keys(q.choices);
        if (keys.length >= 2) {
          q.pairs = keys.map((k, idx) => ({
            id: String(idx + 1),
            left: k.toUpperCase() + ". " + (q.choices[k]?.text || ""),
            right: ""
          }));
        }
      }
      if (q.pairs && Array.isArray(q.pairs)) {
        const validPairs = q.pairs.filter((p: any) => p.left?.trim() && p.right?.trim());
        if (validPairs.length >= 2) {
          q.pairs = validPairs.map((p: any, idx: number) => ({
            id: p.id || String(idx + 1),
            left: p.left.trim(),
            right: p.right.trim()
          }));
        } else if (q.pairs.length >= 2) {
          // Keep pairs even if some are incomplete (user can edit in batch modal)
          q.pairs = q.pairs.map((p: any, idx: number) => ({
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
    
    // For isian_singkat: must have answerKey
    if (qType === "isian_singkat" && !q.answerKey?.trim() && !q.answer_key?.trim() && !q.answer?.trim()) return false;
    
    return true;
  }).map(q => ({
    text: stripUnwantedLatex(q.text || q.question || "", isExactSubject),
    type: q.type || requestedType || "pilihan_ganda",
    choices: (() => {
      const c = q.choices || q.options || undefined;
      if (c && !isExactSubject) {
        const cleaned: any = {};
        Object.keys(c).forEach(k => {
          cleaned[k] = { ...c[k], text: stripUnwantedLatex(c[k]?.text || "", isExactSubject) };
        });
        return cleaned;
      }
      return c;
    })(),
    pairs: q.pairs || undefined,
    items: q.items || undefined,
    answerKey: q.answerKey || q.answer_key || q.answer || "",
    groupId: q.groupId || "",
    groupText: q.groupText || ""
  }));
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
  focus: string = "umum"
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
      drag_drop: "Drag & Drop (susun/kelompokkan item ke posisi benar)"
    };
    const typeLabel = typeDesc[type] || "Pilihan Ganda";

    // ═══ PARALLEL BATCH for large counts (>7 soal) ═══
    if (count > 7 && !isLiteracy) {
      const batchSize = Math.ceil(count / 2);
      const batches = [batchSize, count - batchSize];
      console.log(`⚡ [PARALLEL] Splitting ${count} into batches: ${batches.join(', ')}`);
      
      const results = await Promise.allSettled(
        batches.map(batchCount => 
          generateQuestionsAI(pb, topic, batchCount, level, subject, type, false, passageLength, difficulty, focus)
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

      const systemPrompt = `Anda adalah Spesialis Evaluasi Pendidikan. Buat stimulus literasi + ${count} soal ${typeLabel} dalam SATU respons.
Jenjang: ${level}, Mapel: ${subject}, Kesulitan: ${difficulty}, Fokus: ${focus}.

INSTRUKSI:
1. Buat stimulus/wacana bertema "${topic}" sepanjang ${lengthMap[passageLength] || lengthMap.sedang}. Sajikan sebagai artikel/studi kasus menarik (bukan definisi). Format HTML: <h2 style="text-align:center;color:#1e3a8a;margin-bottom:32px;font-weight:900;">[JUDUL]</h2> lalu <p style="text-indent:30px;margin-bottom:24px;line-height:1.8;text-align:justify;">paragraf</p>.
2. Buat ${count} soal ${typeLabel} berdasarkan stimulus. Variasi pola: konsep, aplikasi, analisis, evaluasi. ${litTypeInstructions}
${formatRules ? `3. FORMAT KHUSUS:\n${formatRules}` : ""}${fewShotLit ? `\n${fewShotLit}` : ""}

OUTPUT JSON (WAJIB):
${litTypeFormat}
Hanya JSON. Pastikan stimulus SELESAI SEMPURNA (tidak terpotong).`;

      const topicLower = topic.toLowerCase();
      const isTopicInstruction = topic.length > 50 || topicLower.includes('buat') || topicLower.includes('berikan');
      const userPrompt = isTopicInstruction
        ? `INSTRUKSI: ${topic}\nBuat stimulus + ${count} soal sesuai instruksi di atas.`
        : `Topik: "${topic}". Buat stimulus literasi + ${count} soal ${typeLabel}.`;

      // Token estimation: stimulus + questions combined
      const stimulusTokens = ({ pendek: 500, sedang: 1000, panjang: 1800 }[passageLength] || 1000);
      const questionTokens = count * (ctx.isReligious || ctx.explicitlyWantsArabic ? 700 : 400);
      const totalTokens = Math.min(stimulusTokens + questionTokens + 200, 12000);

      const content = await fetchAI({
        pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        maxTokens: totalTokens, temperature: 0.75
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
        default:
          return `OUTPUT JSON: {"questions":[{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}]}`;
      }
    };

    const typeOutputFormat = getTypeOutputFormat(type);
    
    const systemPrompt = `Buat ${count} soal ${typeLabel}, ${level} - ${subject}, kesulitan ${difficulty}, fokus ${focus}.
Variasi pola: konsep, aplikasi, analisis, evaluasi. Variasi panjang stem.${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? " Opsi A-E ringkas & logis. Kunci jawaban acak." : ""}
${formatRules ? `\n${formatRules}\n` : ""}${fewShot ? `\n${fewShot}\n` : ""}
${typeOutputFormat}
Hanya JSON.`;

    const topicLower = topic.toLowerCase();
    const isTopicInstruction = topic.length > 50 || topic.includes(',') || topicLower.includes('buat') || topicLower.includes('berikan') || topicLower.includes('pakai');
    
    const userPrompt = isTopicInstruction
      ? `INSTRUKSI PENGGUNA: ${topic}\nBuat ${count} soal ${typeLabel}, ${level} - ${subject}. Ikuti instruksi di atas.`
      : `Topik: "${topic}". Buat ${count} soal ${typeLabel}, ${level} - ${subject}. Variasi panjang stem & tipe pertanyaan.`;

    const baseTokens = (ctx.isReligious || ctx.explicitlyWantsArabic) ? 700 : 350;
    const maxTokens = Math.min(Math.max(count * baseTokens, 1500), 8000);

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      maxTokens, temperature: 0.8
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
  existingWacana: string = ""
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
      drag_drop: "Drag & Drop (4-6 item disusun/dikelompokkan)"
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
        default:
          return `JSON:{"text":"...","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},"b":{"text":"...","isCorrect":false},"c":{"text":"...","isCorrect":true},"d":{"text":"...","isCorrect":false},"e":{"text":"...","isCorrect":false}},"answerKey":"c"}`;
      }
    };

    const typeFormat = getSingleTypeFormat(type);

    const systemPrompt = `Buat 1 soal ${typeLabel}, ${level} - ${subject}, kesulitan ${difficulty}.
${formatRules ? `FORMAT: ${formatRules}` : ""}${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? " Opsi A-E ringkas. Kunci jawaban acak." : ""}
${typeFormat}
Hanya JSON.`;

    const userPrompt = existingWacana 
      ? `STIMULUS LITERASI:\n${existingWacana}\n\nBuat 1 soal ${typeLabel} baru dari stimulus di atas. Jangan tanya definisi. Variasi bentuk pertanyaan.`
      : `Topik: "${topic}". Buat 1 soal ${typeLabel}. Variasi bentuk pertanyaan.`;

    const maxTokens = ctx.isReligious ? 900 : (type === "menjodohkan" || type === "urutkan" || type === "drag_drop" || type === "uraian") ? 800 : 600;

    const content = await fetchAI({
      pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      maxTokens, temperature: 0.8
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
      answerKey: result.answerKey || result.answer_key || result.correctAnswer || "",
      groupId: "",
      groupText: existingWacana
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
export const testAIConnection = async (pb: PocketBase, apiKey: string, modelId: string, customUrl?: string, provider: string = "groq"): Promise<{ success: boolean; message: string }> => {
  try {
    const actualModelDef = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];
    const finalProvider = provider || actualModelDef.provider;

    if (finalProvider === "puter") {
      try {
        await loadPuterSDK();
        const puter = (window as any).puter;
        if (!puter?.ai?.chat) return { success: false, message: "Puter.js SDK tidak tersedia." };
        try { const isSignedIn = await puter.auth.isSignedIn(); if (!isSignedIn) await puter.auth.signIn(); } catch {}
        await puter.ai.chat("Say hi", { model: modelId, max_tokens: 10 });
        return { success: true, message: `Koneksi Puter Berhasil! (Model: ${modelId})` };
      } catch (e: any) {
        return { success: false, message: e.message || "Gagal koneksi ke Puter AI." };
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
      let url = base.trim().replace(/\/$/, "");
      return url.includes("/chat/completions") ? url : `${url}/chat/completions`;
    };

    const baseUrl = cleanUrl(resolveBaseUrl(finalProvider, customUrl || ""));
    if (!baseUrl) throw new Error("Base URL / Account ID belum lengkap.");

    let response;
    if (useProxy) {
      response = await fetch(pb.baseUrl + "/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Token": pb.authStore.token },
        body: JSON.stringify({ baseUrl, apiKey, body: { model: modelId, messages: [{ role: "user", content: "hi" }], max_tokens: 5, stream: false } })
      });
    } else {
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "hi" }], max_tokens: 5 })
      });
    }

    if (response.ok) return { success: true, message: "Koneksi Berhasil!" };
    
    let errorMessage = "Gagal menghubungi AI";
    try {
      const err = await response.json();
      errorMessage = err.error?.message || err.error || err.message || JSON.stringify(err);
    } catch { errorMessage = `Server Error: ${response.status} ${response.statusText}`; }
    
    return { success: false, message: errorMessage };
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menghubungi server AI." };
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
        default:
          return `JSON: {"questions":[{"text":"pertanyaan SAJA","type":"pilihan_ganda","choices":{"a":{"text":"...","isCorrect":false},...,"e":{"text":"...","isCorrect":true}},"answerKey":"e"}]}`;
      }
    };

    const materialTypeFormat = getMaterialTypeFormat(type);

    const systemPrompt = `Anda adalah Spesialis Kurikulum & Evaluasi Pendidikan.
Tugas: Buat ${count} soal ${typeDesc} berdasarkan MATERI yang diberikan.
Jenjang: ${level}, Mapel: ${subject}, Kesulitan: ${difficulty}.

KETENTUAN:
1. AKURASI: Soal WAJIB berdasarkan fakta dalam materi.
2. HOTS & VARIASI: Wajib variasi pola (analisis, evaluasi, kreasi, skenario kasus). DILARANG pola seragam.
${type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" ? "3. OPSI: 5 pilihan (A-E) variatif, logis, diawali huruf kapital." : "3. Pastikan format sesuai tipe soal."}
4. LITERASI: Jika diminta, masukkan wacana ke "groupText" (BUKAN "text"). Berikan "groupId" sama untuk soal satu wacana.
${formatRules ? `\n${formatRules}` : ""}${fewShot ? `\n${fewShot}` : ""}

${materialTypeFormat}
Hanya JSON murni.`;

    const userPrompt = `MATERI:\n\n${material}\n\nBuat ${count} soal ${typeDesc}, kesulitan ${difficulty}. WAJIB variasi pola pertanyaan. Jika ada instruksi spesifik dalam materi, ikuti sebagai prioritas.`;

    // Parallel batch for large counts
    if (count > 7) {
      const batchSize = Math.ceil(count / 2);
      const batches = [batchSize, count - batchSize];
      const results = await Promise.allSettled(
        batches.map(batchCount => {
          const batchUserPrompt = `MATERI:\n\n${material}\n\nBuat ${batchCount} soal ${typeDesc}, kesulitan ${difficulty}. WAJIB variasi pola pertanyaan.`;
          return fetchAI({
            pb, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: batchUserPrompt }],
            maxTokens: batchCount * 1200, temperature: 0.7
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
      maxTokens: count * 1200, temperature: 0.7
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
