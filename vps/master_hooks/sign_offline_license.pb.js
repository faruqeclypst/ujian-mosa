// ============================================================
// PocketBase Master Hook: RSA-2048 Sign Offline License
// ============================================================

routerAdd("OPTIONS", "/api/multi-vps/sign-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/multi-vps/sign-offline-license", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    try {
        console.log("[SignOfflineLicense] Step 1: Read requestInfo");
        const info = c.requestInfo();
        const body = info.body || {};
        console.log("[SignOfflineLicense] Step 2: Body read", JSON.stringify(body));
        
        const schoolName = (body["school_name"] || "").toString().trim();
        const slug = (body["slug"] || "").toString().trim();
        const npsn = (body["npsn"] || "-").toString().trim();
        const validUntil = (body["valid_until"] || "").toString().trim();
        const maxStudents = parseInt(body["max_students"] || 0, 10);
        const notes = (body["notes"] || "Izin Resmi Server Offline CBT").toString().trim();

        console.log("[SignOfflineLicense] Step 3: Executing cmd");
        const out = $os.cmd("/usr/local/bin/sign-offline-license.py", schoolName, slug, npsn, validUntil, String(maxStudents), notes).output();
        console.log("[SignOfflineLicense] Step 4: Cmd executed, out len:", out ? out.length : 0);

        let rawJson = "";
        if (out) {
            for (let i = 0; i < out.length; i++) {
                rawJson += String.fromCharCode(out[i]);
            }
        }
        rawJson = rawJson.trim();
        console.log("[SignOfflineLicense] Step 5: Raw JSON:", rawJson);

        const result = JSON.parse(rawJson);
        return c.json(result.success ? 200 : 400, result);
    } catch (err) {
        console.error("[SignOfflineLicense] Error:", err, err.stack);
        return c.json(500, { success: false, error: "Terjadi kesalahan internal: " + err });
    }
});
