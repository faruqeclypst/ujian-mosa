/* ============================================================
   🚀 DOCKER PROVISIONING HOOK (MASTER)
   ============================================================ */

// Gunakan 'router' hook agar lebih stabil di versi Anda
onRecordAfterCreateRequest((e) => {
    const slug = e.record.get("slug");
    const domain = e.record.get("domain") || (slug + ".alfaruqasri.my.id");
    const isActive = e.record.get("is_active");

    if (isActive) {
        console.log("[Docker-SaaS] Mencoba deploy sekolah:", slug);
        try {
            $os.exec("/pb/scripts/deploy-school.sh", slug, domain);
            console.log("[Docker-SaaS] Sukses Deploy:", slug);
        } catch (err) {
            console.error("[Docker-SaaS] Gagal Deploy:", err.message);
        }
    }
}, "schools");

onRecordAfterUpdateRequest((e) => {
    const wasActive = e.originalRecord.get("is_active");
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    const domain = e.record.get("domain") || (slug + ".alfaruqasri.my.id");

    if (isActive && !wasActive) {
        console.log("[Docker-SaaS] Mengaktifkan sekolah via Update:", slug);
        try {
            $os.exec("/pb/scripts/deploy-school.sh", slug, domain);
        } catch (err) {
            console.error("[Docker-SaaS] Gagal Update Deploy:", err.message);
        }
    }
}, "schools");
