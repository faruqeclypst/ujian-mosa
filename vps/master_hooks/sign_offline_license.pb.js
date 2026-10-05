// ============================================================
// PocketBase Master Hook: RSA-2048 Sign Offline License & Tracking
// ============================================================

// 1. Endpoint Penerbitan Lisensi Baru (Sign RSA-2048)
routerAdd("OPTIONS", "/api/multi-vps/sign-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/sign-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        console.log("[SignOfflineLicense] Step 1: Read requestInfo");
        const info = c.requestInfo();
        const body = info.body || {};
        console.log("[SignOfflineLicense] Step 2: Body read", JSON.stringify(body));
        
        const schoolName = (body["school_name"] || "").toString().trim();
        const slug = (body["slug"] || "").toString().trim();
        const npsn = (body["npsn"] || "-").toString().trim();
        const validUntil = (body["valid_until"] || "").toString().trim();
        const maxStudents = parseInt(body["max_students"] || 0, 10);
        const notes = (body["notes"] || "Izin Resmi Server Offline CBT").toString().trim();

        console.log("[SignOfflineLicense] Step 3: Executing cmd");
        const out = $os.cmd("/usr/local/bin/sign-offline-license.py", schoolName, slug, npsn, validUntil, String(maxStudents), notes).output();
        console.log("[SignOfflineLicense] Step 4: Cmd executed, out len:", out ? out.length : 0);

        let rawJson = "";
        if (out) {
            for (let i = 0; i < out.length; i++) {
                rawJson += String.fromCharCode(out[i]);
            }
        }
        rawJson = rawJson.trim();
        console.log("[SignOfflineLicense] Step 5: Raw JSON:", rawJson);

        const result = JSON.parse(rawJson);

        if (result.success && result.license) {
            try {
                let rec = null;
                const existing = $app.findRecordsByFilter("offline_licenses", "slug = '" + slug.replace(/'/g, "") + "'", "-created", 1);
                if (existing && existing.length > 0) {
                    rec = existing[0];
                } else {
                    const col = $app.findCollectionByNameOrId("offline_licenses");
                    rec = new Record(col);
                    rec.set("slug", slug);
                }
                rec.set("school_name", schoolName);
                rec.set("npsn", npsn !== "-" ? npsn : "");
                rec.set("license_code", result.license);
                rec.set("version", "v2");
                rec.set("valid_until", validUntil);
                rec.set("max_students", maxStudents);
                rec.set("issued_at", (result.payload && result.payload.issued_at) || new Date().toISOString());
                rec.set("notes", notes);
                rec.set("status", "active");
                rec.set("is_used", false);
                rec.set("used_at", "");
                rec.set("activation_count", 0);
                rec.set("activated_device", "");
                $app.save(rec);
                console.log("[SignOfflineLicense] Lisensi berhasil dicatat di offline_licenses:", rec.id);
            } catch (eRecord) {
                console.warn("[SignOfflineLicense] Gagal merekam ke offline_licenses:", eRecord);
            }
        }

        return c.json(result.success ? 200 : 400, result);
    } catch (err) {
        console.error("[SignOfflineLicense] Error:", err, err.stack);
        return c.json(500, { success: false, error: "Terjadi kesalahan internal: " + err });
    }
});

