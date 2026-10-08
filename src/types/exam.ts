export interface Teacher {
  id: string;
  name: string;
  code?: string;
  username: string;
  email?: string;
  phone?: string;
  subjects: string[];
  createdAt: number;
}

export type TeacherPayload = Omit<Teacher, "id" | "createdAt">;

export interface ClassData {
  id: string;
  name: string;
  createdAt: number;
}

export type ClassPayload = Omit<ClassData, "id" | "createdAt">;

export interface SubjectData {
  id: string;
  name: string;
  createdAt: number;
}

export type SubjectPayload = Omit<SubjectData, "id" | "createdAt">;

export interface StudentData {
  id: string;
  nisn: string;
  name: string;
  gender: "L" | "P";
  classId: string;
  className?: string; // Tambahan untuk mempermudah tampilan
  createdAt: number;
  password?: string; // Untuk PocketBase Auth
  hasChangedPassword?: boolean;
  photo?: string;
  birthPlace?: string;
  birthDate?: string;
  room?: string;
  session?: string;
  examNumber?: string;
}

export type StudentPayload = Omit<StudentData, "id" | "createdAt">;
