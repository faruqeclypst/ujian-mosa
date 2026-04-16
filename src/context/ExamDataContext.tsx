import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useTenant } from "./TenantContext";

import type {
  Teacher, TeacherPayload,
  ClassData, ClassPayload,
  SubjectData, SubjectPayload,
  StudentData, StudentPayload
} from "../types/exam";

interface ExamDataContextType {
  teachers: Teacher[];
  classes: ClassData[];
  subjects: SubjectData[];
  students: StudentData[];
  loading: boolean;

  // Teachers
  createTeacher: (payload: TeacherPayload) => Promise<void>;
  updateTeacher: (id: string, payload: Partial<TeacherPayload>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;

  // Classes
  createClass: (payload: ClassPayload) => Promise<void>;
  updateClass: (id: string, payload: Partial<ClassPayload>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  // Subjects
  createSubject: (payload: SubjectPayload) => Promise<void>;
  updateSubject: (id: string, payload: Partial<SubjectPayload>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;

  // Students
  createStudent: (payload: StudentPayload) => Promise<void>;
  updateStudent: (id: string, payload: Partial<StudentPayload>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  deleteStudentsBatch: (studentIds: string[]) => Promise<void>;
  updateStudentClassBatch: (studentIds: string[], newClassId: string) => Promise<void>;

  // Universal Token
  universalToken: string;
  timeLeft: string;
}

const ExamDataContext = createContext<ExamDataContextType | undefined>(undefined);

export const ExamDataProvider = ({ children }: { children: ReactNode }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);

  const [universalToken, setUniversalToken] = useState("");
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("--:--");
  const [serverOffset, setServerOffset] = useState(0); // Selisih waktu Server vs Client
  const { role } = useAuth();
  const { pb: tenantPb } = useTenant();
  const pb = tenantPb!;


  // Helper untuk memuai data awal dan subscribe ke perubahan Realtime
  const setupRealtime = useCallback((collection: string, setter: (data: any[]) => void) => {
    // 1. Ambil data awal (Full List)
    pb.collection(collection).getFullList({ sort: '-created' })
      .then((data) => {
        setter(data.map(item => {
          const { id, ...rest } = item;
          return { id, ...rest };
        }));
      })
      .catch(err => console.error(`Error loading ${collection}:`, err));

    // 2. Subscribe ke perubahan Realtime
    return pb.collection(collection).subscribe("*", (e) => {
      pb.collection(collection).getFullList({ sort: '-created' })
        .then((data) => {
          setter(data.map(item => {
            const { id, ...rest } = item;
            const mapped = { id, ...rest } as any;

            // Khusus Siswa: Petakan username ke nisn jika perlu
            if (collection === "students") {
              mapped.nisn = item.username || item.nisn;
              mapped.gender = item.gender || "L";
              mapped.classId = item.classId || item.classid;
            }
            return mapped;
          }));
        });
    });
  }, []);

  const initAll = useCallback(async () => {
    try {
      setLoading(true);
      // Disable auto-cancellation globally to prevent AbortErrors during parallel fetches
      pb.autoCancellation(false);

      // Ambil data awal untuk semua
      const [tData, cData, sMapel, stData] = await Promise.all([
        pb.collection("teachers").getFullList({ sort: '-created' }),
        pb.collection("classes").getFullList({ sort: '-created' }),
        pb.collection("subjects").getFullList({ sort: '-created' }),
        pb.collection("students").getFullList({ sort: '-created' }),
      ]);

      setTeachers(tData.map(i => ({ ...i, id: i.id } as any)));
      setClasses(cData.map(i => ({ ...i, id: i.id } as any)));
      setSubjects(sMapel.map(i => ({ ...i, id: i.id } as any)));
      setStudents(stData.map(i => {
        return {
          ...i,
          id: i.id,
          nisn: i.username || i.nisn,
          gender: i.gender || "L",
          classId: i.classId || i.classid || i.class_id
        } as any;
      }));

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeTeachers: any, unsubscribeClasses: any, unsubscribeSubjects: any, unsubscribeStudents: any;

    const setup = async () => {
      pb.autoCancellation(false);
      await initAll();
      
      // Subscribe with incremental updates instead of initAll (re-fetch everything)
      unsubscribeTeachers = await pb.collection("teachers").subscribe("*", (e) => {
        if (e.action === "create") setTeachers(prev => [e.record as any, ...prev]);
        if (e.action === "update") setTeachers(prev => prev.map(item => item.id === e.record.id ? { ...item, ...e.record } as any : item));
        if (e.action === "delete") setTeachers(prev => prev.filter(item => item.id !== e.record.id));
      });

      unsubscribeClasses = await pb.collection("classes").subscribe("*", (e) => {
        if (e.action === "create") setClasses(prev => [e.record as any, ...prev]);
        if (e.action === "update") setClasses(prev => prev.map(item => item.id === e.record.id ? { ...item, ...e.record } as any : item));
        if (e.action === "delete") setClasses(prev => prev.filter(item => item.id !== e.record.id));
      });

      unsubscribeSubjects = await pb.collection("subjects").subscribe("*", (e) => {
        if (e.action === "create") setSubjects(prev => [e.record as any, ...prev]);
        if (e.action === "update") setSubjects(prev => prev.map(item => item.id === e.record.id ? { ...item, ...e.record } as any : item));
        if (e.action === "delete") setSubjects(prev => prev.filter(item => item.id !== e.record.id));
      });

      unsubscribeStudents = await pb.collection("students").subscribe("*", (e) => {
        if (e.action === "create") {
          const m = { ...e.record, id: e.record.id, nisn: e.record.username || e.record.nisn, gender: e.record.gender || "L", classId: e.record.classId || e.record.classid } as any;
          setStudents(prev => [m, ...prev]);
        }
        if (e.action === "update") {
          const m = { ...e.record, id: e.record.id, nisn: e.record.username || e.record.nisn, gender: e.record.gender || "L", classId: e.record.classId || e.record.classid } as any;
          setStudents(prev => prev.map(item => item.id === e.record.id ? m : item));
        }
        if (e.action === "delete") setStudents(prev => prev.filter(item => item.id !== e.record.id));
      });
    };

    setup();
    return () => {
      if (unsubscribeTeachers) unsubscribeTeachers();
      if (unsubscribeClasses) unsubscribeClasses();
      if (unsubscribeSubjects) unsubscribeSubjects();
      if (unsubscribeStudents) unsubscribeStudents();
    };
  }, [initAll]);

  // --- Universal Token & Settings Sync ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        pb.autoCancellation(false);
        
        // 🕒 Sinkronisasi Waktu Server yang Akurat
        // Kita ambil jam asli server dari response header
        const healthResponse = await fetch(`${pb.baseUrl}/api/health`, { method: 'GET' });
        const serverDateStr = healthResponse.headers.get('Date');
        if (serverDateStr) {
          const serverTime = new Date(serverDateStr).getTime();
          const localTime = Date.now();
          const offset = localTime - serverTime;
          setServerOffset(offset);
          console.log("🕒 Server Time Sync Offset:", offset, "ms");
        }

        const records = await pb.collection('settings').getFullList({ limit: 1, sort: 'created' });
        if (records.length > 0) {
          const s = records[0];
          setUniversalToken(s.universal_token || "");
          setTokenUpdatedAt(s.universal_token_updated_at || s.updated || "");
          console.log("⚙️ Settings loaded:", s.universal_token);
        }
      } catch (e) {
        console.error("❌ Error fetching settings/time:", e);
      }
    };

    fetchSettings();
    
    // Subscribe ke perubahan dan langsung update state
    const unsubscribe = pb.collection('settings').subscribe("*", (e) => {
      console.log("🔔 Settings Subscription Event:", e.action, e.record.universal_token);
      if (e.action === "update" || e.action === "create") {
        setUniversalToken(e.record.universal_token || "");
        setTokenUpdatedAt(e.record.universal_token_updated_at || e.record.updated || "");
      } else {
        fetchSettings();
      }
    });

    return () => { unsubscribe.then(unsub => unsub()); };
  }, [pb]);

