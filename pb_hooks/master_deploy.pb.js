/* ============================================================
   🚀 DOCKER PROVISIONING HOOK (MASTER)
   ============================================================ */

onRecordAfterCreateSuccess((e) => {
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
    
    if (e.next) e.next();
}, "schools");

onRecordAfterUpdateSuccess((e) => {
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    const domain = e.record.get("domain") || (slug + ".alfaruqasri.my.id");
    
    // Kita jalankan deploy setiap kali ia diset Aktif (deploy script sudah aman dipanggil ulang)
    if (isActive) {
        console.log("[Docker-SaaS] Memastikan deploy sekolah aktif via Update:", slug);
        try {
            $os.exec("/pb/scripts/deploy-school.sh", slug, domain);
        } catch (err) {
            console.error("[Docker-SaaS] Gagal Update Deploy:", err.message);
        }
    }
    
    if (e.next) e.next();
}, "schools");
