routerAdd("POST", "/api/ai-proxy", (c) => {
    try {
        // 🔥 Use Try/Catch for each header to prevent crash
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }

        console.log("[PROXY] step 1: getting requestInfo");
        const info = c.requestInfo();

        console.log("[PROXY] step 2: extracting data safely");
        // Safe extraction from Go map (bracket notation is safe)
        const apiKey = (info.body["apiKey"] || "").toString();
        const baseUrl = (info.body["baseUrl"] || "https://ollama.com").toString();
        const bodyData = info.body["body"];

        if (!apiKey || apiKey === "undefined") {
            return c.json(400, { error: "Missing API Key" });
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

        console.log("[PROXY] forwarding to " + baseUrl + " model " + model);

        const res = $http.send({
            url: baseUrl + "/api/chat",
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: msgArray,
                stream: false
            })
        });

        console.log("[PROXY] ollama responded: " + res.statusCode);

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
    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization");
    } catch (e) { }
    return c.noContent(204);
});
