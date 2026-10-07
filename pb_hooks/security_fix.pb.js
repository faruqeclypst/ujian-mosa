/* =========================================================
   SECURITY FIX — modalbangsa (v2, 2026-09-29)
   1. Strip kunci jawaban (correctAnswer + isCorrect/answer)
      dari respons questions untuk siswa & guest — TANPA
      merusak struktur soal (statements/pairs/items utuh).
   2. Strip API key AI (groq_api_key, ai_gateway_key) dari
      respons settings untuk selain superuser/users.
      (universal_token BELUM di-strip: frontend masih baca
      dari settings publik; pindahkan ke /api/verify-pin dulu.)
   3. Hitung ulang skor attempts di server setiap ada
      submit (status=finished) dari siswa — nilai dari
      client tidak lagi dipercaya. Guru/admin (users)
      tetap bisa override manual (untuk nilai uraian).
   4. Siswa hanya bisa melihat answers miliknya sendiri.
   5. Endpoint POST /api/verify-pin untuk validasi token
      ruangan di sisi server (rate-limit sederhana).

   CATATAN TEKNIS: di JSVM PocketBase ini, binding
   top-level file TIDAK terlihat di dalam callback, jadi
   semua helper didefinisikan di dalam tiap callback
   (duplikasi disengaja).
   ========================================================= */

// ---------- 1, 2, 4: strip field sensitif (onRecordEnrich) ----------
onRecordEnrich((e) => {
    function pj(v, fb) {
        try {
            if (v === null || v === undefined || v === "") return fb;
            if (typeof v === "string") return JSON.parse(v);
            if (typeof v === "object" && v !== null) {
                // PocketBase JSONRaw: ambil string mentah via .string()
                if (typeof v.string === "function") {
                    try { return JSON.parse(v.string()); } catch (e2) { return fb; }
                }
                return v;
            }
            return fb;
        } catch (x) { return fb; }
    }
    function authName(auth) {
        if (!auth) return "";
        try {
            const c = auth.collection();
            if (c && c.name) return c.name;
        } catch (x) {}
        return "";
    }
    // Hapus kunci jawaban secara rekursif TANPA merusak struktur soal:
    //  - pilihan ganda/kompleks : {a:{text,isCorrect}} -> {a:{text}}
    //  - benar-salah statements : {statements:[{id,text,answer}]} -> [{id,text}]
    //  - menjodohkan/urutan/drag : pairs/items dipertahankan utuh
    function stripAnswerKeys(node) {
        if (Array.isArray(node)) {
            const out = [];
            for (let i = 0; i < node.length; i++) out.push(stripAnswerKeys(node[i]));
            return out;
        }
        if (node !== null && typeof node === "object") {
            const obj = {};
            const keys = Object.keys(node);
            for (let j = 0; j < keys.length; j++) {
                const k = keys[j];
                const lk = ("" + k).toLowerCase();
                if (lk === "iscorrect" || lk === "correctanswer" || lk === "answer") continue;
                obj[k] = stripAnswerKeys(node[k]);
            }
            return obj;
        }
        return node;
    }
    try {
        const cname = e.record.collection().name;
        let auth = null;
        try { if (e.requestInfo && e.requestInfo.auth) auth = e.requestInfo.auth; } catch (x) {}
        const aname = authName(auth);
        const trusted = (aname === "_superusers" || aname === "users");

        if (cname === "questions") {
            // Kunci jawaban hanya untuk guru/admin; siswa & guest di-strip
            if (!trusted) {
                try { e.record.hide("correctAnswer"); }
                catch (hx) { try { e.record.set("correctAnswer", ""); } catch (hx2) {} }
                const parsed = pj(e.record.get("options"), null);
                if (parsed !== null && parsed !== undefined) {
                    e.record.set("options", stripAnswerKeys(parsed));
                }
            }
        } else if (cname === "settings") {
            // API key AI tidak boleh keluar ke siswa/guest
            if (!trusted) {
                try { e.record.hide("groq_api_key"); } catch (hx) {}
                try { e.record.hide("ai_gateway_key"); } catch (hx) {}
            }
        } else if (cname === "attempts") {
            // Siswa hanya boleh lihat answers miliknya sendiri
            if (aname === "students") {
                let authId = "";
                try { authId = auth.id; } catch (x) {}
                const owner = e.record.getString("studentId");
                if (owner && authId && owner !== authId) {
                    e.record.set("answers", {});
                }
            }
        }
    } catch (err) {
        console.error("[SECURITY_FIX] enrich error:", err);
    }
    try { e.next(); } catch (nx) {}
});

