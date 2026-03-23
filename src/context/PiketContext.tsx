import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../lib/firebase";
import type { 
  Teacher, TeacherPayload, 
  ClassData, ClassPayload, 
  SubjectData, SubjectPayload,
  StudentData, StudentPayload 
} from "../types/piket";

interface PiketContextType {
  teachers: Teacher[];
  classes: ClassData[];
  mapels: SubjectData[];
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

  // Mapels
  createMapel: (payload: SubjectPayload) => Promise<void>;
  updateMapel: (id: string, payload: Partial<SubjectPayload>) => Promise<void>;
  deleteMapel: (id: string) => Promise<void>;

  // Students
  createStudent: (payload: StudentPayload) => Promise<void>;
  updateStudent: (id: string, payload: Partial<StudentPayload>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  updateStudentClassBatch: (studentIds: string[], newClassId: string) => Promise<void>;
}

const PiketContext = createContext<PiketContextType | undefined>(undefined);

export const PiketProvider = ({ children }: { children: ReactNode }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [mapels, setMapels] = useState<SubjectData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadedTeachers, setLoadedTeachers] = useState(false);
  const [loadedClasses, setLoadedClasses] = useState(false);
  const [loadedMapels, setLoadedMapels] = useState(false);
  const [loadedStudents, setLoadedStudents] = useState(false);

  useEffect(() => {
    if (loadedTeachers && loadedClasses && loadedMapels && loadedStudents) {
      setLoading(false);
    }
  }, [loadedTeachers, loadedClasses, loadedMapels, loadedStudents]);

  // Load teachers
  useEffect(() => {
    const teachersRef = ref(database, "piket_teachers");
    const unsubscribe = onValue(teachersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedTeachers: Teacher[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
          subjects: data[key].subjects || [],
        }));
        setTeachers(loadedTeachers);
      } else {
        setTeachers([]);
      }
      setLoadedTeachers(true);
    });
    return () => unsubscribe();
  }, []);

  // Load classes
  useEffect(() => {
    const classesRef = ref(database, "piket_classes");
    const unsubscribe = onValue(classesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedClasses: ClassData[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setClasses(loadedClasses);
      } else {
        setClasses([]);
      }
      setLoadedClasses(true);
    });
    return () => unsubscribe();
  }, []);

  // Load mapels
  useEffect(() => {
    const mapelsRef = ref(database, "piket_subjects");
    const unsubscribe = onValue(mapelsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedMapels: SubjectData[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setMapels(loadedMapels);
      } else {
        setMapels([]);
      }
      setLoadedMapels(true);
    });
    return () => unsubscribe();
  }, []);

  // Load students
  useEffect(() => {
    const studentsRef = ref(database, "piket_students");
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedStudents: StudentData[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setStudents(loadedStudents);
      } else {
        setStudents([]);
      }
      setLoadedStudents(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Teacher Actions ---
  const createTeacher = async (payload: TeacherPayload) => {
    const teachersRef = ref(database, "piket_teachers");
    await push(teachersRef, { ...payload, createdAt: Date.now() });
  };
  const updateTeacher = async (id: string, payload: Partial<TeacherPayload>) => {
    const teacherRef = ref(database, `piket_teachers/${id}`);
    await update(teacherRef, payload);
  };
  const deleteTeacher = async (id: string) => {
    const teacherRef = ref(database, `piket_teachers/${id}`);
    await remove(teacherRef);
  };

  // --- Class Actions ---
  const createClass = async (payload: ClassPayload) => {
    const classRef = ref(database, "piket_classes");
    await push(classRef, { ...payload, createdAt: Date.now() });
  };
  const updateClass = async (id: string, payload: Partial<ClassPayload>) => {
    const classRef = ref(database, `piket_classes/${id}`);
    await update(classRef, payload);
  };
  const deleteClass = async (id: string) => {
    const classRef = ref(database, `piket_classes/${id}`);
    await remove(classRef);
  };

  // --- Mapel Actions ---
  const createMapel = async (payload: SubjectPayload) => {
    const mapelRef = ref(database, "piket_subjects");
    await push(mapelRef, { ...payload, createdAt: Date.now() });
  };
  const updateMapel = async (id: string, payload: Partial<SubjectPayload>) => {
    const mapelRef = ref(database, `piket_subjects/${id}`);
    await update(mapelRef, payload);
  };
  const deleteMapel = async (id: string) => {
    const mapelRef = ref(database, `piket_subjects/${id}`);
    await remove(mapelRef);
  };

  // --- Student Actions ---
  const createStudent = async (payload: StudentPayload) => {
    const studentsRef = ref(database, "piket_students");
    await push(studentsRef, { ...payload, createdAt: Date.now() });
  };
  const updateStudent = async (id: string, payload: Partial<StudentPayload>) => {
    const studentRef = ref(database, `piket_students/${id}`);
    await update(studentRef, payload);
  };
  const deleteStudent = async (id: string) => {
    const studentRef = ref(database, `piket_students/${id}`);
    await remove(studentRef);
  };
  const updateStudentClassBatch = async (studentIds: string[], newClassId: string) => {
    const updates: Record<string, any> = {};
    studentIds.forEach((id) => {
      updates[`piket_students/${id}/classId`] = newClassId;
    });
    await update(ref(database), updates);
  };

  return (
    <PiketContext.Provider
      value={{
        teachers, classes, mapels, students, loading,
        createTeacher, updateTeacher, deleteTeacher,
        createClass, updateClass, deleteClass,
        createMapel, updateMapel, deleteMapel,
        createStudent, updateStudent, deleteStudent, updateStudentClassBatch,
      }}
    >
      {children}
    </PiketContext.Provider>
  );
};

export const usePiket = () => {
  const context = useContext(PiketContext);
  if (context === undefined) {
    throw new Error("usePiket must be used within a PiketProvider");
  }
  return context;
};
