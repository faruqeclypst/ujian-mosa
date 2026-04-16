/* ============================================================
   🚀 DOCKER PROVISIONING HOOK (MASTER)
   Fungsi: Otomatis mendeploy container sekolah baru
   ============================================================ */

onRecordAfterUpdate((e) => {
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    const domain = e.record.get("domain") || (slug + ".alfaruqasri.my.id");
    
    // Cek status lama
    const wasActive = e.originalRecord.get("is_active");

    if (isActive && !wasActive) {
        console.log("[Docker-SaaS] Mendeploy sekolah baru:", slug);

        try {
            // Kita panggil skrip deploy-school.sh yang sudah ada di image
            // Pastikan skrip ini ada di /pb/scripts/deploy-school.sh di dalam container
            const result = $os.exec("/pb/scripts/deploy-school.sh", slug, domain);

            console.log("[Docker-SaaS] Sukses Deploy:", slug, result);
        } catch (err) {
            console.error("[Docker-SaaS] Gagal Deploy " + slug + ":", err.message);
        }
    }
}, "schools");
