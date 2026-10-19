// monitoring_stats.pb.js
// Endpoint agregasi backend untuk monitoring — ganti fetch 10k records di frontend.
// 
// 1. GET /api/room-stats -> {[roomId]: {ongoing, finished}}
//    Dipakai halaman Daftar Ruang Ujian (badge "N SISWA SEDANG MENGERJAKAN").
// 2. GET /api/room-detail-stats?roomId=xxx -> {total, ongoing, finished}
//    Dipakai halaman Monitoring detail (kartu statistik).
//
// Auth: hanya admin (users dengan role admin / _superusers).
console.log("[MONITOR] monitoring_stats hook loaded: /api/room-stats, /api/room-detail-stats");

function msGetAuth(info) {
    try {
        if (info && info.auth) return info.auth;
        const headers = info ? (info.headers || {}) : {};
        let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
        if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
            token = token.substring(7);
        }
        if (token) {
            return $app.findAuthRecordByToken(token);
        }
    } catch (e) {}
    return null;
}

function msRequireAdminOrTeacher(e) {
    const info = e.requestInfo();
    const auth = msGetAuth(info);
    if (!auth) return null;
    let col = "";
    try { if (auth.collection) col = auth.collection().name; } catch (err) {}
    if (col !== "_superusers" && col !== "users") return null;
    return auth;
}

// ---------------------------------------------------------------------------
// 1. GET /api/room-stats
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/room-stats", (e) => {
    const auth = msRequireAdminOrTeacher(e);
    if (!auth) return e.json(401, { error: "Autentikasi diperlukan." });
    try {
        const tpl = new DynamicModel({ rid: "", st: "", c: 0 });
        const rows = arrayOf(tpl);
        $app.db()
            .newQuery("SELECT examRoomId AS rid, status AS st, COUNT(DISTINCT studentId) AS c FROM attempts WHERE status IN ('ongoing','finished','LOCKED') GROUP BY examRoomId, status")
            .all(rows);
        const map = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.rid) continue;
            const rid = String(r.rid);
            if (!map[rid]) map[rid] = { ongoing: 0, finished: 0 };
            const st = String(r.st || "");
            const c = Number(r.c) || 0;
            if (st === "ongoing" || st === "LOCKED") map[rid].ongoing += c;
            else if (st === "finished" || st === "submitted") map[rid].finished += c;
        }
        return e.json(200, map);
    } catch (err) {
        console.error("[MONITOR] room-stats error:", err);
        return e.json(500, { error: "gagal menghitung statistik room" });
    }
});

// ---------------------------------------------------------------------------
// 2. GET /api/room-detail-stats?roomId=xxx
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/room-detail-stats", (e) => {
    const auth = msRequireAdminOrTeacher(e);
    if (!auth) return e.json(401, { error: "Autentikasi diperlukan." });
    try {
        const roomId = String(e.queryParam("roomId") || e.queryParam("roomid") || "");
        if (!roomId) return e.json(400, { error: "roomId wajib diisi" });

        // Ambil classIds room untuk eligibility (SQL langsung, bukan findRecordById)
        // Kolom allClasses tidak ada di semua tenant — jika classIds kosong/null,
        // anggap room menerima semua kelas (skip filter eligibility).
        let classIds = [];
        try {
            const rqTpl = new DynamicModel({ eci: "" });
            const rqRows = arrayOf(rqTpl);
            $app.db().newQuery(
                "SELECT classIds AS eci FROM exam_rooms WHERE id = '" + roomId.replace(/'/g, "''") + "'"
            ).all(rqRows);
            if (rqRows.length > 0) {
                const raw = rqRows[0].eci || "";
                if (Array.isArray(raw)) {
                    classIds = raw.map((c) => String(c).trim()).filter((c) => c && c !== "all");
                } else if (typeof raw === "string" && raw.length > 0) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                            classIds = parsed.map((c) => String(c).trim()).filter((c) => c && c !== "all");
                        }
                    } catch (pe) {
                        classIds = raw.split(",").map((c) => String(c).trim()).filter((c) => c && c !== "all");
                    }
                }
            }
        } catch (err) {}

        // Helper: hitung distinct student dengan filter status (+ eligibility bila perlu)
        // Jika classIds kosong → room untuk semua kelas → skip eligibility filter.
        function countByStatus(statusList, withEligibility) {
            const tpl = new DynamicModel({ c: 0 });
            const rows = arrayOf(tpl);
            let q;
            if (withEligibility && classIds.length > 0) {
                const inList = classIds.map((c) => "'" + String(c).replace(/'/g, "''") + "'").join(",");
                q = "SELECT COUNT(DISTINCT a.studentId) AS c FROM attempts a " +
                    "JOIN students s ON s.id = a.studentId " +
                    "WHERE a.examRoomId = '" + roomId.replace(/'/g, "''") + "' " +
                    "AND a.status IN (" + statusList.map((s) => "'" + s + "'").join(",") + ") " +
                    "AND s.classId IN (" + inList + ")";
            } else {
                q = "SELECT COUNT(DISTINCT studentId) AS c FROM attempts " +
                    "WHERE examRoomId = '" + roomId.replace(/'/g, "''") + "' " +
                    "AND status IN (" + statusList.map((s) => "'" + s + "'").join(",") + ")";
            }
            $app.db().newQuery(q).all(rows);
            return rows.length > 0 ? (Number(rows[0].c) || 0) : 0;
        }

        const useElig = classIds.length > 0;
        const ongoing = countByStatus(["ongoing", "LOCKED"], useElig);
        const finished = countByStatus(["finished", "submitted"], useElig);
        // Total peserta = siswa eligible yang punya attempt (ongoing+finished)
        // Untuk "total" yang konsisten dengan definisi monitoring (eligible),
        // hitung distinct student yang punya attempt apapun di room ini + eligible.
        const total = ongoing + finished;

        return e.json(200, { roomId: roomId, total: total, ongoing: ongoing, finished: finished });
    } catch (err) {
        console.error("[MONITOR] room-detail-stats error:", err);
        return e.json(500, { error: "gagal menghitung detail room" });
    }
});

