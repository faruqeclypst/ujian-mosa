import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../lib/firebase";
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
}

const ExamDataContext = createContext<ExamDataContextType | undefined>(undefined);

export const ExamDataProvider = ({ children }: { children: ReactNode }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadedTeachers, setLoadedTeachers] = useState(false);
  const [loadedClasses, setLoadedClasses] = useState(false);
  const [loadedSubjects, setLoadedSubjects] = useState(false);
  const [loadedStudents, setLoadedStudents] = useState(false);

  useEffect(() => {
    if (loadedTeachers && loadedClasses && loadedSubjects && loadedStudents) {
      setLoading(false);
    }
  }, [loadedTeachers, loadedClasses, loadedSubjects, loadedStudents]);

  // Load teachers
  useEffect(() => {
    const teachersRef = ref(database, "teachers");
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
    const classesRef = ref(database, "classes");
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

  // Load subjects
  useEffect(() => {
    const subjectsRef = ref(database, "subjects");
    const unsubscribe = onValue(subjectsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedSubjects: SubjectData[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setSubjects(loadedSubjects);
      } else {
        setSubjects([]);
      }
      setLoadedSubjects(true);
    });
    return () => unsubscribe();
  }, []);

  // Load students
  useEffect(() => {
    const studentsRef = ref(database, "students");
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
    const teachersRef = ref(database, "teachers");
    await push(teachersRef, { ...payload, createdAt: Date.now() });
  };
  const updateTeacher = async (id: string, payload: Partial<TeacherPayload>) => {
    const teacherRef = ref(database, `teachers/${id}`);
    await update(teacherRef, payload);
  };
  const deleteTeacher = async (id: string) => {
    const teacherRef = ref(database, `teachers/${id}`);
    await remove(teacherRef);
  };

  // --- Class Actions ---
  const createClass = async (payload: ClassPayload) => {
    const classRef = ref(database, "classes");
    await push(classRef, { ...payload, createdAt: Date.now() });
  };
  const updateClass = async (id: string, payload: Partial<ClassPayload>) => {
    const classRef = ref(database, `classes/${id}`);
    await update(classRef, payload);
  };
  const deleteClass = async (id: string) => {
    const classRef = ref(database, `classes/${id}`);
    await remove(classRef);
  };

  // --- Subject Actions ---
  const createSubject = async (payload: SubjectPayload) => {
    const subjectRef = ref(database, "subjects");
    await push(subjectRef, { ...payload, createdAt: Date.now() });
  };
  const updateSubject = async (id: string, payload: Partial<SubjectPayload>) => {
    const subjectRef = ref(database, `subjects/${id}`);
    await update(subjectRef, payload);
  };
  const deleteSubject = async (id: string) => {
    const subjectRef = ref(database, `subjects/${id}`);
    await remove(subjectRef);
  };

  // --- Student Actions ---
  const createStudent = async (payload: StudentPayload) => {
    const studentsRef = ref(database, "students");
    await push(studentsRef, { ...payload, createdAt: Date.now() });
  };
  const updateStudent = async (id: string, payload: Partial<StudentPayload>) => {
    const studentRef = ref(database, `students/${id}`);
    await update(studentRef, payload);
  };
  const deleteStudent = async (id: string) => {
    const studentRef = ref(database, `students/${id}`);
    await remove(studentRef);
  };
  const updateStudentClassBatch = async (studentIds: string[], newClassId: string) => {
    const updates: Record<string, any> = {};
    studentIds.forEach((id) => {
      updates[`students/${id}/classId`] = newClassId;
    });
    await update(ref(database), updates);
  };

  return (
    <ExamDataContext.Provider
      value={{
        teachers, classes, subjects, students, loading,
        createTeacher, updateTeacher, deleteTeacher,
        createClass, updateClass, deleteClass,
        createSubject, updateSubject, deleteSubject,
        createStudent, updateStudent, deleteStudent, updateStudentClassBatch,
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
