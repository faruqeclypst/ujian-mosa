// ============================================================
// Image Proxy Gateway
// Resolves CORS and forwards image requests safely for exports
// ============================================================

routerAdd("GET", "/api/image-proxy", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (e) { }

        const info = c.requestInfo();
        const url = (info.query["url"] || "").toString();

        if (!url) {
            return c.json(400, { error: "Missing url parameter" });
        }

        const res = $http.send({
            url: url,
            method: "GET"
        });

        if (res.statusCode < 200 || res.statusCode >= 400) {
            return c.json(res.statusCode, { error: "Failed to fetch image", status: res.statusCode });
        }

        const contentType = (res.headers["Content-Type"] && res.headers["Content-Type"][0]) || "image/png";

        // Convert byte array to base64
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const bytes = res.body || [];
        let base64 = "";
        const len = bytes.length;
        for (let i = 0; i < len; i += 3) {
            const b1 = bytes[i];
            const b2 = i + 1 < len ? bytes[i + 1] : 0;
            const b3 = i + 2 < len ? bytes[i + 2] : 0;

            base64 += chars[b1 >> 2];
            base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
            base64 += (i + 1 < len) ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
            base64 += (i + 2 < len) ? chars[b3 & 63] : "=";
        }

        return c.json(200, {
            contentType: contentType,
            base64: base64
        });
    } catch (e) {
        return c.json(500, { error: e.message });
    }
});

routerAdd("OPTIONS", "/api/image-proxy", (c) => {
    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "*");
    } catch (e) { }
    return c.noContent(204);
});
