routerAdd("GET", "/api/ai-test", (c) => {
    try {
        const settings = $app.findFirstRecordByFilter("settings", "id != ''");
        const apiKey = settings.get("ai_gateway_key") || settings.get("groq_api_key");
        const model = settings.get("ai_model") || "llama-3.1-8b-instant";

        console.log("-> AI Test: Starting connection test to Ollama Cloud...");

        const res = $http.send({
            url: "https://ollama.com/api/chat",
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Say hi short" }],
                stream: false
            })
        });

        console.log("<- AI Test: Finished with status " + res.statusCode);

        return c.json(200, {
            status: res.statusCode === 200 ? "SUCCESS" : "FAILED",
            code: res.statusCode,
            response: res.raw ? JSON.parse(res.raw) : "EMPTY RESPONSE",
            config: {
                model: model,
                hasKey: !!apiKey
            }
        });
    } catch (e) {
        return c.json(500, { error: e.message });
    }
});
