// ============================================================
// PocketBase Hook: 1-Click Multi-VPS Migration & Burst Mode
// ============================================================

// OPTIONS preflight untuk seluruh endpoint multi-vps
routerAdd("OPTIONS", "/api/multi-vps/{path...}", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

// 1. Dapatkan Kunci Publik SSH Master VPS
routerAdd("GET", "/api/multi-vps/master-key", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try {
        let keyBytes = null;
        try {
            keyBytes = $os.readFile("/root/.ssh/id_ed25519.pub");
        } catch (_) {
            keyBytes = $os.readFile("/root/.ssh/id_rsa.pub");
        }
        let key = "";
        if (keyBytes) {
            for (let i = 0; i < keyBytes.length; i++) {
                key += String.fromCharCode(keyBytes[i]);
            }
        }
        return c.json(200, { public_key: key.trim() });
    } catch (err) {
        return c.json(500, { error: "Gagal membaca kunci publik Master VPS: " + err });
    }
});

// 2. Uji Koneksi SSH ke Worker Node
routerAdd("POST", "/api/multi-vps/test-connection", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    
    let host = "";
    try {
        const info = c.requestInfo();
        let b = {};
        try { b = info.body || {}; } catch (_) {}
        let d = {};
        try { d = info.data || {}; } catch (_) {}
        let q = {};
        try { q = info.query || {}; } catch (_) {}
        host = (b.host || d.host || q.host || "").toString().trim();
    } catch (e) {
        return c.json(400, { success: false, error: "Gagal membaca data request: " + e });
    }

    if (!host) {
        return c.json(400, { success: false, error: "Host / IP Worker wajib diisi." });
    }

    try {
        const start = new Date().getTime();
        const cmd = `/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${host} "test -f /opt/pocketbase/schools/template/pocketbase && echo OK"`;
        const out = $os.cmd("bash", "-c", cmd).output();
        const elapsed = new Date().getTime() - start;
        let resStr = "";
        if (out) {
            for (let i = 0; i < out.length; i++) {
                resStr += String.fromCharCode(out[i]);
            }
        }
        resStr = resStr.trim();

        if (resStr.includes("OK")) {
            return c.json(200, {
                success: true,
                latency_ms: elapsed,
                pb_ready: true,
                message: `Berhasil terhubung ke ${host} (${elapsed}ms). Template PocketBase siap!`
            });
        } else {
            return c.json(200, {
                success: true,
                latency_ms: elapsed,
                pb_ready: false,
                message: `SSH terhubung (${elapsed}ms), namun PocketBase belum terpasang di worker. Jalankan script setup_worker_node.sh.`
            });
        }
    } catch (err) {
        return c.json(200, {
            success: false,
            error: `Koneksi SSH ke ${host} gagal. Pastikan worker aktif dan script setup_worker_node.sh sudah dijalankan.`
        });
    }
});

// 3. Eksekusi 1-Click Migration (Burst Mode)
routerAdd("POST", "/api/multi-vps/migrate", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    let slug = "";
    let targetHost = "127.0.0.1";
    let direction = "to_worker";

    try {
        const info = c.requestInfo();
        let b = {};
        try { b = info.body || {}; } catch (_) {}
        let d = {};
        try { d = info.data || {}; } catch (_) {}
        let q = {};
        try { q = info.query || {}; } catch (_) {}
        slug = (b.slug || d.slug || q.slug || "").toString().trim();
        targetHost = (b.target_host || d.target_host || q.target_host || "127.0.0.1").toString().trim();
        direction = (b.direction || d.direction || q.direction || "to_worker").toString().trim();
    } catch (e) {
        return c.json(400, { success: false, error: "Gagal membaca data request: " + e });
    }

    if (!slug) {
        return c.json(400, { success: false, error: "Slug sekolah wajib diisi." });
    }

    if (direction === "to_worker" && (!targetHost || targetHost === "127.0.0.1" || targetHost === "localhost")) {
        return c.json(400, { success: false, error: "IP Worker tujuan tidak valid." });
    }

    try {
        console.log(`[Migration] Memulai migrasi 1-klik untuk '${slug}' (direction: ${direction}, target: ${targetHost})...`);
        const cmd = `/usr/local/bin/migrate-tenant.sh "${slug}" "${targetHost}" "${direction}"`;
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
            result = { success: rawJson.includes('"success": true'), message: rawJson };
        }

        if (result.success) {
            console.log(`[Migration] Sukses migrasi '${slug}':`, result.message);
            return c.json(200, result);
        } else {
            console.error(`[Migration] Gagal migrasi '${slug}':`, result.error || result.message);
            return c.json(400, result);
        }
    } catch (err) {
        console.error(`[Migration] Error exception saat migrasi '${slug}':`, err);
        return c.json(500, { success: false, error: "Terjadi kesalahan internal: " + err });
    }
});
