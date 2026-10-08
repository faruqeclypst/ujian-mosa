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

// ============================================================
// 5. Daftar snapshot harian tenant (untuk restore darurat)
// ============================================================
routerAdd("GET", "/api/multi-vps/snapshots", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    let slug = "";
    try {
        const info = c.requestInfo();
        let q = {};
        try { q = info.query || {}; } catch (_) {}
        slug = (q.slug || "").toString().trim();
    } catch (e) {
        return c.json(400, { success: false, error: "Gagal membaca data request: " + e });
    }

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return c.json(400, { success: false, error: "Slug sekolah tidak valid." });
    }

    try {
        const cmd = `for f in /opt/pocketbase/worker-snapshots/${slug}/*.db; do [ -f "$f" ] || continue; echo "$(basename "$f" .db)|$(du -h "$f" | cut -f1)"; done | sort -r`;
        const out = $os.cmd("bash", "-c", cmd).output();
        let raw = "";
        if (out) { for (let i = 0; i < out.length; i++) raw += String.fromCharCode(out[i]); }
        const snapshots = raw.trim().split("\n")
            .filter((l) => l.indexOf("|") > 0)
            .map((l) => {
                const p = l.split("|");
                return { date: p[0], size: p[1] || "-" };
            });
        return c.json(200, { success: true, snapshots: snapshots });
    } catch (err) {
        return c.json(500, { success: false, error: "Terjadi kesalahan internal: " + err });
    }
});

// ============================================================
// 6. Restore snapshot darurat ke Master VPS
// Dipakai bila worker mati mendadak sebelum auto-fallback H-3.
// Body/query: slug, date (opsional, default terbaru), force.
// ============================================================
routerAdd("POST", "/api/multi-vps/restore-snapshot", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    let slug = "", date = "", force = "";
    try {
        const info = c.requestInfo();
        let b = {}; try { b = info.body || {}; } catch (_) {}
        let q = {}; try { q = info.query || {}; } catch (_) {}
        slug = (b.slug || q.slug || "").toString().trim();
        date = (b.date || q.date || "").toString().trim();
        force = (b.force || q.force || "").toString().trim();
    } catch (e) {
        return c.json(400, { success: false, error: "Gagal membaca data request: " + e });
    }

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return c.json(400, { success: false, error: "Slug sekolah tidak valid." });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return c.json(400, { success: false, error: "Format tanggal tidak valid (YYYY-MM-DD)." });
    }

    try {
        console.log(`[Restore] Memulai restore snapshot '${slug}' (${date || "terbaru"})...`);

        // Guard: bila worker masih hidup, arahkan ke migrasi 1-klik normal
        // (restore snapshot hanya untuk kasus darurat worker mati).
        try {
            const qcmd = `sqlite3 /opt/pocketbase/master/pb_data/data.db "SELECT server_host FROM schools WHERE slug='${slug}';"`;
            const qout = $os.cmd("bash", "-c", qcmd).output();
            let srv = "";
            if (qout) { for (let i = 0; i < qout.length; i++) srv += String.fromCharCode(qout[i]); }
            srv = srv.trim();
            if (srv && srv !== "127.0.0.1" && srv !== "localhost") {
                const pout = $os.cmd("bash", "-c", `/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${srv} "true" && echo ALIVE`).output();
                let pr = "";
                if (pout) { for (let i = 0; i < pout.length; i++) pr += String.fromCharCode(pout[i]); }
                if (pr.indexOf("ALIVE") >= 0) {
                    return c.json(400, { success: false, error: `Worker ${srv} masih hidup dan terjangkau. Gunakan 'Tarik Database Balik ke Master (1-Klik)' untuk migrasi normal.` });
                }
            }
        } catch (_) { /* abaikan guard, lanjutkan restore */ }

        const forceArg = (force === "1" || force === "true") ? " --force" : "";
        const dateArg = date ? ` "${date}"` : "";
        const cmd = `/usr/local/bin/examku-restore-snapshot.sh "${slug}"${dateArg}${forceArg} 2>&1; echo "__EXIT:$?"`;
        const out = $os.cmd("bash", "-c", cmd).output();
        let raw = "";
        if (out) { for (let i = 0; i < out.length; i++) raw += String.fromCharCode(out[i]); }
        raw = raw.trim();
        const exitMatch = raw.match(/__EXIT:(\d+)\s*$/);
        const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 1;
        raw = raw.replace(/__EXIT:\d+\s*$/, "").trim();
        if (exitCode === 0 && raw.indexOf("[restore] SELESAI") >= 0) {
            console.log(`[Restore] Sukses restore '${slug}'`);
            return c.json(200, { success: true, message: `Snapshot ${date || "terbaru"} untuk '${slug}' berhasil dipulihkan ke Master VPS.`, log: raw });
        }
        console.error(`[Restore] Gagal restore '${slug}':`, raw);
        const tail = raw.split("\n").filter((l) => l.indexOf("ERROR") >= 0).slice(-2).join(" ").trim()
            || raw.split("\n").slice(-2).join(" ").trim();
        return c.json(400, { success: false, error: tail || "Restore gagal." });
    } catch (err) {
        console.error(`[Restore] Error exception saat restore '${slug}':`, err);
        return c.json(500, { success: false, error: "Terjadi kesalahan internal: " + err });
    }
});

