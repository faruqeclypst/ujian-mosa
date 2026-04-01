import { useState, useEffect } from "react";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { database } from "../../lib/firebase";
import { ref, onValue, DataSnapshot } from "firebase/database";

const studentLoginPage = () => {
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
    const r = ref(database, "settings/school");
    const unsubscribe = onValue(r, (snap: DataSnapshot) => {
      setLogoLoading(true);
      if (snap.exists()) {
        const d = snap.val();
        setSchoolName(d.name || "");
        setSchoolLogo(d.logoUrl || "");
      }
      setLogoLoading(false);
    }, (error: Error) => {
      console.error("Firebase read error:", error);
      setLogoLoading(false);
    });

    return () => unsubscribe();
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 overflow-hidden relative">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-0 -left-10 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob"></div>
      <div className="absolute top-0 -right-10 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-10 left-20 w-80 h-80 bg-pink-100 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>

      <Card className="w-full max-w-md mx-4 bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-xl rounded-3xl p-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-24 h-24 flex items-center justify-center mb-4 overflow-hidden relative">
            {logoLoading ? (
              <div className="h-full w-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            ) : schoolLogo && !logoError ? (
              <img 
                src={schoolLogo} 
                alt="Logo Sekolah" 
                className="h-full w-full object-contain" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 rounded-2xl">
                <span className="text-3xl font-black text-white">CBT</span>
              </div>
            )}
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800">Login Siswa</CardTitle>
          <p className="text-slate-500 text-xs sm:text-sm">{schoolName || "Ujian Computer Based Test"}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
                {error}
              </div>
            )}
            
            <FormField id="nisn" label="NISN" error={undefined}>
              <Input 
                value={nisn}
                onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))} // only numbers
                placeholder="Masukkan NISN Anda"
                className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 hover:bg-slate-100/50 focus:bg-white rounded-xl px-4 h-11 transition-all"
                disabled={loading}
              />
            </FormField>

            <FormField id="password" label="Password" error={undefined}>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan Password"
                className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 hover:bg-slate-100/50 focus:bg-white rounded-xl px-4 h-11 transition-all"
                disabled={loading}
              />
            </FormField>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold h-11 rounded-xl shadow-lg border-0" 
                disabled={loading}
              >
                {loading ? "Menghubungkan..." : "Masuk Ujian"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">Ganti Password Wajib!</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 text-center -mt-1 mb-4">
            Ini adalah login pertama Anda. Demi keamanan, silakan ganti password bawaan Anda.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {changePassError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-lg">
                {changePassError}
              </div>
            )}

            <FormField id="new-password" label="Password Baru" error={undefined}>
              <Input 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
              />
            </FormField>

            <FormField id="confirm-password" label="Konfirmasi Password Baru" error={undefined}>
              <Input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
              />
            </FormField>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
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

export default studentLoginPage;

