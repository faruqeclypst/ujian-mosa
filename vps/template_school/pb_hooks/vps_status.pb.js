// ============================================================
// TENANT VPS STATUS HOOK
// GET /api/vps-status
// Memberikan data resource VPS real-time untuk panel admin tenant
// ============================================================

routerAdd("OPTIONS", "/api/vps-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    return c.noContent(204);
});

routerAdd("GET", "/api/vps-status", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    }
    setCors(c);

    function getAuth(info) {
        try {
            if (info && info.auth) return info.auth;
            const headers = info ? (info.headers || {}) : {};
            let token = headers["authorization"] || headers["x-token"] || "";
            if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                token = token.substring(7).trim();
            }
            if (token) {
                return $app.findAuthRecordByToken(token);
            }
        } catch (e) {}
        return null;
    }

    const info = c.requestInfo();
    const auth = getAuth(info);

    if (!auth) {
        return c.json(401, { error: "Autentikasi diperlukan." });
    }

    let authCol = "";
    try {
        if (auth.collection) authCol = auth.collection().name;
    } catch (e) {}

    if (authCol !== "_superusers" && authCol !== "users") {
        return c.json(403, { error: "Akses ditolak." });
    }

    try {
        const out = $os.cmd("/usr/local/bin/vps-health.py").output();
        let outStr = "";
        for (let i = 0; i < out.length; i++) {
            outStr += String.fromCharCode(out[i]);
        }
        const data = JSON.parse(outStr.trim());
        return c.json(200, data);
    } catch (err) {
        return c.json(500, {
            error: "Gagal membaca status VPS: " + err
        });
    }
});
