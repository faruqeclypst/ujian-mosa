// ============================================================
// Master Provisioning Trigger (With Multi-VPS Worker Node Support)
// ============================================================
const triggerProvisioning = (e) => {
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    let port = e.record.get("port");
    const customDomain = (e.record.get("custom_domain") || "").trim();
    const quota = e.record.get("student_quota") || 50;
    const serverHost = (e.record.get("server_host") || "127.0.0.1").trim();

    if (!port || port === 0) {
        const schools = $app.findRecordsByFilter("schools", "port > 0", "-port", 1);
        let nextPort = 8091;
        if (schools.length > 0) nextPort = schools[0].get("port") + 1;
        e.record.set("port", nextPort);
        $app.save(e.record);
        port = nextPort;
    }

    if (isActive) {
        console.log("[Provisioning] Orchestrating:", slug, "on port:", port, "host:", serverHost, "customDomain:", customDomain, "quota:", quota);
        try { 
            const domainArg = customDomain ? ('"' + customDomain + '"') : "_";
            const cmd = `/usr/local/bin/add-school.sh "${slug}" ${port} ${domainArg} ${quota} "${serverHost}"`;
            $os.cmd("bash", "-c", cmd).run(); 
        } catch (err) { console.log("[Provisioning] Error:", err); }
    }
    return e.next();
};

onRecordAfterCreateSuccess(triggerProvisioning, "schools");
onRecordAfterUpdateSuccess(triggerProvisioning, "schools");

onRecordAfterDeleteSuccess((e) => {
    const slug = e.record.get("slug");
    console.log("[Provisioning] Cleaning up:", slug);
    try { $os.cmd("bash", "-c", "/usr/local/bin/remove-school.sh " + slug).run(); } catch (err) {}
    return e.next();
}, "schools");
