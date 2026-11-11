// pb_hooks/fast_exams.pb.js
// Ultra-fast bulk operation for bank soal (archive, restore, delete) in PocketBase SQLite
// Executes directly within $app.runInTransaction() in single-digit milliseconds (<10ms)
console.log("[PERF] fast_exams hook loaded: /api/fast-exams/*");

routerAdd("OPTIONS", "/api/fast-exams/{action}", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/fast-exams/{action}", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) { }
    }

    function getAuth(info) {
        try {
            if (info && info.auth) return info.auth;
            const headers = info ? (info.headers || {}) : {};
            let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
            if (Array.isArray(token)) token = token[0] || "";
            if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                token = token.substring(7);
            }
            token = (token || "").trim();
            if (token) {
                return $app.findAuthRecordByToken(token);
            }
        } catch (_) {}
        return null;
    }

    setCors(c);

    const action = (c.pathParam("action") || "").toLowerCase().trim();
    if (action !== "archive" && action !== "restore" && action !== "delete") {
        return c.json(400, { ok: false, message: "Aksi tidak valid. Gunakan: archive, restore, atau delete." });
    }

    const info = c.requestInfo();
    const auth = getAuth(info);

    if (!auth) {
        return c.json(401, { ok: false, message: "Autentikasi diperlukan." });
    }

    let authCol = "";
    try { if (auth.collection) authCol = auth.collection().name; } catch (_) {}
    if (authCol !== "_superusers" && authCol !== "users") {
        return c.json(403, { ok: false, message: "Akses ditolak: Hanya admin dan guru yang diizinkan." });
    }

    let callerRole = "teacher";
    let callerTeacherId = "";
    try {
        callerRole = auth.getString ? auth.getString("role") : (auth.role || "teacher");
        callerTeacherId = auth.getString ? auth.getString("teacherId") : (auth.teacherId || "");
    } catch (_) {}

    const isAdmin = authCol === "_superusers" || callerRole === "admin" || callerRole === "superadmin";

    const body = info.body || {};
    let rawIds = body.examIds || [];
    if (!Array.isArray(rawIds)) rawIds = [rawIds];

    // Filter valid IDs (string tidak kosong, alphanumeric)
    const examIds = rawIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id))
        .slice(0, 500);

    if (examIds.length === 0) {
        return c.json(400, { ok: false, message: "examIds array diperlukan dan tidak boleh kosong." });
    }

    try {
        let processedCount = 0;
        let blockedActiveRooms = 0;
        let blockedNotOwner = 0;

        $app.runInTransaction((txApp) => {
            let targetIds = examIds;

            // Jika role adalah Guru (bukan admin), hanya proses bank soal milik guru bersangkutan
            if (!isAdmin) {
                if (!callerTeacherId) {
                    throw new Error("Akun guru belum ditautkan dengan data guru (teacherId kosong).");
                }
                const inListAuth = targetIds.map((_, i) => "{:chk" + i + "}").join(",");
                const chkParams = { teacherId: callerTeacherId };
                for (let i = 0; i < targetIds.length; i++) {
                    chkParams["chk" + i] = targetIds[i];
                }

                const ownedRows = arrayOf(new DynamicModel({ id: "" }));
                txApp.db().newQuery(
                    "SELECT id FROM exams WHERE id IN (" + inListAuth + ") AND teacherId = {:teacherId}"
                ).bind(chkParams).all(ownedRows);

                const ownedSet = {};
                for (let r of ownedRows) ownedSet[r.id] = true;
                const ownedIds = targetIds.filter((id) => ownedSet[id]);
                blockedNotOwner = targetIds.length - ownedIds.length;
                targetIds = ownedIds;

                if (targetIds.length === 0) {
                    throw new Error("Anda tidak memiliki izin untuk mengelola bank soal terpilih.");
                }
            }

            // Proteksi: jangan hapus/arsip jika bank soal sedang digunakan di ruang ujian aktif
            if (action === "delete" || action === "archive") {
                const inListRooms = targetIds.map((_, i) => "{:rid" + i + "}").join(",");
                const roomParams = {};
                for (let i = 0; i < targetIds.length; i++) {
                    roomParams["rid" + i] = targetIds[i];
                }

                const activeRoomRows = arrayOf(new DynamicModel({ examId: "" }));
                txApp.db().newQuery(
                    "SELECT DISTINCT examId FROM exam_rooms WHERE examId IN (" + inListRooms + ") " +
                    "AND (status IS NULL OR status != 'archive') " +
                    "AND (isActive IS NULL OR isActive = 1 OR isActive = 'true') " +
                    "AND (isDisabled IS NULL OR isDisabled = 0 OR isDisabled = 'false')"
                ).bind(roomParams).all(activeRoomRows);

                if (activeRoomRows.length > 0) {
                    const activeSet = {};
                    for (let r of activeRoomRows) activeSet[r.examId] = true;
                    const safeIds = targetIds.filter((id) => !activeSet[id]);
                    blockedActiveRooms = targetIds.length - safeIds.length;

                    if (safeIds.length === 0) {
                        throw new Error("Semua bank soal terpilih sedang digunakan di Ruang Ujian aktif dan tidak dapat diubah.");
                    }
                    targetIds = safeIds;
                }
            }

            const inList = targetIds.map((_, i) => "{:id" + i + "}").join(",");
            const params = {};
            for (let i = 0; i < targetIds.length; i++) {
                params["id" + i] = targetIds[i];
            }

            if (action === "archive") {
                txApp.db().newQuery("UPDATE exams SET status = 'archive' WHERE id IN (" + inList + ")").bind(params).execute();
            } else if (action === "restore") {
                txApp.db().newQuery("UPDATE exams SET status = '' WHERE id IN (" + inList + ")").bind(params).execute();
            } else if (action === "delete") {
                // Hapus seluruh butir soal yang bersangkutan
                txApp.db().newQuery("DELETE FROM questions WHERE examId IN (" + inList + ")").bind(params).execute();
                // Hapus exams
                txApp.db().newQuery("DELETE FROM exams WHERE id IN (" + inList + ")").bind(params).execute();
            }

            processedCount = targetIds.length;
        });

        return c.json(200, {
            ok: true,
            count: processedCount,
            action: action,
            blockedRooms: blockedActiveRooms,
            blockedPermissions: blockedNotOwner
        });
    } catch (err) {
        console.error("[PERF] fast_exams error:", err);
        return c.json(400, { ok: false, error: err.message || String(err) });
    }
});
