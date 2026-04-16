import { useState, useEffect } from "react";
import { UserCircle, KeyRound, Save, CheckCircle, AlertCircle } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { useNavigate } from "react-router-dom";

const SuperAdminSettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    oldPassword: "",
    newPassword: "",
    newPasswordConfirm: ""
  });

  useEffect(() => {
    // Memuat data akun admin yang sedang login dari masterPb
    const admin = masterPb.authStore.model;
    if (!admin) {
      navigate("/superadmin/login");
      return;
    }
    setFormData(prev => ({
      ...prev,
      name: admin.name || "",
      email: admin.email || "",
    }));
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const adminId = masterPb.authStore.model?.id;
      const currentEmail = masterPb.authStore.model?.email;
      if (!adminId) throw new Error("Sesi tidak valid. Harap login kembali.");

      // 1. Update Nama selalu bisa dilakukan jika API Rules mengizinkan (@request.auth.id = id)
      await masterPb.collection("super_admins").update(adminId, {
        name: formData.name,
      });
      
      // 2. Pocketbase melarang pengubahan 'email' secara langsung via .update() untuk keamanan 
      //    (hanya "superusers/native admin" yang bisa bypass).
      //    Jika email diubah, kita harus kirim email konfirmasi ke email yang baru.
      if (formData.email !== currentEmail) {
        await masterPb.collection("super_admins").requestEmailChange(formData.email);
        setSuccess("Profil tersimpan! Tautan verifikasi telah dikirim ke email baru Anda untuk mengonfirmasi perubahan.");
      } else {
        setSuccess("Profil admin berhasil diperbarui di database utama!");
      }
    } catch (err: any) {
      if (err.message.includes("Only superusers can perform this action") || err.status === 403) {
        setError("Izin Ditolak! Pastikan 'Update API Rule' di Pocketbase untuk tabel super_admins telah diatur ke: @request.auth.id = id");
      } else {
        setError(err.message || "Gagal memperbarui profil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (formData.newPassword !== formData.newPasswordConfirm) {
      setError("Konfirmasi sandi baru tidak cocok!");
      setLoading(false);
      return;
    }

    try {
      const adminId = masterPb.authStore.model?.id;
      if (!adminId) throw new Error("Sesi tidak valid");

      await masterPb.collection("super_admins").update(adminId, {
        oldPassword: formData.oldPassword,
        password: formData.newPassword,
        passwordConfirm: formData.newPasswordConfirm
      });
      
      setSuccess("Kata sandi berhasil diubah! Anda bisa menggunakan sandi baru untuk login berikutnya.");
      setFormData(prev => ({ ...prev, oldPassword: "", newPassword: "", newPasswordConfirm: "" }));
    } catch (err: any) {
      if (err.message.includes("Only superusers can perform this action") || err.status === 403) {
        setError("Izin Ditolak! Pastikan 'Update API Rule' koleksi super_admins adalah: @request.auth.id = id");
      } else {
        setError("Gagal merubah kata sandi. Pastikan sandi lama sudah benar atau hubungi administrator database.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
             Setelan Akun
          </h2>
          <p className="text-slate-500 font-medium text-sm">Kelola profil dan keamanan kredensial Super Admin Anda secara aman.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-2">
          <button className="w-full text-left bg-blue-50 text-blue-700 font-bold px-4 py-3 rounded-xl border border-blue-100 flex items-center gap-3">
            <UserCircle size={18} /> Profil Pribadi
          </button>
          <button className="w-full text-left bg-transparent text-slate-600 hover:bg-slate-100 font-semibold px-4 py-3 rounded-xl flex items-center gap-3 transition-colors">
            <KeyRound size={18} /> Ganti Kata Sandi
          </button>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 text-sm font-bold shadow-sm">
              <CheckCircle size={18} className="text-emerald-500" /> {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 text-sm font-bold shadow-sm">
              <AlertCircle size={18} className="text-red-500" /> {error}
            </div>
          )}

          {/* Pengaturan Profil */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Ubah Data Diri</h3>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nama Admin"
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Alamat Email Login</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@email.com"
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : <><Save size={16} /> Simpan Profil</>}
                </button>
              </div>
            </form>
          </div>

          {/* Keamanan & Kata Sandi */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Perbarui Kata Sandi Akses</h3>
            </div>
            
            <form onSubmit={handleSavePassword} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  name="oldPassword"
                  required
                  value={formData.oldPassword}
                  onChange={handleChange}
                  placeholder="Masukkan sandi saat ini"
                  className="w-full max-w-md bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                />
              </div>
              <div className="w-full max-w-md h-px bg-slate-100 my-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Sandi Baru</label>
                  <input
                    type="password"
                    name="newPassword"
                    required
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Minimal 8 karakter"
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Konfirmasi Sandi Baru</label>
                  <input
                    type="password"
                    name="newPasswordConfirm"
                    required
                    value={formData.newPasswordConfirm}
                    onChange={handleChange}
                    placeholder="Ketik ulang sandi baru"
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading || !formData.oldPassword || !formData.newPassword} 
                  className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Memproses..." : <><KeyRound size={16} /> Ubah Sandi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminSettingsPage;
