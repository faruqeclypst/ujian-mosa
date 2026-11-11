import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { BookOpen } from "lucide-react";
import { MathText } from "../../../../components/ui/MathText";

interface MathGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MathGuideDialog: React.FC<MathGuideDialogProps> = ({ open, onOpenChange }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl overflow-hidden p-0 border-none shadow-2xl bg-white dark:bg-slate-950">
        <div className="bg-slate-900 p-8 text-white relative">
          <BookOpen className="h-16 w-16 opacity-5 absolute right-8 top-8" />
          <h2 className="text-2xl font-bold mb-1 tracking-tight">Panduan Penulisan Rumus</h2>
          <p className="text-slate-400 text-sm font-medium">Cara menulis rumus Matematika, Fisika, dan Kimia agar tampil sempurna di soal ujian.</p>
        </div>

        <div className="p-8 space-y-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {/* ATURAN UTAMA */}
          <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40 space-y-3">
            <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black">!</span>
              ATURAN PENTING
            </h4>
            <p className="text-sm text-rose-800/80 dark:text-rose-300 leading-relaxed">
              Semua rumus <strong>WAJIB</strong> dibungkus dengan tanda dollar (<code className="bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded font-mono text-rose-700">$...$</code>). Tanpa tanda dollar, rumus akan tampil sebagai teks biasa.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800">
                <div className="text-xs font-black text-rose-500 mb-1.5">✕ SALAH</div>
                <code className="text-xs font-mono text-slate-600">{"\\frac{a}{b}"}</code>
                <div className="mt-2 text-xs text-slate-400 italic">Tampil sebagai teks biasa</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="text-xs font-black text-emerald-500 mb-1.5">✓ BENAR</div>
                <code className="text-xs font-mono text-indigo-600">{"$ \\frac{a}{b} $"}</code>
                <div className="mt-2"><MathText content="$ \frac{a}{b} $" className="text-sm" /></div>
              </div>
            </div>
          </div>

          {/* KAMUS SIMBOL LENGKAP */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Kamus Simbol (Klik baris untuk menyalin)</h4>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Nama</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Kode (tulis di antara $...$)</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { name: "Pecahan", code: "\\frac{a}{b}", full: "$ \\frac{a}{b} $" },
                    { name: "Pecahan Besar", code: "\\dfrac{a}{b}", full: "$ \\dfrac{a}{b} $" },
                    { name: "Akar Kuadrat", code: "\\sqrt{x}", full: "$ \\sqrt{x} $" },
                    { name: "Akar Pangkat n", code: "\\sqrt[3]{x}", full: "$ \\sqrt[3]{x} $" },
                    { name: "Pangkat", code: "x^{2}", full: "$ x^{2} $" },
                    { name: "Indeks/Subscript", code: "x_{1}", full: "$ x_{1} $" },
                    { name: "Log basis a", code: "{}^{a}\\!\\log b", full: "$ {}^{a}\\!\\log b $" },
                    { name: "Log natural", code: "\\ln x", full: "$ \\ln x $" },
                    { name: "Derajat", code: "90^\\circ", full: "$ 90^\\circ $" },
                    { name: "Perkalian (dot)", code: "a \\cdot b", full: "$ a \\cdot b $" },
                    { name: "Perkalian (cross)", code: "a \\times b", full: "$ a \\times b $" },
                    { name: "Tidak Sama Dengan", code: "\\neq", full: "$ \\neq $" },
                    { name: "Kurang/Lebih sama", code: "\\leq \\geq", full: "$ \\leq \\geq $" },
                    { name: "Integral", code: "\\int_{a}^{b} f(x)\\,dx", full: "$ \\int_{a}^{b} f(x)\\,dx $" },
                    { name: "Sigma/Jumlah", code: "\\sum_{i=1}^{n} x_i", full: "$ \\sum_{i=1}^{n} x_i $" },
                    { name: "Limit", code: "\\lim_{x \\to \\infty}", full: "$ \\lim_{x \\to \\infty} $" },
                    { name: "Vektor", code: "\\vec{F}", full: "$ \\vec{F} $" },
                    { name: "Teks dalam rumus", code: "5\\text{ kg}", full: "$ 5\\text{ kg} $" },
                    { name: "Kurung besar", code: "\\left( \\frac{a}{b} \\right)", full: "$ \\left( \\frac{a}{b} \\right) $" },
                    { name: "Panah reaksi", code: "\\rightarrow", full: "$ \\rightarrow $" },
                    { name: "Panah kesetimbangan", code: "\\rightleftharpoons", full: "$ \\rightleftharpoons $" },
                    { name: "Delta (perubahan)", code: "\\Delta H", full: "$ \\Delta H $" },
                    { name: "Omega (ohm)", code: "\\Omega", full: "$ \\Omega $" },
                    { name: "Theta (sudut)", code: "\\theta", full: "$ \\theta $" },
                    { name: "Alpha/Beta/Gamma", code: "\\alpha \\beta \\gamma", full: "$ \\alpha \\beta \\gamma $" },
                    { name: "Koma desimal", code: "9{,}8", full: "$ 9{,}8 $" },
                    { name: "Kimia (H₂O)", code: "\\text{H}_2\\text{O}", full: "$ \\text{H}_2\\text{O} $" },
                    { name: "Ion (Na⁺)", code: "\\text{Na}^+", full: "$ \\text{Na}^+ $" },
                    { name: "Keadaan (gas)", code: "\\text{CO}_2(g)", full: "$ \\text{CO}_2(g) $" },
                    { name: "Satuan (m/s²)", code: "\\text{m/s}^2", full: "$ \\text{m/s}^2 $" },
                  ].map((item) => (
                    <tr key={item.name} className="group hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors" onClick={() => copyToClipboard(item.full, item.name)}>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 text-xs">{item.code}</td>
                      <td className="p-2.5"><MathText content={item.full} className="text-sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CONTOH SOAL LENGKAP */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Contoh Soal per Mata Pelajaran (Klik untuk Salin)</h4>
            <div className="space-y-3">
              {[
                { label: "MATEMATIKA - Logaritma", code: "Nilai dari $ \\dfrac{{}^{2}\\!\\log \\sqrt{5} + 2 \\cdot {}^{4}\\!\\log 5}{{}^{2}\\!\\log 3 \\cdot {}^{3}\\!\\log 5} $ = ..." },
                { label: "MATEMATIKA - Integral", code: "Hitunglah $ \\int_{0}^{2} (3x^2 + 2x) \\, dx $ = ..." },
                { label: "MATEMATIKA - Limit", code: "Nilai $ \\lim_{x \\to 2} \\dfrac{x^2 - 4}{x - 2} $ = ..." },
                { label: "MATEMATIKA - Trigonometri", code: "Jika $ \\sin \\alpha = \\dfrac{3}{5} $ dan $ \\alpha $ di kuadran I, tentukan nilai $ \\cos 2\\alpha $ = ..." },
                { label: "MATEMATIKA - Barisan & Deret", code: "Jumlah $ n $ suku pertama deret geometri $ S_n = \\dfrac{a(1 - r^n)}{1 - r} $. Jika $ a = 3 $, $ r = 2 $, dan $ n = 5 $, maka $ S_5 $ = ..." },
                { label: "MATEMATIKA - Matriks", code: "Diketahui matriks $ A = \\begin{pmatrix} 2 & 1 \\\\ 3 & 4 \\end{pmatrix} $. Tentukan $ \\det(A) $ = ..." },
                { label: "MATEMATIKA - Turunan", code: "Jika $ f(x) = 3x^4 - 2x^3 + x - 5 $, maka $ f'(x) $ = ..." },
                { label: "MATEMATIKA - Peluang", code: "Dari 52 kartu bridge, peluang terambil kartu As atau kartu berwarna merah $ P(A \\cup B) = P(A) + P(B) - P(A \\cap B) $ = ..." },
                { label: "FISIKA - Hukum Newton", code: "Benda bermassa $ m = 5 \\text{ kg} $ di atas bidang miring $ \\theta = 30^\\circ $. Jika $ g = 10 \\text{ m/s}^2 $ dan $ \\mu_k = 0{,}2 $, percepatan benda $ a $ = ..." },
                { label: "FISIKA - Listrik", code: "Hambatan total rangkaian seri $ R_1 = 4 \\, \\Omega $ dan $ R_2 = 6 \\, \\Omega $ dengan tegangan $ V = 20 \\text{ V} $. Arus listrik $ I = \\dfrac{V}{R_{total}} $ = ..." },
                { label: "FISIKA - Gelombang", code: "Gelombang berjalan $ y = 0{,}2 \\sin(4\\pi t - 2\\pi x) $ m. Tentukan amplitudo $ A $, frekuensi $ f $, dan panjang gelombang $ \\lambda $." },
                { label: "FISIKA - Termodinamika", code: "Gas ideal mengalami proses isobarik. Usaha yang dilakukan gas $ W = P \\cdot \\Delta V $. Jika $ P = 2 \\times 10^5 \\text{ Pa} $ dan $ \\Delta V = 0{,}01 \\text{ m}^3 $, maka $ W $ = ..." },
                { label: "FISIKA - Relativitas", code: "Energi total partikel bermassa $ m $ bergerak dengan kecepatan $ v $: $ E = \\dfrac{m_0 c^2}{\\sqrt{1 - \\dfrac{v^2}{c^2}}} $" },
                { label: "FISIKA - Optik", code: "Lensa cembung dengan jarak fokus $ f = 20 \\text{ cm} $. Benda diletakkan $ s = 30 \\text{ cm} $. Jarak bayangan $ \\dfrac{1}{s'} = \\dfrac{1}{f} - \\dfrac{1}{s} $ = ..." },
                { label: "KIMIA - Reaksi", code: "Reaksi: $ 2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O} $. Jika 4 mol $ \\text{H}_2 $ bereaksi sempurna, berapa mol $ \\text{H}_2\\text{O} $ yang dihasilkan?" },
                { label: "KIMIA - pH", code: "Larutan $ \\text{CH}_3\\text{COOH} $ 0,1 M dengan $ K_a = 10^{-5} $. Tentukan pH! ($ [\\text{H}^+] = \\sqrt{K_a \\cdot C} $)" },
                { label: "KIMIA - Termokimia", code: "Diketahui: $ \\text{C}(s) + \\text{O}_2(g) \\rightarrow \\text{CO}_2(g) \\quad \\Delta H = -393{,}5 \\text{ kJ/mol} $. Hitunglah kalor jika 24 g karbon dibakar! ($ A_r \\text{ C} = 12 $)" },
                { label: "KIMIA - Kesetimbangan", code: "Reaksi: $ \\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g) $. Tentukan $ K_c $ jika $ [\\text{NH}_3] = 0{,}4 $ M, $ [\\text{N}_2] = 0{,}2 $ M, $ [\\text{H}_2] = 0{,}1 $ M." },
                { label: "KIMIA - Elektrokimia", code: "Sel volta: $ \\text{Zn}(s) | \\text{Zn}^{2+}(aq) || \\text{Cu}^{2+}(aq) | \\text{Cu}(s) $. Jika $ E^\\circ_{\\text{Zn}} = -0{,}76 $ V dan $ E^\\circ_{\\text{Cu}} = +0{,}34 $ V, maka $ E^\\circ_{sel} $ = ..." },
                { label: "BIOLOGI - Genetika", code: "Persilangan $ \\text{Aa} \\times \\text{Aa} $ menghasilkan rasio genotip $ 1\\text{AA} : 2\\text{Aa} : 1\\text{aa} $. Berapa probabilitas fenotip dominan?" },
                { label: "BIOLOGI - Pertumbuhan", code: "Populasi bakteri: $ N_t = N_0 \\cdot 2^{t/g} $, dengan $ N_0 = 100 $, waktu generasi $ g = 20 $ menit. Jumlah bakteri setelah $ t = 60 $ menit = ..." },
                { label: "BIOLOGI - Enzim", code: "Laju reaksi enzim mengikuti persamaan Michaelis-Menten: $ v = \\dfrac{V_{max} \\cdot [S]}{K_m + [S]} $. Jika $ V_{max} = 100 $, $ K_m = 5 $, dan $ [S] = 10 $, maka $ v $ = ..." },
                { label: "EKONOMI - Keseimbangan", code: "Fungsi permintaan $ Q_d = 100 - 2P $ dan penawaran $ Q_s = -20 + 3P $. Harga keseimbangan $ P_e $ dan kuantitas $ Q_e $ = ..." },
                { label: "EKONOMI - Elastisitas", code: "Elastisitas permintaan $ E_d = \\dfrac{\\Delta Q / Q}{\\Delta P / P} $. Jika harga naik dari $ P_1 = 5000 $ ke $ P_2 = 6000 $ dan $ Q $ turun dari 100 ke 80, maka $ E_d $ = ..." },
                { label: "INFORMATIKA - Konversi Bilangan", code: "Konversikan $ (1011{,}01)_2 $ ke desimal: $ 1 \\cdot 2^3 + 0 \\cdot 2^2 + 1 \\cdot 2^1 + 1 \\cdot 2^0 + 0 \\cdot 2^{-1} + 1 \\cdot 2^{-2} $ = ..." },
              ].map((ex) => (
                <div key={ex.label} onClick={() => copyToClipboard(ex.code, ex.label)} className={`group p-4 rounded-2xl border cursor-pointer transition-all ${copiedId === ex.label ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300" : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase">{ex.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${copiedId === ex.label ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 opacity-0 group-hover:opacity-100"}`}>{copiedId === ex.label ? "TERSALIN!" : "KLIK SALIN"}</span>
                  </div>
                  <MathText content={ex.code} className="text-sm font-serif leading-relaxed" />
                  <code className="block mt-2 text-xs font-mono text-slate-400 break-all">{ex.code}</code>
                </div>
              ))}
            </div>
          </div>

          {/* TIPS */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 space-y-2">
            <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">Tips Penting</h4>
            <ul className="text-xs text-amber-800/80 dark:text-amber-300 space-y-1.5">
              <li> Gunakan <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\dfrac"}</code> untuk pecahan besar yang lebih mudah dibaca</li>
              <li> Untuk teks biasa di dalam rumus, bungkus dengan <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\text{...}"}</code></li>
              <li> Import dari Word otomatis mengkonversi equation ke LaTeX</li>
              <li> Copy-paste pecahan HTML dari Word juga otomatis dikonversi</li>
              <li> AI Generator sudah otomatis menggunakan format LaTeX yang benar</li>
              <li> Format KaTeX <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\(...\\)"}</code> juga didukung sebagai alternatif <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"$...$"}</code></li>
            </ul>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <Button onClick={() => onOpenChange(false)} className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-sm shadow-slate-200 dark:shadow-none">
            Tutup Dokumentasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

