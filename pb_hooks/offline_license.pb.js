/* =========================================================
   🚀 OFFLINE SERVER LICENSE & SECURITY ENFORCEMENT HOOK
   1. Validasi Kriptografi Asimetris RSA-2048 di level backend
   2. Hardware ID Auto-Lock (Penguncian Sidik Jari Mesin Server)
   3. Pencegahan Duplikasi: Server terkunci jika dipindah/dicopy ke komputer lain
   4. Proteksi Akses Siswa & Ujian: Memblokir login siswa & attempt jika lisensi tidak sah / expired / duplikat
   5. Remote Kill-Switch Sync saat server terhubung internet
   ========================================================= */

// -------------------------------------------------------------
// Endpoint 1: Aktivasi Lisensi Server (Auto-Lock ke Mesin Server Pertama Kali)
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

        // Dapatkan Sidik Jari Perangkat (Hardware ID) Komputer Server Saat Ini
        const hw = validator.getMachineHardwareId();

        let record = null;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) record = list[0];
        } catch (_) {}

        if (!record) {
            const col = $app.findCollectionByNameOrId("settings");
            record = new Record(col);
        }

        // Cek apakah database ini sudah pernah dikunci di laptop lain
        const prevDeviceId = record.get("locked_device_id") || "";
        const prevDeviceName = record.get("locked_device_name") || "";
        if (prevDeviceId && prevDeviceId !== hw.id) {
            if (record.get("offline_license") === licenseCode) {
                return c.json(403, {
                    error: "Lisensi ini sudah terikat ke komputer server (" + (prevDeviceName || prevDeviceId) + "). Duplikasi aplikasi ke komputer lain (" + hw.computerName + ") melanggar lisensi. Silakan hubungi Super Admin untuk reset perangkat jika Anda resmi memindahkan server."
                });
            }
        }

        const finalName = schoolName || (check.payload ? check.payload.school_name : "") || record.get("name");
        if (finalName) {
            record.set("name", finalName);
        }
        record.set("offline_license", licenseCode);
        record.set("offline_license_status", "active");
        record.set("locked_device_id", hw.id);
        record.set("locked_device_name", hw.computerName);
        $app.save(record);

        // Lapor aktivasi ke Master VPS (jika ada koneksi internet)
        try {
            $http.send({
                url: "https://examku.my.id/api/multi-vps/record-offline-activation",
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    license: licenseCode,
                    school_name: finalName,
                    machine_info: hw.id + " (" + hw.computerName + ")",
                    device_id: hw.id,
                    device_name: hw.computerName
                }),
                timeout: 3
            });
        } catch (_) {}

        return c.json(200, {
            success: true,
            isAsymmetric: check.isAsymmetric,
            message: "Lisensi server offline berhasil diverifikasi dan dikunci permanen ke perangkat (" + hw.computerName + ")!",
            school_name: finalName,
            device_id: hw.id,
            device_name: hw.computerName
        });
    } catch (err) {
        return c.json(500, { error: err.message || "Gagal menyimpan lisensi server offline" });
    }
});

// -------------------------------------------------------------
// Endpoint 2: Baca Status Lisensi Server & Verifikasi Hardware ID (Untuk Client LAN & Siswa)
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

        const validator = require(`${__hooks}/license_validator.js`);
        const hw = validator.getMachineHardwareId();

        let license = "";
        let schoolName = "";
        let isRevokedLocally = false;
        let lockedDeviceId = "";
        let lockedDeviceName = "";
        let localRecord = null;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                localRecord = list[0];
                license = localRecord.get("offline_license") || "";
                schoolName = localRecord.get("name") || "";
                isRevokedLocally = (localRecord.get("offline_license_status") || "active") === "revoked";
                lockedDeviceId = localRecord.get("locked_device_id") || "";
                lockedDeviceName = localRecord.get("locked_device_name") || "";
            }
        } catch (_) {}

        // Migrasi mulus: Jika lisensi sudah aktif tapi belum mencatat locked_device_id, kunci ke perangkat ini sekarang
        if (license && !lockedDeviceId && localRecord) {
            lockedDeviceId = hw.id;
            lockedDeviceName = hw.computerName;
            localRecord.set("locked_device_id", hw.id);
            localRecord.set("locked_device_name", hw.computerName);
            $app.save(localRecord);
        }

        // Pengecekan Duplikasi Hardware ID lokal:
        // Jika folder ini di-copy ke laptop lain, hw.id saat ini BEDA dengan lockedDeviceId di database!
        let isDeviceMismatch = false;
        if (license && lockedDeviceId && lockedDeviceId !== hw.id) {
            isDeviceMismatch = true;
        }

        // Remote Kill-Switch & Remote Device Check: Jika laptop proktor sedang online, verifikasi status ke Master VPS
        if (license && !isDeviceMismatch) {
            try {
                const res = $http.send({
                    url: "https://examku.my.id/api/multi-vps/check-offline-license-status?license=" + encodeURIComponent(license) + "&school_name=" + encodeURIComponent(schoolName) + "&device_id=" + encodeURIComponent(hw.id),
                    method: "GET",
                    timeout: 3
                });
                if (res.statusCode === 200) {
                    const raw = res.raw || (typeof res.body === "string" ? res.body : "");
                    const checkRemote = JSON.parse(raw);
                    if (checkRemote && checkRemote.is_revoked) {
                        isRevokedLocally = true;
                        if (localRecord && localRecord.get("offline_license_status") !== "revoked") {
                            localRecord.set("offline_license_status", "revoked");
                            $app.save(localRecord);
                        }
                    } else if (checkRemote && checkRemote.is_device_mismatch) {
                        isDeviceMismatch = true;
                    } else if (checkRemote && checkRemote.status === "active") {
                        if (localRecord && localRecord.get("offline_license_status") === "revoked") {
                            localRecord.set("offline_license_status", "active");
                            $app.save(localRecord);
                            isRevokedLocally = false;
                        }
                    }
                }
            } catch (_) {
                // Offline / tidak ada internet: gunakan status dari database lokal
            }
        }

        const check = license ? validator.pbVerifyLicense(license) : { valid: false, message: "Belum ada lisensi" };

        const isFullyActive = Boolean(license && check.valid && !isRevokedLocally && !isDeviceMismatch);

        let mismatchMessage = null;
        if (isDeviceMismatch) {
            mismatchMessage = "Lisensi ini terdaftar untuk perangkat server (" + (lockedDeviceName || lockedDeviceId) + "). Duplikasi aplikasi ke komputer ini (" + hw.computerName + ") melanggar lisensi. Silakan hubungi Super Admin untuk reset lisensi jika Anda resmi memindahkan server.";
        }

        return c.json(200, {
            active: isFullyActive,
            valid: Boolean(check.valid && !isRevokedLocally && !isDeviceMismatch),
            isRevoked: isRevokedLocally,
            isDeviceMismatch: isDeviceMismatch,
            isExpired: check.isExpired || false,
            isAsymmetric: check.isAsymmetric || false,
            license: license,
            school_name: schoolName,
            current_device_id: hw.id,
            current_device_name: hw.computerName,
            locked_device_id: lockedDeviceId,
            locked_device_name: lockedDeviceName,
            valid_until: check.payload ? check.payload.valid_until : null,
            revocation_message: isRevokedLocally
                ? "Lisensi Server Offline telah dinonaktifkan oleh Administrator Pusat karena pelanggaran kebijakan. Database bank soal dan data siswa tetap aman."
                : (isDeviceMismatch ? mismatchMessage : null)
        });
    } catch (err) {
        return c.json(500, { error: err.message });
    }
});

