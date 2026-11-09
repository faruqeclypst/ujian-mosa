// pb_hooks/student_exam_login.pb.js
// Endpoint untuk otentikasi alternatif siswa menggunakan Kredensial Sesi Ujian (examUsername & examPassword).
// Memungkinkan siswa langsung login menggunakan username & password ujian yang tercetak di kartu peserta,
// terhubung langsung ke akun siswa sebenarnya tanpa terhalang lupa password akun pribadi.

routerAdd("OPTIONS", "/api/student/exam-login", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/student/exam-login", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token"); } catch (_) { }

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const username = ((body.username || body.nisn) || "").toString().trim();
        const password = (body.password || "").toString().trim();

        if (!username || !password) {
            return c.json(400, {
                ok: false,
                message: "Username dan Password ujian wajib diisi."
            });
        }

        // Cari siswa berdasarkan examUsername ATAU username (NISN) ATAU examNumber
        let student = null;
        try {
            student = $app.findFirstRecordByFilter(
                "students",
                "examUsername = {:u} || username = {:u} || examNumber = {:u}",
                { u: username }
            );
        } catch (_) {
            student = null;
        }

        if (!student) {
            return c.json(404, {
                ok: false,
                message: "Akun peserta ujian tidak ditemukan."
            });
        }

        // Cocokkan password dengan examPassword yang tersimpan
        const savedExamPass = student.getString("examPassword");
        if (!savedExamPass || savedExamPass !== password) {
            return c.json(401, {
                ok: false,
                message: "Kredensial ujian tidak cocok. Pastikan username dan password sesuai dengan yang tercetak di kartu ujian."
            });
        }

        // Terbitkan token auth resmi PocketBase
        let token = "";
        try {
            token = student.newAuthToken();
        } catch (e1) {
            try {
                token = $app.createAuthToken(student);
            } catch (e2) {
                console.error("[EXAM_LOGIN] Gagal membuat token:", e1, e2);
            }
        }

        if (!token) {
            return c.json(500, {
                ok: false,
                message: "Gagal membuat sesi login peserta ujian."
            });
        }

        return c.json(200, {
            ok: true,
            token: token,
            record: student,
            examLogin: true
        });
    } catch (err) {
        console.error("[EXAM_LOGIN_ERROR]:", err);
        return c.json(500, {
            ok: false,
            message: "Terjadi kesalahan saat memproses login ujian: " + (err ? err.message : "Internal Error")
        });
    }
});

// Endpoint untuk Generate / Regenerate Kredensial Ujian (Massal maupun Individu)
routerAdd("OPTIONS", "/api/student/generate-exam-credentials", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/student/generate-exam-credentials", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token"); } catch (_) { }

    try {
        const info = c.requestInfo();
        const body = info.body || {};
        const prefix = (body.prefix || "TU").toString().trim().toUpperCase();
        const studentIds = Array.isArray(body.studentIds) ? body.studentIds : null;
        const onlyEmpty = body.onlyEmpty === true;

        const tpl = new DynamicModel({ id: "", username: "" });
        const rows = arrayOf(tpl);

        let query = "SELECT id, username FROM students WHERE 1=1";
        if (onlyEmpty) {
            query += " AND (examUsername = '' OR examUsername IS NULL OR examPassword = '' OR examPassword IS NULL)";
        }

        $app.db().newQuery(query).all(rows);

        let targetRows = rows;
        if (studentIds && studentIds.length > 0) {
            const setIds = new Set(studentIds);
            targetRows = rows.filter(r => setIds.has(r.id));
        }

        let updatedCount = 0;
        const generatedList = [];

        // Update super cepat menggunakan transaction SQLite (1 disk fsync untuk seluruh siswa!)
        $app.runInTransaction((txApp) => {
            const txDb = txApp.db();
            for (let i = 0; i < targetRows.length; i++) {
                const row = targetRows[i];
                const nisn = (row.username || "").toString().trim();
                const examUser = prefix + (nisn || row.id.substring(0, 8));
                
                // Password acak 5 digit angka + '*' (contoh: 28327*)
                const randomNum = Math.floor(10000 + Math.random() * 90000);
                const examPass = randomNum.toString() + "*";

                try {
                    txDb.newQuery("UPDATE students SET examUsername = {:u}, examPassword = {:p} WHERE id = {:id}")
                        .bind({ u: examUser, p: examPass, id: row.id })
                        .execute();
                    updatedCount++;
                    generatedList.push({
                        id: row.id,
                        examUsername: examUser,
                        examPassword: examPass
                    });
                } catch (updErr) {
                    console.error("[GENERATE_EXAM_CREDENTIALS_ERR] Student id:", row.id, updErr);
                }
            }
        });

        return c.json(200, {
            ok: true,
            message: "Berhasil menghasilkan kredensial ujian untuk " + updatedCount + " siswa dalam sekejap.",
            updatedCount: updatedCount,
            prefix: prefix,
            credentials: generatedList
        });
    } catch (err) {
        console.error("[GENERATE_EXAM_CREDENTIALS_FATAL]:", err);
        return c.json(500, {
            ok: false,
            message: "Gagal menghasilkan kredensial ujian: " + (err ? err.message : "Internal Error")
        });
    }
});
