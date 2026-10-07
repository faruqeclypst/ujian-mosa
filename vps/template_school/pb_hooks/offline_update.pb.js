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
            timeout: 10
        });

        if (res.statusCode !== 200) {
            return c.json(res.statusCode, { ok: false, error: "Gagal memeriksa pembaruan di server pusat." });
        }

        const raw = res.raw || (typeof res.body === "string" ? res.body : "");
        const data = JSON.parse(raw);

        // Baca versi lokal jika ada
        let currentVersion = "1.1.18";
        try {
            const rawLocal = $os.readFile("version.json");
            const localData = JSON.parse(rawLocal);
            if (localData && localData.version) {
                currentVersion = localData.version;
            }
        } catch (_) { }

        const hasUpdate = Boolean(data && data.version && data.version !== currentVersion);

        // Kill-Switch Check: Cek apakah lisensi telah dinonaktifkan oleh Super Admin di server pusat
        let isRevoked = false;
        try {
            const sList = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (sList && sList.length > 0) {
                const sRec = sList[0];
                const curLic = sRec.get("offline_license") || "";
                const curSchool = sRec.get("name") || "";
                if (curLic) {
                    const chkRes = $http.send({
                        url: "https://examku.my.id/api/multi-vps/check-offline-license-status?license=" + encodeURIComponent(curLic) + "&school_name=" + encodeURIComponent(curSchool),
                        method: "GET",
                        timeout: 5
                    });
                    if (chkRes.statusCode === 200) {
                        const rawChk = chkRes.raw || (typeof chkRes.body === "string" ? chkRes.body : "");
                        const chkData = JSON.parse(rawChk);
                        if (chkData && chkData.is_revoked) {
                            sRec.set("offline_license_status", "revoked");
                            $app.save(sRec);
                            isRevoked = true;
                        } else if (chkData && chkData.status === "active") {
                            if (sRec.get("offline_license_status") === "revoked") {
                                sRec.set("offline_license_status", "active");
                                $app.save(sRec);
                            }
                        }
                    }
                }
            }
        } catch (_) {}

        return c.json(200, {
            ok: true,
            current_version: currentVersion,
            remote_version: (data && data.version) || currentVersion,
            has_update: hasUpdate,
            is_revoked: isRevoked,
            data: data
        });
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
        let downloaded = false;
        try {
            $os.cmd("curl.exe", "-f", "-s", "-L", "-o", tempZip, "https://examku.my.id/downloads/offline-update.zip").run();
            downloaded = true;
        } catch (downloadErr) {
            try {
                $os.cmd("powershell.exe", "-NoProfile", "-Command",
                    "Invoke-WebRequest -Uri 'https://examku.my.id/downloads/offline-update.zip' -OutFile '" + tempZip + "'").run();
                downloaded = true;
            } catch (psErr) {
                return c.json(500, {
                    ok: false,
                    error: "Gagal mengunduh pembaruan. Pastikan koneksi internet aktif: " + ((downloadErr && downloadErr.message) || downloadErr)
                });
            }
        }

        // 2. Ekstrak hanya pb_public dan pb_hooks (Database pb_data/data.db 100% aman dan utuh)
        let extracted = false;
        try {
            $os.cmd("tar.exe", "-xf", tempZip).run();
            extracted = true;
        } catch (extractErr) {
            try {
                $os.cmd("powershell.exe", "-NoProfile", "-Command",
                    "Expand-Archive -Path '" + tempZip + "' -DestinationPath '.' -Force").run();
                extracted = true;
            } catch (psExtractErr) {
                return c.json(500, {
                    ok: false,
                    error: "Gagal mengekstrak pembaruan: " + ((extractErr && extractErr.message) || extractErr)
                });
            }
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
