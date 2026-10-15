import { useState, useEffect, useCallback, useRef } from "react";
import { ExamRoomData } from "../utils/helpers";

interface UseMonitoringDataParams {
  pb: any;
  roomId: string | null;
  subjects: any[];
  masterTeachers: any[];
  examClasses: any[];
}

interface UseMonitoringDataReturn {
  loading: boolean;
  monitorRoom: ExamRoomData | null;
  attempts: any[];
  monitorQuestions: any[];
  answersList: Record<string, any>;
  detailAnswers: Record<string, any>;
  isLargeRoom: boolean;
  largeRoomRef: React.MutableRefObject<boolean>;
  refresh: (targetRoomId?: string) => Promise<void>;
  setAttempts: React.Dispatch<React.SetStateAction<any[]>>;
  setMonitorRoom: React.Dispatch<React.SetStateAction<ExamRoomData | null>>;
  setMonitorQuestions: React.Dispatch<React.SetStateAction<any[]>>;
  setAnswersList: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setDetailAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const ATTEMPT_LITE_FIELDS = "id,studentId,examRoomId,status,isOnline,lastHeartbeat,score,correct,total,cheatCount,submittedAt,submitTime,created,updated,startedAt,startTime,overrides,objectiveScore,objectiveCorrect,objectiveTotal,essayScore,essayCorrect,essayGraded,essayTotal,answeredCount";
const LARGE_ROOM_THRESHOLD = 200;

/**
 * Hook untuk fetch data monitoring: room, attempts, questions.
 * Diekstrak dari MonitoringPage untuk kerapian kode.
 */
export const useMonitoringData = ({
  pb,
  roomId,
  subjects,
  masterTeachers,
  examClasses,
}: UseMonitoringDataParams): UseMonitoringDataReturn => {
  const [loading, setLoading] = useState(true);
  const [monitorRoom, setMonitorRoom] = useState<ExamRoomData | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [answersList, setAnswersList] = useState<Record<string, any>>({});
  const [detailAnswers, setDetailAnswers] = useState<Record<string, any>>({});
  const [isLargeRoom, setIsLargeRoom] = useState(false);
  const largeRoomRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async (targetRoomId?: string) => {
    const id = targetRoomId || roomId;
    if (!id || !pb) return;

    isRefreshingRef.current = true;
    try {
      let currentRoom = monitorRoom;
      if (!currentRoom) {
        const roomRecord = await pb.collection('exam_rooms').getOne(id, {
          expand: 'examId,examId.teacherId,examId.subjectId'
        });
        const examObj = roomRecord.expand?.examId || await pb.collection('exams').getOne(roomRecord.examId).catch(() => null);

        const sId = roomRecord.examId || (roomRecord as any).examid || "";
        const roomName = roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "Tanpa Nama";
        const subjectObj = examObj?.expand?.subjectId || subjects.find((s: any) => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
        const teacherObj = examObj?.expand?.teacherId || masterTeachers.find((t: any) => t.id === (examObj?.teacherId || (examObj as any)?.teacherid));

        const isAllClasses = roomRecord.allClasses || (roomRecord as any).all_classes || false;
        const clsData = roomRecord.classId || (roomRecord as any).classid || (roomRecord as any).classIds || (roomRecord as any).classids || "";
        let classList: string[] = [];
        if (!isAllClasses) {
          if (Array.isArray(clsData)) {
            classList = clsData;
          } else if (typeof clsData === 'string' && clsData.length > 0) {
            classList = clsData.split(",").map((cid: string) => cid.trim()).filter(Boolean);
          }
        }

        currentRoom = {
          ...roomRecord,
          room_name: roomName,
          examId: sId,
          examTitle: roomName,
          subjectName: subjectObj?.name || "-",
          teacherName: teacherObj?.name || "-",
          classId: classList.length > 0 ? classList.join(",") : null,
          allClasses: isAllClasses,
        } as ExamRoomData;
        setMonitorRoom(currentRoom);
      }

      // Fetch questions
      const qRecords = await pb.collection('questions').getFullList({
        filter: `examId = "${currentRoom.examId}"`,
        sort: 'order,created',
      });
      setMonitorQuestions(qRecords);

      // Fetch attempts
      const attRecords = await pb.collection('attempts').getFullList({
        filter: `examRoomId = "${id}"`,
        fields: ATTEMPT_LITE_FIELDS,
        sort: 'created',
      });
      setAttempts(attRecords);
      largeRoomRef.current = attRecords.length > LARGE_ROOM_THRESHOLD;
      setIsLargeRoom(attRecords.length > LARGE_ROOM_THRESHOLD);

      // Build answers lookup
      const ansMap: Record<string, any> = {};
      const detMap: Record<string, any> = {};
      for (const att of attRecords) {
        if (att.answers) {
          ansMap[att.id] = att.answers;
          detMap[att.studentId] = att.answers;
        }
      }
      setAnswersList(ansMap);
      setDetailAnswers(detMap);
    } catch (e) {
      console.error("Gagal refresh monitoring:", e);
    } finally {
      isRefreshingRef.current = false;
      setLoading(false);
    }
  }, [pb, roomId, monitorRoom, subjects, masterTeachers]);

  useEffect(() => {
    if (roomId) {
      refresh(roomId);
    }
  }, [roomId]);

  return {
    loading,
    monitorRoom,
    attempts,
    monitorQuestions,
    answersList,
    detailAnswers,
    isLargeRoom,
    largeRoomRef,
    refresh,
    setAttempts,
    setMonitorRoom,
    setMonitorQuestions,
    setAnswersList,
    setDetailAnswers,
  };
};
