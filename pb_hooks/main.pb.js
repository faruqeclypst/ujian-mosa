/* =========================================================
   🚀 SYSTEM MASTER MAINTENANCE (CLEAN VERSION)
   Fungsi: Auto-Score, Offline Cleanup, & Token Universal
   ========================================================= */

// 🕒 1. PEMBERSIHAN STATUS OFFLINE (Setiap 2 Menit)
cronAdd("cleanupOfflineStudents", "*/2 * * * *", () => {
    const expiredTime = new Date(Date.now() - 5 * 60000).toISOString();
    try {
        $app.db().newQuery("UPDATE attempts SET isOnline = 0 WHERE status = 'ongoing' AND lastHeartbeat < {:expiredTime}")
            .bind({ expiredTime: expiredTime })
            .execute();
    } catch (e) { }
});

// 🕒 2. AUTO-FINISH & AUTO-SCORE (Setiap 1 Menit)
cronAdd("autoFinishAndScore", "* * * * *", () => {
    try {
        const expired = [];
        $app.db().newQuery(`
            SELECT a.id, a.examRoomId FROM attempts a
            JOIN exam_rooms r ON a.examRoomId = r.id
            WHERE (a.status = 'ongoing' OR a.status = 'LOCKED')
              AND r.isActive = 1
              AND datetime(COALESCE(NULLIF(a.startedAt, ''), a.created), '+' || COALESCE(r.duration, 60) || ' minutes') < datetime('now')
        `).all(expired);
        
        if (expired.length === 0) return;

        const roomsCache = {};
        const questionsCache = {};

        expired.forEach(row => {
            try {
                const att = $app.findRecordById("attempts", row.id);
                const roomId = row.examRoomId;
                
                let room = roomsCache[roomId];
                if (room === undefined) {
                    try {
                        room = $app.findRecordById("exam_rooms", roomId);
                        roomsCache[roomId] = room;
                    } catch (e) {
                        roomsCache[roomId] = null;
                    }
                }
                if (!room) return;

                const examId = room.get("examId");
                let questions = questionsCache[examId];
                if (questions === undefined) {
                    try {
                        questions = $app.findRecordsByFilter("questions", `examId = "${examId}"`);
                        questionsCache[examId] = questions;
                    } catch (e) {
                        questionsCache[examId] = [];
                    }
                }

                const answers = att.get("answers") || {};
                let correctCount = 0;
                questions.forEach(q => {
                    const studentAns = answers[q.id];
                    if (!studentAns) return;
                    const type = q.get("type") || "pilihan_ganda";
                    const options = q.get("options") || {};

                    if (type === "pilihan_ganda" || type === "benar_salah") {
                        if (options[studentAns] && options[studentAns].isCorrect === true) correctCount++;
                    }
                    else if (type === "pilihan_ganda_kompleks") {
                        const correctKeys = Object.keys(options).filter(k => options[k].isCorrect).sort();
                        if (Array.isArray(studentAns)) {
                            const sortedStudent = studentAns.sort();
                            if (JSON.stringify(sortedStudent) === JSON.stringify(correctKeys)) correctCount++;
                        }
                    }
                    else if (type === "isian_singkat") {
                        const key = (q.get("answerKey") || "").toLowerCase().trim();
                        if (String(studentAns).toLowerCase().trim() === key) correctCount++;
                    }
                });

                const score = Math.round((correctCount / (questions.length || 1)) * 100);

                att.set("status", "finished");
                att.set("score", score);
                att.set("correct", correctCount);
                att.set("total", questions.length);
                att.set("submittedAt", new Date().toISOString());
                att.set("isOnline", false);
                $app.save(att);
            } catch (err) { }
        });
    } catch (e) { }
});

// 🕒 3. ROTASI TOKEN UNIVERSAL (Setiap 5 Menit)
cronAdd("rotateUniversalToken", "*/5 * * * *", () => {
    try {
        const settings = $app.findFirstRecordByFilter("settings", "1=1");
        if (!settings) return;
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let token = "";
        for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
        settings.set("universal_token", token);
        settings.set("universal_token_updated_at", new Date().toISOString());
        $app.save(settings);
    } catch (e) { }
});

cronAdd("autoArchive", "0 3 * * *", () => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60000).toISOString();
        $app.db().newQuery("UPDATE exam_rooms SET status = 'archive' WHERE status != 'archive' AND end_time < {:yesterday}")
            .bind({ yesterday: yesterday })
            .execute();
    } catch (e) { }
});

console.log("🚀 System Master Maintenance Optimized!");