// ---------- 3: skoring server-side (mirror logika cron auto-finish) ----------
onRecordCreateRequest((e) => {
    // --- helper lokal (wajib di dalam callback) ---
    function pj(v, fb) {
        try {
            if (v === null || v === undefined || v === "") return fb;
            if (typeof v === "string") return JSON.parse(v);
            if (typeof v === "object" && v !== null) {
                // PocketBase JSONRaw: ambil string mentah via .string()
                if (typeof v.string === "function") {
                    try { return JSON.parse(v.string()); } catch (e2) { return fb; }
                }
                return v;
            }
            return fb;
        } catch (x) { return fb; }
    }
    function authName(auth) {
        if (!auth) return "";
        try {
            const c = auth.collection();
            if (c && c.name) return c.name;
        } catch (x) {}
        return "";
    }
    function doRecalc(ev) {
        const TYPE_MAP = {
            "multiple_choice": "pilihan_ganda", "pilihan_ganda": "pilihan_ganda",
            "complex_multiple_choice": "pilihan_ganda_kompleks", "complex_choice": "pilihan_ganda_kompleks",
            "pilihan_ganda_kompleks": "pilihan_ganda_kompleks",
            "short_answer": "isian_singkat", "isian_singkat": "isian_singkat",
            "essay": "uraian", "uraian": "uraian",
            "true_false": "benar_salah", "benar_salah": "benar_salah",
            "matching": "menjodohkan", "menjodohkan": "menjodohkan",
            "ordering": "urutkan", "sequence": "urutkan", "urutkan": "urutkan"
        };
        try {
            let auth = null;
            try { if (ev.requestInfo && ev.requestInfo.auth) auth = ev.requestInfo.auth; } catch (x) {}
            const aname = authName(auth);
            // Guru/admin (users) boleh override manual, mis. nilai uraian
            if (aname === "_superusers" || aname === "users") return;
            if (ev.record.getString("status") !== "finished") return;

            const answers = pj(ev.record.get("answers"), null);
            if (!answers || typeof answers !== "object") return;

            const roomId = ev.record.getString("examRoomId");
            if (!roomId || !/^[a-zA-Z0-9]+$/.test(roomId)) return;

            let examId = "";
            try {
                const room = $app.findRecordById("exam_rooms", roomId);
                if (room) examId = room.getString("examId");
            } catch (x) { return; }
            if (!examId || !/^[a-zA-Z0-9]+$/.test(examId)) return;

            let questions = [];
            try {
                questions = $app.findRecordsByFilter("questions", "examId = '" + examId + "'", "order,created", 0, 0);
            } catch (x) { return; }
            if (!questions || questions.length === 0) return;

            let objectiveCorrect = 0, objectiveTotal = 0, essayTotal = 0;
            questions.forEach((q) => {
                const rawField = q.getString("field") || q.getString("type") || "multiple_choice";
                const t = TYPE_MAP[rawField] || "pilihan_ganda";
                if (t === "uraian") { essayTotal++; return; }
                objectiveTotal++;
                const studentAns = answers[q.id];
                if (studentAns === undefined || studentAns === null || studentAns === "") return;
                const options = pj(q.get("options"), {});
                if (t === "isian_singkat") {
                    const expected = String(q.getString("answerKey") || q.getString("correctAnswer") || "").trim().toLowerCase();
                    const given = String(studentAns).trim().toLowerCase();
                    if (expected && given === expected) objectiveCorrect++;
                } else if (t === "pilihan_ganda") {
                    if (options[studentAns] && options[studentAns].isCorrect === true) objectiveCorrect++;
                } else if (t === "benar_salah") {
                    if (options.statements && Array.isArray(options.statements)) {
                        // format pernyataan: options.statements=[{id, answer:"benar"/"salah"}]
                        // jawaban siswa: {"1":"benar","2":"salah",...}
                        let stCount = 0, stCorr = 0;
                        for (let si = 0; si < options.statements.length; si++) {
                            const st = options.statements[si] || {};
                            const sid = String(st.id != null ? st.id : "");
                            if (!sid) continue;
                            stCount++;
                            const expected = String(st.answer || "").toLowerCase();
                            const given = String((typeof studentAns === "object" && studentAns !== null ? studentAns[sid] : "") || "").toLowerCase();
                            if (given === expected) stCorr++;
                        }
                        if (stCount > 0) objectiveCorrect += (stCorr / stCount);
                    } else if (typeof studentAns === "object" && studentAns !== null) {
                        let stCount = 0, stCorr = 0;
                        const okeys = Object.keys(options);
                        for (let i = 0; i < okeys.length; i++) {
                            const k = okeys[i];
                            stCount++;
                            const expected = (options[k].answer || options[k].isCorrect ? "benar" : "salah").toLowerCase();
                            const given = String(studentAns[k] || "").toLowerCase();
                            if (given === expected) stCorr++;
                        }
                        if (stCount > 0) objectiveCorrect += (stCorr / stCount);
                    } else if (options[studentAns] && options[studentAns].isCorrect === true) {
                        objectiveCorrect++;
                    }
                } else if (t === "pilihan_ganda_kompleks") {
                    const ckeys = Object.keys(options)
                        .filter((k) => options[k] && options[k].isCorrect === true)
                        .map((k) => String(k).toLowerCase());
                    const chosen = Array.isArray(studentAns)
                        ? studentAns.map((k) => String(k).toLowerCase())
                        : [String(studentAns).toLowerCase()];
                    const okC = chosen.filter((k) => ckeys.indexOf(k) !== -1).length;
                    const badC = chosen.filter((k) => ckeys.indexOf(k) === -1).length;
                    if (ckeys.length > 0) objectiveCorrect += Math.max(0, okC - badC) / ckeys.length;
                }
            });

            const totalQuestions = objectiveTotal + essayTotal;
            const score = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
            ev.record.set("score", score);
            ev.record.set("correct", Math.floor(objectiveCorrect));
            ev.record.set("total", totalQuestions);
            console.log("[SECURITY_FIX] Skor dihitung ulang di server untuk attempt " + ev.record.id +
                " => " + score + " (" + Math.floor(objectiveCorrect) + "/" + totalQuestions + ")");
        } catch (err) {
            console.error("[SECURITY_FIX] recalc error:", err);
        }
    }
    // --- akhir helper lokal ---
    try {
        if (e.record.collection().name === "attempts") doRecalc(e);
    } catch (err) {
        console.error("[SECURITY_FIX] create hook error:", err);
    }
    e.next();
});

