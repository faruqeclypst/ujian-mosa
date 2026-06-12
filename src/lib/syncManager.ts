import PocketBase from "pocketbase";

export async function syncPendingData(pb: PocketBase, studentId: string): Promise<string[]> {
  if (!navigator.onLine || !studentId) return [];

  const syncedRoomIds: string[] = [];

  // Snapshot keys dulu agar tidak iterasi sambil delete
  const pendingKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`pending_sync_${studentId}_`)) {
      pendingKeys.push(key);
    }
  }

  for (const key of pendingKeys) {
    const roomId = key.replace(`pending_sync_${studentId}_`, "");

    const localAnswersRaw = localStorage.getItem(`offline_answers_${studentId}_${roomId}`);
    const localAttRaw = localStorage.getItem(`local_attempt_${studentId}_${roomId}`);

    if (!localAttRaw) {
      // Tidak ada data lokal — hapus flag saja
      localStorage.removeItem(key);
      continue;
    }

    try {
      const parsedAtt = JSON.parse(localAttRaw);
      if (!parsedAtt?.id) {
        localStorage.removeItem(key);
        continue;
      }

      // Bangun payload bersih
      const cleanData: Record<string, any> = {
        isOnline: true,
        lastHeartbeat: new Date().toISOString(),
      };

      if (localAnswersRaw) {
        try { cleanData.answers = JSON.parse(localAnswersRaw); } catch {}
      } else if (parsedAtt.answers) {
        cleanData.answers = parsedAtt.answers;
      }

      if (parsedAtt.status !== undefined) cleanData.status = parsedAtt.status;
      if (parsedAtt.cheatCount !== undefined) cleanData.cheatCount = parsedAtt.cheatCount;

      // Kirim score dan field hasil hanya jika ujian sudah selesai
      if (parsedAtt.status === "finished" || parsedAtt.status === "submitted") {
        if (parsedAtt.score !== undefined) cleanData.score = parsedAtt.score;
        if (parsedAtt.correct !== undefined) cleanData.correct = parsedAtt.correct;
        if (parsedAtt.total !== undefined) cleanData.total = parsedAtt.total;
        if (parsedAtt.usedTime !== undefined) cleanData.usedTime = parsedAtt.usedTime;
        if (parsedAtt.submittedAt !== undefined) cleanData.submittedAt = parsedAtt.submittedAt;
        if (parsedAtt.objectiveScore !== undefined) cleanData.objectiveScore = parsedAtt.objectiveScore;
        if (parsedAtt.objectiveCorrect !== undefined) cleanData.objectiveCorrect = parsedAtt.objectiveCorrect;
        if (parsedAtt.objectiveTotal !== undefined) cleanData.objectiveTotal = parsedAtt.objectiveTotal;
        if (parsedAtt.essayTotal !== undefined) cleanData.essayTotal = parsedAtt.essayTotal;
        if (parsedAtt.totalQuestions !== undefined) cleanData.totalQuestions = parsedAtt.totalQuestions;
      }

      await pb.collection("attempts").update(parsedAtt.id, cleanData);

      // Berhasil — bersihkan semua data lokal untuk room ini
      localStorage.removeItem(key);
      localStorage.removeItem(`offline_answers_${studentId}_${roomId}`);
      // Hapus local_attempt hanya jika sudah finished (tidak perlu backup lagi)
      if (parsedAtt.status === "finished" || parsedAtt.status === "submitted") {
        localStorage.removeItem(`local_attempt_${studentId}_${roomId}`);
      }

      syncedRoomIds.push(roomId);
      console.log(`✅ Synced offline data for room ${roomId} (status: ${parsedAtt.status})`);
    } catch (e: any) {
      // 404 = attempt dihapus admin → hapus data lokal, tidak perlu retry
      if (e?.status === 404) {
        localStorage.removeItem(key);
        localStorage.removeItem(`offline_answers_${studentId}_${roomId}`);
        localStorage.removeItem(`local_attempt_${studentId}_${roomId}`);
        console.warn(`⚠️ Attempt for room ${roomId} no longer exists, cleaned local data`);
      } else {
        console.error(`❌ Failed to sync room ${roomId}:`, e);
      }
    }
  }

  return syncedRoomIds;
}