// ============================================================
// 7. Status operasional backup & auto-fallback (superadmin)
// ============================================================
routerAdd("GET", "/api/multi-vps/ops-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try {
        const out = $os.cmd("bash", "-c", "/usr/local/bin/examku-ops-status.sh").output();
        let raw = "";
        if (out) { for (let i = 0; i < out.length; i++) raw += String.fromCharCode(out[i]); }
        raw = raw.trim();
        const data = JSON.parse(raw);
        data.success = true;
        return c.json(200, data);
    } catch (err) {
        return c.json(500, { success: false, error: "Gagal membaca status operasional: " + err });
    }
});

// ============================================================
// 8. Jalankan job backup / fallback manual (background)
// Body/query: job = "backup" | "fallback"
// ============================================================
routerAdd("POST", "/api/multi-vps/run-job", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    let job = "";
    try {
        const info = c.requestInfo();
        let b = {}; try { b = info.body || {}; } catch (_) {}
        let q = {}; try { q = info.query || {}; } catch (_) {}
        job = (b.job || q.job || "").toString().trim();
    } catch (e) {
        return c.json(400, { success: false, error: "Gagal membaca data request: " + e });
    }

    const JOBS = {
        "backup":   { bin: "/usr/local/bin/examku-backup-workers.sh", log: "/var/log/examku-backup-workers.log", label: "Backup Harian Worker" },
        "fallback": { bin: "/usr/local/bin/examku-auto-fallback.sh", log: "/var/log/examku-auto-fallback.log",   label: "Auto-Fallback H-3" },
    };
    const cfg = JOBS[job];
    if (!cfg) {
        return c.json(400, { success: false, error: "Job tidak valid (backup | fallback)." });
    }

    try {
        // Tolak bila job sedang berjalan
        const chk = $os.cmd("bash", "-c", `pgrep -f "${cfg.bin}" >/dev/null 2>&1 && echo RUNNING || echo IDLE`).output();
        let st = "";
        if (chk) { for (let i = 0; i < chk.length; i++) st += String.fromCharCode(chk[i]); }
        if (st.trim() === "RUNNING") {
            return c.json(409, { success: false, error: `${cfg.label} sedang berjalan. Tunggu selesai dulu.` });
        }
        $os.cmd("bash", "-c", `nohup ${cfg.bin} >> ${cfg.log} 2>&1 & echo STARTED`);
        console.log(`[Ops] Job manual dimulai: ${job}`);
        return c.json(200, { success: true, message: `${cfg.label} dimulai di latar. Pantau log untuk hasilnya.` });
    } catch (err) {
        return c.json(500, { success: false, error: "Gagal menjalankan job: " + err });
    }
});
