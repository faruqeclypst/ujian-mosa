// exam_counts.pb.js (FINAL)
// PERF: endpoint agregasi backend untuk statistik kelas dan bank soal
// 1. GET /api/exam-question-counts -> { "<examId>": <count>, ... }
// 2. GET /api/class-student-counts -> { "<classId>": <count>, ..., "_total": <total> }
console.log("[PERF] exam_counts hook loaded: /api/exam-question-counts, /api/class-student-counts");

routerAdd("GET", "/api/exam-question-counts", (e) => {
    try {
        const tpl = new DynamicModel({ eid: "", c: 0 });
        const rows = arrayOf(tpl);
        $app.db()
            .newQuery("SELECT examId AS eid, COUNT(*) AS c FROM questions GROUP BY examId")
            .all(rows);
        const map = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r && r.eid) map[String(r.eid)] = Number(r.c) || 0;
        }
        return e.json(200, map);
    } catch (err) {
        console.error("[PERF] exam-question-counts error:", err);
        return e.json(500, { error: "gagal menghitung jumlah soal" });
    }
});

routerAdd("GET", "/api/class-student-counts", (e) => {
    try {
        const tpl = new DynamicModel({ cid: "", c: 0 });
        const rows = arrayOf(tpl);
        $app.db()
            .newQuery("SELECT classId AS cid, COUNT(*) AS c FROM students WHERE classId != '' AND classId != 'ALUMNI' GROUP BY classId")
            .all(rows);
        const map = {};
        let total = 0;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r && r.cid) {
                const count = Number(r.c) || 0;
                map[String(r.cid)] = count;
                total += count;
            }
        }
        map["_total"] = total;
        return e.json(200, map);
    } catch (err) {
        console.error("[PERF] class-student-counts error:", err);
        return e.json(500, { error: "gagal menghitung jumlah siswa per kelas" });
    }
});
