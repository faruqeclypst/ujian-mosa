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
const StudentDashboardPage = lazy(() => import("./pages/student/StudentDashboardPage"));
const CBTPage = lazy(() => import("./pages/student/CBTPage"));
import NotFoundPage from "./pages/NotFoundPage";
import pb from "./lib/pocketbase";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TeachersPage = lazy(() => import("./pages/TeachersPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage")); 
const AlumniPage = lazy(() => import("./pages/AlumniPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const ExamsPage = lazy(() => import("./pages/admin/ExamsPage"));
const QuestionsPage = lazy(() => import("./pages/admin/QuestionsPage"));
const ExamRoomsPage = lazy(() => import("./pages/admin/ExamRoomsPage"));
const MonitoringPage = lazy(() => import("./pages/admin/MonitoringPage"));
const GuidePage = lazy(() => import("./pages/admin/GuidePage"));

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
  if (loading) return null;
  if (role !== "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

import CapacitorOverlay from "./components/auth/CapacitorOverlay";

const AppContent = () => {
  const { user, loading } = useAuth();
  const { student } = useStudentAuth();
  const location = useLocation();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const records = await pb.collection("settings").getFullList({
          limit: 1,
          sort: "created",
        });
        
        if (records.length > 0) {
          const data = records[0];
          document.title = data.name ? `E-Ujian - ${data.name}` : "E-Ujian";

          // 🌍 Dynamically set Favicon from school logo
          let faviconUrl = data.logoUrl || data.logo || "";
          if (faviconUrl && !faviconUrl.startsWith('http') && !faviconUrl.startsWith('data:')) {
            faviconUrl = pb.files.getUrl(data, faviconUrl);
          }

          if (faviconUrl) {
            const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = faviconUrl;
            document.getElementsByTagName('head')[0].appendChild(link);
          }
        } else {
          document.title = "E-Ujian";
        }
      } catch (err) {
        console.error("Gagal memuat judul aplikasi:", err);
        document.title = "E-Ujian";
      }
    };

    fetchSettings();
  }, []);

  // Check if it's an admin route to decide whether to show a full-screen loader or a shell skeleton
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (loading && !isAdminRoute) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <CapacitorOverlay />
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
          path="/cbt" 
          element={
            <ExambroGuard>
              <StudentAuthGuard>
                <CBTPage />
              </StudentAuthGuard>
            </ExambroGuard>
          } 
        />
        <Route 
          path="/cbt/:roomId" 
          element={
            <ExambroGuard>
              <StudentAuthGuard>
                <CBTPage />
              </StudentAuthGuard>
            </ExambroGuard>
          } 
        />

        {/* === ADMIN / GURU ROUTES (PREFIX /admin) === */}
        <Route path="/admin/register" element={user ? <Navigate to="/admin" replace /> : <RegisterPage />} />
        <Route path="/admin/change-password" element={user ? <ChangePasswordPage /> : <Navigate to="/admin" replace />} />
        <Route path="/admin/profile" element={user ? <ProfilePage /> : <Navigate to="/admin" replace />} />
        
        <Route
          path="/admin"
          element={
            loading ? (
              <LoadingScreen />
            ) : user ? (
              <ExamDataProvider>
                <InventoryLayout />
              </ExamDataProvider>
            ) : (
              <LoginPage />
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
          <Route path="monitoring/:roomId" element={<MonitoringPage />} />
          <Route path="panduan" element={<GuidePage />} />
          <Route path="pengaturan" element={<AdminOnlyRoute><SettingsPage /></AdminOnlyRoute>} />
        </Route>

        {/* Fallback - 404 Error Page */}
        <Route path="*" element={<NotFoundPage />} />
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
