// ============================================================
// PocketBase Hook: Tenant Branding Sync (Name & Logo)
// Memungkinkan sekolah tenant menyinkronkan nama dan logo ke
// registry Master PocketBase tanpa memerlukan token SuperAdmin.
// ============================================================

routerAdd("OPTIONS", "/api/tenant-branding-sync", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/tenant-branding-sync", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const slug = (body["slug"] || "").toString().trim();
        const name = (body["name"] || "").toString().trim();
        const logoUrl = body["logo_url"] !== undefined ? ("" + body["logo_url"]).trim() : null;

        if (!slug) {
            return c.json(400, { success: false, error: "Parameter 'slug' wajib diisi." });
        }

        const safeSlug = slug.replace(/'/g, "");
        const records = $app.findRecordsByFilter("schools", "slug = '" + safeSlug + "'", "-created", 1);
        if (!records || records.length === 0) {
            return c.json(404, { success: false, error: "Sekolah dengan slug '" + slug + "' tidak ditemukan di registry master." });
        }

        const school = records[0];

        // Update langsung via database query agar tidak memicu hook provisioning Nginx/Caddy yang tidak perlu
        const params = { id: school.id };
        let updateParts = [];

        if (name) {
            updateParts.push("name = {:name}");
            params.name = name;
        }

        if (logoUrl !== null) {
            updateParts.push("logo_url = {:logo_url}");
            params.logo_url = logoUrl;
        }

        if (updateParts.length > 0) {
            const sql = "UPDATE schools SET " + updateParts.join(", ") + " WHERE id = {:id}";
            $app.db().newQuery(sql).bind(params).execute();
            console.log("[TenantBrandingSync] Berhasil sinkronisasi slug:", slug, "name:", name, "logo_url:", logoUrl);
        }

        return c.json(200, {
            success: true,
            id: school.id,
            slug: slug,
            name: name || school.get("name"),
            logo_url: logoUrl !== null ? logoUrl : school.get("logo_url")
        });
    } catch (err) {
        console.error("[TenantBrandingSync] Error:", err);
        return c.json(500, { success: false, error: "" + err });
    }
});
