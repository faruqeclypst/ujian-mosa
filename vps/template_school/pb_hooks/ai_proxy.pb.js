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
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    }
    function allowed(info) {
        try {
            const auth = info.auth;
            if (!auth) return false;
            const n = auth.collection().name;
            return n === "_superusers" || n === "users";
        } catch (e) { return false; }
    }
    function chatUrl(baseUrl) {
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
        if (!settings) return c.json(500, { error: "Settings tidak ditemukan" });
        const apiKey = settings.getString("ai_gateway_key") || settings.getString("groq_api_key");
        const baseUrl = settings.getString("ai_gateway_url") || "https://api.groq.com";
        const model = settings.getString("ai_model") || "llama-3.1-8b-instant";
        if (!apiKey) return c.json(500, { error: "AI belum dikonfigurasi di server" });

        const bodyData = info.body || {};
        const msgs = bodyData["messages"] || [];
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

        const maxTokens = bodyData["max_tokens"] ? parseInt(bodyData["max_tokens"]) : 4000;
        const reqBody = {
            model: model,
            messages: msgArray,
            stream: false,
            max_tokens: maxTokens
        };
        if (bodyData["temperature"]) reqBody["temperature"] = bodyData["temperature"];

        const finalUrl = chatUrl(baseUrl);
        console.log("[PROXY] forwarding to " + finalUrl + " model " + model);

        const res = $http.send({
            url: finalUrl,
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reqBody)
        });

        let result = {};
        try {
            result = JSON.parse(res.raw || "{}");
        } catch (e) {
            result = { error: "Parse failed", raw: res.raw };
        }
        return c.json(res.statusCode, result);
    } catch (e) {
        console.log("[PROXY] CRASH: " + e.message);
        return c.json(500, { error: e.message });
    }
});

routerAdd("OPTIONS", "/api/ai-proxy", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    return c.noContent(204);
});

// ============================================================
// AI Proxy - Models List (secured, pakai konfigurasi server)
// ============================================================
routerAdd("POST", "/api/ai-proxy-models", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
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
        if (!settings) return c.json(500, { error: "Settings tidak ditemukan" });
        const apiKey = settings.getString("ai_gateway_key") || settings.getString("groq_api_key");
        const baseUrl = settings.getString("ai_gateway_url") || "https://api.groq.com";
        if (!apiKey) return c.json(500, { error: "AI belum dikonfigurasi di server" });

        let modelsUrl = baseUrl.replace(/\/$/, "");
        if (baseUrl.includes("ollama.com") || baseUrl.includes(":11434")) {
            modelsUrl = modelsUrl + "/api/tags";
        } else {
            modelsUrl = modelsUrl + "/models";
        }

        console.log("[PROXY-MODELS] fetching: " + modelsUrl);

        const res = $http.send({
            url: modelsUrl,
            method: "GET",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            }
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
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    return c.noContent(204);
});
