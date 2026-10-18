// pb_hooks/student_reset_password.pb.js
// Endpoint untuk permintaan reset password oleh siswa yang lupa password.
// Setelah diajukan, proktor atau admin akan melihat notifikasi di bilah atas (seperti siswa terkunci)
// dan dapat mereset password siswa menjadi 12345678 dengan satu klik.

routerAdd("OPTIONS", "/api/student/request-reset", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); } catch (_) { }
    return c.noContent(204);
});

routerAdd("POST", "/api/student/request-reset", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (_) { }
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); } catch (_) { }

    // Rate limiting: maksimal 5 permintaan per 2 menit per IP
    let store = null;
    try {
        store = globalThis.__resetAttempts || (globalThis.__resetAttempts = {});
    } catch (_) { store = {}; }

    try {
        const info = c.requestInfo();
        let ip = "unknown";
        try {
            const hdrs = info.headers || {};
            const fwd = (hdrs["X-Forwarded-For"] || hdrs["x-forwarded-for"] || "").toString();
            ip = fwd.split(",")[0].trim() || "unknown";
        } catch (_) {}

        const now = Date.now();
        const bucket = (store[ip] || []).filter((t) => now - t < 120000);
        if (bucket.length >= 5) {
            return c.json(429, {
                ok: false,
                message: "Terlalu banyak permintaan reset password. Silakan tunggu 2 menit sebelum mencoba kembali."
            });
        }
        bucket.push(now);
        store[ip] = bucket;

        const body = info.body || {};
        const username = ((body.username || body.nisn) || "").toString().trim();

        if (!username) {
            return c.json(400, {
                ok: false,
                message: "NISN atau Username wajib diisi."
            });
        }

        // Cari record siswa berdasarkan username (NISN)
        let student = null;
        try {
            student = $app.findFirstRecordByFilter("students", "username = {:u}", { u: username });
        } catch (_) {
            student = null;
        }

        if (!student) {
            return c.json(404, {
                ok: false,
                message: "Siswa dengan NISN atau Username tersebut tidak ditemukan. Mohon periksa kembali nomor yang Anda masukkan."
            });
        }

        // Simpan waktu permintaan reset
        const requestTime = new Date().toISOString();
        try {
            $app.db().newQuery("UPDATE students SET resetRequested = {:t} WHERE id = {:id}")
                .bind({ t: requestTime, id: student.id })
                .execute();
        } catch (_) {}

        try {
            student.set("resetRequested", requestTime);
            $app.save(student);
        } catch (_) {}

        return c.json(200, {
            ok: true,
            message: "Permintaan reset password berhasil diajukan ke pengawas.",
            studentName: student.getString("name"),
            nisn: student.getString("username"),
            requestedAt: requestTime
        });
    } catch (err) {
        return c.json(500, {
            ok: false,
            message: "Terjadi kesalahan saat memproses permintaan reset: " + (err ? err.message : "Internal Error")
        });
    }
});
