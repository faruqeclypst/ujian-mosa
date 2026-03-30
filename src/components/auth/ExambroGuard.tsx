import { useEffect, useState } from "react";
import { ReactNode } from "react";

// List of allowed user agents (case-insensitive substrings)
const ALLOWED_USER_AGENTS = [
  "exambro", 
  "exambrowser", 
  "exambroandroid", 
  "wv", 
  "protected_exambro", 
  "seb", 
  "safeexambrowser",
  "exambro_klas"
];

interface ExambroGuardProps {
  children: ReactNode;
}

// Add SEB global window declaration
declare global {
  interface Window {
    SafeExamBrowser?: any;
  }
}

const ExambroGuard = ({ children }: ExambroGuardProps) => {
  const [isExambro, setIsExambro] = useState<boolean | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    
    // 1. Check User Agent
    const isValidUA = ALLOWED_USER_AGENTS.some((agent) => ua.includes(agent.toLowerCase()));
    
    // 2. Check for SEB API injection (Modern Safe Exam Browser)
    const isSEBExtension = typeof window !== 'undefined' && (!!window.SafeExamBrowser);
    
    // 3. For development, allow bypass with simple condition or override flag
    const isDev = import.meta.env.MODE === "development";
    const bypassGuard = import.meta.env.VITE_DISABLE_EXAMBRO_GUARD === "true";
    
    setIsExambro(isValidUA || isSEBExtension || isDev || bypassGuard); 
  }, []);

  if (isExambro === null) {
    return null; // or loading
  }

  if (!isExambro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-100/50 max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 0h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 12c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Akses Dibatasi</h2>
          <div className="space-y-4 mb-8">
            <p className="text-slate-500 text-sm leading-relaxed">
              Halaman ini hanya dapat diakses melalui aplikasi <span className="font-bold text-blue-600">Safe Exam Browser</span> atau <span className="font-bold text-blue-600">Exambro</span> resmi untuk menjaga integritas ujian.
            </p>
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-blue-700 font-medium">
              Pastikan Anda membuka link ini dari dalam aplikasi ujian yang telah ditentukan.
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-left space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Info / User Agent:</p>
            <div className="text-[10px] text-slate-500 font-mono break-all bg-white p-2 rounded-lg border border-slate-100 leading-normal">
              {navigator.userAgent}
            </div>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ExambroGuard;
