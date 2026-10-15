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
        // Jalankan di background agar tidak timeout (sync 10+ tenant bisa 2-5 menit)
        // Output ditulis ke log, API langsung return "started"
        const logFile = "/tmp/sync-all-tenants.log";
        $os.cmd("bash", "-c", `/usr/local/bin/sync-all-tenants.sh > ${logFile} 2>&1 & echo $!`);
        
        const result = {
            success: true,
            message: "Sinkronisasi dimulai di background. Cek log di /tmp/sync-all-tenants.log di Master VPS.",
            background: true
        };
        console.log("[SyncAllTenants] Started in background");
        return c.json(200, result);
    } catch (err) {
        console.error("[SyncAllTenants] Error exception:", err);
        return c.json(500, { success: false, error: "Gagal eksekusi: " + err });
    }
});
