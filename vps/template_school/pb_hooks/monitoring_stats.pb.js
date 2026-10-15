// monitoring_stats.pb.js
// Endpoint agregasi backend untuk monitoring — ganti fetch 10k records di frontend.
// 
// 1. GET /api/room-stats -> {[roomId]: {ongoing, finished}}
//    Dipakai halaman Daftar Ruang Ujian (badge "N SISWA SEDANG MENGERJAKAN").
// 2. GET /api/room-detail-stats?roomId=xxx -> {total, ongoing, finished}
//    Dipakai halaman Monitoring detail (kartu statistik).
// 3. GET /api/leaderboard?roomId=xxx&page=1&perPage=50
//    -> {items: [{studentId, name, username, score, answered, status}], totalItems, totalPages, page}
//    Dipakai halaman Live Score (ranking akurat, paginasi server-side).
//    Response juga membawa `stats: {total, ongoing, finished, locked, avgScore}`
//    untuk kartu statistik tanpa request tambahan.
//
// Auth: hanya admin (users dengan role admin / _superusers).
console.log("[MONITOR] monitoring_stats hook loaded: /api/room-stats, /api/room-detail-stats, /api/leaderboard");

function msGetAuth(info) {
    try {
        if (info && info.auth) return info.auth;
        const headers = info ? (info.headers || {}) : {};
        let token = headers["authorization"] || headers["x-token"] || "";
        if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
            token = token.substring(7);
        }
        if (token) {
            return $app.findAuthRecordByToken(token);
        }
    } catch (e) {}
    return null;
}

function msRequireAdmin(e) {
    const info = e.requestInfo();
    const auth = msGetAuth(info);
    if (!auth) {
        return { ok: false, res: e.json(401, { error: "Autentikasi diperlukan." }) };
    }
    let col = "";
    try { if (auth.collection) col = auth.collection().name; } catch (err) {}
    if (col !== "_superusers" && col !== "users") {
        return { ok: false, res: e.json(403, { error: "Akses ditolak." }) };
    }
    // users biasa harus punya role admin
    if (col === "users") {
        try {
            const role = auth.get("role") || "";
            if (role !== "admin" && role !== "superadmin") {
                return { ok: false, res: e.json(403, { error: "Hanya admin." }) };
            }
        } catch (err) {}
    }
    return { ok: true, auth: auth };
}

