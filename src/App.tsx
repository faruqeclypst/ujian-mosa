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

import { TenantProvider, useTenant } from "./context/TenantContext";
import { StudentAuthProvider, useStudentAuth } from "./context/StudentAuthContext";
import { AuthProvider } from "./context/AuthContext";
import ExambroGuard from "./components/auth/ExambroGuard";
import StudentLoginPage from "./pages/student/StudentLoginPage";

const StudentDashboardPage = lazy(() => import("./pages/student/StudentDashboardPage"));
const CBTPage = lazy(() => import("./pages/student/CBTPage"));
const InterestSurveyPage = lazy(() => import("./pages/student/InterestSurveyPage"));

import NotFoundPage from "./pages/NotFoundPage";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

// Admin pages
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

// Landing & SaaS pages
import LandingPage from "./pages/landing/LandingPage";
import RegisterSchoolPage from "./pages/landing/RegisterSchoolPage";
import SchoolNotFoundPage from "./pages/landing/SchoolNotFoundPage";
import SuperAdminLoginPage from "./pages/superadmin/SuperAdminLoginPage";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SelectSchoolPage from "./pages/landing/SelectSchoolPage";

import { ExamDataProvider } from "./context/ExamDataContext";
import CapacitorOverlay from "./components/auth/CapacitorOverlay";

// ============================================================
// Guards
// ============================================================
const StudentAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { student, loading } = useStudentAuth();
  if (loading) return <LoadingScreen />;
  if (!student) return <Navigate to="/exam" replace />;
  return <>{children}</>;
};

const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// ============================================================
// School App Content (when on a school subdomain)
// ============================================================
const SchoolAppContent = () => {
  const { user, loading: adminLoading } = useAuth();
  const { student, loading: studentLoading } = useStudentAuth();
  const { school, notFound, inactive, loading: tenantLoading } = useTenant();
  const location = useLocation();

  useEffect(() => {
    if (school) {
      document.title = `EXAM AA - ${school.name}`;
    }
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(err => console.warn("Splash hide error:", err));
    }
  }, [school]);

  if (tenantLoading) return <LoadingScreen />;
  if (notFound || inactive) return <SchoolNotFoundPage />;

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isGlobalLoading = adminLoading || studentLoading;

  return (
    <>
      {isGlobalLoading && !isAdminRoute ? (
        <LoadingScreen />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Siswa — /exam */}
            <Route
              path="/exam"
              element={
                <ExambroGuard>
                  {student && student.hasChangedPassword ? <StudentDashboardPage /> : <StudentLoginPage />}
                </ExambroGuard>
              }
            />
            <Route
              path="/cbt"
              element={
                <ExambroGuard>
                  <StudentAuthGuard><CBTPage /></StudentAuthGuard>
                </ExambroGuard>
              }
            />
            <Route
              path="/cbt/:roomId"
              element={
                <ExambroGuard>
                  <StudentAuthGuard><CBTPage /></StudentAuthGuard>
                </ExambroGuard>
              }
            />
            <Route
              path="/minat-bakat"
              element={
                <ExambroGuard>
                  <StudentAuthGuard><InterestSurveyPage /></StudentAuthGuard>
                </ExambroGuard>
              }
            />

            {/* Admin — /admin */}
            <Route path="/admin/register" element={user ? <Navigate to="/admin" replace /> : <RegisterPage />} />
            <Route path="/admin/change-password" element={user ? <ChangePasswordPage /> : <Navigate to="/admin" replace />} />
            <Route path="/admin/profile" element={user ? <ProfilePage /> : <Navigate to="/admin" replace />} />

            <Route
              path="/admin"
              element={
                adminLoading ? (
                  <LoadingScreen />
                ) : (user && user.hasChangedPassword) ? (
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
              <Route path="student" element={<StudentsPage />} />
              <Route path="alumni" element={<AdminOnlyRoute><AlumniPage /></AdminOnlyRoute>} />
              <Route path="classes" element={<AdminOnlyRoute><ClassesPage /></AdminOnlyRoute>} />
              <Route path="kelola-akun" element={<AdminOnlyRoute><UsersPage /></AdminOnlyRoute>} />
              <Route path="bank-soal" element={<ExamsPage />} />
              <Route path="bank-soal/questions" element={<QuestionsPage />} />
              <Route path="ruang-ujian" element={<ExamRoomsPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="panduan" element={<GuidePage />} />
              <Route path="pengaturan" element={<AdminOnlyRoute><SettingsPage /></AdminOnlyRoute>} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/exam" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
};

// ============================================================
// Landing / Super Admin Content (ujian.alfaruqasri.my.id)
// ============================================================
import SuperAdminInfraPage from "./pages/superadmin/SuperAdminInfraPage";
import SuperAdminAnalyticsPage from "./pages/superadmin/SuperAdminAnalyticsPage";
import SuperAdminSettingsPage from "./pages/superadmin/SuperAdminSettingsPage";

const LandingContent = () => {
  useEffect(() => {
    document.title = "EXAM AA — Platform CBT Online untuk Sekolah";
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => { });
    }
  }, []);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/daftar" element={<RegisterSchoolPage />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/infra" element={<SuperAdminInfraPage />} />
        <Route path="/superadmin/analytics" element={<SuperAdminAnalyticsPage />} />
        <Route path="/superadmin/settings" element={<SuperAdminSettingsPage />} />
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
        <Route path="/pilih-sekolah" element={<SelectSchoolPage />} />
        <Route path="/pilih sekolah" element={<SelectSchoolPage />} />
        <Route path="/pilihsekolah" element={<SelectSchoolPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  );
};

// ============================================================
// App Root — determines which experience to render
// ============================================================
const AppRouter = () => {
  const { isLandingDomain, loading } = useTenant();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (isLandingDomain) {
    // Jika di mobile app, paksa ke halaman pilih sekolah (simulation mode untuk localhost tetap tersedia via /pilih-sekolah)
    const isAppMode = Capacitor.isNativePlatform();
    const isSpecialRoute = location.pathname.startsWith('/superadmin') || location.pathname === '/daftar';

    if (isAppMode && location.pathname !== '/pilih-sekolah' && !isSpecialRoute) {
      return (
        <Routes>
          <Route path="*" element={<SelectSchoolPage />} />
        </Routes>
      );
    }
    return <LandingContent />;
  }

  // School subdomain — wrap with auth providers that use tenant pb
  return (
    <StudentAuthProvider>
      <SchoolAppContent />
    </StudentAuthProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider>
        <SidebarProvider>
          <TenantProvider>
            <AuthProvider>
              <AppRouter />
              <CapacitorOverlay />
            </AuthProvider>
          </TenantProvider>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
