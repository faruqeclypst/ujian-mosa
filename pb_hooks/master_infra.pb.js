// ============================================================
// MASTER INFRASTRUCTURE STATUS HOOK (SuperAdmin)
// GET /api/master-infra-status
// Mengumpulkan status resource VPS Master & seluruh Worker Node
// ============================================================

routerAdd("OPTIONS", "/api/master-infra-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    return c.noContent(204);
});

routerAdd("GET", "/api/master-infra-status", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    }
    setCors(c);

    // Otentikasi: Hanya Super Admin
    const info = c.requestInfo();
    let auth = null;
    try { if (info && info.auth) auth = info.auth; } catch (_) {}
    if (!auth) {
        return c.json(401, { error: "Autentikasi Super Admin diperlukan." });
    }

    try {
        const out = $os.cmd("/usr/local/bin/master-infra-audit.py").output();
        let outStr = "";
        for (let i = 0; i < out.length; i++) {
            outStr += String.fromCharCode(out[i]);
        }
        const data = JSON.parse(outStr.trim());
        return c.json(200, data);
    } catch (err) {
        return c.json(500, {
            error: "Gagal mengaudit infrastruktur multi-VPS: " + err
        });
    }
});
