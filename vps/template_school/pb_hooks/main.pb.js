/* =========================================================
   🚀 SYSTEM MASTER MAINTENANCE (CLEAN VERSION)
   Fungsi: Auto-Score, Offline Cleanup, & Token Universal
   ========================================================= */

// 🕒 1. PEMBERSIHAN STATUS OFFLINE (Setiap 2 Menit)
cronAdd("cleanupOfflineStudents", "*/2 * * * *", () => {
  const expiredTime = new Date(Date.now() - 3 * 60000).toISOString();
  try {
    const records = $app.findRecordsByFilter("attempts", `status = "ongoing" && lastHeartbeat < "${expiredTime}"`);
    records.forEach(r => {
      r.set("isOnline", false);
      $app.save(r);
    });
  } catch (e) { }
});

// 🕒 2. AUTO-FINISH & AUTO-SCORE (Setiap 1 Menit)
cronAdd("autoFinishAndScore", "* * * * *", () => {
  try {
    const now = new Date();
    const ongoing = $app.findRecordsByFilter("attempts", 'status = "ongoing" || status = "LOCKED"');

    ongoing.forEach(att => {
      const room = $app.findRecordById("exam_rooms", att.get("examRoomId"));
      if (!room || room.get("isActive") === false) return;

      const start = new Date(att.get("startedAt") || att.get("created"));
      const duration = (room.get("duration") || 60) * 60000;
      const expiredAt = new Date(start.getTime() + duration);

      if (expiredAt < now) {
        const answers = att.get("answers") || {};
        const questions = $app.findRecordsByFilter("questions", `examId = "${room.get("examId")}"`);

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
        att.set("submittedAt", now.toISOString());
        att.set("isOnline", false);
        $app.save(att);
      }
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

// 🕒 4. AUTO-ARCHIVE RUANGAN (Jam 03:00 Pagi)
cronAdd("autoArchive", "0 3 * * *", () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60000).toISOString();
    const oldRooms = $app.findRecordsByFilter("exam_rooms", `status != "archive" && end_time < "${yesterday}"`);
    oldRooms.forEach(room => {
      room.set("status", "archive");
      $app.save(room);
    });
  } catch (e) { }
});


// 🕒 5. AUTO-CALCULATE RANKINGS (Setiap 10 Menit)
cronAdd("calculateRankings", "* * * * *", () => {
  try {
    console.log("Ranking: Memulai proses...");
    const rooms = $app.findRecordsByFilter("exam_rooms", "status != 'archive'");
    rooms.forEach(room => {
      const roomId = room.id;
      const attempts = $app.findRecordsByFilter("attempts", "examRoomId = '" + roomId + "' && status = 'finished'");

      if (!attempts || attempts.length === 0) return;
      // Sorting Tanpa .get()
      const sorted = attempts.sort((a, b) => {
        const scoreA = parseFloat(a.get("score")) || 0;
        const scoreB = parseFloat(b.get("score")) || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const timeA = parseInt(a.get("usedTime")) || 0;
        const timeB = parseInt(b.get("usedTime")) || 0;
        return timeA - timeB;
      });
      const rankingData = sorted.map((att, index) => {
        let sName = "Anonim";
        try {
          const student = $app.findRecordById("students", att.get("studentId"));
          if (student) sName = student.get("name");
        } catch (e) { }
        return {
          rank: index + 1,
          name: sName,
          score: parseFloat(att.get("score")) || 0,
          usedTime: parseInt(att.get("usedTime")) || 0,
          finishedAt: att.get("submittedAt")
        };
      });
      let lb;
      try {
        lb = $app.findFirstRecordByFilter("leaderboards", "examRoomId = '" + roomId + "'");
      } catch (e) {
        // Cara paling aman buat record di v0.22:
        const collection = $app.findCollectionByNameOrId("leaderboards");
        lb = new Record(collection);
        lb.set("examRoomId", roomId);
      }

      lb.set("data", rankingData);
      $app.save(lb);
    });
    console.log("✅ Ranking Selesai!");
  } catch (e) {
    console.log("❌ Ranking Error: " + e.toString()); // Gunakan .toString() agar pesan lengkap
  }
});

console.log("🚀 System Master Maintenance Optimized!");