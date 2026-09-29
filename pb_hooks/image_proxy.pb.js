// ============================================================
// Image Proxy Gateway — SECURED (2026-09-29)
// - Wajib login (sebelumnya terbuka untuk publik).
// - URL divalidasi: hanya http/https, tolak IP privat,
//   localhost, dan metadata cloud (anti-SSRF).
//
// CATATAN FRONTEND: kirim header Authorization (token login)
//   saat memanggil endpoint ini untuk export.
// CATATAN TEKNIS: helper harus inline di handler
//   (binding top-level tidak terlihat di callback).
// ============================================================

routerAdd("GET", "/api/image-proxy", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (e) {}
    }
    // Tolak URL yang mengarah ke jaringan internal / metadata cloud.
    function urlOk(url) {
        const m = /^https?:\/\/([^\/:]+)(:\d+)?(\/.*)?$/i.exec(url || "");
        if (!m) return false;
        const host = m[1].toLowerCase();
        if (host === "localhost" || host === "localhost.") return false;
        if (host === "[::1]" || host === "[::]" || host === "[::ffff:127.0.0.1]") return false;
        const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
        if (ipv4) {
            const a = parseInt(ipv4[1]), b = parseInt(ipv4[2]);
            if (a === 10) return false;                        // 10.0.0.0/8
            if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
            if (a === 192 && b === 168) return false;         // 192.168.0.0/16
            if (a === 127) return false;                      // 127.0.0.0/8
            if (a === 169 && b === 254) return false;         // 169.254.0.0/16 (metadata cloud)
            if (a === 0) return false;                        // 0.0.0.0/8
        }
        return true;
    }
    try {
        setCors(c);

        const info = c.requestInfo();
        let authed = false;
        try { authed = !!(info.auth); } catch (e) {}
        if (!authed) {
            return c.json(401, { error: "Login diperlukan" });
        }

        const url = (info.query["url"] || "").toString();
        if (!url) {
            return c.json(400, { error: "Missing url parameter" });
        }
        if (!urlOk(url)) {
            return c.json(400, { error: "URL tidak diizinkan" });
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
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (e) {}
    return c.noContent(204);
});
