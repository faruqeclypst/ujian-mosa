import { useState, useEffect } from "react";
import { UserCircle, KeyRound, Save, CheckCircle, AlertCircle, Shield } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

type Section = "profile" | "password";

const SuperAdminSettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    oldPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });

  useEffect(() => {
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

  const clearMessages = () => {
    setSuccess("");
    setError("");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      const adminId = masterPb.authStore.model?.id;
      const currentEmail = masterPb.authStore.model?.email;
      if (!adminId) throw new Error("Sesi tidak valid. Harap login kembali.");

      await masterPb.collection("super_admins").update(adminId, { name: formData.name });

      if (formData.email !== currentEmail) {
        await masterPb.collection("super_admins").requestEmailChange(formData.email);
        setSuccess("Profil tersimpan! Tautan verifikasi dikirim ke email baru Anda.");
      } else {
        setSuccess("Profil admin berhasil diperbarui!");
      }
    } catch (err: any) {
      if (err.message?.includes("Only superusers") || err.status === 403) {
        setError("Izin ditolak. Pastikan Update API Rule diatur: @request.auth.id = id");
      } else {
        setError(err.message || "Gagal memperbarui profil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (formData.newPassword !== formData.newPasswordConfirm) {
      setError("Konfirmasi sandi baru tidak cocok!");
      return;
    }
    setLoading(true);
    try {
      const adminId = masterPb.authStore.model?.id;
      if (!adminId) throw new Error("Sesi tidak valid");
      await masterPb.collection("super_admins").update(adminId, {
        oldPassword: formData.oldPassword,
        password: formData.newPassword,
        passwordConfirm: formData.newPasswordConfirm,
      });
      setSuccess("Kata sandi berhasil diubah!");
      setFormData(prev => ({ ...prev, oldPassword: "", newPassword: "", newPasswordConfirm: "" }));
    } catch (err: any) {
      if (err.message?.includes("Only superusers") || err.status === 403) {
        setError("Izin ditolak. Cek API Rule koleksi super_admins.");
      } else {
        setError("Gagal mengubah sandi. Pastikan sandi lama benar.");
      }
    } finally {
      setLoading(false);
    }
  };

  const sideNavItems: { key: Section; label: string; icon: typeof UserCircle }[] = [
    { key: "profile", label: "Profil Pribadi", icon: UserCircle },
    { key: "password", label: "Ganti Kata Sandi", icon: KeyRound },
  ];

  const adminName = masterPb.authStore.model?.name || masterPb.authStore.model?.email || "Super Admin";
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <SuperAdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Setelan Akun</h2>
        <p className="text-slate-500 text-sm mt-0.5">Kelola profil dan keamanan akun Super Admin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1">
          {/* Admin Avatar Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-md shadow-blue-500/30">
              {adminInitial}
            </div>
            <p className="font-semibold text-slate-900 text-sm">{formData.name || "–"}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{formData.email}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
              <Shield size={12} />
              Super Administrator
            </div>
          </div>

          {/* Nav buttons */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {sideNavItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveSection(item.key); clearMessages(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all text-left border-b border-slate-100 last:border-0",
                  activeSection === item.key
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={16} className={activeSection === item.key ? "text-blue-600" : "text-slate-400"} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Feedback */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium shadow-sm">
              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium shadow-sm">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">Ubah Data Diri</h3>
                <p className="text-xs text-slate-400 mt-0.5">Perbarui nama dan alamat email akun Anda.</p>
              </div>
              <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Lengkap</label>
                    <input
                      type="text" name="name" required value={formData.name} onChange={handleChange}
                      placeholder="Nama Admin"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Login</label>
                    <input
                      type="email" name="email" required value={formData.email} onChange={handleChange}
                      placeholder="admin@email.com"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit" disabled={loading}
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95"
                  >
                    {loading ? "Menyimpan..." : <><Save size={14} /> Simpan Profil</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Password Section */}
          {activeSection === "password" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">Perbarui Kata Sandi</h3>
                <p className="text-xs text-slate-400 mt-0.5">Gunakan sandi yang kuat dan unik.</p>
              </div>
              <form onSubmit={handleSavePassword} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi Saat Ini</label>
                  <input
                    type="password" name="oldPassword" required value={formData.oldPassword} onChange={handleChange}
                    placeholder="Masukkan sandi saat ini"
                    className="w-full sm:max-w-sm h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
                <div className="h-px bg-slate-100" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sandi Baru</label>
                    <input
                      type="password" name="newPassword" required value={formData.newPassword} onChange={handleChange}
                      placeholder="Minimal 8 karakter"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Konfirmasi Sandi</label>
                    <input
                      type="password" name="newPasswordConfirm" required value={formData.newPasswordConfirm} onChange={handleChange}
                      placeholder="Ketik ulang sandi baru"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading || !formData.oldPassword || !formData.newPassword}
                    className="h-9 px-5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95"
                  >
                    {loading ? "Memproses..." : <><KeyRound size={14} /> Ubah Sandi</>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminSettingsPage;
