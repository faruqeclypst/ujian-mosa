import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import pb from "../lib/pocketbase";
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
      await initAll();
      unsubscribeTeachers = await pb.collection("teachers").subscribe("*", initAll);
      unsubscribeClasses = await pb.collection("classes").subscribe("*", initAll);
      unsubscribeSubjects = await pb.collection("subjects").subscribe("*", initAll);
      unsubscribeStudents = await pb.collection("students").subscribe("*", initAll);
    };

    setup();
    return () => {
      if (unsubscribeTeachers) unsubscribeTeachers();
      if (unsubscribeClasses) unsubscribeClasses();
      if (unsubscribeSubjects) unsubscribeSubjects();
      if (unsubscribeStudents) unsubscribeStudents();
    };
  }, [setupRealtime]);

  // --- Universal Token & Settings Sync ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const records = await pb.collection('settings').getFullList();
        if (records.length > 0) {
          const s = records[0];
          setUniversalToken(s.universal_token || "");
          setTokenUpdatedAt(s.universal_token_updated_at || s.updated || "");
        } else {
          // Auto create if empty (Admin only usually)
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          let token = "";
          for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
          
          await pb.collection('settings').create({
            universal_token: token,
            universal_token_updated_at: new Date().toISOString()
          });
          fetchSettings();
        }
      } catch (e) {}
    };

    fetchSettings();
    const unsubscribe = pb.collection('settings').subscribe("*", () => {
      fetchSettings();
    });
    return () => { unsubscribe.then(unsub => unsub()); };
  }, []);

  useEffect(() => {
    if (!tokenUpdatedAt) return;

    const timer = setInterval(async () => {
      const now = Date.now();
      const updatedDate = new Date(tokenUpdatedAt).getTime();
      const nextUpdate = updatedDate + 5 * 60 * 1000;
      const diff = nextUpdate - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        try {
          const records = await pb.collection('settings').getFullList();
          if (records.length > 0) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let token = "";
            for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
            
            await pb.collection('settings').update(records[0].id, {
              universal_token: token,
              universal_token_updated_at: new Date().toISOString()
            });
          }
        } catch (e) {}
      } else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tokenUpdatedAt]);

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
    for (const id of studentIds) {
      await pb.collection("students").update(id, { 
        classId: newClassId,
        classid: newClassId 
      });
    }
  };

  return (
    <ExamDataContext.Provider
      value={{
        teachers, classes, subjects, students, loading,
        createTeacher, updateTeacher, deleteTeacher,
        createClass, updateClass, deleteClass,
        createSubject, updateSubject, deleteSubject,
        createStudent, updateStudent, deleteStudent, updateStudentClassBatch,
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
