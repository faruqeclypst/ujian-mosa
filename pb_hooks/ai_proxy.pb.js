// ============================================================
// AI Proxy Gateway (v0.25+)
// Resolves CORS and forwards AI requests safely to Ollama Cloud
// ============================================================

routerAdd("POST", "/api/ai-proxy", (c) => {
    try {
        // 🛡️ Always set CORS headers first
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization");

        const info = c.requestInfo();
        const apiKey = (info.body["apiKey"] || "").toString();
        const baseUrl = (info.body["baseUrl"] || "https://ollama.com").toString();
        const bodyData = info.body["body"] || {};
        
        if (!apiKey) return c.json(400, { error: "Missing API Key" });

        const model = (bodyData["model"] || "").toString();
        const isGroq = baseUrl.includes("groq.com");
        
        // 🎯 Resolve Correct API Endpoint
        const targetUrl = isGroq 
            ? "https://api.groq.com/openai/v1/chat/completions" 
            : baseUrl + "/api/chat";

        // 🧠 Rebuild messages safely
        const msgs = bodyData["messages"] || [];
        const msgArray = [];
        for (let i = 0; i < msgs.length; i++) {
            msgArray.push({
                role: (msgs[i]["role"] || "user").toString(),
                content: (msgs[i]["content"] || "").toString()
            });
        }

        console.log("[PROXY] forwarding to " + (isGroq ? "GROQ" : "OLLAMA") + " model: " + model);

        // 🚀 Forward request
        const res = $http.send({
            url: targetUrl,
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: msgArray,
                stream: false,
                ...(isGroq ? { temperature: 0.7 } : {})
            }),
            timeout: 60 // ⏳ Increase timeout to 60s
        });

        let result = {};
        try {
            result = JSON.parse(res.raw || "{}");
        } catch(e) {
            result = { error: "AI Response Error", raw: res.raw };
        }

        return c.json(res.statusCode, result);
    } catch (e) {
        return c.json(500, { error: e.message });
    }
});

// 🛡️ Handles CORS Preflight
routerAdd("OPTIONS", "/api/ai-proxy", (c) => {
    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization");
    } catch(e) {}
    return c.noContent(204);
});
