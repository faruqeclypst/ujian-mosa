import { useState } from "react";
import {
  BookOpen, Copy, Check, Server, Cpu, Terminal, ShieldCheck,
  Clock, Database, AlertCircle, ArrowUpRight, HelpCircle,
  FileCode, Layers, Zap
} from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";

interface CommandSnippetProps {
  code: string;
  language?: string;
  title?: string;
}

const CommandSnippet = ({ code, title }: CommandSnippetProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-sm my-2 text-left">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>{title}</span>
          <span className="text-[10px] text-slate-400">Bash / Shell</span>
        </div>
      )}
      <div className="p-3.5 flex items-start justify-between gap-3 overflow-x-auto">
        <pre className="font-mono text-xs text-slate-100 whitespace-pre-wrap leading-relaxed select-all">
          {code}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer",
            copied
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white"
          )}
          title="Salin perintah"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span>Tersalin</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const SuperAdminMultiVpsDocsPage = () => {
  const [activeTab, setActiveTab] = useState<"quickstart" | "ssh" | "tenant" | "burst" | "troubleshoot">("quickstart");

  return (
    <SuperAdminLayout>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Cpu size={12} /> Panduan Arsitektur Multi-VPS
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Aktif & Teruji
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manual & Dokumentasi Multi-Node Worker</h2>
            <p className="text-slate-500 text-sm mt-1">
              Panduan menjalankan database ujian sekolah di VPS terpisah untuk isolasi beban tanpa memindahkan billing terpusat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/superadmin"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-xs flex items-center gap-1.5"
            >
              <Server size={14} className="text-slate-500" /> Kelola Tenant
            </a>
            <a
              href="/superadmin/infra"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5"
            >
              <Zap size={14} /> Monitor Node
            </a>
          </div>
        </div>
      </div>

      {/* Top Architecture Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white mb-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                Prinsip Arsitektur Ingress Gateway
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Seluruh lalu lintas domain masuk ke <strong>Master VPS (64.235.41.108)</strong>. Master Caddy otomatis menyajikan frontend React secara instan dan mem-proxy endpoint API langsung ke IP Worker VPS.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="bg-white/10 border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" /> SSL Terpusat
              </span>
              <span className="bg-white/10 border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <Check size={13} className="text-blue-400" /> Bebas Kendala CORS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                <Server size={14} /> Master VPS (64.235.41.108)
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Menyimpan data pendaftaran, superadmin, invoice resmi, dan gateway pembayaran SumoPod QRIS/VA.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-xs mb-1">
                <Cpu size={14} /> Worker VPS (IP Kustom)
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Menjalankan instance PocketBase sekolah khusus ujian. RAM dan CPU sekolah besar tidak membebani Master.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs mb-1">
                <Clock size={14} /> Pola Sewa 1 Bulan
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Hanya sewa VPS saat pekan ujian PAS/PAT. Data bisa ditarik kembali ke Master saat ujian usai.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("quickstart")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === "quickstart"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Terminal size={14} className={activeTab === "quickstart" ? "text-blue-600" : "text-slate-400"} />
          1. Setup VPS Baru (1 Baris)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ssh")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === "ssh"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <ShieldCheck size={14} className={activeTab === "ssh" ? "text-purple-600" : "text-slate-400"} />
          2. Hubungkan SSH Otomatis
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tenant")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === "tenant"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Server size={14} className={activeTab === "tenant" ? "text-emerald-600" : "text-slate-400"} />
          3. Cara Bikin Tenant di Worker
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("burst")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === "burst"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Clock size={14} className={activeTab === "burst" ? "text-amber-600" : "text-slate-400"} />
          4. Siklus Hemat 1 Bulan (Burst Mode)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("troubleshoot")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === "troubleshoot"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <HelpCircle size={14} className={activeTab === "troubleshoot" ? "text-rose-600" : "text-slate-400"} />
          5. Bantuan & FAQ
        </button>
      </div>

      {/* Tab 1: Setup VPS Baru */}
      {activeTab === "quickstart" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Jalankan Script Onboarding di VPS Baru (Hanya 1 Baris)</h4>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  Login via SSH ke VPS Worker baru (Ubuntu 22.04 / 24.04 sebagai user <code className="text-blue-700 font-mono">root</code>), lalu jalankan perintah otomatis satu baris berikut:
                </p>
              </div>
            </div>

            <CommandSnippet
              title="Perintah Setup Otomatis pada VPS Worker"
              code="curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash"
            />

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs text-slate-700">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileCode size={14} className="text-blue-600" /> Apa yang otomatis dikerjakan oleh script ini?
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                <li>Mengunduh PocketBase binary v0.22.20 dan menyiapkan struktur direktori template sekolah.</li>
                <li><strong>Otomatis memasangkan SSH Public Key Master VPS</strong> ke <code className="font-mono text-slate-800">/root/.ssh/authorized_keys</code> sehingga Master bisa mengontrol worker tanpa password.</li>
                <li>Membuka port firewall UFW otomatis (SSH port 22 dan rentang port PocketBase 8090 s/d 8200).</li>
                <li>Memasang hook SQLite <code className="font-mono text-slate-800">busy_timeout=5000</code> dan optimasi jurnal WAL.</li>
                <li>Menyiapkan template systemd service otomatis untuk tenant (<code className="font-mono text-slate-800">pb-school@.service</code>).</li>
              </ul>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs space-y-2 text-xs text-emerald-900">
            <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-700" />
              Selesai! Tidak Perlu Konfigurasi Tambahan
            </h4>
            <p className="leading-relaxed">
              Setelah script di atas selesai berjalan, worker node sudah 100% siap. Anda langsung bisa membuka SuperAdmin Dashboard dan memindahkan sekolah menggunakan fitur <strong>1-Klik Burst Mode (ikon Petir ⚡)</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Hubungkan SSH */}
      {activeTab === "ssh" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
            <p className="font-bold flex items-center gap-1.5 mb-1">
              <Zap size={14} className="text-blue-700" /> Sudah Otomatis Terhubung
            </p>
            <p className="leading-relaxed text-blue-800">
              Jika Anda sudah menjalankan perintah <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">setup_worker_node.sh</code> di Tab 1, kunci SSH Master VPS sudah terpasang otomatis. Anda bisa langsung mengujinya dari menu SuperAdmin melalui tombol <strong>Tes Koneksi</strong> di modal 1-Klik Migrasi.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-base">Verifikasi atau Pasang Kunci SSH Manual (Opsional)</h4>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">
              Gunakan panduan manual ini hanya jika Anda ingin memverifikasi koneksi atau memasang kunci SSH secara mandiri tanpa menggunakan script otomatis.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
              <p className="font-bold text-xs text-slate-900">Langkah A: Public Key Master VPS (64.235.41.108)</p>
              <p className="text-xs text-slate-600">
                Kunci publik Master VPS:
              </p>
              <CommandSnippet
                title="Public Key Master VPS:"
                code="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICmezFyH8hAAToSr4Aw3f0dtTcGVxp8fTkatn1ZdS0w3 root@alfaruqasr-sg"
              />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
              <p className="font-bold text-xs text-slate-900">Langkah B: Tempelkan ke Worker VPS</p>
              <p className="text-xs text-slate-600">
                Pastikan kunci di atas terdaftar di file <code className="font-mono text-slate-800">/root/.ssh/authorized_keys</code> pada Worker VPS:
              </p>
              <CommandSnippet
                title="Di terminal Worker VPS:"
                code="echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICmezFyH8hAAToSr4Aw3f0dtTcGVxp8fTkatn1ZdS0w3 root@alfaruqasr-sg' >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys"
              />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
              <p className="font-bold text-xs text-slate-900">Langkah C: Uji Koneksi Langsung</p>
              <p className="text-xs text-slate-600">
                Tes koneksi dari Master VPS ke IP Worker:
              </p>
              <CommandSnippet
                title="Tes koneksi dari Master VPS:"
                code="ssh -o BatchMode=yes -o ConnectTimeout=5 root@IP_WORKER 'echo Koneksi Otomasi Berhasil!'"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cara Bikin Tenant */}
      {activeTab === "tenant" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h4 className="font-bold text-slate-900 text-base">Cara Mendaftarkan Tenant ke Worker Node</h4>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">
              Semua pengelolaan tetap dilakukan melalui antarmuka Superadmin yang sama.
            </p>
          </div>

          <div className="space-y-4 text-xs text-slate-700">
            <div className="flex gap-3 items-start border-l-2 border-blue-500 pl-4 py-1">
              <div className="font-bold text-slate-900 text-sm">1. Buka Halaman Kelola Tenant</div>
              <p className="text-slate-600">
                Buka menu <strong>Dashboard</strong> (<a href="/superadmin" className="text-blue-600 hover:underline">/superadmin</a>), lalu klik tombol <strong>+ Tambah Institusi</strong> (atau klik <strong>Edit</strong> pada sekolah yang ingin dipindah).
              </p>
            </div>

            <div className="flex gap-3 items-start border-l-2 border-purple-500 pl-4 py-1">
              <div className="font-bold text-slate-900 text-sm">2. Pilih Lokasi Server Node</div>
              <div className="space-y-1 text-slate-600">
                <p>Pada formulir pembuatan sekolah, temukan kotak <strong>Lokasi Server Node (Multi-VPS)</strong>:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>Master VPS:</strong> Pilihan default untuk sekolah reguler atau Starter (dijalankan di 64.235.41.108).</li>
                  <li><strong>Worker Node:</strong> Pilih ini untuk sekolah besar (misal 500 sampai 1.000 siswa).</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 items-start border-l-2 border-emerald-500 pl-4 py-1">
              <div className="font-bold text-slate-900 text-sm">3. Masukkan IP Worker VPS</div>
              <p className="text-slate-600">
                Ketikkan IP publik VPS Worker Anda (misal <code className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">103.123.45.67</code>). Klik <strong>Buat Tenant</strong> atau <strong>Simpan</strong>.
              </p>
            </div>

            <div className="flex gap-3 items-start border-l-2 border-amber-500 pl-4 py-1">
              <div className="font-bold text-slate-900 text-sm">4. Otomatisasi Bekerja di Belakang Layar</div>
              <p className="text-slate-600">
                Master Caddy akan langsung menulis konfigurasi reverse-proxy untuk subdomain sekolah ke <code className="font-mono text-slate-800">http://103.123.45.67:PORT</code>. Murid dan guru dapat langsung membuka URL <code className="font-mono text-blue-600">https://slug.examku.my.id</code> secara mulus!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Siklus Hemat 1 Bulan (1-Klik Burst Mode) */}
      {activeTab === "burst" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 rounded-2xl p-5 text-purple-950">
            <div className="flex items-center gap-2 font-bold text-sm text-purple-900 mb-1">
              <Zap size={16} className="text-purple-600" />
              Sistem 1-Klik Otomasi Aktif (Tidak Perlu Terminal / CLI)
            </div>
            <p className="text-xs text-purple-800/90 leading-relaxed">
              Kini Anda tidak perlu lagi menjalankan perintah <code className="font-mono bg-purple-100/80 px-1 py-0.5 rounded">rsync</code> atau menghentikan service secara manual. Cukup gunakan modal <strong>1-Klik Burst Mode</strong> langsung dari antarmuka SuperAdmin!
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-base">Cara Pakai 1-Klik Burst Mode di SuperAdmin</h4>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">
              Gunakan alur mudah ini saat sekolah membutuhkan server performa tinggi selama 1 sampai 2 pekan ujian semester (PAS/PAT):
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                  Fase 1: Sebelum Ujian (Pindah ke Worker)
                </span>
                <Zap size={14} className="text-blue-600" />
              </div>
              <h5 className="font-bold text-slate-900 text-sm">Pindahkan Beban Sekolah ke Worker VPS</h5>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 pl-0.5">
                <li>Buka menu <strong>Daftar Institusi</strong> di SuperAdmin (<a href="/superadmin" className="text-blue-600 hover:underline">/superadmin</a>).</li>
                <li>Cari sekolah yang akan ujian, lalu klik <strong>ikon Petir (⚡)</strong> atau klik badge <strong>Master Node (Lokal)</strong>.</li>
                <li>Ketikkan IP Worker VPS baru Anda (contoh <code className="font-mono text-purple-700 bg-purple-50 px-1 py-0.5 rounded">103.123.45.67</code>).</li>
                <li>Klik tombol <strong>"Tes Koneksi"</strong> untuk memastikan SSH terhubung (muncul indikator latensi hijau).</li>
                <li>Pilih mode <strong>"Mulai Ujian (Ke Worker VPS)"</strong> lalu klik <strong>"Mulai Migrasi Sekarang"</strong>.</li>
              </ol>
              <div className="bg-white border border-blue-200/80 rounded-lg p-2.5 text-[11px] text-blue-900 leading-normal">
                ✓ Sistem otomatis menyinkronkan database SQLite, mengalihkan routing Master Caddy, dan mengaktifkan service di worker tanpa downtime.
              </div>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Fase 2: Setelah Ujian Selesai (Tarik ke Master)
                </span>
                <Check size={14} className="text-emerald-600" />
              </div>
              <h5 className="font-bold text-slate-900 text-sm">Tarik Balik Database ke Master VPS</h5>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 pl-0.5">
                <li>Setelah masa ujian selesai, buka kembali menu <strong>Daftar Institusi</strong>.</li>
                <li>Klik <strong>ikon Petir (⚡)</strong> pada sekolah yang sedang berjalan di worker node.</li>
                <li>Sistem otomatis mendeteksi bahwa sekolah berada di worker, dan opsi langsung mengarah ke <strong>"Selesai Ujian (Tarik ke Master VPS)"</strong>.</li>
                <li>Klik <strong>"Mulai Migrasi Sekarang"</strong>.</li>
                <li>Semua data jawaban siswa, riwayat nilai, dan token ujian otomatis ditarik kembali 100% utuh ke Master VPS.</li>
              </ol>
              <div className="bg-white border border-emerald-200/80 rounded-lg p-2.5 text-[11px] text-emerald-900 leading-normal">
                ✓ Setelah migrasi selesai, Anda dapat mematikan atau menghapus VPS Worker tersebut tanpa khawatir data hilang. Sangat hemat biaya!
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Opsi Darurat: Perintah Manual CLI (Fallback)
            </h5>
            <p className="text-xs text-slate-500">
              Jika sewaktu-waktu Anda ingin melakukan sinkronisasi langsung melalui terminal server:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CommandSnippet
                title="Pindah manual ke Worker:"
                code="rsync -avz /opt/pocketbase/schools/slug/pb_data/* root@IP_WORKER:/opt/pocketbase/schools/slug/pb_data/"
              />
              <CommandSnippet
                title="Tarik manual ke Master:"
                code="rsync -avz root@IP_WORKER:/opt/pocketbase/schools/slug/pb_data/* /opt/pocketbase/schools/slug/pb_data/"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: FAQ & Troubleshooting */}
      {activeTab === "troubleshoot" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h4 className="font-bold text-slate-900 text-base">Pertanyaan Umum & Troubleshooting</h4>
            <p className="text-slate-600 text-xs mt-1">
              Panduan menyelesaikan kendala teknis yang mungkin terjadi pada arsitektur multi-node.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 space-y-1.5">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <AlertCircle size={15} className="text-amber-500" />
                Status Node di Halaman Infrastruktur menunjukkan TIMEOUT atau Gagal Terhubung?
              </p>
              <p className="text-slate-600 leading-relaxed">
                Kemungkinan besar port PocketBase pada Worker VPS belum dibuka di firewall atau proses PocketBase di Worker belum berjalan. Coba periksa di Worker:
              </p>
              <CommandSnippet
                title="Cek status service di Worker VPS:"
                code="systemctl status pb-SLUG.service --no-pager"
              />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-1.5">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <HelpCircle size={15} className="text-blue-500" />
                Apakah sekolah yang memakai Custom Domain juga bisa ditempatkan di Worker VPS?
              </p>
              <p className="text-slate-600 leading-relaxed">
                Bisa. Cukup arahkan DNS Custom Domain (misal <code className="font-mono text-slate-800">cbt.sman1.sch.id</code>) ke IP Master VPS (<code className="font-mono text-blue-700">64.235.41.108</code>). Master Caddy akan otomatis menerbitkan sertifikat SSL dan meneruskan traffic ke Worker VPS.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-1.5">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <HelpCircle size={15} className="text-emerald-500" />
                Di mana invoice dan pembayaran disimpan saat tenant ada di Worker VPS?
              </p>
              <p className="text-slate-600 leading-relaxed">
                Seluruh data pendaftaran, invoice, paket langganan, dan callback pembayaran SumoPod QRIS/VA selalu disimpan di <strong>Master VPS</strong> secara terpusat. Worker VPS tidak menyimpan data keuangan apapun, sehingga pergantian atau penutupan Worker VPS tidak akan pernah merusak data tagihan atau kwitansi resmi.
              </p>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminMultiVpsDocsPage;
