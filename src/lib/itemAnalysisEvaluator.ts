/**
 * Classical Test Theory (CTT) Item Analysis & Psychometrics Engine
 * 3-Layer Architecture:
 * Layer 1: Item Statistics (P, D with Kelley 27% floor, Corrected Point-Biserial r_pb, Distractor Analysis & DE%)
 * Layer 2: Diagnostic Engine (Automated flags for key issues, D anomalies, P extremes, dead/misleading distractors)
 * Layer 3: Decision Engine (5-Tier Verdict: Diterima, Revisi Kecil, Revisi, Revisi Total, Ditolak)
 */

import type { QuestionType } from "../pages/admin/QuestionsPage";

export type VerdictType = "Diterima" | "Revisi Kecil" | "Revisi" | "Revisi Total" | "Ditolak";
export type DifficultyCategory = "Sukar" | "Sedang" | "Mudah";
export type DiscriminationCategory = "Sangat Baik" | "Baik" | "Cukup" | "Rendah" | "Negatif";
export type PointBiserialCategory = "Sangat Baik" | "Baik" | "Cukup" | "Rendah" | "Negatif";
export type DistractorStatus = "Kunci" | "Efektif" | "Tidak Efektif" | "Menyesatkan";

export interface DistractorAnalysis {
  key: string;
  text: string;
  isCorrect: boolean;
  totalCount: number;
  totalPercent: number;
  upperCount: number;
  upperPercent: number;
  lowerCount: number;
  lowerPercent: number;
  status: DistractorStatus;
  effective: boolean;
  note: string;
}

export interface StatementAnalysis {
  id: string;
  index: number;
  text: string;
  correctAnswer: "benar" | "salah";
  totalBenar: number;
  totalBenarPercent: number;
  totalSalah: number;
  totalSalahPercent: number;
  upperBenar: number;
  upperBenarPercent: number;
  lowerBenar: number;
  lowerBenarPercent: number;
  difficultyIndex: number; // P_st
  discriminationIndex: number; // D_st
  status: "Berfungsi Baik" | "Cukup" | "Menyesatkan" | "Terlalu Mudah" | "Terlalu Sukar";
  note: string;
}

export interface VerdictDetail {
  verdict: VerdictType;
  badgeLabel: string;
  summaryTitle: string;
  severity: "GOOD" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: string[];
  findings: string[];
  actionPlan: string;
  keyAlert?: boolean;
}

export interface QuestionAnalysis {
  id: string;
  index: number;
  text: string;
  imageUrl?: string;
  type: QuestionType;
  groupId?: string;
  groupText?: string;
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  answerKey?: string;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string }>;
  statements?: Array<{ id: string; text: string; answer?: string }>;

  // Layer 1: Metrik Statistik Murni
  totalAnswered: number;
  totalCorrect: number;
  difficultyIndex: number; // P (0.00 - 1.00)
  difficultyCategory: DifficultyCategory;

  upperGroupCorrect: number;
  lowerGroupCorrect: number;
  discriminationIndex: number; // D (-1.00 - 1.00)
  discriminationCategory: DiscriminationCategory;

  pointBiserial: number; // Corrected r_pb (-1.00 - 1.00)
  pointBiserialCategory: PointBiserialCategory;

  distractorEfficiency: number; // DE% (0 - 100)
  effectiveDistractorCount: number;
  totalDistractorCount: number;

  // Layer 2: Diagnosis Temuan
  flags: string[];

  // Layer 3: Keputusan (Decision Engine)
  verdict: VerdictType;
  verdictDetail: VerdictDetail;
  recommendation: string;

  // Rincian Pengecoh (Pilihan Ganda & PG Kompleks)
  distractors?: DistractorAnalysis[];

  // Rincian Pernyataan (Benar / Salah)
  statementsAnalysis?: StatementAnalysis[];
}

