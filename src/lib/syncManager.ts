import PocketBase from "pocketbase";
import { getOnlineFlag } from "./network";

/**
 * LOCK GLOBAL.
 * syncPendingData dipanggil dari beberapa tempat (CBTPage, StudentDashboardPage).
 * Tanpa lock, dua pemanggilan bersamaan menulis ke attempt yang sama dua kali
 * dan menabrak SQLite (SQLITE_BUSY) — terutama saat retry storm.
 */
let syncInFlight: Promise<string[]> | null = null;

/**
 * Wrapper ber-lock. Selalu panggil INI dari komponen, bukan syncPendingData langsung.
 */
export function syncPendingDataLocked(
  pb: PocketBase,
  studentId: string
): Promise<string[]> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = syncPendingData(pb, studentId).finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Apakah sedang ada sinkronisasi berjalan? (untuk indikator UI) */
export function isSyncing(): boolean {
  return syncInFlight !== null;
}

/**
 * FIX #5 — Penulis localStorage anti-QuotaExceededError.
 *
 * Pengukuran: 1 ujian 60 soal ~ 67 KB (1,3% dari 5 MB).
 * Masalah muncul bila data TIDAK pernah dibersihkan (ujian offline beruntun
 * atau sync terus gagal) -> setelah puluhan ujian, localStorage penuh dan
 * `setItem` melempar -> jawaban siswa GAGAL disimpan.
 *
 * @param key   kunci tujuan
 * @param value nilai (string)
 * @returns true bila berhasil disimpan
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    const isQuota =
      e?.name === "QuotaExceededError" ||
      e?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e?.code === 22 ||
      e?.code === 1014;

    if (!isQuota) {
      console.warn("[safeSetItem] gagal menyimpan (bukan kuota):", e);
      return false;
    }

    console.warn("[safeSetItem] localStorage PENUH — membersihkan data lama...");

    // ── Tahap 1: buang data attempt yang sudah selesai (aman dihapus)
    const hapus: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      if (k.startsWith("offline_answers_") || k.startsWith("local_attempt_")) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const st = parsed?.status;
          if (st === "finished" || st === "submitted") hapus.push(k);
        } catch {
          // Data rusak -> aman dihapus
          hapus.push(k);
        }
      }
    }
    for (const k of hapus) {
      try { localStorage.removeItem(k); } catch {}
    }
    if (hapus.length) {
      console.warn(`[safeSetItem] dibersihkan ${hapus.length} key attempt selesai`);
    }

    // ── Tahap 2: coba lagi
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // masih penuh
    }

    // ── Tahap 3: sisakan HANYA key dari roomId yang sedang ditulis.
    // Jawaban ujian yang SEDANG berjalan adalah yang paling berharga.
    const roomIdAktif = key.includes("_") ? key.split("_").slice(2).join("_") : "";
    const sisa: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("offline_answers_") || k.startsWith("local_attempt_")) {
        if (roomIdAktif && !k.endsWith(roomIdAktif)) sisa.push(k);
      }
    }
    for (const k of sisa) {
      try { localStorage.removeItem(k); } catch {}
    }

    try {
      localStorage.setItem(key, value);
      console.log("[safeSetItem] berhasil setelah pembersihan agresif");
      return true;
    } catch (e2) {
      console.error("[safeSetItem] GAGAL TOTAL — localStorage tidak bisa dipakai:", e2);
      return false;
    }
  }
}

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
        isOnline: getOnlineFlag(),
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
