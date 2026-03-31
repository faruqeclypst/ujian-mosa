import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import InventoryLayout from "./components/layout/InventoryLayout";
import LoadingScreen from "./components/layout/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ProfilePage from "./pages/ProfilePage";
import { ToastProvider } from "./components/ui/toast";

import { StudentAuthProvider, useStudentAuth } from "./context/StudentAuthContext";
import ExambroGuard from "./components/auth/ExambroGuard";
import StudentLoginPage from "./pages/student/StudentLoginPage";
import StudentDashboardPage from "./pages/student/StudentDashboardPage";
import CBTPage from "./pages/student/CBTPage";
import ExamResultPage from "./pages/student/ExamResultPage";
import { database } from "./lib/firebase";
import { ref, onValue } from "firebase/database";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TeachersPage = lazy(() => import("./pages/TeachersPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage")); 
const AlumniPage = lazy(() => import("./pages/AlumniPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

import ExamsPage from "./pages/admin/ExamsPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import ExamRoomsPage from "./pages/admin/ExamRoomsPage";

import { ExamDataProvider } from "./context/ExamDataContext";

// Simple Guard for student Authentications
const StudentAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { student, loading } = useStudentAuth();
  if (loading) return <LoadingScreen />;
  if (!student) return <Navigate to="/student/login" replace />;
  return <>{children}</>;
};

// Guard for Admin Only Routes
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (role !== "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const { student } = useStudentAuth();
  const location = useLocation();

  useEffect(() => {
    const configRef = ref(database, "settings/school");
    return onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.name) {
          document.title = `E-Ujian - ${data.name}`;
        } else {
          document.title = "E-Ujian";
        }
      }
    });
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  // Apakah route diakses oleh Guru/Admin
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* === student ROUTES (HALAMAN UTAMA) === */}
        <Route 
          path="/" 
          element={
            <ExambroGuard>
              {student ? <StudentDashboardPage /> : <StudentLoginPage />}
            </ExambroGuard>
          } 
        />
        <Route 
          path="/cbt/:roomId" 
          element={
            <ExambroGuard>
              {student ? <CBTPage /> : <Navigate to="/" replace />}
            </ExambroGuard>
          } 
        />
        <Route 
          path="/cbt/:roomId/result" 
          element={
            <ExambroGuard>
              {student ? <ExamResultPage /> : <Navigate to="/" replace />}
            </ExambroGuard>
          } 
        />

        {/* === ADMIN / GURU ROUTES (PREFIX /admin) === */}
        <Route path="/admin/login" element={user ? <Navigate to="/admin" replace /> : <LoginPage />} />
        <Route path="/admin/register" element={user ? <Navigate to="/admin" replace /> : <RegisterPage />} />
        <Route path="/admin/change-password" element={user ? <ChangePasswordPage /> : <Navigate to="/admin/login" replace />} />
        <Route path="/admin/profile" element={user ? <ProfilePage /> : <Navigate to="/admin/login" replace />} />
        
        <Route
          path="/admin"
          element={
            user ? (
              <ExamDataProvider>
                <InventoryLayout />
              </ExamDataProvider>
            ) : (
              <Navigate to="/admin/login" replace />
            )
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="subjects" element={<AdminOnlyRoute><SubjectsPage /></AdminOnlyRoute>} />
          <Route path="teachers" element={<AdminOnlyRoute><TeachersPage /></AdminOnlyRoute>} />
          <Route path="student" element={<AdminOnlyRoute><StudentsPage /></AdminOnlyRoute>} />
          <Route path="alumni" element={<AdminOnlyRoute><AlumniPage /></AdminOnlyRoute>} />
          <Route path="classes" element={<AdminOnlyRoute><ClassesPage /></AdminOnlyRoute>} />
          <Route path="kelola-akun" element={<AdminOnlyRoute><UsersPage /></AdminOnlyRoute>} />
          <Route path="bank-soal" element={<ExamsPage />} />
          <Route path="bank-soal/:examId/questions" element={<QuestionsPage />} />
          <Route path="ruang-ujian" element={<ExamRoomsPage />} />
          <Route path="pengaturan" element={<AdminOnlyRoute><SettingsPage /></AdminOnlyRoute>} />
        </Route>

        {/* Fallback */}
        <Route 
          path="*" 
          element={
            <Navigate 
              to={isAdminRoute ? "/admin/login" : "/"} 
              replace 
            />
          } 
        />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider>
        <SidebarProvider>
          <StudentAuthProvider>
            <AppContent />
          </StudentAuthProvider>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
