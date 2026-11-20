// monitoring_stats.pb.js
// Endpoint agregasi backend untuk monitoring — ganti fetch 10k records di frontend.
// 
// 1. GET /api/room-stats -> {[roomId]: {ongoing, finished}}
//    Dipakai halaman Daftar Ruang Ujian (badge "N SISWA SEDANG MENGERJAKAN").
// 2. GET /api/room-detail-stats?roomId=xxx -> {total, ongoing, finished}
//    Dipakai halaman Monitoring detail (kartu statistik).
// 3. GET /api/room-participants?roomId=xxx -> {roomId, total, participants[]}
//    Roster peserta satu ruang (nama + username + nama kelas digabung di SQL).
//    Dipakai halaman Monitoring detail sebagai sumber nama siswa, menggantikan
//    ketergantungan pada getFullList students global di frontend.
// 4. GET /api/dashboard-stats -> {students, teachers, classes, subjects,
//    exams, questions, rooms, roomsActive, ongoingStudents}
//    Semua angka kartu Dashboard sebagai COUNT(*) SQL dalam satu request.
//
// Auth: hanya admin (users dengan role admin / _superusers).
console.log("[MONITOR] monitoring_stats hook loaded: /api/room-stats, /api/room-detail-stats, /api/room-participants, /api/dashboard-stats");

// CATATAN: helper auth TIDAK boleh didefinisikan di top-level file ini.
// VM handler PocketBase tidak mewarisi function top-level, sehingga handler
// yang memanggil helper top-level selalu melempar ReferenceError dan dibalas
// 400 generik. Semua helper endpoint ini ditulis di dalam handler masing-masing.

// ---------------------------------------------------------------------------
// 1. GET /api/room-stats
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/room-stats", (e) => {
    const auth = (() => {
        try {
            const info = e.requestInfo();
            let rec = info ? info.auth : null;
            if (!rec) {
                const headers = (info && info.headers) || {};
                let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
                if (typeof token === "string" && token.indexOf("Bearer ") === 0) token = token.substring(7);
                if (token) rec = $app.findAuthRecordByToken(token);
            }
            if (!rec) return null;
            let col = "";
            try { if (rec.collection) col = rec.collection().name; } catch (err) {}
            return (col === "_superusers" || col === "users") ? rec : null;
        } catch (err) { return null; }
    })();
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
    const auth = (() => {
        try {
            const info = e.requestInfo();
            let rec = info ? info.auth : null;
            if (!rec) {
                const headers = (info && info.headers) || {};
                let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
                if (typeof token === "string" && token.indexOf("Bearer ") === 0) token = token.substring(7);
                if (token) rec = $app.findAuthRecordByToken(token);
            }
            if (!rec) return null;
            let col = "";
            try { if (rec.collection) col = rec.collection().name; } catch (err) {}
            return (col === "_superusers" || col === "users") ? rec : null;
        } catch (err) { return null; }
    })();
    if (!auth) return e.json(401, { error: "Autentikasi diperlukan." });
    try {
        const reqInfo = e.requestInfo();
        const query = (reqInfo && reqInfo.query) || {};
        const roomId = String(query["roomId"] || query["roomid"] || "");
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

// ---------------------------------------------------------------------------
// 3. GET /api/room-participants?roomId=xxx
// Roster peserta satu ruang digabung di SQL (students LEFT JOIN classes):
// nama, username, dan nama kelas tiba di browser dalam SATU request ringan.
// Inilah sumber nama siswa untuk tabel monitoring — sebelumnya panel membaca
// daftar students global hasil getFullList (10rb record, puluhan request)
// yang lambat/gagal saat server sibuk, sehingga nama tampil sebagai ID mentah.
// classIds kosong -> room menerima semua kelas -> seluruh siswa.
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/room-participants", (e) => {
    const auth = (() => {
        try {
            const info = e.requestInfo();
            let rec = info ? info.auth : null;
            if (!rec) {
                const headers = (info && info.headers) || {};
                let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
                if (typeof token === "string" && token.indexOf("Bearer ") === 0) token = token.substring(7);
                if (token) rec = $app.findAuthRecordByToken(token);
            }
            if (!rec) return null;
            let col = "";
            try { if (rec.collection) col = rec.collection().name; } catch (err) {}
            return (col === "_superusers" || col === "users") ? rec : null;
        } catch (err) { return null; }
    })();
    if (!auth) return e.json(401, { error: "Autentikasi diperlukan." });
    try {
        const reqInfo = e.requestInfo();
        const query = (reqInfo && reqInfo.query) || {};
        const roomId = String(query["roomId"] || query["roomid"] || "");
        if (!roomId) return e.json(400, { error: "roomId wajib diisi" });

        // classIds room dibaca via SQL (pola sama dengan room-detail-stats).
        let classIds = [];
        try {
            const rqTpl = new DynamicModel({ eci: "" });
            const rqRows = arrayOf(rqTpl);
            $app.db().newQuery(
                "SELECT classIds AS eci FROM exam_rooms WHERE id = '" + roomId.replace(/'/g, "''") + "'"
            ).all(rqRows);
            if (rqRows.length === 0) return e.json(404, { error: "ruang tidak ditemukan" });
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
        } catch (err) {}

        let sql = "SELECT s.id AS id, s.name AS name, s.username AS username, s.classId AS classId, COALESCE(c.name, '') AS className " +
            "FROM students s LEFT JOIN classes c ON c.id = s.classId";
        if (classIds.length > 0) {
            const inList = classIds.map((c) => "'" + String(c).replace(/'/g, "''") + "'").join(",");
            sql += " WHERE s.classId IN (" + inList + ")";
        }
        sql += " ORDER BY className, s.name LIMIT 20000";

        const tpl = new DynamicModel({ id: "", name: "", username: "", classId: "", className: "" });
        const rows = arrayOf(tpl);
        $app.db().newQuery(sql).all(rows);

        const participants = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.id) continue;
            participants.push({
                id: String(r.id),
                name: String(r.name || ""),
                username: String(r.username || ""),
                classId: String(r.classId || ""),
                className: String(r.className || ""),
            });
        }
        return e.json(200, { roomId: roomId, total: participants.length, participants: participants });
    } catch (err) {
        console.error("[MONITOR] room-participants error:", err);
        return e.json(500, { error: "gagal memuat peserta room" });
    }
});

