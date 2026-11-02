// ============================================================
// AI Proxy Gateway — SECURED (2026-09-29)
// - API key, model, & base URL diambil dari settings di
//   SERVER, tidak lagi dari body request client.
// - Wajib login dan hanya untuk superuser/users
//   (guru/admin); students ditolak.
// - Tidak lagi meneruskan ke URL bebas (open proxy ditutup).
//
// CATATAN FRONTEND: berhenti kirim apiKey & baseUrl di body.
//   Cukup kirim { messages, max_tokens?, temperature? }.
// CATATAN TEKNIS: helper harus inline di tiap handler
//   (binding top-level tidak terlihat di callback).
// ============================================================

routerAdd("POST", "/api/ai-proxy", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }
    }
    function allowed(info) {
        try {
            const auth = info.auth;
            if (!auth) return false;
            const n = auth.collection().name;
            return n === "_superusers" || n === "users";
        } catch (e) { return false; }
    }
    function chatUrl(baseUrl, isAnthropic) {
        if (isAnthropic) {
            if (baseUrl.includes("/messages")) return baseUrl;
            return baseUrl.replace(/\/$/, "") + (baseUrl.includes("/v1") ? "/messages" : "/v1/messages");
        }
        if (baseUrl.includes("ollama.com") || baseUrl.includes(":11434")) {
            return baseUrl.endsWith("/api/chat") ? baseUrl : baseUrl.replace(/\/$/, "") + "/api/chat";
        }
        if (!baseUrl.includes("/chat/completions") && !baseUrl.includes("/api/chat") && !baseUrl.includes("/v1/engines")) {
            return baseUrl.replace(/\/$/, "") + "/chat/completions";
        }
        return baseUrl;
    }
    try {
        setCors(c);
        const info = c.requestInfo();
        if (!allowed(info)) {
            return c.json(403, { error: "Akses ditolak" });
        }

        const settings = $app.findFirstRecordByFilter("settings", "id != ''");
        const bodyData = info.body || {};

        let apiKey = (settings ? (settings.getString("ai_gateway_key") || settings.getString("groq_api_key")) : "");
        let baseUrl = (settings ? settings.getString("ai_gateway_url") : "") || "https://apihub.agnes-ai.com/v1";
        let model = (settings ? settings.getString("ai_model") : "") || "agnes-2.5-flash";

        // Izinkan guru/admin yang terotentikasi membawa API Key, Base URL, atau Model pribadi/khusus
        if (bodyData.apiKey && typeof bodyData.apiKey === "string" && bodyData.apiKey.trim()) {
            apiKey = bodyData.apiKey.trim();
        }
        if (bodyData.baseUrl && typeof bodyData.baseUrl === "string" && bodyData.baseUrl.trim()) {
            baseUrl = bodyData.baseUrl.trim();
        }
        if (bodyData.model && typeof bodyData.model === "string" && bodyData.model.trim()) {
            model = bodyData.model.trim();
        }

        const isAnthropic = baseUrl.includes("anthropic.com") || baseUrl.includes("/messages") || (apiKey && apiKey.startsWith("sk-ant-")) || bodyData.isAnthropic === true;
        const isOllama = !isAnthropic && (baseUrl.includes("ollama") || baseUrl.includes(":11434") || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"));
        if (!isOllama && !apiKey) {
            return c.json(400, { error: "API Key AI belum diatur. Silakan masukkan API Key di Pengaturan AI." });
        }
        if (!model) {
            return c.json(400, { error: "Model AI belum ditentukan. Silakan pilih atau masukkan ID Model di Pengaturan AI." });
        }

        const msgs = bodyData["messages"] || [];
        const maxTokens = bodyData["max_tokens"] ? parseInt(bodyData["max_tokens"]) : 4000;

        if (isAnthropic) {
            let systemText = "";
            const anthropicMsgs = [];
            for (let i = 0; i < msgs.length; i++) {
                const r = (msgs[i]["role"] || "user").toString();
                const content = (msgs[i]["content"] || "").toString();
                if (r === "system") {
                    systemText = systemText ? systemText + "\n\n" + content : content;
                } else {
                    const mappedRole = r === "assistant" ? "assistant" : "user";
                    if (anthropicMsgs.length > 0 && anthropicMsgs[anthropicMsgs.length - 1].role === mappedRole) {
                        anthropicMsgs[anthropicMsgs.length - 1].content += "\n\n" + content;
                    } else {
                        anthropicMsgs.push({ role: mappedRole, content: content });
                    }
                }
            }
            if (anthropicMsgs.length === 0 || anthropicMsgs[0].role !== "user") {
                anthropicMsgs.unshift({ role: "user", content: "Mulai pembuatan butir soal." });
            }

            const reqBody = {
                model: model,
                messages: anthropicMsgs,
                max_tokens: maxTokens
            };
            if (systemText) reqBody["system"] = systemText;
            if (bodyData["temperature"]) reqBody["temperature"] = bodyData["temperature"];

            const finalUrl = chatUrl(baseUrl, true);
            console.log("[PROXY-ANTHROPIC] forwarding to " + finalUrl + " model " + model);

            const reqHeaders = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            };

            const res = $http.send({
                url: finalUrl,
                method: "POST",
                headers: reqHeaders,
                body: JSON.stringify(reqBody),
                timeout: 60
            });

            let result = {};
            try { result = JSON.parse(res.raw || "{}"); } catch (e) { result = { error: "Parse failed", raw: res.raw }; }
            return c.json(res.statusCode, result);
        }

        // OpenAI-Compatible / Ollama
        const msgArray = [];
        for (let i = 0; i < msgs.length; i++) {
            msgArray.push({
                role: (msgs[i]["role"] || "user").toString(),
                content: (msgs[i]["content"] || "").toString()
            });
        }
        if (msgArray.length === 0) {
            return c.json(400, { error: "Messages kosong" });
        }

        const reqBody = {
            model: model,
            messages: msgArray,
            stream: false,
            max_tokens: maxTokens
        };
        if (bodyData["temperature"]) reqBody["temperature"] = bodyData["temperature"];
        if (bodyData["response_format"]) reqBody["response_format"] = bodyData["response_format"];

        const finalUrl = chatUrl(baseUrl, false);
        console.log("[PROXY] forwarding to " + finalUrl + " model " + model);

        const reqHeaders = { "Content-Type": "application/json" };
        if (apiKey && apiKey !== "no-key" && !isOllama) {
            reqHeaders["Authorization"] = "Bearer " + apiKey;
        }

        const res = $http.send({
            url: finalUrl,
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify(reqBody),
            timeout: 60
        });

        let result = {};
        try {
            result = JSON.parse(res.raw || "{}");
        } catch (e) {
            result = { error: "Parse failed", raw: res.raw };
        }
        return c.json(res.statusCode, result);
    } catch (e) {
        console.log("[PROXY] CRASH: " + (e && e.message ? e.message : String(e)));
        return c.json(500, { error: (e && e.message ? e.message : String(e)) });
    }
});

