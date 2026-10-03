// ============================================================
// PocketBase Hook: 1-Click Sync All Tenants (Hooks & Schema)
// ============================================================

// OPTIONS preflight untuk endpoint sync-all-tenants
routerAdd("OPTIONS", "/api/multi-vps/sync-all-tenants", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

// Endpoint eksekusi sinkronisasi 1-klik untuk seluruh tenant
routerAdd("POST", "/api/multi-vps/sync-all-tenants", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    try {
        console.log("[SyncAllTenants] Memulai 1-Click Sync untuk seluruh tenant Master & Worker...");
        const cmd = `/usr/local/bin/sync-all-tenants.sh`;
        const out = $os.cmd("bash", "-c", cmd).output();
        let rawJson = "";
        if (out) {
            for (let i = 0; i < out.length; i++) {
                rawJson += String.fromCharCode(out[i]);
            }
        }
        rawJson = rawJson.trim();

        let result = {};
        try {
            result = JSON.parse(rawJson);
        } catch (_) {
            result = {
                success: rawJson.includes('"success": true') || rawJson.includes("berhasil"),
                message: rawJson || "Proses sinkronisasi selesai dijalankan."
            };
        }

        if (result.success) {
            console.log("[SyncAllTenants] Sukses:", result.message);
            return c.json(200, result);
        } else {
            console.error("[SyncAllTenants] Gagal:", result.error || result.message);
            return c.json(400, result);
        }
    } catch (err) {
        console.error("[SyncAllTenants] Error exception:", err);
        return c.json(500, { success: false, error: "Gagal eksekusi: " + err });
    }
});