onRecordUpdateRequest((e) => {
    // --- helper lokal (duplikat dari create; wajib di dalam callback) ---
    function pj(v, fb) {
        try {
            if (v === null || v === undefined || v === "") return fb;
            if (typeof v === "string") return JSON.parse(v);
            if (typeof v === "object" && v !== null) {
                // PocketBase JSONRaw: ambil string mentah via .string()
                if (typeof v.string === "function") {
                    try { return JSON.parse(v.string()); } catch (e2) { return fb; }
                }
                return v;
            }
            return fb;
        } catch (x) { return fb; }
    }
    function authName(auth) {
        if (!auth) return "";
        try {
            const c = auth.collection();
            if (c && c.name) return c.name;
        } catch (x) {}
        return "";
    }
    function doRecalc(ev) {
        const TYPE_MAP = {
            "multiple_choice": "pilihan_ganda", "pilihan_ganda": "pilihan_ganda",
            "complex_multiple_choice": "pilihan_ganda_kompleks", "complex_choice": "pilihan_ganda_kompleks",
            "pilihan_ganda_kompleks": "pilihan_ganda_kompleks",
            "short_answer": "isian_singkat", "isian_singkat": "isian_singkat",
            "essay": "uraian", "uraian": "uraian",
            "true_false": "benar_salah", "benar_salah": "benar_salah",
            "matching": "menjodohkan", "menjodohkan": "menjodohkan",
            "ordering": "urutkan", "sequence": "urutkan", "urutkan": "urutkan"
        };
        try {
            let auth = null;
            try { if (ev.requestInfo && ev.requestInfo.auth) auth = ev.requestInfo.auth; } catch (x) {}
            const aname = authName(auth);
            if (aname === "_superusers" || aname === "users") return;
            if (ev.record.getString("status") !== "finished") return;

            const answers = pj(ev.record.get("answers"), null);
            if (!answers || typeof answers !== "object") return;

            const roomId = ev.record.getString("examRoomId");
            if (!roomId || !/^[a-zA-Z0-9]+$/.test(roomId)) return;

            let examId = "";
            try {
                const room = $app.findRecordById("exam_rooms", roomId);
                if (room) examId = room.getString("examId");
            } catch (x) { return; }
            if (!examId || !/^[a-zA-Z0-9]+$/.test(examId)) return;

            let questions = [];
            try {
                questions = $app.findRecordsByFilter("questions", "examId = '" + examId + "'", "order,created", 0, 0);
            } catch (x) { return; }
            if (!questions || questions.length === 0) return;

            let objectiveCorrect = 0, objectiveTotal = 0, essayTotal = 0;
            questions.forEach((q) => {
                const rawField = q.getString("field") || q.getString("type") || "multiple_choice";
                const t = TYPE_MAP[rawField] || "pilihan_ganda";
                if (t === "uraian") { essayTotal++; return; }
                objectiveTotal++;
                const studentAns = answers[q.id];
                if (studentAns === undefined || studentAns === null || studentAns === "") return;
                const options = pj(q.get("options"), {});
                if (t === "isian_singkat") {
                    const expected = String(q.getString("answerKey") || q.getString("correctAnswer") || "").trim().toLowerCase();
                    const given = String(studentAns).trim().toLowerCase();
                    if (expected && given === expected) objectiveCorrect++;
                } else if (t === "pilihan_ganda") {
                    if (options[studentAns] && options[studentAns].isCorrect === true) objectiveCorrect++;
                } else if (t === "benar_salah") {
                    if (options.statements && Array.isArray(options.statements)) {
                        // format pernyataan: options.statements=[{id, answer:"benar"/"salah"}]
                        // jawaban siswa: {"1":"benar","2":"salah",...}
                        let stCount = 0, stCorr = 0;
                        for (let si = 0; si < options.statements.length; si++) {
                            const st = options.statements[si] || {};
                            const sid = String(st.id != null ? st.id : "");
                            if (!sid) continue;
                            stCount++;
                            const expected = String(st.answer || "").toLowerCase();
                            const given = String((typeof studentAns === "object" && studentAns !== null ? studentAns[sid] : "") || "").toLowerCase();
                            if (given === expected) stCorr++;
                        }
                        if (stCount > 0) objectiveCorrect += (stCorr / stCount);
                    } else if (typeof studentAns === "object" && studentAns !== null) {
                        let stCount = 0, stCorr = 0;
                        const okeys = Object.keys(options);
                        for (let i = 0; i < okeys.length; i++) {
                            const k = okeys[i];
                            stCount++;
                            const expected = (options[k].answer || options[k].isCorrect ? "benar" : "salah").toLowerCase();
                            const given = String(studentAns[k] || "").toLowerCase();
                            if (given === expected) stCorr++;
                        }
                        if (stCount > 0) objectiveCorrect += (stCorr / stCount);
                    } else if (options[studentAns] && options[studentAns].isCorrect === true) {
                        objectiveCorrect++;
                    }
                } else if (t === "pilihan_ganda_kompleks") {
                    const ckeys = Object.keys(options)
                        .filter((k) => options[k] && options[k].isCorrect === true)
                        .map((k) => String(k).toLowerCase());
                    const chosen = Array.isArray(studentAns)
                        ? studentAns.map((k) => String(k).toLowerCase())
                        : [String(studentAns).toLowerCase()];
                    const okC = chosen.filter((k) => ckeys.indexOf(k) !== -1).length;
                    const badC = chosen.filter((k) => ckeys.indexOf(k) === -1).length;
                    if (ckeys.length > 0) objectiveCorrect += Math.max(0, okC - badC) / ckeys.length;
                }
            });

            const totalQuestions = objectiveTotal + essayTotal;
            const score = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
            ev.record.set("score", score);
            ev.record.set("correct", Math.floor(objectiveCorrect));
            ev.record.set("total", totalQuestions);
            console.log("[SECURITY_FIX] Skor dihitung ulang di server untuk attempt " + ev.record.id +
                " => " + score + " (" + Math.floor(objectiveCorrect) + "/" + totalQuestions + ")");
        } catch (err) {
            console.error("[SECURITY_FIX] recalc error:", err);
        }
    }
    // --- akhir helper lokal ---
    try {
        if (e.record.collection().name === "attempts") doRecalc(e);
    } catch (err) {
        console.error("[SECURITY_FIX] update hook error:", err);
    }
    e.next();
});