// -------------------------------------------------------------
// Proteksi Backend 1: Siswa Tidak Bisa Login Jika Lisensi Tidak Aktif, Dinonaktifkan, atau Duplikat di Perangkat Lain
// (HANYA berlaku untuk Server Mandiri Offline Lab, BUKAN untuk Cloud VPS)
// -------------------------------------------------------------
onRecordAuthRequest((e) => {
    // Jangan pernah blokir jika berjalan di server Cloud VPS (/opt/pocketbase)
    if (typeof __hooks !== "undefined" && (__hooks.indexOf("/opt/pocketbase") !== -1 || __hooks.indexOf("/schools/") !== -1)) {
        return e.next();
    }

    // Hanya batasi siswa di server lokal offline
    if (e.collection.name === "students") {
        let license = "";
        let isRevoked = false;
        let isDeviceMismatch = false;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
                isRevoked = (list[0].get("offline_license_status") || "active") === "revoked";
                const lockedDev = list[0].get("locked_device_id") || "";
                if (license && lockedDev) {
                    const validator = require(`${__hooks}/license_validator.js`);
                    const hw = validator.getMachineHardwareId();
                    if (lockedDev !== hw.id) {
                        isDeviceMismatch = true;
                    }
                }
            }
        } catch (_) {}

        if (isDeviceMismatch) {
            throw new ForbiddenError("Aplikasi CBT Terkunci: Terdeteksi duplikasi lisensi di perangkat berbeda. Hubungi Super Admin.");
        }

        if (isRevoked) {
            throw new ForbiddenError("Aplikasi CBT Offline telah dinonaktifkan oleh Administrator Pusat karena pelanggaran kebijakan. Seluruh bank soal dan data siswa tetap aman. Hubungi admin@examku.my.id.");
        }

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
// Proteksi Backend 2: Cegah Siswa Memulai Ujian Jika Lisensi Expired, Dinonaktifkan, atau Duplikat
// (HANYA berlaku untuk Server Mandiri Offline Lab, BUKAN untuk Cloud VPS)
// -------------------------------------------------------------
onRecordCreateRequest((e) => {
    // Jangan pernah blokir jika berjalan di server Cloud VPS (/opt/pocketbase)
    if (typeof __hooks !== "undefined" && (__hooks.indexOf("/opt/pocketbase") !== -1 || __hooks.indexOf("/schools/") !== -1)) {
        return e.next();
    }

    if (e.collection.name === "attempts") {
        let license = "";
        let isRevoked = false;
        let isDeviceMismatch = false;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
                isRevoked = (list[0].get("offline_license_status") || "active") === "revoked";
                const lockedDev = list[0].get("locked_device_id") || "";
                if (license && lockedDev) {
                    const validator = require(`${__hooks}/license_validator.js`);
                    const hw = validator.getMachineHardwareId();
                    if (lockedDev !== hw.id) {
                        isDeviceMismatch = true;
                    }
                }
            }
        } catch (_) {}

        if (isDeviceMismatch) {
            throw new ForbiddenError("Ujian tidak dapat dimulai: Terdeteksi duplikasi lisensi di perangkat berbeda.");
        }

        if (isRevoked) {
            throw new ForbiddenError("Ujian tidak dapat dimulai: Lisensi Server Offline telah dinonaktifkan oleh Administrator Pusat.");
        }

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
