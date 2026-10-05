import { useState, useEffect } from "react";
import { UserCircle, KeyRound, Save, CheckCircle, AlertCircle, Shield, Smartphone, Cloud, RefreshCw, Database, Server, Check, Landmark } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { BankAccountsSettings } from "../../components/admin/BankAccountsSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

type Section = "profile" | "password" | "apk" | "media" | "bank";

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

  const [apkRecordId, setApkRecordId] = useState<string | null>(null);
  const [apkData, setApkData] = useState({
    app_name: "Examku CBT",
    min_version_code: 1,
    min_version_name: "1.0.0",
    apk_url: "",
    update_notes: "",
    is_force_update: false,
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

    const fetchApkSettings = async () => {
      try {
        const records = await masterPb.collection("app_settings").getFullList({ limit: 1 });
        if (records.length > 0) {
          const rec = records[0];
          setApkRecordId(rec.id);
          setApkData({
            app_name: rec.app_name || "EXAMKU",
            min_version_code: rec.min_version_code ?? 1,
            min_version_name: rec.min_version_name || "1.0.0",
            apk_url: rec.apk_url || "",
            update_notes: rec.update_notes || "",
            is_force_update: rec.is_force_update ?? false,
          });
        }
      } catch (e) {
        console.warn("Gagal memuat setelan APK dari Master PB:", e);
      }
    };
    fetchApkSettings();
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

  const handleSaveApk = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      if (apkRecordId) {
        await masterPb.collection("app_settings").update(apkRecordId, apkData);
      } else {
        const created = await masterPb.collection("app_settings").create(apkData);
        setApkRecordId(created.id);
      }
      setSuccess("Konfigurasi versi APK siswa berhasil disimpan ke Master PB!");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan konfigurasi APK ke Master PB.");
    } finally {
      setLoading(false);
    }
  };

  const [mediaAudit, setMediaAudit] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState("");

  const handleRunMediaAudit = async () => {
    setIsAuditing(true);
    setAuditError("");
    try {
      const res = await masterPb.send("/api/media-manager/audit", { method: "GET" });
      setMediaAudit(res);
    } catch (err: any) {
      setAuditError(err.message || "Gagal menjalankan audit media lintas server.");
    } finally {
      setIsAuditing(false);
    }
  };

  const sideNavItems: { key: Section; label: string; icon: typeof UserCircle }[] = [
    { key: "profile", label: "Profil Pribadi", icon: UserCircle },
    { key: "password", label: "Ganti Kata Sandi", icon: KeyRound },
    { key: "apk", label: "Versi APK Siswa", icon: Smartphone },
    { key: "media", label: "Penyimpanan Media", icon: Cloud },
  ];

  const adminName = masterPb.authStore.model?.name || masterPb.authStore.model?.email || "Super Admin";
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <SuperAdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Setelan Akun</h2>
        <p className="text-slate-500 text-sm mt-0.5">Kelola profil dan keamanan akun Super Admin.</p>
      </div>

      {/* Mobile Horizontal Section Tabs */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {sideNavItems.map(item => (
          <button
            key={item.key}
            onClick={() => { setActiveSection(item.key); clearMessages(); }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap min-h-[42px] transition-all flex-shrink-0 shadow-xs",
              activeSection === item.key
                ? "bg-blue-600 text-white shadow-blue-500/20"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <item.icon size={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav (Desktop) & Admin Info */}
        <div className="lg:col-span-1">
          {/* Admin Avatar Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-md shadow-blue-500/30">
              {adminInitial}
            </div>
            <p className="font-bold text-slate-900 text-sm">{formData.name || "–"}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{formData.email}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
              <Shield size={12} />
              Super Administrator
            </div>
          </div>

          {/* Desktop Nav buttons */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {sideNavItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveSection(item.key); clearMessages(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all text-left border-b border-slate-100 last:border-0",
                  activeSection === item.key
                    ? "bg-blue-50 text-blue-700 font-bold"
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

          {/* APK Version Section */}
          {activeSection === "apk" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manajemen Versi APK EXAMKU</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Kontrol versi minimum APK Android siswa yang diizinkan mengakses ujian.</p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border",
                  apkData.is_force_update
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                )}>
                  {apkData.is_force_update ? "Pembaruan Wajib Aktif" : "Pembaruan Opsional"}
                </span>
              </div>
              <form onSubmit={handleSaveApk} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Aplikasi</label>
                    <input
                      type="text"
                      value={apkData.app_name}
                      onChange={(e) => setApkData(p => ({ ...p, app_name: e.target.value }))}
                      placeholder="EXAMKU"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Versi Minimal Label (VersionName)
                    </label>
                    <input
                      type="text"
                      value={apkData.min_version_name}
                      onChange={(e) => setApkData(p => ({ ...p, min_version_name: e.target.value }))}
                      placeholder="Contoh: 2.0.0"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kode Versi Minimal (VersionCode / Build Number)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={apkData.min_version_code}
                      onChange={(e) => setApkData(p => ({ ...p, min_version_code: parseInt(e.target.value, 10) || 1 }))}
                      placeholder="1"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Angka integer di build.gradle Android. HP siswa dengan build lebih rendah akan dikunci.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tautan Unduh APK Baru (Download URL)
                    </label>
                    <input
                      type="url"
                      value={apkData.apk_url}
                      onChange={(e) => setApkData(p => ({ ...p, apk_url: e.target.value }))}
                      placeholder="https://.../EXAM_AA_v2.apk"
                      className="w-full h-10 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Link direct download (Cloudflare R2, Google Drive, atau server web Anda).
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Catatan Pembaruan (Changelog)</label>
                  <textarea
                    rows={3}
                    value={apkData.update_notes}
                    onChange={(e) => setApkData(p => ({ ...p, update_notes: e.target.value }))}
                    placeholder="Contoh: Pembaruan wajib fitur ujian online terbaru dan perbaikan sistem keamanan anti-cheat."
                    className="w-full border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Aktifkan Force Update (Wajib Perbarui)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Jika aktif, siswa dengan versi lama tidak dapat membuka login atau ujian sama sekali.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apkData.is_force_update}
                      onChange={(e) => setApkData(p => ({ ...p, is_force_update: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95"
                  >
                    {loading ? "Menyimpan..." : <><Save size={14} /> Simpan Setelan APK</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bank Accounts Section */}
          {activeSection === "bank" && (
             <BankAccountsSettings />
          )}

          {/* Media & Cloud Storage Section */}
          {activeSection === "media" && (
            <div className="space-y-5">
              {/* Architecture & Protection Status */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Arsitektur Penyimpanan Media Cloud</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Status perlindungan multi-tenant dan sistem pencegahan duplikasi berkas.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1.5">
                    <Check size={12} className="stroke-[3]" />
                    Sistem Aktif
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Penyimpanan Objek</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Cloudflare R2</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">assets.examku.my.id</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Proteksi Multi-Tenant</p>
                    <p className="text-sm font-bold text-emerald-700 mt-1">Aktif & Aman</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Penghapusan fisik tenant dicegah</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Deduplikasi Berkas</p>
                    <p className="text-sm font-bold text-blue-700 mt-1">SHA-256 CAS</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Berkas identik memakai kunci sama</p>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900 leading-relaxed">
                  <span className="font-bold">Keamanan Data Silang Sekolah: </span>
                  Sekolah hasil salinan (clone) atau pemulihan cadangan dapat menghapus bank soal secara bebas tanpa khawatir merusak gambar di sekolah asal.
                </div>
              </div>

              {/* Cross-School Media Audit */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Audit Penggunaan Media Lintas Server</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pindai database seluruh sekolah di Master VPS dan Worker Node untuk memverifikasi referensi gambar aktif.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunMediaAudit}
                    disabled={isAuditing}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto"
                  >
                    <RefreshCw size={14} className={cn(isAuditing && "animate-spin")} />
                    {isAuditing ? "Memindai Semua Sekolah..." : "Pindai Seluruh Sekolah"}
                  </button>
                </div>

                <div className="p-5">
                  {auditError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={14} />
                      {auditError}
                    </div>
                  )}

                  {!mediaAudit && !isAuditing && (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Database size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">Belum ada data audit tersimpan pada sesi ini</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Klik tombol di atas untuk memindai database seluruh sekolah dan memverifikasi gambar aktif.</p>
                    </div>
                  )}

                  {mediaAudit && (
                    <div className="space-y-4">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="text-[11px] font-semibold text-slate-500">Total Referensi Aktif</p>
                          <p className="text-xl font-black text-slate-900 mt-1">{mediaAudit.total_active_references || 0}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Digunakan pada soal dan identitas sekolah</p>
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="text-[11px] font-semibold text-slate-500">Berkas Unik Terpakai</p>
                          <p className="text-xl font-black text-blue-600 mt-1">{mediaAudit.unique_images_in_use || 0}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Kunci unik tersimpan di Cloudflare R2</p>
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="text-[11px] font-semibold text-slate-500">Gambar Dipakai Bersama</p>
                          <p className="text-xl font-black text-emerald-600 mt-1">{mediaAudit.shared_images_count || 0}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Dilindungi dari penghapusan silang</p>
                        </div>
                      </div>

                      {/* Per-School Table */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Rincian Penggunaan Tiap Sekolah</h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                              <tr>
                                <th className="px-4 py-2.5">Identitas Sekolah</th>
                                <th className="px-4 py-2.5">Node VPS</th>
                                <th className="px-4 py-2.5 text-right">Referensi Gambar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {Object.entries(mediaAudit.schools || {}).map(([slug, info]: [string, any]) => (
                                <tr key={slug} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 font-bold text-slate-800">{slug}</td>
                                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{info.node || "master"}</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{info.active_references ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminSettingsPage;