export const isFuzzyMatch = (studentAns: any, correctKey: string): boolean => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
  const sAns = stripHtml(studentAns).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = stripHtml(correctKey).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  if (sAns.includes(cKey) || cKey.includes(sAns)) return true;
  if (cKey.length < 3) return sAns === cKey;

  const distance = (a: string, b: string) => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
      }
    }
    return matrix[b.length][a.length];
  };
  const dist = distance(sAns, cKey);
  const maxLen = Math.max(sAns.length, cKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

/**
 * Layer 1: Kategori Tingkat Kesukaran (P)
 * Standar CTT:
 * 0.00 - 0.30 : Sukar
 * 0.31 - 0.70 : Sedang
 * 0.71 - 1.00 : Mudah
 */
export function getDifficultyCategory(p: number): DifficultyCategory {
  if (p <= 0.30) return "Sukar";
  if (p <= 0.70) return "Sedang";
  return "Mudah";
}

/**
 * Layer 1: Kategori Daya Pembeda (D)
 * Standar Ebel:
 * D >= 0.40       : Sangat Baik
 * 0.30 <= D < 0.40 : Baik
 * 0.20 <= D < 0.30 : Cukup
 * 0.00 <= D < 0.20 : Rendah
 * D < 0.00        : Negatif
 */
export function getDiscriminationCategory(d: number): DiscriminationCategory {
  if (d < 0) return "Negatif";
  if (d < 0.20) return "Rendah";
  if (d < 0.30) return "Cukup";
  if (d < 0.40) return "Baik";
  return "Sangat Baik";
}

/**
 * Layer 1: Kategori Korelasi Point-Biserial (Corrected r_pb)
 */
export function getPointBiserialCategory(rpb: number): PointBiserialCategory {
  if (rpb < 0) return "Negatif";
  if (rpb < 0.20) return "Rendah";
  if (rpb < 0.30) return "Cukup";
  if (rpb < 0.40) return "Baik";
  return "Sangat Baik";
}

/**
 * Layer 1: Menghitung Corrected Item-Total Point-Biserial Correlation (r_pbis)
 * Korelasi antara skor dikotomis butir soal y_j in {0, 1} dengan skor total tes siswa
 * yang telah dikurangi skor butir soal tersebut (z_j = X_j - y_j).
 */
export function calculateCorrectedPointBiserial(
  itemScores: number[],
  totalScores: number[]
): number {
  const n = itemScores.length;
  if (n < 2) return 0;

  // Corrected total score z = X - y
  const correctedTotals: number[] = new Array(n);
  let sumY = 0;
  let sumZ = 0;

  for (let i = 0; i < n; i++) {
    const y = itemScores[i] || 0;
    const z = (totalScores[i] || 0) - y;
    correctedTotals[i] = z;
    sumY += y;
    sumZ += z;
  }

  const meanY = sumY / n;
  const meanZ = sumZ / n;

  let varY = 0;
  let varZ = 0;
  let covYZ = 0;

  for (let i = 0; i < n; i++) {
    const dy = (itemScores[i] || 0) - meanY;
    const dz = correctedTotals[i] - meanZ;
    varY += dy * dy;
    varZ += dz * dz;
    covYZ += dy * dz;
  }

  if (varY <= 1e-9 || varZ <= 1e-9) {
    return 0; // Tidak ada variasi jawaban atau skor
  }

  const r = covYZ / Math.sqrt(varY * varZ);
  const clamped = Math.max(-1, Math.min(1, r));
  return Number(clamped.toFixed(2));
}

/**
 * Layer 2: Diagnosis Masalah Konstruksi & Anomali Data Butir Soal
 */
export function diagnoseItemIssues(params: {
  p: number;
  d: number;
  rpb: number;
  hasValidKey: boolean;
  distractors?: DistractorAnalysis[];
  statementsAnalysis?: StatementAnalysis[];
}): string[] {
  const { p, d, rpb, hasValidKey, distractors, statementsAnalysis } = params;
  const flags: string[] = [];

  if (!hasValidKey) {
    flags.push("Kunci Jawaban Belum Ditentukan");
  }

  if (d < 0) {
    flags.push("Daya Pembeda Negatif (Kritis: Kelompok Bawah Lebih Banyak Benar)");
  } else if (d < 0.20) {
    flags.push("Daya Pembeda Rendah");
  }

  if (p <= 0.30) {
    flags.push("Tingkat Kesukaran Sukar");
  } else if (p > 0.70) {
    flags.push("Tingkat Kesukaran Mudah");
  }

  if (rpb < 0) {
    flags.push("Point-Biserial Negatif (Berlawanan dengan Total Skor)");
  } else if (rpb < 0.20) {
    flags.push("Point-Biserial Lemah");
  }

  if (distractors && distractors.length > 0) {
    const misleading = distractors.filter(dis => dis.status === "Menyesatkan");
    if (misleading.length > 0) {
      flags.push(`Pengecoh Menyesatkan: Opsi ${misleading.map(m => m.key).join(", ")}`);
    }

    const dead = distractors.filter(dis => dis.status === "Tidak Efektif");
    if (dead.length > 0) {
      flags.push(`Pengecoh Pasif (<5%): Opsi ${dead.map(m => m.key).join(", ")}`);
    }
  }

  if (statementsAnalysis && statementsAnalysis.length > 0) {
    const misleadingSt = statementsAnalysis.filter(st => st.status === "Menyesatkan");
    if (misleadingSt.length > 0) {
      flags.push(`Pernyataan Menyesatkan: #${misleadingSt.map(s => s.index).join(", #")}`);
    }
  }

  return flags;
}

/**
 * Layer 3: Decision Engine CTT (5-Tier Verdict)
 * Diterima | Revisi Kecil | Revisi | Revisi Total | Ditolak
 */
export function evaluateQuestionVerdict(params: {
  p: number;
  d: number;
  rpb: number;
  hasValidKey?: boolean;
  distractors?: DistractorAnalysis[];
  statementsAnalysis?: StatementAnalysis[];
  qType?: QuestionType;
}): VerdictDetail {
  const { p, d, rpb, hasValidKey = true, distractors, statementsAnalysis, qType = "pilihan_ganda" } = params;
  const pPercent = Math.round(p * 100);
  const findings: string[] = [];
  const flags = diagnoseItemIssues({ p, d, rpb, hasValidKey, distractors, statementsAnalysis });

  let verdict: VerdictType = "Diterima";
  let badgeLabel = "Diterima";
  let summaryTitle = "";
  let actionPlan = "";
  let keyAlert = false;
  let severity: VerdictDetail["severity"] = "GOOD";

  const isMC = qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks";
  const misleadingDistractors = distractors?.filter(dis => dis.status === "Menyesatkan") || [];
  const deadDistractors = distractors?.filter(dis => dis.status === "Tidak Efektif") || [];
  const totalDistractors = distractors?.filter(dis => !dis.isCorrect) || [];
  const effectiveCount = totalDistractors.filter(dis => dis.effective).length;
  const dePercent = totalDistractors.length > 0 ? Math.round((effectiveCount / totalDistractors.length) * 100) : 100;

  const misleadingStatements = statementsAnalysis?.filter(st => st.status === "Menyesatkan") || [];
  const extremeEasyStatements = statementsAnalysis?.filter(st => st.status === "Terlalu Mudah") || [];
  const extremeHardStatements = statementsAnalysis?.filter(st => st.status === "Terlalu Sukar") || [];

  // ========================================================
  // KONDISI 1: DITOLAK (D < 0 atau Kunci Salah/Tidak Valid)
  // ========================================================
  if (!hasValidKey) {
    verdict = "Ditolak";
    severity = "CRITICAL";
    badgeLabel = "Ditolak / Kunci Kosong";
    keyAlert = true;
    summaryTitle = "Kunci Jawaban Belum Ditentukan";
    findings.push(
      "Kunci jawaban pada butir soal ini kosong atau belum ditentukan dalam konfigurasi soal.",
      "Sistem tidak dapat mengevaluasi capaian siswa secara valid tanpa kunci yang jelas."
    );
    actionPlan = "Tentukan kunci jawaban pada editor soal sebelum mengikutsertakan butir ini dalam evaluasi akhir.";
    return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
  }

  if (d < 0) {
    verdict = "Ditolak";
    severity = "CRITICAL";
    badgeLabel = "Ditolak / Periksa Kunci";
    keyAlert = true;
    summaryTitle = "Anomali Kritis: Siswa Kelompok Bawah Lebih Banyak Benar (D < 0)";

    findings.push(
      `Daya Pembeda Negatif (D = ${d.toFixed(2)}): Siswa berkemampuan rendah justru lebih banyak menjawab benar daripada siswa berkemampuan tinggi.`,
      `Point-Biserial Negatif (r_pb = ${rpb.toFixed(2)}): Korelasi item berlawanan dengan performa skor total siswa.`,
      "Pola terbalik ini mengindikasikan adanya kekeliruan fatal pada kunci jawaban atau jebakan redaksi yang ambigu."
    );

    if (misleadingDistractors.length > 0) {
      findings.push(
        `Opsi pengecoh ${misleadingDistractors.map(m => `"${m.key}"`).join(", ")} menarik lebih banyak siswa kelompok atas.`
      );
    }

    actionPlan = "SEGERA PERIKSA KUNCI JAWABAN: Periksa apakah kunci jawaban salah diinput pada sistem (misal tertukar antara dua opsi). Jika kunci sudah benar, butir soal ini memiliki kesalahan konsep/multitafsir berat yang merugikan siswa pandai dan harus dibuang/ditolak.";
    return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
  }

  // ========================================================
  // KONDISI 2: REVISI TOTAL (0 <= D < 0.20 atau Masalah Konstruksi Berat)
  // ========================================================
  if (d < 0.20) {
    verdict = "Revisi Total";
    severity = "HIGH";
    badgeLabel = "Revisi Total";
    summaryTitle = "Daya Pembeda Rendah (D < 0.20): Kurang Mampu Membedakan Kemampuan Siswa";

    findings.push(
      `Daya Pembeda Rendah (D = +${d.toFixed(2)}): Butir soal tidak mampu memisahkan kelompok siswa yang menguasai dan belum menguasai materi.`,
      `Indeks Kesukaran P = ${p.toFixed(2)} (${getDifficultyCategory(p)}, dijawab benar oleh ${pPercent}% siswa).`,
      `Point-Biserial r_pb = ${rpb.toFixed(2)} (${getPointBiserialCategory(rpb)}).`
    );

    if (misleadingDistractors.length > 0) {
      findings.push(
        `Ditemukan opsi pengecoh ${misleadingDistractors.map(m => `"${m.key}"`).join(", ")} yang menyesatkan siswa kelompok atas.`
      );
    }
    if (deadDistractors.length > 0) {
      findings.push(
        `${deadDistractors.length} dari ${totalDistractors.length} pengecoh pasif/mati (<5% pemilih).`
      );
    }

    actionPlan = "Konstruksi butir soal belum reliabel sebagai alat ukur. Rombak kalimat stimulus soal, perjelas pertanyaan inti, dan susun ulang pilihan jawaban sebelum digunakan pada evaluasi mendatang.";
    return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
  }

  // ========================================================
  // KONDISI 3: REVISI (0.20 <= D < 0.30 atau Kesukaran Ekstrem)
  // ========================================================
  if (d < 0.30 || (p <= 0.20 && d < 0.35) || (p >= 0.85 && d < 0.35)) {
    verdict = "Revisi";
    severity = "MEDIUM";
    badgeLabel = "Perlu Revisi";
    summaryTitle = "Daya Pembeda Cukup: Perlu Optimalisasi Redaksi / Opsi";

    findings.push(
      `Daya Pembeda Cukup (D = +${d.toFixed(2)}): Butir soal sudah bekerja, namun daya pisahnya belum optimal.`,
      `Tingkat Kesukaran P = ${p.toFixed(2)} (${getDifficultyCategory(p)}, ${pPercent}% siswa benar).`,
      `Point-Biserial r_pb = ${rpb.toFixed(2)} (${getPointBiserialCategory(rpb)}).`
    );

    if (misleadingDistractors.length > 0) {
      findings.push(
        `Pengecoh ${misleadingDistractors.map(m => `"${m.key}"`).join(", ")} dipilih lebih banyak oleh kelompok atas.`
      );
    }
    if (deadDistractors.length > 0) {
      findings.push(
        `${deadDistractors.length} opsi pengecoh (${deadDistractors.map(m => m.key).join(", ")}) pasif (<5% pemilih).`
      );
    }

    actionPlan = isMC && (deadDistractors.length > 0 || misleadingDistractors.length > 0)
      ? "Perbaiki opsi pengecoh yang pasif atau menyesatkan. Ganti opsi yang tidak berfungsi dengan alternatif jawaban yang lebih masuk akal dan relevan dengan materi."
      : "Sempurnakan kalimat pertanyaan atau stimulus soal agar pembedaan siswa yang kompeten dan belum kompeten menjadi lebih tegas.";
    return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
  }

  // ========================================================
  // KONDISI 4: REVISI KECIL (0.30 <= D < 0.40 atau Pengecoh/Pernyataan Kurang Efektif)
  // ========================================================
  if (d < 0.40 || (isMC && (deadDistractors.length > 0 || dePercent < 100)) || misleadingStatements.length > 0) {
    verdict = "Revisi Kecil";
    severity = "LOW";
    badgeLabel = "Revisi Kecil";
    summaryTitle = d >= 0.40
      ? (misleadingStatements.length > 0 
          ? "Daya Pembeda Sangat Baik, Namun Ada Pernyataan yang Perlu Dikalibrasi"
          : "Daya Pembeda Sangat Baik, Namun Sebagian Pengecoh Belum Berfungsi Optimal")
      : "Daya Pembeda Baik: Butir Soal Layak Pakai dengan Sedikit Penyesuaian";

    findings.push(
      `Daya Pembeda ${getDiscriminationCategory(d)} (D = +${d.toFixed(2)}): Memiliki daya pisah yang baik dan andal.`,
      `Tingkat Kesukaran P = ${p.toFixed(2)} (${getDifficultyCategory(p)}, ${pPercent}% siswa benar).`,
      `Point-Biserial r_pb = ${rpb.toFixed(2)} (${getPointBiserialCategory(rpb)}).`
    );

    if (isMC) {
      findings.push(`Efektivitas Pengecoh: ${effectiveCount}/${totalDistractors.length} berfungsi efektif (DE = ${dePercent}%).`);
      if (deadDistractors.length > 0) {
        findings.push(`Opsi ${deadDistractors.map(m => `"${m.key}"`).join(", ")} pasif (<5% pemilih), terlalu mudah dieliminasi oleh siswa.`);
      }
    }

    if (qType === "benar_salah" && misleadingStatements.length > 0) {
      findings.push(`Pernyataan #${misleadingStatements.map(m => m.index).join(", #")} memiliki daya pembeda negatif (menarik lebih banyak kelompok bawah).`);
    }

    if (misleadingStatements.length > 0) {
      actionPlan = `Kalibrasi ulang kalimat pada pernyataan #${misleadingStatements.map(m => m.index).join(", #")} agar tidak memicu miskonsepsi bagi siswa berkemampuan tinggi.`;
    } else if (deadDistractors.length > 0) {
      actionPlan = `Soal secara umum berkualitas baik. Cukup lakukan penyesuaian minor pada opsi pengecoh yang pasif (${deadDistractors.map(m => m.key).join(", ")}) agar lebih menarik minat siswa yang belum tuntas.`;
    } else {
      actionPlan = "Soal dapat langsung digunakan pada evaluasi atau disimpan ke Bank Soal dengan sedikit pemolesan redaksi.";
    }

    return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
  }

  // ========================================================
  // KONDISI 5: DITERIMA (D >= 0.40 & Kunci Valid & DE Sempurna / Bebas Anomali)
  // ========================================================
  verdict = "Diterima";
  severity = "GOOD";
  badgeLabel = "Diterima (Sangat Baik)";
  summaryTitle = "Butir Soal Berkualitas Prima (Daya Beda & Kesukaran Ideal)";

  findings.push(
    `Daya Pembeda Sangat Baik (D = +${d.toFixed(2)}): Sangat efektif membedakan siswa yang menguasai kompetensi dari yang belum.`,
    `Tingkat Kesukaran Ideal (${getDifficultyCategory(p)}, P = ${p.toFixed(2)}): Sebanyak ${pPercent}% siswa menjawab benar, berada di rentang optimal evaluasi.`,
    `Point-Biserial r_pb = ${rpb.toFixed(2)} (${getPointBiserialCategory(rpb)}): Konsistensi internal butir soal sangat tinggi.`
  );

  if (isMC) {
    findings.push(`Efektivitas Pengecoh Sempurna: Seluruh ${totalDistractors.length} opsi pengecoh bekerja optimal (DE = 100%).`);
  } else if (qType === "benar_salah" && statementsAnalysis && statementsAnalysis.length > 0) {
    findings.push(`Seluruh ${statementsAnalysis.length} pernyataan terkonfirmasi berfungsi dengan baik dan memiliki daya diskriminasi yang positif.`);
  }

  actionPlan = "Soal memiliki kualitas psikometri prima dan sangat layak disimpan permanen di Bank Soal Sekolah untuk digunakan pada ujian-ujian berikutnya.";
  return { verdict, badgeLabel, summaryTitle, severity, flags, findings, actionPlan, keyAlert };
}
