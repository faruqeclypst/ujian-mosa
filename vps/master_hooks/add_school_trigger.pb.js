// ============================================================
// Master PocketBase Trigger Hook - UNIVERSAL VERSION
// Fungsi: 
// 1. Auto-assign port jika kosong (mulai dari 8091)
// 2. Jalankan add-school.sh saat pendaftaran BARU atau UPDATE
// ============================================================

const triggerProvisioning = (e) => {
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    let port = e.record.get("port");
    
    // LOGIC AUTO-PORT
    if (!port || port === 0) {
        console.log("[Provisioning] Port kosong untuk", slug, ". Mencari port bebas...");
        const schools = $app.findRecordsByFilter("schools", "port > 0", "-port", 1);
        let nextPort = 8091; 
        if (schools.length > 0) {
            nextPort = schools[0].get("port") + 1;
        }
        e.record.set("port", nextPort);
        $app.save(e.record);
        port = nextPort;
        console.log("[Provisioning] Port diberikan otomatis:", nextPort);
    }

    if (isActive) {
        console.log("[Provisioning] Running automasi untuk:", slug, "pada port:", port);
        try {
            $os.exec("bash", "-c", "/usr/local/bin/add-school.sh " + slug + " " + port);
        } catch (err) {
            // handle error
        }
    }
    return e.next();
};

// Aktifkan untuk pendaftaran baru dan perubahan data
onRecordAfterCreateSuccess(triggerProvisioning, "schools");
onRecordAfterUpdateSuccess(triggerProvisioning, "schools");

// Hook untuk hapus sekolah
onRecordAfterDeleteSuccess((e) => {
    const slug = e.record.get("slug");
    console.log("[Provisioning] Menghapus infrastruktur:", slug);
    try {
        $os.exec("bash", "-c", "/usr/local/bin/remove-school.sh " + slug);
    } catch (err) {
        // handle error
    }
    return e.next();
}, "schools");