// 2. Endpoint Pencatatan Aktivasi dari Client / Server Offline
routerAdd("OPTIONS", "/api/multi-vps/activate-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/activate-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const licenseCode = (body["license"] || body["license_code"] || "").toString().trim();
        const schoolName = (body["school_name"] || "").toString().trim();
        const machineInfo = (body["machine_info"] || "").toString().trim();

        if (!licenseCode) {
            return c.json(400, { success: false, error: "Kode lisensi diperlukan" });
        }

        let rec = null;
        try {
            const list = $app.findRecordsByFilter("offline_licenses", "license_code = '" + licenseCode.replace(/'/g, "") + "'", "-created", 1);
            if (list && list.length > 0) rec = list[0];
        } catch (_) {}

        if (!rec && schoolName) {
            try {
                const list = $app.findRecordsByFilter("offline_licenses", "school_name = '" + schoolName.replace(/'/g, "") + "'", "-created", 1);
                if (list && list.length > 0) rec = list[0];
            } catch (_) {}
        }

        if (rec) {
            rec.set("is_used", true);
            if (!rec.get("used_at")) {
                rec.set("used_at", new Date().toISOString());
            }
            const prevCount = rec.get("activation_count") || 0;
            rec.set("activation_count", prevCount + 1);

            const deviceId = (body["device_id"] || "").toString().trim();
            const deviceName = (body["device_name"] || "").toString().trim();
            if (deviceId && deviceId.includes("HWID-")) {
                rec.set("activated_device", deviceId + (deviceName ? " (" + deviceName + ")" : ""));
            } else if (machineInfo && machineInfo.includes("HWID-")) {
                rec.set("activated_device", machineInfo);
            }

            $app.save(rec);
            return c.json(200, {
                success: true,
                message: "Aktivasi offline berhasil dicatat di server pusat.",
                school_name: rec.get("school_name"),
                is_used: true,
                used_at: rec.get("used_at"),
                activation_count: rec.get("activation_count")
            });
        }

        return c.json(200, {
            success: true,
            warning: "Lisensi valid offline, namun catatan registri spesifik tidak ditemukan di database pusat."
        });
    } catch (err) {
        console.error("[ActivateOfflineLicense] Error:", err);
        return c.json(500, { success: false, error: err.message || String(err) });
    }
});

// 3. Endpoint Toggle Status Lisensi (Digunakan / Reset Belum Digunakan) oleh Super Admin
routerAdd("OPTIONS", "/api/multi-vps/toggle-offline-license-used", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/toggle-offline-license-used", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const id = (body["id"] || "").toString().trim();
        const isUsed = Boolean(body["is_used"]);

        if (!id) {
            return c.json(400, { success: false, error: "ID lisensi diperlukan" });
        }

        const rec = $app.findRecordById("offline_licenses", id);
        if (!rec) {
            return c.json(404, { success: false, error: "Data lisensi tidak ditemukan" });
        }

        rec.set("is_used", isUsed);
        if (isUsed) {
            if (!rec.get("used_at")) {
                rec.set("used_at", new Date().toISOString());
            }
            const prev = rec.get("activation_count") || 0;
            if (prev === 0) rec.set("activation_count", 1);
        } else {
            rec.set("used_at", "");
            rec.set("activation_count", 0);
            rec.set("activated_device", "");
        }
        $app.save(rec);

        return c.json(200, {
            success: true,
            is_used: isUsed,
            message: isUsed ? "Lisensi berhasil ditandai sudah digunakan." : "Status penggunaan lisensi berhasil direset menjadi belum digunakan."
        });
    } catch (err) {
        console.error("[ToggleOfflineLicenseUsed] Error:", err);
        return c.json(500, { success: false, error: err.message || String(err) });
    }
});

// 4. Endpoint Nonaktifkan / Blokir Lisensi (Revoke / Terminate Kill-Switch) oleh Super Admin
routerAdd("OPTIONS", "/api/multi-vps/toggle-offline-license-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/toggle-offline-license-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const id = (body["id"] || "").toString().trim();
        const status = (body["status"] || "active").toString().trim().toLowerCase(); // 'active' | 'revoked'
        const reason = (body["reason"] || "Pelanggaran kebijakan penggunaan sistem CBT offline.").toString().trim();

        if (!id) {
            return c.json(400, { success: false, error: "ID lisensi diperlukan" });
        }

        const rec = $app.findRecordById("offline_licenses", id);
        if (!rec) {
            return c.json(404, { success: false, error: "Data lisensi tidak ditemukan" });
        }

        rec.set("status", status);
        if (reason) {
            rec.set("notes", (rec.get("notes") ? rec.get("notes") + "\n" : "") + "[Status " + status + "]: " + reason);
        }
        $app.save(rec);

        return c.json(200, {
            success: true,
            status: status,
            message: status === "revoked"
                ? "Lisensi berhasil dinonaktifkan (diblokir). Server offline akan terkunci saat mendeteksi koneksi online."
                : "Lisensi berhasil diaktifkan kembali."
        });
    } catch (err) {
        console.error("[ToggleOfflineLicenseStatus] Error:", err);
        return c.json(500, { success: false, error: err.message || String(err) });
    }
});

// 4b. Endpoint Reset Kunci Perangkat Server (Hardware ID) oleh Super Admin
routerAdd("OPTIONS", "/api/multi-vps/reset-offline-license-device", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/reset-offline-license-device", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const id = (body["id"] || "").toString().trim();

        if (!id) {
            return c.json(400, { success: false, error: "ID lisensi diperlukan" });
        }

        const rec = $app.findRecordById("offline_licenses", id);
        if (!rec) {
            return c.json(404, { success: false, error: "Data lisensi tidak ditemukan" });
        }

        const oldDevice = rec.get("activated_device") || "Perangkat Lama";
        rec.set("activated_device", "");
        rec.set("notes", (rec.get("notes") ? rec.get("notes") + "\n" : "") + "[RESET PERANGKAT]: Kunci perangkat (" + oldDevice + ") telah dibuka/direset oleh Super Admin pada " + new Date().toISOString());
        $app.save(rec);

        return c.json(200, {
            success: true,
            message: "Kunci perangkat berhasil direset. Sekolah kini dapat mengaktivasi server di perangkat laptop baru."
        });
    } catch (err) {
        console.error("[ResetOfflineLicenseDevice] Error:", err);
        return c.json(500, { success: false, error: err.message || String(err) });
    }
});

