// exam_counts.pb.js (FINAL)
// PERF: endpoint khusus untuk jumlah soal per exam.
// GET /api/exam-question-counts -> { "<examId>": <count>, ... }
// Dipakai halaman Bank Soal supaya badge jumlah soal cukup 1 request
// (tidak perlu N+1 request per bank soal).
console.log("[PERF] exam_counts hook loaded: /api/exam-question-counts");

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
