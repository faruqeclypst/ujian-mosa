/* =========================================================
   🚀 OFFLINE LICENSE ACTIVATION HOOK
   Menyimpan lisensi offline ke database server secara permanen
   sehingga berlaku untuk semua browser & komputer peserta di LAN.
   ========================================================= */

routerAdd("POST", "/api/offline-activate", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) { }

        const info = c.requestInfo();
        const licenseCode = (info.body["license"] || "").toString().trim();
        const schoolName = (info.body["school_name"] || "").toString().trim();

        if (!licenseCode) {
            return c.json(400, { error: "Kode lisensi tidak boleh kosong" });
        }

        let record = null;
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                record = list[0];
            }
        } catch (e) {}

        if (!record) {
            const col = $app.findCollectionByNameOrId("settings");
            record = new Record(col);
        }

        if (schoolName) {
            record.set("name", schoolName);
        }
        record.set("offline_license", licenseCode);
        $app.save(record);

        return c.json(200, { 
            success: true, 
            message: "Lisensi server offline berhasil disimpan ke database server!",
            school_name: schoolName || record.get("name")
        });
    } catch (err) {
        return c.json(500, { error: err.message || "Gagal menyimpan lisensi server offline" });
    }
});

// Endpoint baca status lisensi offline untuk client LAN / HP siswa / laptop pengawas
routerAdd("OPTIONS", "/api/offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (e) { }
    return c.noContent(204);
});

routerAdd("GET", "/api/offline-license", (c) => {
    try {
        try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (e) { }
        try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (e) { }

        let license = "";
        let schoolName = "";
        try {
            const list = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (list && list.length > 0) {
                license = list[0].get("offline_license") || "";
                schoolName = list[0].get("name") || "";
            }
        } catch (e) {}

        return c.json(200, {
            active: Boolean(license),
            license: license,
            school_name: schoolName
        });
    } catch (err) {
        return c.json(500, { error: err.message });
    }
});