// 5. Endpoint Remote Kill-Switch & Device Check (Dipanggil otomatis oleh Server Offline saat terhubung internet)
routerAdd("OPTIONS", "/api/multi-vps/check-offline-license-status", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

const handleLicenseStatusCheck = (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const query = info.query || {};
        const licenseCode = (body["license"] || body["license_code"] || query["license"] || query["license_code"] || "").toString().trim();
        const schoolName = (body["school_name"] || query["school_name"] || "").toString().trim();
        const deviceId = (body["device_id"] || query["device_id"] || "").toString().trim();

        if (!licenseCode && !schoolName) {
            return c.json(400, { success: false, error: "Kode lisensi atau nama sekolah diperlukan" });
        }

        let rec = null;
        if (licenseCode) {
            try {
                const list = $app.findRecordsByFilter("offline_licenses", "license_code = '" + licenseCode.replace(/'/g, "") + "'", "-created", 1);
                if (list && list.length > 0) rec = list[0];
            } catch (_) {}
        }

        if (!rec && schoolName) {
            try {
                const list = $app.findRecordsByFilter("offline_licenses", "school_name = '" + schoolName.replace(/'/g, "") + "'", "-created", 1);
                if (list && list.length > 0) rec = list[0];
            } catch (_) {}
        }

        if (rec) {
            const currentStatus = (rec.get("status") || "active").toString().toLowerCase();
            if (currentStatus === "revoked") {
                return c.json(200, {
                    success: true,
                    status: "revoked",
                    is_revoked: true,
                    message: "Lisensi Server Offline ini telah dinonaktifkan oleh Administrator Pusat karena pelanggaran kebijakan. Database bank soal dan data siswa Anda tetap aman.",
                    school_name: rec.get("school_name")
                });
            }

            const existingDevice = (rec.get("activated_device") || "").toString().trim();
            // Pengecekan Duplikasi Hardware ID:
            // Hanya anggap mismatch jika lisensi ini SUDAH terikat ke sidik jari HWID sah lain
            if (deviceId && deviceId.includes("HWID-")) {
                if (!existingDevice || !existingDevice.includes("HWID-")) {
                    // Belum ada binding HWID resmi, kunci otomatis ke perangkat pertama ini
                    rec.set("activated_device", deviceId);
                    $app.save(rec);
                } else if (!existingDevice.includes(deviceId)) {
                    // Sidik jari hardware benar-benar berbeda
                    return c.json(200, {
                        success: true,
                        status: "device_mismatch",
                        is_revoked: false,
                        is_device_mismatch: true,
                        message: "Lisensi ini terdaftar untuk perangkat server (" + existingDevice + "). Duplikasi aplikasi ke perangkat lain melanggar kebijakan lisensi.",
                        school_name: rec.get("school_name"),
                        registered_device: existingDevice
                    });
                }
            }

            return c.json(200, {
                success: true,
                status: "active",
                is_revoked: false,
                is_device_mismatch: false,
                school_name: rec.get("school_name")
            });
        }

        // Jika lisensi tidak terdaftar di database pusat
        return c.json(200, {
            success: true,
            status: "active",
            is_revoked: false,
            message: "Lisensi tidak ditemukan dalam daftar blokir pusat."
        });
    } catch (err) {
        console.error("[CheckOfflineLicenseStatus] Error:", err);
        return c.json(500, { success: false, error: err.message || String(err) });
    }
};

routerAdd("GET", "/api/multi-vps/check-offline-license-status", handleLicenseStatusCheck);
routerAdd("POST", "/api/multi-vps/check-offline-license-status", handleLicenseStatusCheck);

// Alias route untuk kompatibilitas record-offline-activation
routerAdd("POST", "/api/multi-vps/record-offline-activation", (c) => {
    return c.json(200, { success: true, message: "Aktivasi dicatat." });
});
routerAdd("OPTIONS", "/api/multi-vps/record-offline-activation", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