routerAdd("OPTIONS", "/api/ai-proxy", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }
    return c.noContent(204);
});

// ============================================================
// AI Proxy - Models List (secured, pakai konfigurasi server)
// ============================================================
routerAdd("POST", "/api/ai-proxy-models", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }
    }
    function allowed(info) {
        try {
            const auth = info.auth;
            if (!auth) return false;
            const n = auth.collection().name;
            return n === "_superusers" || n === "users";
        } catch (e) { return false; }
    }
    try {
        setCors(c);
        const info = c.requestInfo();
        if (!allowed(info)) {
            return c.json(403, { error: "Akses ditolak" });
        }

        const settings = $app.findFirstRecordByFilter("settings", "id != ''");
        const bodyData = info.body || {};

        let apiKey = (settings ? (settings.getString("ai_gateway_key") || settings.getString("groq_api_key")) : "");
        let baseUrl = (settings ? settings.getString("ai_gateway_url") : "") || "https://apihub.agnes-ai.com/v1";

        if (bodyData.apiKey && typeof bodyData.apiKey === "string" && bodyData.apiKey.trim()) {
            apiKey = bodyData.apiKey.trim();
        }
        if (bodyData.baseUrl && typeof bodyData.baseUrl === "string" && bodyData.baseUrl.trim()) {
            baseUrl = bodyData.baseUrl.trim();
        }

        const isAnthropic = baseUrl.includes("anthropic.com") || (apiKey && apiKey.startsWith("sk-ant-"));
        const isOllama = !isAnthropic && (baseUrl.includes("ollama") || baseUrl.includes(":11434") || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"));
        if (!isOllama && !apiKey) {
            return c.json(400, { error: "AI belum dikonfigurasi di server" });
        }

        let modelsUrl = baseUrl.replace(/\/$/, "").replace(/\/chat\/completions$/, "").replace(/\/messages$/, "");
        const reqHeaders = { "Content-Type": "application/json" };
        if (isAnthropic) {
            modelsUrl = modelsUrl.endsWith("/models") ? modelsUrl : modelsUrl + (modelsUrl.includes("/v1") ? "/models" : "/v1/models");
            reqHeaders["x-api-key"] = apiKey;
            reqHeaders["anthropic-version"] = "2023-06-01";
        } else if (isOllama) {
            modelsUrl = modelsUrl.endsWith("/api/tags") ? modelsUrl : modelsUrl + "/api/tags";
        } else {
            modelsUrl = modelsUrl.endsWith("/models") ? modelsUrl : modelsUrl + "/models";
            if (apiKey && apiKey !== "no-key") {
                reqHeaders["Authorization"] = "Bearer " + apiKey;
            }
        }

        console.log("[PROXY-MODELS] fetching: " + modelsUrl);

        const res = $http.send({
            url: modelsUrl,
            method: "GET",
            headers: reqHeaders,
            timeout: 20
        });

        let result = {};
        try {
            result = JSON.parse(res.raw || "{}");
        } catch (e) {
            result = { error: "Parse failed", raw: res.raw };
        }
        return c.json(res.statusCode, result);
    } catch (e) {
        console.log("[PROXY-MODELS] CRASH: " + e.message);
        return c.json(500, { error: e.message });
    }
});

routerAdd("OPTIONS", "/api/ai-proxy-models", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }
    return c.noContent(204);
});




