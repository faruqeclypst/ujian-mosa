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
