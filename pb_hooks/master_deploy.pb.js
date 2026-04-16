/* ============================================================
   🚀 DOCKER PROVISIONING HOOK (MASTER)
   Fungsi: Otomatis mendeploy container sekolah baru
   ============================================================ */

function deploySchool(record) {
    const slug = record.get("slug");
    const domain = record.get("domain") || (slug + ".alfaruqasri.my.id");

    console.log("[Docker-SaaS] Mencoba deploy sekolah:", slug);
    try {
        const result = $os.exec("/pb/scripts/deploy-school.sh", slug, domain);
        console.log("[Docker-SaaS] Sukses Deploy:", slug, result);
    } catch (err) {
        console.error("[Docker-SaaS] Gagal Deploy " + slug + ":", err.message);
    }
}

// Gunakan nama fungsi yang benar untuk v0.36
onRecordAfterCreate((e) => {
    if (e.record.get("is_active")) {
        deploySchool(e.record);
    }
}, "schools");

onRecordAfterUpdate((e) => {
    const wasActive = e.originalRecord.get("is_active");
    const isActive = e.record.get("is_active");

    if (isActive && !wasActive) {
        deploySchool(e.record);
    }
}, "schools");