  useEffect(() => {
    if (!tokenUpdatedAt) return;
    let isUpdating = false;

    const timer = setInterval(async () => {
      // Gunakan waktu client yang dikoreksi dengan offset server
      const now = Date.now() - serverOffset;
      const updatedDate = new Date(tokenUpdatedAt).getTime();
      const nextUpdate = updatedDate + 5 * 60 * 1000;
      const diff = nextUpdate - now;

      if (diff <= 0) {
        if (timeLeft !== "00:00") setTimeLeft("00:00");
        
        // 🔒 No longer rotating from the frontend admin to avoid conflicts.
        // Rotation is now handled by the server (pb_hooks/main.pb.js).
        // Only trigger a safety fetch if we are stuck at 0.
        if (!isUpdating) {
          isUpdating = true;
          try {
            const records = await pb.collection('settings').getFullList({ limit: 1, sort: 'created' });
            if (records.length > 0) {
              setUniversalToken(records[0].universal_token || "");
              setTokenUpdatedAt(records[0].universal_token_updated_at || records[0].updated || "");
            }
          } catch (e) { }
          finally { setTimeout(() => { isUpdating = false; }, 3000); }
        }
      } else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tokenUpdatedAt, role, timeLeft]);

  // --- Teacher Actions ---
  const createTeacher = async (payload: TeacherPayload) => {
    await pb.collection("teachers").create(payload);
  };
  const updateTeacher = async (id: string, payload: Partial<TeacherPayload>) => {
    await pb.collection("teachers").update(id, payload);
  };
  const deleteTeacher = async (id: string) => {
    await pb.collection("teachers").delete(id);
  };

  // --- Class Actions ---
  const createClass = async (payload: ClassPayload) => {
    await pb.collection("classes").create(payload);
  };
  const updateClass = async (id: string, payload: Partial<ClassPayload>) => {
    await pb.collection("classes").update(id, payload);
  };
  const deleteClass = async (id: string) => {
    await pb.collection("classes").delete(id);
  };

  // --- Subject Actions ---
  const createSubject = async (payload: SubjectPayload) => {
    await pb.collection("subjects").create(payload);
  };
  const updateSubject = async (id: string, payload: Partial<SubjectPayload>) => {
    await pb.collection("subjects").update(id, payload);
  };
  const deleteSubject = async (id: string) => {
    await pb.collection("subjects").delete(id);
  };

  // --- Student Actions ---
  const createStudent = async (payload: StudentPayload) => {
    const defaultPass = payload.password || `${payload.nisn}@mosa`;
    await pb.collection("students").create({
      username: payload.nisn,
      password: defaultPass,
      passwordConfirm: defaultPass,
      name: payload.name,
      gender: payload.gender || "L",
      classId: payload.classId,
      classid: payload.classId, // backup for lowercase field
    });
  };
  const updateStudent = async (id: string, payload: Partial<StudentPayload>) => {
    const updateData: any = {};
    if (payload.name) updateData.name = payload.name;
    if (payload.nisn) updateData.username = payload.nisn;
    if (payload.gender) updateData.gender = payload.gender;
    if (payload.classId) {
      updateData.classId = payload.classId;
      updateData.classid = payload.classId;
    }
    await pb.collection("students").update(id, updateData);
  };
  const deleteStudent = async (id: string) => {
    await pb.collection("students").delete(id);
  };
  const updateStudentClassBatch = async (studentIds: string[], newClassId: string) => {
    const chunkSize = 10;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      await Promise.all(chunk.map(id => pb.collection("students").update(id, {
        classId: newClassId,
        classid: newClassId
      })));
    }
  };
  const deleteStudentsBatch = async (studentIds: string[]) => {
    const chunkSize = 10;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      await Promise.all(chunk.map(id => pb.collection("students").delete(id)));
    }
  };

  return (
    <ExamDataContext.Provider
      value={{
        teachers, classes, subjects, students, loading,
        createTeacher, updateTeacher, deleteTeacher,
        createClass, updateClass, deleteClass,
        createSubject, updateSubject, deleteSubject,
        createStudent, updateStudent, deleteStudent, updateStudentClassBatch, deleteStudentsBatch,
        universalToken, timeLeft
      }}
    >
      {children}
    </ExamDataContext.Provider>
  );
};

export const useExamData = () => {
  const context = useContext(ExamDataContext);
  if (context === undefined) {
    throw new Error("useExamData must be used within a ExamDataProvider");
  }
  return context;
};
