import { useEffect, useState } from "react";
import { ReactNode } from "react";

const ALLOWED_USER_AGENTS = ["Exambro", "ExamBrowser", "ExambroAndroid"]; // Configure strings

interface ExambroGuardProps {
  children: ReactNode;
}

const ExambroGuard = ({ children }: ExambroGuardProps) => {
  const [isExambro, setIsExambro] = useState<boolean | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isValid = ALLOWED_USER_AGENTS.some((agent) => ua.includes(agent));
    
    // For development, allow bypass with simple condition or override flag
    const isDev = import.meta.env.MODE === "development";
    const bypassGuard = import.meta.env.VITE_DISABLE_EXAMBRO_GUARD === "true";
    setIsExambro(isValid || isDev || bypassGuard); 
  }, []);

  if (isExambro === null) {
    return null; // or loading
  }

  if (!isExambro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Akses Ditolak</h2>
          <p className="text-slate-600 text-sm mb-4">
            Ujian CBT ini hanya dapat diakses melalui aplikasi **Exambro**. Silakan buka aplikasi tersebut untuk melanjutkan.
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border text-left text-xs text-slate-500 font-mono">
            User Agent: <br /> {navigator.userAgent}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ExambroGuard;
