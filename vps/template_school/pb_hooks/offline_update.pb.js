// =========================================================
// 🚀 1-CLICK SYSTEM UPDATE HOOK (OFFLINE / LOCAL SERVER)
// =========================================================

routerAdd("OPTIONS", "/api/offline-update-check", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("GET", "/api/offline-update-check", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }

        const res = $http.send({
            url: "https://examku.my.id/downloads/version.json",
            method: "GET",
            timeout: 8
        });

        if (res.statusCode !== 200) {
            return c.json(res.statusCode, { ok: false, error: "Gagal memeriksa pembaruan di server pusat." });
        }

        const data = JSON.parse(res.rawText);
        return c.json(200, { ok: true, data: data });
    } catch (err) {
        return c.json(500, {
            ok: false,
            error: "Tidak dapat terhubung ke server pusat. Pastikan laptop proktor terhubung ke internet."
        });
    }
});

routerAdd("OPTIONS", "/api/offline-update-apply", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/offline-update-apply", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }

        const tempZip = "offline_update_temp.zip";

        // 1. Unduh offline-update.zip dari CDN Examku
        try {
            $os.cmd("curl.exe", "-f", "-L", "-o", tempZip, "https://examku.my.id/downloads/offline-update.zip").run();
        } catch (downloadErr) {
            return c.json(500, {
                ok: false,
                error: "Gagal mengunduh pembaruan. Pastikan koneksi internet aktif: " + downloadErr.message
            });
        }

        // 2. Ekstrak hanya pb_public dan pb_hooks (Database pb_data/data.db 100% aman dan utuh)
        try {
            $os.cmd("tar.exe", "-xf", tempZip).run();
        } catch (extractErr) {
            return c.json(500, {
                ok: false,
                error: "Gagal mengekstrak pembaruan: " + extractErr.message
            });
        }

        // 3. Bersihkan file zip sementara
        try {
            $os.cmd("cmd.exe", "/c", "del " + tempZip).run();
        } catch (_) { }

        return c.json(200, {
            ok: true,
            message: "Aplikasi server offline berhasil diperbarui ke versi terbaru! Halaman akan dimuat ulang."
        });
    } catch (err) {
        return c.json(500, { ok: false, error: String((err && err.message) || err) });
    }
});
