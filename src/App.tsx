import { lazy, Suspense } from "react";
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

import { SiswaAuthProvider, useSiswaAuth } from "./context/SiswaAuthContext";
import ExambroGuard from "./components/auth/ExambroGuard";
import SiswaLoginPage from "./pages/siswa/SiswaLoginPage";
import SiswaDashboardPage from "./pages/siswa/SiswaDashboardPage";
import CBTPage from "./pages/siswa/CBTPage";
import ExamResultPage from "./pages/siswa/ExamResultPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const GuruPage = lazy(() => import("./pages/GuruPage"));
const MapelPage = lazy(() => import("./pages/MapelPage"));
const KelasPage = lazy(() => import("./pages/KelasPage"));
const SiswaPage = lazy(() => import("./pages/SiswaPage")); 
const AlumniPage = lazy(() => import("./pages/AlumniPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

import ExamsPage from "./pages/admin/ExamsPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import ExamRoomsPage from "./pages/admin/ExamRoomsPage";

import { PiketProvider } from "./context/PiketContext";

// Simple Guard for Siswa Authentications
const SiswaAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { siswa, loading } = useSiswaAuth();
  if (loading) return <LoadingScreen />;
  if (!siswa) return <Navigate to="/siswa/login" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const { siswa } = useSiswaAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Apakah route diakses oleh Guru/Admin
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* === SISWA ROUTES (HALAMAN UTAMA) === */}
        <Route 
          path="/" 
          element={
            <ExambroGuard>
              {siswa ? <SiswaDashboardPage /> : <SiswaLoginPage />}
            </ExambroGuard>
          } 
        />
        <Route 
          path="/cbt/:roomId" 
          element={
            <ExambroGuard>
              {siswa ? <CBTPage /> : <Navigate to="/" replace />}
            </ExambroGuard>
          } 
        />
        <Route 
          path="/cbt/:roomId/result" 
          element={
            <ExambroGuard>
              {siswa ? <ExamResultPage /> : <Navigate to="/" replace />}
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
              <PiketProvider>
                <InventoryLayout />
              </PiketProvider>
            ) : (
              <Navigate to="/admin/login" replace />
            )
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="mapel" element={<MapelPage />} />
          <Route path="guru" element={<GuruPage />} />
          <Route path="siswa" element={<SiswaPage />} />
          <Route path="alumni" element={<AlumniPage />} />
          <Route path="kelas" element={<KelasPage />} />
          <Route path="kelola-akun" element={<UsersPage />} />
          <Route path="bank-soal" element={<ExamsPage />} />
          <Route path="bank-soal/:examId/questions" element={<QuestionsPage />} />
          <Route path="ruang-ujian" element={<ExamRoomsPage />} />
          <Route path="pengaturan" element={<SettingsPage />} />
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
          <SiswaAuthProvider>
            <AppContent />
          </SiswaAuthProvider>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
