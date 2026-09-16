/* =========================================================
   🚀 SYSTEM MASTER MAINTENANCE (OPTIMIZED & BULLETPROOF)
   Fungsi: Auto-Finish & Score, Offline Cleanup, & Token Universal
   ========================================================= */

// 🕒 1. PEMBERSIHAN STATUS OFFLINE (Setiap 2 Menit)
cronAdd("cleanupOfflineStudents", "*/2 * * * *", () => {
    try {
        const expiredTime = new Date(Date.now() - 5 * 60000).toISOString();
        $app.db().newQuery("UPDATE attempts SET isOnline = 0 WHERE status = 'ongoing' AND lastHeartbeat < {:expiredTime}")
            .bind({ expiredTime: expiredTime })
            .execute();
    } catch (e) {
        console.error("[CRON OFFLINE CLEANUP ERROR]:", e);
    }
});

// 🕒 2. AUTO-FINISH & AUTO-SCORE KETIKA TIMER HABIS (Setiap 1 Menit)
cronAdd("autoFinishAndScore", "* * * * *", () => {
    try {
        // PocketBase JS VM membutuhkan DynamicModel pointer untuk query.all()
        const expiredRow = new DynamicModel({
            id: "",
            examRoomId: "",
            status: "",
            startedAt: "",
            created: "",
            duration: 0
        });
        const expired = arrayOf(expiredRow);

        $app.db().newQuery(`
            SELECT a.id, a.examRoomId, a.status, a.startedAt, a.created, COALESCE(r.duration, 60) as duration
            FROM attempts a
            LEFT JOIN exam_rooms r ON a.examRoomId = r.id
            WHERE (a.status = 'ongoing' OR a.status = 'LOCKED')
              AND (
                -- 1. Attempt tanpa ruangan / ruangan dihapus (kadaluarsa > 1 jam)
                (r.id IS NULL AND datetime(COALESCE(NULLIF(a.startedAt, ''), a.created), '+60 minutes') < datetime('now'))
                -- 2. Timer durasi pengerjaan siswa habis
                OR (r.id IS NOT NULL AND datetime(COALESCE(NULLIF(a.startedAt, ''), a.created), '+' || COALESCE(r.duration, 60) || ' minutes') < datetime('now'))
                -- 3. Batas akhir ruangan ujian (endTime) telah terlewati
                OR (r.endTime IS NOT NULL AND r.endTime != '' AND datetime(r.endTime) < datetime('now'))
                -- 4. Ruangan telah dinonaktifkan atau diarsipkan
                OR r.status = 'archive'
                OR r.isActive = 0
              )
        `).all(expired);

        if (expired.length === 0) return;

        console.log("[AUTO-FINISH] Menemukan " + expired.length + " ujian siswa yang waktunya habis. Memproses...");

        const typeMap = {
            "multiple_choice": "pilihan_ganda",
            "pilihan_ganda": "pilihan_ganda",
            "complex_multiple_choice": "pilihan_ganda_kompleks",
            "complex_choice": "pilihan_ganda_kompleks",
            "pilihan_ganda_kompleks": "pilihan_ganda_kompleks",
            "short_answer": "isian_singkat",
            "isian_singkat": "isian_singkat",
            "essay": "uraian",
            "uraian": "uraian",
            "true_false": "benar_salah",
            "benar_salah": "benar_salah",
            "matching": "menjodohkan",
            "menjodohkan": "menjodohkan",
            "ordering": "urutkan",
            "sequence": "urutkan",
            "urutkan": "urutkan"
        };

        const roomsCache = {};
        const questionsCache = {};

        expired.forEach(row => {
            try {
                const att = $app.findRecordById("attempts", row.id);
                if (!att) return;

                const roomId = row.examRoomId;
                let room = null;
                if (roomId) {
                    room = roomsCache[roomId];
                    if (room === undefined) {
                        try {
                            room = $app.findRecordById("exam_rooms", roomId);
                            roomsCache[roomId] = room;
                        } catch (e) {
                            roomsCache[roomId] = null;
                        }
                    }
                }

                let questions = [];
                if (room) {
                    const examId = room.getString("examId");
                    questions = questionsCache[examId];
                    if (questions === undefined) {
                        try {
                            questions = $app.findRecordsByFilter("questions", "examId = '" + examId + "'", "order,created", 0, 0);
                            questionsCache[examId] = questions;
                        } catch (e) {
                            questionsCache[examId] = [];
                        }
                    }
                }

                // Parse jawaban siswa dari JSON string
                let answers = {};
                try {
                    const rawAnswers = att.getString("answers");
                    if (rawAnswers) answers = JSON.parse(rawAnswers);
                } catch (pe) {
                    answers = {};
                }

                let objectiveCorrect = 0;
                let objectiveTotal = 0;
                let essayTotal = 0;

                questions.forEach(q => {
                    const rawField = q.getString("field") || q.getString("type") || "multiple_choice";
                    const t = typeMap[rawField] || "pilihan_ganda";

                    if (t === "isian_singkat" || t === "uraian") {
                        essayTotal++;
                        return;
                    }
                    objectiveTotal++;

                    const studentAns = answers[q.id];
                    if (!studentAns) return;

                    let options = {};
                    try {
                        const rawOpt = q.getString("options");
                        if (rawOpt) options = JSON.parse(rawOpt);
                    } catch (oe) {
                        options = {};
                    }

                    if (t === "pilihan_ganda") {
                        if (options[studentAns] && options[studentAns].isCorrect === true) {
                            objectiveCorrect++;
                        }
                    } else if (t === "benar_salah") {
                        if (typeof studentAns === "object" && studentAns !== null) {
                            let stCount = 0;
                            let stCorr = 0;
                            Object.keys(options).forEach(k => {
                                stCount++;
                                const expected = (options[k].answer || options[k].isCorrect ? "benar" : "salah").toLowerCase();
                                const given = String(studentAns[k] || "").toLowerCase();
                                if (given === expected) stCorr++;
                            });
                            if (stCount > 0) objectiveCorrect += (stCorr / stCount);
                        } else if (options[studentAns] && options[studentAns].isCorrect === true) {
                            objectiveCorrect++;
                        }
                    } else if (t === "pilihan_ganda_kompleks") {
                        const correctKeys = Object.keys(options)
                            .filter(k => options[k] && options[k].isCorrect === true)
                            .map(k => String(k).toLowerCase());
                        const chosenKeys = Array.isArray(studentAns)
                            ? studentAns.map(k => String(k).toLowerCase())
                            : [String(studentAns).toLowerCase()];

                        const correctChosen = chosenKeys.filter(k => correctKeys.includes(k));
                        const wrongChosen = chosenKeys.filter(k => !correctKeys.includes(k));
                        if (correctKeys.length > 0) {
                            const itemScore = Math.max(0, correctChosen.length - wrongChosen.length) / correctKeys.length;
                            objectiveCorrect += itemScore;
                        }
                    }
                });

                const totalQuestions = objectiveTotal + essayTotal;
                const score = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;

                // Hitung usedTime berdasarkan startedAt
                let usedTime = row.duration * 60;
                const startStr = att.getString("startedAt") || att.getString("created");
                if (startStr) {
                    const diffSec = Math.floor((Date.now() - new Date(startStr).getTime()) / 1000);
                    if (diffSec > 0) usedTime = Math.min(diffSec, row.duration * 60);
                }

                att.set("status", "finished");
                att.set("score", score);
                att.set("correct", Math.floor(objectiveCorrect));
                att.set("total", totalQuestions);
                att.set("usedTime", usedTime);
                att.set("submittedAt", new Date().toISOString());
                att.set("isOnline", false);
                $app.save(att);

                console.log("[AUTO-FINISH] Selesai: Attempt ID " + row.id + " | Nilai: " + score + " (" + Math.floor(objectiveCorrect) + "/" + totalQuestions + ")");
            } catch (rowErr) {
                console.error("[AUTO-FINISH ROW ERROR] ID " + row.id + ":", rowErr);
            }
        });
    } catch (e) {
        console.error("[AUTO-FINISH CRON ERROR]:", e);
    }
});

