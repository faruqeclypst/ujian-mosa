/* ============================================================
   🚀 DOCKER PROVISIONING HOOK (MASTER)
   Fungsi: Otomatis mendeploy container sekolah baru (Create & Update)
   ============================================================ */

function deploySchool(record) {
    const isActive = record.get("is_active");
    const slug = record.get("slug");
    const domain = record.get("domain") || (slug + ".alfaruqasri.my.id");

    if (isActive) {
        console.log("[Docker-SaaS] Mencoba deploy sekolah:", slug);
        try {
            // Panggil skrip deploy
            const result = $os.exec("/pb/scripts/deploy-school.sh", slug, domain);
            console.log("[Docker-SaaS] Sukses Deploy:", slug, result);
        } catch (err) {
            console.error("[Docker-SaaS] Gagal Deploy " + slug + ":", err.message);
        }
    }
}

// 1. Trigger saat buat sekolah baru
onRecordAfterCreateRequest((e) => {
    deploySchool(e.record);
}, "schools");

// 2. Trigger saat status is_active diubah
onRecordAfterUpdateRequest((e) => {
    const wasActive = e.originalRecord.get("is_active");
    const isActive = e.record.get("is_active");
    
    if (isActive && !wasActive) {
        deploySchool(e.record);
    }
}, "schools");
