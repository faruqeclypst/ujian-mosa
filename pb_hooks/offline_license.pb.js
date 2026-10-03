/* =========================================================
   🚀 OFFLINE SERVER LICENSE & SECURITY ENFORCEMENT HOOK
   1. Validasi Kriptografi Asimetris RSA-2048 di level backend
   2. Proteksi Akses Siswa & Ujian: Memblokir login siswa & attempt jika lisensi tidak sah/expired
   3. Menyediakan endpoint status lisensi dan aktivasi lisensi mandiri
   ========================================================= */

// -------------------------------------------------------------
// Endpoint 1: Aktivasi Lisensi Server
// -------------------------------------------------------------
routerAdd("OPTIONS", "/api/offline-activate", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/offline-activate", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }

        const info = c.requestInfo();
        const licenseCode = (info.body["license"] || "").toString().trim();
        const schoolName = (info.body["school_name"] || "").toString().trim();

        if (!licenseCode) {
            return c.json(400, { error: "Kode lisensi tidak boleh kosong" });
        }

        const validator = require(`${__hooks}/license_validator.js`);
        const check = validator.pbVerifyLicense(licenseCode);
        if (!check.valid) {
            return c.json(400, {
                error: check.message || "Kode lisensi tidak valid atau telah kadaluarsa."
            });
        }

        let record = null;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) record = list[0];
        } catch (_) {}

        if (!record) {
            const col = $app.findCollectionByNameOrId("settings");
            record = new Record(col);
        }

        const finalName = schoolName || (check.payload ? check.payload.school_name : "") || record.get("name");
        if (finalName) {
            record.set("name", finalName);
        }
        record.set("offline_license", licenseCode);
        $app.save(record);

        return c.json(200, {
            success: true,
            isAsymmetric: check.isAsymmetric,
            message: "Lisensi server offline berhasil diverifikasi dan disimpan ke database server!",
            school_name: finalName
        });
    } catch (err) {
        return c.json(500, { error: err.message || "Gagal menyimpan lisensi server offline" });
    }
});

// -------------------------------------------------------------
// Endpoint 2: Baca Status Lisensi Server (Untuk Client LAN & Siswa)
// -------------------------------------------------------------
routerAdd("OPTIONS", "/api/offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("GET", "/api/offline-license", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (_) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }

        let license = "";
        let schoolName = "";
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
                schoolName = list[0].get("name") || "";
            }
        } catch (_) {}

        const validator = require(`${__hooks}/license_validator.js`);
        const check = license ? validator.pbVerifyLicense(license) : { valid: false, message: "Belum ada lisensi" };

        return c.json(200, {
            active: Boolean(license && check.valid),
            valid: Boolean(check.valid),
            isExpired: check.isExpired || false,
            isAsymmetric: check.isAsymmetric || false,
            license: license,
            school_name: schoolName,
            valid_until: check.payload ? check.payload.valid_until : null
        });
    } catch (err) {
        return c.json(500, { error: err.message });
    }
});

// -------------------------------------------------------------
// Proteksi Backend 1: Siswa Tidak Bisa Login Jika Lisensi Tidak Aktif
// (Admin diizinkan login agar proktor dapat mengonfigurasi dan mengaktifkan lisensi)
// -------------------------------------------------------------
onRecordAuthRequest((e) => {
    // Hanya batasi siswa
    if (e.collection.name === "students") {
        let license = "";
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
            }
        } catch (_) {}

        if (!license) {
            throw new ForbiddenError("Izin Server Offline CBT belum aktif. Silakan hubungi proktor sekolah.");
        }

        const validator = require(`${__hooks}/license_validator.js`);
        const check = validator.pbVerifyLicense(license);
        if (!check.valid) {
            throw new ForbiddenError(check.message || "Izin Server Offline CBT tidak valid atau masa berlaku telah habis.");
        }
    }

    return e.next();
});

// -------------------------------------------------------------
// Proteksi Backend 2: Cegah Siswa Memulai Ujian Jika Lisensi Server Expired
// -------------------------------------------------------------
onRecordCreateRequest((e) => {
    if (e.collection.name === "attempts") {
        let license = "";
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
            }
        } catch (_) {}

        if (!license) {
            throw new ForbiddenError("Ujian tidak dapat dimulai: Izin Server Offline CBT belum aktif.");
        }

        const validator = require(`${__hooks}/license_validator.js`);
        const check = validator.pbVerifyLicense(license);
        if (!check.valid) {
            throw new ForbiddenError("Ujian tidak dapat dimulai: " + (check.message || "Masa izin server offline telah berakhir."));
        }
    }

    return e.next();
});