// ---------------------------------------------------------------------------
// 4. GET /api/dashboard-stats
// Semua angka kartu Dashboard sebagai COUNT(*) SQL dalam satu request:
// total siswa/guru/kelas/mapel/ujian/soal/ruang + siswa sedang ujian.
// Dashboard tidak lagi menghitung dari getFullList ribuan record di frontend.
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/dashboard-stats", (e) => {
    const auth = (() => {
        try {
            const info = e.requestInfo();
            let rec = info ? info.auth : null;
            if (!rec) {
                const headers = (info && info.headers) || {};
                let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
                if (typeof token === "string" && token.indexOf("Bearer ") === 0) token = token.substring(7);
                if (token) rec = $app.findAuthRecordByToken(token);
            }
            if (!rec) return null;
            let col = "";
            try { if (rec.collection) col = rec.collection().name; } catch (err) {}
            return (col === "_superusers" || col === "users") ? rec : null;
        } catch (err) { return null; }
    })();
    if (!auth) return e.json(401, { error: "Autentikasi diperlukan." });
    try {
        const tpl = new DynamicModel({
            students: 0, teachers: 0, classes: 0, subjects: 0, exams: 0,
            questions: 0, rooms: 0, roomsActive: 0, ongoingStudents: 0,
        });
        const rows = arrayOf(tpl);
        $app.db().newQuery(
            "SELECT " +
            "(SELECT COUNT(*) FROM students) AS students, " +
            "(SELECT COUNT(*) FROM teachers) AS teachers, " +
            "(SELECT COUNT(*) FROM classes) AS classes, " +
            "(SELECT COUNT(*) FROM subjects) AS subjects, " +
            "(SELECT COUNT(*) FROM exams) AS exams, " +
            "(SELECT COUNT(*) FROM questions) AS questions, " +
            "(SELECT COUNT(*) FROM exam_rooms) AS rooms, " +
            "(SELECT COUNT(*) FROM exam_rooms WHERE status IS NULL OR status != 'archive') AS roomsActive, " +
            "(SELECT COUNT(DISTINCT studentId) FROM attempts WHERE status = 'ongoing') AS ongoingStudents"
        ).all(rows);
        const r = rows.length > 0 ? rows[0] : {};
        return e.json(200, {
            students: Number(r.students) || 0,
            teachers: Number(r.teachers) || 0,
            classes: Number(r.classes) || 0,
            subjects: Number(r.subjects) || 0,
            exams: Number(r.exams) || 0,
            questions: Number(r.questions) || 0,
            rooms: Number(r.rooms) || 0,
            roomsActive: Number(r.roomsActive) || 0,
            ongoingStudents: Number(r.ongoingStudents) || 0,
        });
    } catch (err) {
        console.error("[MONITOR] dashboard-stats error:", err);
        return e.json(500, { error: "gagal menghitung statistik dashboard" });
    }
});