// ---------------------------------------------------------------------------
// 1. GET /api/room-stats
// ---------------------------------------------------------------------------
routerAdd("GET", "/api/room-stats", (e) => {
    const chk = msRequireAdmin(e);
    if (!chk.ok) return chk.res;
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
    const chk = msRequireAdmin(e);
    if (!chk.ok) return chk.res;
    try {
        const roomId = String(e.queryParam("roomId") || e.queryParam("roomid") || "");
        if (!roomId) return e.json(400, { error: "roomId wajib diisi" });

        // Ambil classIds room untuk eligibility
        let classIds = [];
        let allClasses = false;
        try {
            const room = $app.findRecordById("exam_rooms", roomId);
            if (room) {
                allClasses = !!(room.get("allClasses") || room.get("all_classes"));
                const raw = room.get("classIds") || room.get("classId") || room.get("classids") || "";
                if (Array.isArray(raw)) {
                    classIds = raw.map((c) => String(c).trim()).filter((c) => c && c !== "all");
                } else if (typeof raw === "string" && raw.length > 0) {
                    classIds = raw.split(",").map((c) => String(c).trim()).filter((c) => c && c !== "all");
                }
            }
        } catch (err) {}

        // Helper: hitung distinct student dengan filter status (+ eligibility bila perlu)
        function countByStatus(statusList, withEligibility) {
            const tpl = new DynamicModel({ c: 0 });
            const rows = arrayOf(tpl);
            let q;
            if (withEligibility && !allClasses && classIds.length > 0) {
                // Bangun IN clause dengan placeholder aman (classIds dari DB sendiri)
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

        const useElig = !allClasses && classIds.length > 0;
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
// 3. GET /api/leaderboard?roomId=xxx&page=1&perPage=50
// ---------------------------------------------------------------------------

// Skor satu soal (mirror dari getLiveScore/checkAns di frontend)
function msCheckAns(q, studentAns, overrides) {
    if (overrides && overrides[q.id] !== undefined) return overrides[q.id] ? 1 : 0;
    if (studentAns === undefined || studentAns === null) return 0;
    const type = q.type || q.field || "pilihan_ganda";
    try {
        if (type === "pilihan_ganda") {
            const choices = q.choices || {};
            const ck = Object.keys(choices).find((k) => String(k).toLowerCase() === String(studentAns).toLowerCase());
            return ck && choices[ck].isCorrect === true ? 1 : 0;
        }
        if (type === "benar_salah") {
            const sts = q.statements || (q.choices && q.choices.statements) || [];
            if (sts.length > 0) {
                let ok = 0;
                for (let i = 0; i < sts.length; i++) {
                    const st = sts[i];
                    const expected = String(st.answer || "benar").toLowerCase();
                    const given = String((studentAns && (studentAns[st.id] || "")) || "").toLowerCase();
                    if (given === expected) ok++;
                }
                return sts.length > 0 ? ok / sts.length : 0;
            }
            const choices2 = q.choices || {};
            const ck2 = Object.keys(choices2).find((k) => String(k).toLowerCase() === String(studentAns).toLowerCase());
            return ck2 && choices2[ck2].isCorrect === true ? 1 : 0;
        }
        if (type === "pilihan_ganda_kompleks") {
            const choices3 = q.choices || {};
            const correctKeys = Object.keys(choices3).filter((k) => choices3[k].isCorrect).map((k) => String(k).toLowerCase());
            const sKeys = Array.isArray(studentAns) ? studentAns.map((k) => String(k).toLowerCase()) : [];
            const cChosen = sKeys.filter((k) => correctKeys.indexOf(k) >= 0).length;
            const wChosen = sKeys.filter((k) => correctKeys.indexOf(k) < 0).length;
            return correctKeys.length > 0 ? Math.max(0, cChosen - wChosen) / correctKeys.length : 0;
        }
        if (type === "isian_singkat") {
            const expected = String(q.answerKey || "").trim().toLowerCase();
            const given = String(studentAns || "").trim().toLowerCase();
            return expected && given === expected ? 1 : 0;
        }
        if (type === "menjodohkan") {
            const pairs = q.pairs || [];
            if (pairs.length === 0) return 0;
            for (let i = 0; i < pairs.length; i++) {
                if (!studentAns || studentAns[pairs[i].id] !== pairs[i].right) return 0;
            }
            return 1;
        }
        // uraian & tipe lain: 0 (dinilai manual)
    } catch (err) {}
    return 0;
}

function msCalcScore(answers, questions, overrides) {
    if (!answers || questions.length === 0) return { score: 0, answered: 0 };
    overrides = overrides || {};
    const order = (answers && (answers.__order__ || (answers.__meta && answers.__meta.questionOrder))) || null;
    const target = Array.isArray(order) && order.length > 0
        ? questions.filter((q) => order.indexOf(q.id) >= 0)
        : questions;
    let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0, answered = 0;
    for (let i = 0; i < target.length; i++) {
        const q = target[i];
        const type = q.type || "pilihan_ganda";
        const isEssay = type === "uraian";
        const sa = answers[q.id];
        if (sa !== undefined && sa !== null && sa !== "") answered++;
        const sc = msCheckAns(q, sa, overrides);
        if (isEssay) { essTotal++; essCorrect += sc; }
        else { objTotal++; objCorrect += sc; }
    }
    let score = 0;
    if (essTotal === 0) {
        score = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
    } else {
        const o = objTotal > 0 ? (objCorrect / objTotal) * 100 : 0;
        const s = essTotal > 0 ? (essCorrect / essTotal) * 100 : 0;
        score = Math.round(o * 0.6 + s * 0.4);
    }
    return { score: score, answered: answered };
}

routerAdd("GET", "/api/leaderboard", (e) => {
    const chk = msRequireAdmin(e);
    if (!chk.ok) return chk.res;
    try {
        const roomId = String(e.queryParam("roomId") || e.queryParam("roomid") || "");
        if (!roomId) return e.json(400, { error: "roomId wajib diisi" });
        const page = Math.max(1, parseInt(e.queryParam("page") || "1", 10) || 1);
        const perPage = Math.min(200, Math.max(1, parseInt(e.queryParam("perPage") || e.queryParam("perpage") || "50", 10) || 50));

        // 1. Ambil examId dari room
        let examId = "";
        try {
            const room = $app.findRecordById("exam_rooms", roomId);
            if (room) examId = String(room.get("examId") || room.get("exam_id") || "");
        } catch (err) {}
        if (!examId) return e.json(400, { error: "exam tidak ditemukan untuk room ini" });

        // 2. Ambil questions (hanya field yang dipakai untuk scoring)
        const qTpl = new DynamicModel({ id: "", data: "" });
        const qRows = arrayOf(qTpl);
        // Ambil via DAO agar dapat JSON lengkap per question
        const questions = [];
        try {
            const qRecs = $app.findRecordsByFilter("questions", "examId = '" + examId.replace(/'/g, "''") + "'", "", 0, 0);
            for (let i = 0; i < qRecs.length; i++) {
                const r = qRecs[i];
                questions.push({
                    id: String(r.id),
                    type: r.get("type") || "pilihan_ganda",
                    choices: r.get("choices") || {},
                    statements: r.get("statements") || [],
                    pairs: r.get("pairs") || [],
                    items: r.get("items") || [],
                    answerKey: r.get("answerKey") || r.get("correctAnswer") || "",
                    field: r.get("field") || ""
                });
            }
        } catch (err) {
            console.error("[MONITOR] leaderboard questions error:", err);
        }

        // 3. Ambil attempts room ini (field ringan)
        const aTpl = new DynamicModel({ id: "", sid: "", st: "", ans: "", ovr: "", cc: 0 });
        const aRows = arrayOf(aTpl);
        $app.db().newQuery(
            "SELECT id AS id, studentId AS sid, status AS st, answers AS ans, overrides AS ovr, cheatCount AS cc " +
            "FROM attempts WHERE examRoomId = '" + roomId.replace(/'/g, "''") + "'"
        ).all(aRows);

        // 4. Ambil nama siswa sekaligus
        const sMap = {};
        try {
            const sTpl = new DynamicModel({ id: "", nm: "", un: "" });
            const sRows = arrayOf(sTpl);
            $app.db().newQuery("SELECT id AS id, name AS nm, username AS un FROM students").all(sRows);
            for (let i = 0; i < sRows.length; i++) {
                if (sRows[i] && sRows[i].id) sMap[String(sRows[i].id)] = { name: sRows[i].nm || "", username: sRows[i].un || "" };
            }
        } catch (err) {}

        // 5. Hitung skor semua, sort, paginasi
        const scored = [];
        let stOngoing = 0, stFinished = 0, stLocked = 0, scoreSum = 0;
        for (let i = 0; i < aRows.length; i++) {
            const r = aRows[i];
            if (!r || !r.sid) continue;
            let answers = {};
            let overrides = {};
            try { if (r.ans) answers = JSON.parse(r.ans); } catch (err) {}
            try { if (r.ovr) overrides = JSON.parse(r.ovr); } catch (err) {}
            // overrides bisa juga di dalam answers.__overrides__
            if (!overrides || Object.keys(overrides).length === 0) {
                try { overrides = answers.__overrides__ || {}; } catch (err) {}
            }
            const calc = msCalcScore(answers, questions, overrides);
            const stt = String(r.st || "");
            if (stt === "ongoing") stOngoing++;
            else if (stt === "finished" || stt === "submitted") stFinished++;
            else if (stt === "LOCKED") stLocked++;
            scoreSum += calc.score;
            const sm = sMap[String(r.sid)] || { name: "", username: "" };
            scored.push({
                studentId: String(r.sid),
                attemptId: String(r.id),
                name: sm.name,
                username: sm.username,
                status: stt,
                score: calc.score,
                answered: calc.answered,
                totalQuestions: questions.length,
                cheatCount: Number(r.cc) || 0
            });
        }
        scored.sort((a, b) => b.score - a.score || b.answered - a.answered);

        const totalItems = scored.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        const start = (page - 1) * perPage;
        const items = scored.slice(start, start + perPage).map((it, idx) => {
            it.rank = start + idx + 1;
            return it;
        });

        const stats = {
            total: totalItems,
            ongoing: stOngoing,
            finished: stFinished,
            locked: stLocked,
            avgScore: totalItems > 0 ? Math.round(scoreSum / totalItems) : 0
        };

        return e.json(200, { items: items, totalItems: totalItems, totalPages: totalPages, page: page, perPage: perPage, stats: stats });
    } catch (err) {
        console.error("[MONITOR] leaderboard error:", err);
        return e.json(500, { error: "gagal menghitung leaderboard" });
    }
});
