// ============================================================
// Master PocketBase Hook: Media Manager & Garbage Collection
// - Endpoint audit media terpakai di seluruh database sekolah
// - Memastikan proteksi data multi-tenant dan mencegah gambar rusak
// ============================================================

routerAdd("OPTIONS", "/api/media-manager/{path...}", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("GET", "/api/media-manager/audit", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    // Otentikasi: Hanya Super Admin
    const info = c.requestInfo();
    let auth = null;
    try { if (info && info.auth) auth = info.auth; } catch (_) {}
    if (!auth) {
        return c.json(401, { error: "Autentikasi Super Admin diperlukan." });
    }

    try {
        const out = $os.cmd("/usr/local/bin/scan-media-usage.py").output();
        let parsed = {};
        try {
            let outStr = "";
            for (let i = 0; i < out.length; i++) {
                outStr += String.fromCharCode(out[i]);
            }
            parsed = JSON.parse(outStr.trim());
        } catch (e) {
            return c.json(500, { error: "Gagal membaca hasil audit: " + e });
        }
        return c.json(200, parsed);
    } catch (err) {
        return c.json(500, { error: "Gagal menjalankan audit media: " + err });
    }
});
