/**
 * attemptStats.ts — SATU definisi untuk "sedang ujian / sedang mengerjakan".
 *
 * Dipakai oleh:
 * - ExamRoomsPage (daftar room, badge "N SISWA SEDANG MENGERJAKAN")
 * - MonitoringPage (kartu "Sedang Ujian")
 *
 * Definisi kanonis:
 *   "Sedang ujian" di sebuah room = jumlah SISWA UNIK yang memiliki
 *   minimal satu attempt berstatus 'ongoing' di room tersebut DAN
 *   terdaftar di kelas yang terikat ke room itu (eligibility).
 *
 * Kenapa eligibility? MonitoringPage membatasi "Total Peserta" pada siswa
 * yang eligible (kelas room). Kalau pembilang tidak dibatasi dengan cara
 * yang sama, angka "359" (detail) vs "1001" (daftar) tidak akan pernah cocok
 * — persis bug yang terjadi saat load test menaruh siswa beda kelas
 * ke room yang sama.
 */

export interface RoomLike {
  id: string;
  classId?: string | string[] | null;
  classIds?: string | string[] | null;
  allClasses?: boolean;
  all_classes?: boolean;
}

export interface AttemptLike {
  id?: string;
  studentId?: string;
  student_id?: string;
  examRoomId?: string;
  exam_room?: string;
  status?: string;
}

export interface StudentLike {
  id: string;
  classId?: string;
  class_id?: string;
}

/** Normalisasi daftar classId yang terikat ke sebuah room. */
export function getRoomClassIds(room: RoomLike): string[] {
  if (!room) return [];
  if (room.allClasses || (room as any).all_classes) return [];
  const raw =
    room.classId ?? room.classIds ?? (room as any).classid ?? (room as any).classids ?? "";
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter((c) => c && c !== "all");
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && c !== "all");
  }
  return [];
}

/** Apakah room menerima semua kelas (tanpa batasan)? */
export function isAllClassesRoom(room: RoomLike): boolean {
  return !!(room?.allClasses || (room as any)?.all_classes);
}

/** Apakah siswa (dilihat dari classId-nya) eligible untuk room ini? */
export function isStudentEligibleForRoom(
  studentClassId: string | undefined | null,
  room: RoomLike
): boolean {
  if (isAllClassesRoom(room)) return true;
  const allowed = getRoomClassIds(room);
  // Room tanpa batasan kelas yang jelas → anggap semua eligible
  // (lebih aman daripada menyembunyikan siswa yang sedang ujian).
  if (allowed.length === 0) return true;
  return !!studentClassId && allowed.includes(studentClassId);
}

/** Ambil studentId dari attempt (toleran terhadap varian nama field). */
export function getAttemptStudentId(att: AttemptLike): string {
  return att?.studentId || att?.student_id || "";
}

/** Ambil examRoomId dari attempt. */
export function getAttemptRoomId(att: AttemptLike): string {
  return att?.examRoomId || att?.exam_room || "";
}

/**
 * Hitung jumlah SISWA UNIK dengan attempt 'ongoing' dari daftar attempts.
 * (Dedupe: satu siswa dengan 2 attempt ongoing tetap dihitung 1.)
 */
export function countUniqueOngoingStudents(attempts: AttemptLike[]): number {
  const set = new Set<string>();
  for (const att of attempts || []) {
    if (att?.status !== "ongoing") continue;
    const sId = getAttemptStudentId(att);
    if (sId) set.add(sId);
  }
  return set.size;
}

export interface OngoingPerRoomResult {
  /** roomId -> jumlah siswa unik ongoing (sudah scoped eligibility) */
  perRoom: Record<string, number>;
  /** total siswa unik ongoing di semua room */
  total: number;
}

/**
 * Hitung "sedang mengerjakan" per room dari attempts + daftar rooms + map students.
 * Ini fungsi yang dipakai ExamRoomsPage agar angkanya IDENTIK dengan
 * MonitoringPage ("Sedang Ujian").
 */
export function countOngoingPerRoom(
  attempts: AttemptLike[] | Record<string, AttemptLike>,
  rooms: RoomLike[],
  studentsById: Record<string, StudentLike>
): OngoingPerRoomResult {
  const roomsById: Record<string, RoomLike> = {};
  for (const r of rooms || []) {
    if (r?.id) roomsById[r.id] = r;
  }

  const perRoomSets: Record<string, Set<string>> = {};
  const globalSet = new Set<string>();
  const list = Array.isArray(attempts) ? attempts : Object.values(attempts || {});

  for (const att of list) {
    if (att?.status !== "ongoing") continue;
    const sId = getAttemptStudentId(att);
    const rId = getAttemptRoomId(att);
    if (!sId || !rId) continue;

    const room = roomsById[rId];
    if (!room) continue; // attempt yatim (room sudah dihapus) → jangan hitung

    const student = studentsById?.[sId];
    const studentClassId = student?.classId ?? (student as any)?.class_id;
    if (!isStudentEligibleForRoom(studentClassId, room)) continue;

    globalSet.add(sId);
    if (!perRoomSets[rId]) perRoomSets[rId] = new Set<string>();
    perRoomSets[rId].add(sId);
  }

  const perRoom: Record<string, number> = {};
  for (const rId of Object.keys(perRoomSets)) {
    perRoom[rId] = perRoomSets[rId].size;
  }
  return { perRoom, total: globalSet.size };
}