// 🕒 3. ROTASI TOKEN UNIVERSAL (Setiap 5 Menit - HANYA jika ada ruangan ujian yang sedang aktif)
cronAdd("rotateUniversalToken", "*/5 * * * *", () => {
    try {
        // Cek apakah ada ruangan ujian yang sedang AKTIF menggunakan findRecordsByFilter
        const activeRooms = $app.findRecordsByFilter("exam_rooms", "isActive = true && status != 'archive'", "", 1, 0);
        if (activeRooms.length === 0) return;

        const settings = $app.findFirstRecordByFilter("settings", "1=1");
        if (!settings) return;

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let token = "";
        for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

        settings.set("universal_token", token);
        settings.set("universal_token_updated_at", new Date().toISOString());
        $app.save(settings);

        console.log("[CRON TOKEN] Token universal berhasil dirotasi ke: " + token);
    } catch (e) {
        console.error("[CRON TOKEN ROTATION ERROR]:", e);
    }
});

// 🕒 4. PENGARSIPAN OTOMATIS (Setiap jam 3 pagi)
cronAdd("autoArchive", "0 3 * * *", () => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60000).toISOString();
        $app.db().newQuery("UPDATE exam_rooms SET status = 'archive' WHERE status != 'archive' AND (endTime < {:yesterday} OR end_time < {:yesterday})")
            .bind({ yesterday: yesterday })
            .execute();
        console.log("[CRON AUTO-ARCHIVE] Pengarsipan otomatis ruangan kadaluarsa selesai.");
    } catch (e) {
        console.error("[CRON AUTO-ARCHIVE ERROR]:", e);
    }
});

console.log("🚀 System Master Maintenance Optimized & Verified!");