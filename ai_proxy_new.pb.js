routerAdd("POST", "/api/ai-proxy", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch(e) {}
        try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch(e) {}
        try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch(e) {}

        const info = c.requestInfo();
        const apiKey = (info.body["apiKey"] || "").toString();
        const baseUrl = (info.body["baseUrl"] || "").toString();
        const bodyData = info.body["body"];

        if (!apiKey || apiKey === "undefined" || apiKey === "") {
            return c.json(400, { error: "Missing API Key" });
        }
        if (!baseUrl || baseUrl === "") {
            return c.json(400, { error: "Missing Base URL" });
        }

        const model = (bodyData["model"] || "").toString();
        const msgs = bodyData["messages"];
        const msgArray = [];
        if (msgs) {
            for (let i = 0; i < msgs.length; i++) {
                msgArray.push({
                    role: (msgs[i]["role"] || "user").toString(),
                    content: (msgs[i]["content"] || "").toString()
                });
            }
        }

        // 🎯 Smart URL detection:
        // - Ollama: gunakan /api/chat
        // - OpenAI-compatible (Cloudflare, Groq, Google, dll): gunakan URL apa adanya
        //   karena frontend sudah menambahkan /chat/completions
        let finalUrl = baseUrl;
        if (baseUrl.includes("ollama.com") || baseUrl.includes(":11434")) {
            finalUrl = baseUrl.endsWith("/api/chat") ? baseUrl : baseUrl.replace(/\/$/, "") + "/api/chat";
        }
        // Jika URL belum punya endpoint sama sekali, tambahkan /chat/completions
        else if (!baseUrl.includes("/chat/completions") && !baseUrl.includes("/api/chat") && !baseUrl.includes("/v1/engines")) {
            finalUrl = baseUrl.replace(/\/$/, "") + "/chat/completions";
        }

        console.log("[PROXY] Forwarding to: " + finalUrl + " | model: " + model);

        // Tentukan max_tokens — default 2500 untuk mendukung model reasoning (Kimi, DeepSeek, QwQ)
        const maxTokens = bodyData["max_tokens"] ? parseInt(bodyData["max_tokens"]) : 2500;

        const reqBody = {
            model: model,
            messages: msgArray,
            stream: false,
            max_tokens: maxTokens
        };

        if (bodyData["temperature"]) reqBody["temperature"] = bodyData["temperature"];

        const res = $http.send({
            url: finalUrl,
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reqBody)
        });

        console.log("[PROXY] Response status: " + res.statusCode);

        let result = {};
        try {
            result = JSON.parse(res.raw || "{}");
        } catch(e) {
            result = { error: "Parse failed", raw: res.raw };
        }

        return c.json(res.statusCode, result);
    } catch (e) {
        console.log("[PROXY] CRASH: " + e.message);
        return c.json(500, { error: e.message });
    }
});

routerAdd("OPTIONS", "/api/ai-proxy", (c) => {
    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization");
    } catch(e) {}
    return c.noContent(204);
});
