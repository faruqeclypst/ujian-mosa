import PocketBase from "pocketbase";

export async function syncPendingData(pb: PocketBase, studentId: string) {
  if (!navigator.onLine || !studentId) return;

  const syncedRoomIds: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`pending_sync_${studentId}_`)) {
      const roomId = key.replace(`pending_sync_${studentId}_`, "");
      
      const localAnswersRaw = localStorage.getItem(`offline_answers_${studentId}_${roomId}`);
      const localAttRaw = localStorage.getItem(`local_attempt_${studentId}_${roomId}`);
      
      if (localAttRaw) {
        try {
          const parsedAtt = JSON.parse(localAttRaw);
          let syncData: any = { ...parsedAtt };
          
          if (localAnswersRaw) {
            syncData.answers = JSON.parse(localAnswersRaw);
          }
          
          // Field cleaning to avoid PocketBase errors if we included extra fields
          const cleanData: any = {};
          if (syncData.answers) cleanData.answers = syncData.answers;
          if (syncData.cheatCount !== undefined) cleanData.cheatCount = syncData.cheatCount;
          if (syncData.status !== undefined) cleanData.status = syncData.status;
          if (syncData.score !== undefined) {
             cleanData.score = syncData.score;
             cleanData.correct = syncData.correct;
             cleanData.total = syncData.total;
             cleanData.usedTime = syncData.usedTime;
             cleanData.submittedAt = syncData.submittedAt;
          }
          cleanData.isOnline = true;
          cleanData.lastHeartbeat = new Date().toISOString();

          await pb.collection("attempts").update(parsedAtt.id, cleanData);
          
          // Cleanup
          localStorage.removeItem(`pending_sync_${studentId}_${roomId}`);
          // Don't remove answers/attempt immediately as backup might still be useful, 
          // but we clear the pending flag.
          
          syncedRoomIds.push(roomId);
          console.log(`✅ Synced offline data for room ${roomId}`);
        } catch (e) {
          console.error(`❌ Failed to sync room ${roomId}:`, e);
        }
      }
    }
  }
  
  return syncedRoomIds;
}