// ---------- 5: verifikasi PIN/token ruangan di server ----------
routerAdd("POST", "/api/verify-pin", (c) => {
    // rate-limit sederhana: maks 20x/menit per IP (disimpan di memori proses)
    let store = null;
    try {
        store = globalThis.__pinAttempts || (globalThis.__pinAttempts = {});
    } catch (x) { store = {}; }
    try {
        const info = c.requestInfo();
        let ip = "unknown";
        try {
            const hdrs = info.headers || {};
            const fwd = (hdrs["X-Forwarded-For"] || hdrs["x-forwarded-for"] || "").toString();
            ip = fwd.split(",")[0].trim() || "unknown";
        } catch (x) {}

        const now = Date.now();
        const bucket = (store[ip] || []).filter((t) => now - t < 60000);
        if (bucket.length >= 20) {
            return c.json(429, { ok: false, error: "Terlalu banyak percobaan, coba lagi sebentar." });
        }
        bucket.push(now);
        store[ip] = bucket;

        const body = info.body || {};
        const pin = ((body["pin"] || body["token"]) || "").toString().trim();

        let expected = "";
        try {
            const s = $app.findFirstRecordByFilter("settings", "id != ''");
            if (s) expected = s.getString("universal_token");
        } catch (x) {}

        const ok = pin !== "" && expected !== "" && pin === expected;
        return c.json(200, { ok: ok });
    } catch (err) {
        return c.json(500, { ok: false, error: String((err && err.message) || err) });
    }
});

console.log("[SECURITY_FIX] hook loaded: strip kunci jawaban, strip AI key, skoring server-side, verify-pin");
