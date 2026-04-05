import { useState, useEffect } from "react";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import pb from "../../lib/pocketbase";
import { User, Lock, GraduationCap, School } from "lucide-react";

const StudentLoginPage = () => {
  const { loginStudent, student, changePassword } = useStudentAuth();
  
  const [nisn, setNisn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // For change password modal
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePassError, setChangePassError] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLogoLoading(true);
        const records = await pb.collection("settings").getFullList({
          sort: "created",
          limit: 1
        });

        if (records.length > 0) {
          const data = records[0];
          setSchoolName(data.name || "E-Ujian CBT");
          
          // Handle logo dari logoUrl atau logo (bisa berupa URL atau filename)
          let logoUrl = data.logoUrl || data.logo || "";
          
          // Jika logo adalah filename (bukan URL), gunakan pb.files.getUrl
          if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            logoUrl = pb.files.getUrl(data, logoUrl);
          }
          
          setSchoolLogo(logoUrl);
        }
      } catch (err) {
        console.error("Gagal memuat settings sekolah:", err);
      } finally {
        setLogoLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginStudent(nisn, password);
    } catch (err: any) {
      setError(err.message || "Gagal login. Periksa kembali NISN dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError("");

    if (newPassword.length < 6) {
      setChangePassError("Password baru minimal 6 karakter!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError("Konfirmasi password tidak cocok!");
      return;
    }

    setIsChangingPass(true);
    try {
      await changePassword(newPassword);
    } catch (err: any) {
      setChangePassError(err.message || "Gagal mengubah password.");
    } finally {
      setIsChangingPass(false);
    }
  };

  const showChangePassModal = !!(student && !student.hasChangedPassword);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] overflow-hidden relative font-sans leading-relaxed">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-400/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-400/20 rounded-full blur-[120px] animate-pulse delay-75"></div>
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-lime-400/10 rounded-full blur-[100px] animate-pulse delay-150"></div>
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      </div>

      <div className="w-full max-w-lg mx-auto z-10 p-6 flex flex-col items-center">
        {/* School Logo Section - Made more prominent */}
        <div className="mb-8 relative transition-all duration-700 transform hover:scale-105">
          <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 animate-pulse"></div>
          <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/40 backdrop-blur-md rounded-3xl p-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/40 flex items-center justify-center overflow-hidden">
            {logoLoading ? (
              <div className="w-full h-full bg-emerald-100/50 rounded-2xl animate-pulse flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-600 animate-spin" />
              </div>
            ) : schoolLogo && !logoError ? (
              <img 
                src={schoolLogo} 
                alt="Logo Sekolah" 
                className="w-full h-full object-contain filter drop-shadow-md" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-700 flex flex-col items-center justify-center shadow-inner rounded-2xl p-2 text-white">
                <School size={48} className="mb-1 opacity-90" />
                <span className="text-xl font-black tracking-tighter">CBT</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Portal Ujian Siswa
          </h1>
          <div className="flex items-center justify-center gap-2">
            <GraduationCap size={18} className="text-emerald-600" />
            <p className="text-slate-500 font-medium text-sm md:text-base">
              {schoolName || "SMAN Modal Bangsa Aceh"}
            </p>
          </div>
        </div>

        <Card className="w-full bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_rgba(16,185,129,0.07)] rounded-[32px] overflow-hidden">
          <CardContent className="p-8 md:p-10">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                  <User size={14} className="text-slate-400" /> NISN / Username
                </label>
                <Input 
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)} 
                  placeholder="Masukkan nomor induk siswa"
                  className="bg-white/50 border-slate-200/60 text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-[20px] h-14 px-5 text-base transition-all duration-300"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                  <Lock size={14} className="text-slate-400" /> Password
                </label>
                <Input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/50 border-slate-200/60 text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-[20px] h-14 px-5 text-base transition-all duration-300"
                  disabled={loading}
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold h-14 rounded-[20px] border-0 text-lg transition-all active:scale-[0.98]" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memverifikasi...</span>
                    </div>
                  ) : "Masuk Sekarang"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-slate-400 text-sm font-medium">
          © {new Date().getFullYear()} CBT {schoolName}. All rights reserved.
        </p>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-8" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Lock className="text-emerald-600" size={32} />
            </div>
            <DialogTitle className="text-center text-2xl font-extrabold text-slate-900">Ganti Password Wajib!</DialogTitle>
            <p className="text-slate-500 text-center mt-2 font-medium">
              Ini adalah login pertama Anda. Demi keamanan akun, silakan perbarui password Anda.
            </p>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-6">
            {changePassError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-red-500" />
                {changePassError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password Baru</label>
              <Input 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="rounded-2xl h-12 bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Konfirmasi Password Baru</label>
              <Input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="rounded-2xl h-12 bg-slate-50 border-slate-200"
              />
            </div>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-2xl text-lg transition-all" 
                disabled={isChangingPass}
              >
                {isChangingPass ? "Menyimpan..." : "Simpan & Lanjutkan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentLoginPage;
