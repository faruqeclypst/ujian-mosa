import PocketBase from "pocketbase";
import { fetchAI, robustJSONParse } from "./ai";

export type CopilotActionType =
  | "create_bank_soal"
  | "create_exam_room"
  | "update_exam_room"
  | "create_multiple_exam_rooms"
  | "navigate"
  | "help"
  | "none";

export interface CopilotAction {
  type: CopilotActionType;
  title: string;
  payload?: any;
  executed?: boolean;
  resultMessage?: string;
  isDeterministic?: boolean; // True jika dieksekusi langsung secara lokal tanpa LLM
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: CopilotAction;
  timestamp: number;
}

export interface ExamScheduleResult {
  startDate: Date;
  endDate: Date;
  startISO: string;
  endISO: string;
  durationMinutes: number;
  formattedSchedule: string;
  dayLabel: string;
  timeRange: string;
}

/**
 * Daftar template perintah cepat (Command Palette) untuk Copilot tanpa AI
 */
export interface CopilotCommandTemplate {
  cmd: string;
  syntax: string;
  example: string;
  desc: string;
  iconName: string;
}

export const COPILOT_COMMAND_TEMPLATES: CopilotCommandTemplate[] = [
  {
    cmd: "/multiruang",
    syntax: "/multiruang [mapel 1] dan [mapel 2] jam [jam] jeda [jeda] durasi [durasi]",
    example: "/multiruang B.Inggris dan B.Indonesia jam 8 jeda 15m durasi 120m",
    desc: "Buka beberapa ruang berurutan sekaligus",
    iconName: "Layers"
  },
  {
    cmd: "/ruang",
    syntax: "/ruang [bank soal/mapel] [besok/hari ini] [jam] [durasi]",
    example: "/ruang Informatika besok 09:00 120m",
    desc: "Buka ruang ujian instan (tanpa AI)",
    iconName: "Zap"
  },
  {
    cmd: "/jadwal",
    syntax: "/jadwal [besok/hari ini/lusa] [jam] [durasi]",
    example: "/jadwal besok 09:00 120m",
    desc: "Ubah jadwal & durasi ruang aktif",
    iconName: "Clock"
  },
  {
    cmd: "/banksoal",
    syntax: "/banksoal [nama bank soal] [mapel]",
    example: "/banksoal Ulangan Harian Informatika XI",
    desc: "Buat modul bank soal baru instan",
    iconName: "BookOpen"
  },
  {
    cmd: "/monitoring",
    syntax: "/monitoring",
    example: "/monitoring",
    desc: "Buka live monitoring pengawasan",
    iconName: "BarChart2"
  },
  {
    cmd: "/token",
    syntax: "/token",
    example: "/token",
    desc: "Cek kode token ujian aktif saat ini",
    iconName: "KeyRound"
  },
  {
    cmd: "/help",
    syntax: "/help",
    example: "/help",
    desc: "Panduan seluruh command instan",
    iconName: "Sparkles"
  }
];

/**
 * Helper Pintar untuk memparsing tanggal & waktu ujian dari input pengguna / payload AI
 * Menghandle: "besok", "lusa", "hari ini", "jam 9 pagi", "09:00", durasi 120 menit, dsb.
 */
export function resolveExamSchedule(params: {
  date?: string;
  time?: string;
  duration?: number | string;
  text?: string;
}): ExamScheduleResult {
  const now = new Date();
  const rawText = `${params.date || ""} ${params.time || ""} ${params.text || ""}`.toLowerCase();

  // 1. Ekstraksi Durasi (menit)
  let durationMinutes = 90; // Default 90 menit
  if (params.duration) {
    const num = Number(params.duration);
    if (!isNaN(num) && num > 0) durationMinutes = num;
  } else {
    const durMatch = rawText.match(/(?:durasi\s*)?(\d+(?:\.\d+)?)\s*(?:menit|jam|m\b)/i);
    if (durMatch) {
      const val = parseFloat(durMatch[1]);
      if (/jam/i.test(durMatch[0])) {
        durationMinutes = Math.round(val * 60);
      } else {
        durationMinutes = Math.round(val);
      }
    }
  }

  // 2. Ekstraksi Tanggal
  const targetDate = new Date(now.getTime());

  if (rawText.includes("lusa")) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (rawText.includes("besok") || rawText.includes("tomorrow")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (rawText.includes("hari ini") || rawText.includes("today") || rawText.includes("sekarang")) {
    // Tetap hari ini
  } else {
    // Format ISO "YYYY-MM-DD"
    const isoDateMatch = rawText.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
    if (isoDateMatch) {
      const parsedIso = new Date(isoDateMatch[1]);
      if (!isNaN(parsedIso.getTime())) {
        targetDate.setFullYear(parsedIso.getFullYear(), parsedIso.getMonth(), parsedIso.getDate());
      }
    } else {
      // Format Indonesia "31 okt" atau "1 november"
      const idDateMatch = rawText.match(/(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*/i);
      if (idDateMatch) {
        const day = parseInt(idDateMatch[1], 10);
        const monthNames = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"];
        const monthIdx = monthNames.findIndex(m => idDateMatch[2].toLowerCase().startsWith(m));
        if (monthIdx !== -1) {
          targetDate.setMonth(monthIdx, day);
        }
      }
    }
  }

  // 3. Ekstraksi Jam & Menit
  let hours = 8; // Default pagi 08:00 jika ujian besok/lusa
  let minutes = 0;
  let timeSpecified = false;

  // Tangkap "jam 9 pagi", "jam 9:00", "09:00", "jam 8", "14:00"
  const timeMatch = rawText.match(/(?:jam\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|wib)?/i);
  if (timeMatch) {
    let parsedH = parseInt(timeMatch[1], 10);
    const parsedM = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = (timeMatch[3] || "").toLowerCase();

    if (parsedH >= 0 && parsedH <= 24) {
      if (period === "siang" && parsedH < 12) parsedH += 12;
      else if (period === "sore" && parsedH < 12) parsedH += 12;
      else if (period === "malam" && parsedH < 12) parsedH += 12;
      else if (period === "pagi" && parsedH === 12) parsedH = 0;

      hours = parsedH;
      minutes = parsedM;
      timeSpecified = true;
    }
  }

  // Jika tanggal adalah hari ini dan waktu tidak disebutkan spesifik, gunakan waktu saat ini
  const isTargetToday = targetDate.toDateString() === now.toDateString();
  if (isTargetToday && !timeSpecified) {
    hours = now.getHours();
    minutes = now.getMinutes();
  }

  targetDate.setHours(hours, minutes, 0, 0);

  // 4. Hitung Waktu Selesai (End Time)
  const endDate = new Date(targetDate.getTime() + durationMinutes * 60 * 1000);

  // 5. Label Human-Readable
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const lusa = new Date(now);
  lusa.setDate(lusa.getDate() + 2);

  let dayLabel = "";
  if (targetDate.toDateString() === now.toDateString()) {
    dayLabel = `Hari Ini (${targetDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;
  } else if (targetDate.toDateString() === tomorrow.toDateString()) {
    dayLabel = `Besok (${targetDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;
  } else if (targetDate.toDateString() === lusa.toDateString()) {
    dayLabel = `Lusa (${targetDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;
  } else {
    dayLabel = targetDate.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  }

  const sTime = `${String(targetDate.getHours()).padStart(2, "0")}:${String(targetDate.getMinutes()).padStart(2, "0")}`;
  const eTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
  const timeRange = `${sTime} - ${eTime} WIB`;
  const formattedSchedule = `${dayLabel}, ${timeRange} (${durationMinutes} Menit)`;

  return {
    startDate: targetDate,
    endDate,
    startISO: targetDate.toISOString(),
    endISO: endDate.toISOString(),
    durationMinutes,
    formattedSchedule,
    dayLabel,
    timeRange
  };
}

export interface AskCopilotOptions {
  pb: PocketBase;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  context?: {
    currentPath?: string;
    existingExams?: Array<{ id: string; title: string; subject?: string }>;
    existingClasses?: Array<{ id: string; name: string; level?: string }>;
    existingRooms?: Array<{
      id: string;
      title: string;
      roomCode?: string;
      startTime?: string;
      duration?: number;
      status?: string;
    }>;
    lastActionRoomId?: string;
    schoolName?: string;
  };
  signal?: AbortSignal;
}

/**
 * ⚡ DETERMINISTIC COMMAND RUNNER:
 * Mengeksekusi perintah cepat secara lokal tanpa memanggil LLM.
 * Sangat cepat (0 ms latency), hemat kuota, 100% konsisten, dan bekerja offline!
 */
export const tryRunDeterministicCommand = async (
  opts: AskCopilotOptions
): Promise<{ replyText: string; action?: CopilotAction } | null> => {
  const { messages, context = {} } = opts;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const raw = lastUserMsg.trim();
  const lower = raw.toLowerCase();

  // 1. /help atau bantuan
  const isHelpQuery =
    lower === "/help" ||
    lower === "/bantuan" ||
    lower === "help" ||
    lower === "bantuan" ||
    lower === "command" ||
    lower === "daftar command" ||
    lower === "/commands" ||
    lower === "panduan" ||
    lower === "cara pakai" ||
    lower === "menu";

  if (isHelpQuery) {
    return {
      replyText: `Berikut perintah cepat Copilot (100% lokal tanpa AI). Klik **Coba** untuk langsung mengeksekusi:`,
      action: {
        type: "help",
        title: "Panduan Perintah Cepat Copilot",
        payload: {
          categories: [
            {
              id: "rooms",
              title: "Ruang Ujian & Jadwal",
              icon: "Layers",
              commands: [
                {
                  cmd: "/multiruang",
                  label: "2+ Ruang Berurutan",
                  syntax: "/multiruang [mapel 1] dan [mapel 2] jam [jam] jeda [jeda] durasi [durasi]",
                  example: "/multiruang B.Inggris dan B.Indonesia jam 8 120m jeda 15m",
                  desc: "Buka beberapa sesi berurutan dengan jeda istirahat."
                },
                {
                  cmd: "/ruang",
                  label: "Buka 1 Ruang Ujian",
                  syntax: "/ruang [bank soal/mapel] [besok/hari ini] [jam] [durasi]",
                  example: "/ruang Informatika besok 09:00 120m",
                  desc: "Konfigurasi instan ruang ujian & bank soal."
                },
                {
                  cmd: "/jadwal",
                  label: "Ubah Jadwal Sesi",
                  syntax: "/jadwal [besok/hari ini/lusa] [jam] [durasi]",
                  example: "/jadwal besok 09:00 120m",
                  desc: "Update jadwal & durasi pengerjaan aktif."
                }
              ]
            },
            {
              id: "banksoal",
              title: "Bank Soal",
              icon: "BookOpen",
              commands: [
                {
                  cmd: "/banksoal",
                  label: "Buat Bank Soal",
                  syntax: "/banksoal [nama bank soal] [mapel]",
                  example: "/banksoal Ulangan Informatika XI",
                  desc: "Daftarkan bank soal baru langsung di server."
                }
              ]
            },
            {
              id: "navigation",
              title: "Pintasan Cepat",
              icon: "Compass",
              links: [
                { cmd: "/monitoring", label: "Monitoring", path: "/admin/monitoring", icon: "BarChart2", desc: "Pantau siswa live" },
                { cmd: "/ruang-ujian", label: "Ruang Ujian", path: "/admin/ruang-ujian", icon: "Layers", desc: "Kelola ruang CBT" },
                { cmd: "/bank-soal", label: "Bank Soal", path: "/admin/bank-soal", icon: "BookOpen", desc: "Kelola butir soal" },
                { cmd: "/token", label: "Token CBT", isCommand: true, icon: "KeyRound", desc: "Cek token universal" }
              ]
            }
          ]
        }
      }
    };
  }

  // 2. /token
  if (lower === "/token" || lower === "token") {
    let tokenText = "Belum ada token ruang ujian yang aktif.";
    if (context.existingRooms && context.existingRooms.length > 0) {
      const active = context.existingRooms[0];
      tokenText = `Token ruang aktif **"${active.title}"**: \`${active.roomCode || "TIDAK TERSEDIA"}\``;
    }
    return {
      replyText: `🔑 **Token Ujian Saat Ini:**\n\n${tokenText}\n\nAnda dapat membagikan token ini kepada siswa untuk mengikuti ujian.`,
      action: { type: "none", title: "" }
    };
  }

  // 3. Navigasi Cepat
  if (lower === "/monitoring" || lower === "/monitor") {
    return {
      replyText: "Membuka dashboard **Live Monitoring & Pengawasan Ujian**.",
      action: {
        type: "navigate",
        title: "Buka Live Monitoring",
        payload: { path: "/admin/monitoring", label: "Live Monitoring" }
      }
    };
  }

  if (lower === "/ruangujian" || lower === "/ruang-ujian") {
    return {
      replyText: "Membuka halaman **Ruang Ujian & Sesi CBT**.",
      action: {
        type: "navigate",
        title: "Buka Ruang Ujian",
        payload: { path: "/admin/ruang-ujian", label: "Ruang Ujian" }
      }
    };
  }

  if (lower === "/banksoal" || lower === "/bank-soal") {
    return {
      replyText: "Membuka halaman **Bank Soal & Kisi-Kisi**.",
      action: {
        type: "navigate",
        title: "Buka Bank Soal",
        payload: { path: "/admin/bank-soal", label: "Bank Soal" }
      }
    };
  }

  // ⚡ 4. DETEKSI MULTIPLE RUANG UJIAN (Contoh: "buat 2 ruang untuk bahasa inggris dan bahasa indonesia jam 8 durasi 120 menit jeda 15 menit")
  const isMultipleRooms =
    lower.startsWith("/multiruang") ||
    lower.startsWith("/multi") ||
    /(?:buat|buka|set)?\s*(?:(\d+|dua|tiga)\s+ruang|multiple\s+ruang)/i.test(lower) ||
    (lower.includes("ruang") && (lower.includes("jeda") || (lower.includes("dan") && lower.includes("lanjut"))));

  if (isMultipleRooms) {
    // a. Ekstraksi Durasi (default 120 menit jika user minta 120m)
    let duration = 120;
    const durMatch = lower.match(/(?:durasi\s*)?(\d+)\s*(?:menit|m\b)/i);
    if (durMatch) duration = parseInt(durMatch[1], 10);

    // b. Ekstraksi Jeda Istirahat (default 15 menit)
    let breakMinutes = 15;
    const breakMatch = lower.match(/jeda\s*(\d+)\s*(?:menit|m\b)?/i);
    if (breakMatch) breakMinutes = parseInt(breakMatch[1], 10);

    // c. Jam Mulai Sesi 1
    let startHour = 8;
    let startMin = 0;
    const timeMatch = lower.match(/(?:jam|pukul)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
    if (timeMatch) {
      startHour = parseInt(timeMatch[1], 10);
      if (timeMatch[2]) startMin = parseInt(timeMatch[2], 10);
    }

    // d. Ekstraksi Mata Pelajaran
    let subjects = ["Bahasa Inggris", "Bahasa Indonesia"];
    if (lower.includes("inggris") && (lower.includes("indonesia") || lower.includes("idnoesia"))) {
      subjects = ["Bahasa Inggris", "Bahasa Indonesia"];
    } else {
      const candidates = [
        "Bahasa Inggris",
        "Bahasa Indonesia",
        "Matematika",
        "Informatika",
        "Fisika",
        "Kimia",
        "Biologi",
        "Sejarah",
        "Geografi"
      ];
      const matched = candidates.filter(c => lower.includes(c.toLowerCase()));
      if (matched.length >= 2) subjects = matched;
    }

    // e. Hitung Jadwal Sesi Berurutan
    const now = new Date();
    const baseDate = new Date(now.getTime());
    // Jika jam mulai sudah terlewat hari ini, otomatis jadwalkan besok
    if (now.getHours() > startHour || (now.getHours() === startHour && now.getMinutes() >= startMin)) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
    baseDate.setHours(startHour, startMin, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rooms: any[] = [];
    let currentStart = new Date(baseDate.getTime());

    subjects.forEach((subj, idx) => {
      const currentEnd = new Date(currentStart.getTime() + duration * 60 * 1000);

      // Cari bank soal yang relevan jika ada di sistem
      let matchedExamId = "";
      let matchedExamTitle = `Bank Soal ${subj}`;
      if (context.existingExams && context.existingExams.length > 0) {
        const found = context.existingExams.find(
          e =>
            e.title.toLowerCase().includes(subj.toLowerCase()) ||
            subj.toLowerCase().includes(e.title.toLowerCase())
        );
        if (found) {
          matchedExamId = found.id;
          matchedExamTitle = found.title;
        } else if (context.existingExams[idx]) {
          matchedExamId = context.existingExams[idx].id;
          matchedExamTitle = context.existingExams[idx].title;
        }
      }

      const sTimeStr = `${String(currentStart.getHours()).padStart(2, "0")}:${String(currentStart.getMinutes()).padStart(2, "0")}`;
      const eTimeStr = `${String(currentEnd.getHours()).padStart(2, "0")}:${String(currentEnd.getMinutes()).padStart(2, "0")}`;

      const dayLabel =
        currentStart.toDateString() === tomorrow.toDateString()
          ? `Besok (${currentStart.toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`
          : `Hari Ini (${currentStart.toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;

      rooms.push({
        id: `room-${idx + 1}`,
        roomName: `Ulangan ${subj}`,
        examId: matchedExamId,
        examTitle: matchedExamTitle,
        subject: subj,
        date: currentStart.toDateString() === tomorrow.toDateString() ? "besok" : "hari ini",
        time: sTimeStr,
        startTime: currentStart.toISOString(),
        endTime: currentEnd.toISOString(),
        duration,
        enabled: true,
        scheduleText: `${dayLabel}, ${sTimeStr} - ${eTimeStr} WIB (${duration} Menit)`
      });

      // Sesi berikutnya = akhir sesi sekarang + jeda istirahat
      currentStart = new Date(currentEnd.getTime() + breakMinutes * 60 * 1000);
    });

    return {
      replyText: `Siap! Saya telah menyiapkan konfigurasi **${rooms.length} Ruang Ujian** berurutan dengan jadwal presisi dan jeda istirahat **${breakMinutes} menit**.

Silakan pilih bank soal dan sesuaikan ruangan melalui tombol pil kotak di bawah ini sebelum dibuka.`,
      action: {
        type: "create_multiple_exam_rooms",
        title: `Buka ${rooms.length} Ruang Ujian Sekaligus`,
        isDeterministic: true,
        payload: {
          breakMinutes,
          rooms,
          availableExams: context.existingExams || []
        }
      }
    };
  }

  // 5. /jadwal, /update, /durasi, atau teks ubah jadwal
  const isJadwalCmd =
    lower.startsWith("/jadwal") ||
    lower.startsWith("/update") ||
    lower.startsWith("/durasi") ||
    /^(?:ubah|ganti|set|sesuaikan)\s+(?:jadwal|jam|durasi|waktu)/i.test(lower);

  if (isJadwalCmd) {
    const targetRoomId = context.lastActionRoomId || (context.existingRooms && context.existingRooms[0]?.id) || "";
    const cleanParams = raw
      .replace(/^\/(?:jadwal|update|durasi)\s*/i, "")
      .replace(/^(?:ubah|ganti|set|sesuaikan)\s+(?:jadwal|jam|durasi|waktu)(?:\s+ruang(?:\s+ujian)?)?\s*/i, "");

    const schedule = resolveExamSchedule({ text: cleanParams || raw });

    return {
      replyText: `Siap! Perubahan jadwal terkonfigurasi ke: **${schedule.formattedSchedule}**.`,
      action: {
        type: "update_exam_room",
        title: "Terapkan Perubahan Jadwal",
        isDeterministic: true,
        payload: {
          roomId: targetRoomId,
          date: schedule.dayLabel.toLowerCase().includes("besok")
            ? "besok"
            : schedule.dayLabel.toLowerCase().includes("lusa")
            ? "lusa"
            : "hari ini",
          time: `${String(schedule.startDate.getHours()).padStart(2, "0")}:${String(schedule.startDate.getMinutes()).padStart(2, "0")}`,
          duration: schedule.durationMinutes,
          changeSummary: schedule.formattedSchedule
        }
      }
    };
  }

  // 6. /ruang, /buka, atau perintah buka ruang
  const isRuangCmd =
    lower.startsWith("/ruang") ||
    lower.startsWith("/buka") ||
    /^(?:buka|buat|set)\s+ruang/i.test(lower);

  if (isRuangCmd) {
    const cleanParams = raw
      .replace(/^\/(?:ruang|buka)\s*/i, "")
      .replace(/^(?:buka|buat|set)\s+ruang(?:\s+ujian)?\s*/i, "")
      .trim();

    const schedule = resolveExamSchedule({ text: cleanParams });

    // Bersihkan keyword waktu agar tersisa judul bank soal / mapel
    let examQuery = cleanParams
      .replace(/\b(?:besok|lusa|hari ini|pagi|siang|sore|malam|jam\s*\d+|durasi\s*\d+|\d+\s*menit|\d+m)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!examQuery) examQuery = "Ujian";

    // Cari bank soal yang cocok
    let matchedExamId = "";
    let matchedExamTitle = examQuery;
    if (context.existingExams && context.existingExams.length > 0) {
      const found = context.existingExams.find(
        e =>
          e.title.toLowerCase().includes(examQuery.toLowerCase()) ||
          examQuery.toLowerCase().includes(e.title.toLowerCase())
      );
      if (found) {
        matchedExamId = found.id;
        matchedExamTitle = found.title;
      } else {
        matchedExamTitle = context.existingExams[0].title;
        matchedExamId = context.existingExams[0].id;
      }
    }

    const dayPrefix = schedule.dayLabel.split("(")[0].trim();
    const roomName = `Ulangan ${matchedExamTitle} - ${dayPrefix}`;

    return {
      replyText: `Baik, saya telah menyiapkan draf ruang ujian **"${roomName}"** untuk **${schedule.formattedSchedule}**.

Sebelum ruang ujian resmi dibuka, silakan konfirmasi atau sesuaikan parameter berikut:
1. **Nama Ruang**: Nama sesi ujian yang tampil bagi siswa
2. **Kapan**: Hari pelaksanaan & jam mulai
3. **Durasi**: Lama waktu pengerjaan soal
4. **Kelas Apa**: Semua kelas atau kelas tertentu
5. **Bank Soal Apa**: Paket bank soal yang digunakan

Silakan lengkapi atau ubah opsi pada kartu konfirmasi di bawah, lalu klik **🚀 Buka Ruang Ujian Sekarang**.`,
      action: {
        type: "create_exam_room",
        title: "Konfirmasi & Buka Ruang Ujian",
        payload: {
          roomName,
          examId: matchedExamId,
          examTitle: matchedExamTitle,
          date: schedule.dayLabel.toLowerCase().includes("besok")
            ? "besok"
            : schedule.dayLabel.toLowerCase().includes("lusa")
            ? "lusa"
            : "hari ini",
          time: `${String(schedule.startDate.getHours()).padStart(2, "0")}:${String(schedule.startDate.getMinutes()).padStart(2, "0")}`,
          duration: schedule.durationMinutes,
          scheduleText: schedule.formattedSchedule,
          allClasses: true,
          classIds: [],
          availableExams: context.existingExams || [],
          availableClasses: context.existingClasses || [],
          randomize: true
        }
      }
    };
  }

  // 7. /banksoal, /soal, atau perintah buat bank soal sederhana
  const isBankSoalCmd =
    lower.startsWith("/banksoal") ||
    lower.startsWith("/soal") ||
    /^(?:buat|tambah)\s+bank\s+soal/i.test(lower);

  // Jika user tidak meminta generate butir soal otomatis lewat AI ("buatkan 5 soal...")
  if (isBankSoalCmd && !/(buatkan|soal\s+hots|pilihan\s+ganda|uraian|\d+\s+soal)/i.test(lower)) {
    let cleanParams = raw
      .replace(/^\/(?:banksoal|soal)\s*/i, "")
      .replace(/^(?:buat|tambah)\s+bank\s+soal\s*/i, "")
      .trim();
    if (!cleanParams) cleanParams = "Bank Soal Baru";

    return {
      replyText: `Siap! Modul bank soal **"${cleanParams}"** siap dibuat.`,
      action: {
        type: "create_bank_soal",
        title: "Buat Bank Soal & Kelola Butir Soal",
        isDeterministic: true,
        payload: {
          title: cleanParams,
          subject: cleanParams.split(" ")[0] || "Umum",
          examType: "Ulangan"
        }
      }
    };
  }

  return null;
};

export const askAdminCopilotAI = async (
  opts: AskCopilotOptions
): Promise<{ replyText: string; action?: CopilotAction }> => {
  const { pb, messages, context = {}, signal } = opts;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const trimmed = lastUserMsg.trim().toLowerCase();

  // ⚡ Fast-path 1: Deterministic Command (100% lokal tanpa LLM)
  const deterministicRes = await tryRunDeterministicCommand(opts);
  if (deterministicRes) {
    return deterministicRes;
  }

  // 🚀 Fast-path 2: Sapaan santai / kemampuan dasar
  if (/^(halo|hai|hi|hey|hei|assalamu['a-z]*|selamat\s+(pagi|siang|sore|malam)|sampurasun|salam)[\s!.,?]*$/i.test(trimmed)) {
    return {
      replyText: `Halo! Saya **Examku Copilot**, asisten pintar manajemen ujian sekolah Anda.

Saya siap membantu Anda menjalankan berbagai perintah langsung dari sini:
• 👥 **Multiple Ruang**: Ketik \`/multiruang B.Inggris dan B.Indonesia jam 8 jeda 15m durasi 120m\`
• 🚪 **Set Ruang Ujian**: Ketik \`/ruang Informatika besok 09:00 120m\`
• 🕒 **Ubah Jadwal**: Ketik \`/jadwal besok 09:00 120m\`
• 📝 **Buat Bank Soal**: Ketik \`/banksoal Biologi Kelas 10\`
• 📊 **Live Monitoring**: Ketik \`/monitoring\`
• ❓ **Lihat Semua Command**: Ketik \`/help\`

Apa yang ingin Anda kerjakan sekarang?`,
      action: { type: "none", title: "" }
    };
  }

  const existingExamsList = (context.existingExams || [])
    .slice(0, 15)
    .map(e => `• ${e.title} (ID: "${e.id}")`)
    .join("\n");

  const existingRoomsList = (context.existingRooms || [])
    .slice(0, 10)
    .map(r => `• ${r.title} (ID: "${r.id}", Token: ${r.roomCode || "-"}, Jadwal: ${r.startTime || "Skrg"}, Durasi: ${r.duration || 90}m)`)
    .join("\n");

  const systemPrompt = `Anda adalah Examku Copilot, asisten AI eksekutif di platform CBT Examku.
Tugas Anda membantu admin sekolah dan guru mengelola bank soal dan ruang ujian secara cepat, presisi, dan tepat.
Halaman aktif saat ini: ${context.currentPath || "/admin/ruang-ujian"}.
${context.lastActionRoomId ? `Ruang ujian yang baru saja dibuat/dipilih sesi ini: ID "${context.lastActionRoomId}"` : ""}
${existingRoomsList ? `Daftar Ruang Ujian Aktif di sistem:\n${existingRoomsList}` : ""}
${existingExamsList ? `Daftar Bank Soal yang tersedia:\n${existingExamsList}` : ""}

KEMAMPUAN UTAMA & TINDAKAN (ACTIONS):
1. Membuat Bank Soal Baru (action: "create_bank_soal")
2. Membuka Ruang Ujian Tunggal (action: "create_exam_room")
3. Menyesuaikan Jadwal Ruang Ujian (action: "update_exam_room")
4. Membuka Beberapa Ruang Ujian Sekaligus (action: "create_multiple_exam_rooms"):
   Gunakan jika pengguna meminta membuat beberapa ruang ujian berurutan atau paralel:
   - Hitung jadwal berurutan dengan jeda istirahat yang diminta.
   - Sertakan payload:
     {
       "breakMinutes": 15,
       "rooms": [
         {
           "id": "room-1",
           "roomName": "Ulangan Bahasa Inggris",
           "examId": "ID bank soal jika ada",
           "examTitle": "Bahasa Inggris",
           "date": "besok",
           "time": "08:00",
           "duration": 120,
           "enabled": true
         },
         {
           "id": "room-2",
           "roomName": "Ulangan Bahasa Indonesia",
           "examId": "ID bank soal jika ada",
           "examTitle": "Bahasa Indonesia",
           "date": "besok",
           "time": "10:15",
           "duration": 120,
           "enabled": true
         }
       ]
     }
5. Navigasi Halaman (action: "navigate")
6. Bantuan Umum (action: "none")

ATURAN WAJIB & SANGAT PENTING:
- DILARANG KERAS mengeluarkan proses pemikiran (thinking / reasoning / chain of thought) dalam bahasa Inggris seperti "The user wants...", "I need to...". Berikan balasan langsung dalam bahasa Indonesia yang ramah, ringkas, dan jelas.
- Kembalikan HANYA format JSON valid berikut:
{
  "reply": "Pesan balasan ramah dalam bahasa Indonesia yang terstruktur...",
  "action": {
    "type": "create_bank_soal" | "create_exam_room" | "update_exam_room" | "create_multiple_exam_rooms" | "navigate" | "none",
    "title": "Label singkat tindakan pada tombol",
    "payload": { ... }
  }
}`;

  const conversationHistory = messages.slice(-5).map(m => ({
    role: m.role,
    content: m.content
  }));

  try {
    const content = await fetchAI({
      pb,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory
      ],
      maxTokens: 1400,
      temperature: 0.2,
      jsonMode: true,
      signal
    });

    let replyText = "";
    let action: CopilotAction = { type: "none", title: "" };

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const codeBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonCandidate = codeBlockMatch ? codeBlockMatch[1] : cleanContent;

    let parsed: any = null;
    try {
      parsed = robustJSONParse(jsonCandidate);
    } catch {
      try {
        parsed = robustJSONParse(cleanContent);
      } catch {}
    }

    if (parsed) {
      replyText = parsed.reply || parsed.message || parsed.text || "";
      if (parsed.action && parsed.action.type && parsed.action.type !== "none") {
        action = {
          type: parsed.action.type,
          title: parsed.action.title || "Lakukan Tindakan",
          payload: parsed.action.payload || {}
        };
      }
    } else {
      replyText = cleanContent.replace(/```(?:json)?\s*[\s\S]*?\s*```/g, "").trim() || cleanContent.trim();
    }

    // 🛡️ Filter pemikiran internal bahasa Inggris yang bocor ke replyText
    if (/^(the user|i need to|let me|based on the user|user wants|i should)/i.test(replyText.trim())) {
      if (action.type === "create_multiple_exam_rooms") {
        replyText = "Siap, saya telah menyusun konfigurasi ruang ujian berurutan sesuai instruksi Anda. Silakan tentukan bank soal dan aktifkan/nonaktifkan sesi di bawah ini.";
      } else if (action.type === "update_exam_room") {
        replyText = "Siap, saya telah menyiapkan penyesuaian jadwal dan durasi ruang ujian sesuai permintaan Anda.";
      } else if (action.type === "create_exam_room") {
        replyText = "Siap, konfigurasi ruang ujian telah disiapkan sesuai instruksi Anda.";
      } else {
        replyText = "Perintah Anda telah saya pahami dan siap dijalankan.";
      }
    }

    if (!replyText) {
      replyText = "Perintah Anda telah dipahami. Silakan konfirmasi tindakan di bawah ini.";
    }

    return { replyText, action };
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    console.error("[Copilot AI] Error:", err);
    return {
      replyText: `Maaf, kendala jaringan saat memproses perintah Anda: ${err?.message || "Koneksi AI gagal."}. Silakan gunakan command instan seperti \`/help\` atau menu navigasi standar.`,
      action: { type: "none", title: "" }
    };
  }
};

/**
 * Eksekusi otomatis pembuatan Bank Soal di PocketBase
 */
export const executeCreateBankSoal = async (
  pb: PocketBase,
  payload: any
): Promise<{ success: boolean; examId?: string; message: string }> => {
  try {
    const title = (payload.title || "Bank Soal Baru").trim();
    const examType = payload.examType || "Ulangan";

    let subjectId: string | null = null;
    if (payload.subject) {
      try {
        const subList = await pb.collection("subjects").getList(1, 1, {
          filter: `name ~ "${payload.subject}"`
        });
        if (subList.items.length > 0) {
          subjectId = subList.items[0].id;
        } else {
          const newSub = await pb.collection("subjects").create({
            name: payload.subject,
            code: payload.subject.slice(0, 4).toUpperCase()
          });
          subjectId = newSub.id;
        }
      } catch (subErr) {
        console.warn("[Copilot] Subjek fallback:", subErr);
      }
    }

    const createdExam = await pb.collection("exams").create({
      title,
      subjectId,
      examType,
      status: "active",
      group_name: payload.bab || ""
    });

    const questions = payload.questions || payload.soal || [];
    let insertedQuestionsCount = 0;
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        try {
          const choices: any = {};
          if (q.choices) {
            Object.entries(q.choices).forEach(([k, v]: [string, any]) => {
              choices[k.toLowerCase()] = {
                text: typeof v === "object" ? v.text || "" : String(v),
                isCorrect: typeof v === "object" ? !!v.isCorrect : k.toLowerCase() === String(q.answerKey || "").toLowerCase()
              };
            });
          } else if (Array.isArray(q.pilihan)) {
            const keys = ["a", "b", "c", "d", "e"];
            q.pilihan.forEach((pText: string, pIdx: number) => {
              if (keys[pIdx]) {
                choices[keys[pIdx]] = {
                  text: String(pText),
                  isCorrect: String(pText).trim().toLowerCase() === String(q.jawaban_benar || "").trim().toLowerCase()
                };
              }
            });
          }

          await pb.collection("questions").create({
            examId: createdExam.id,
            text: q.text || q.pertanyaan || "Pertanyaan",
            type: q.type || q.jenis || "pilihan_ganda",
            choices,
            answerKey: q.answerKey || q.jawaban_benar || "a"
          });
          insertedQuestionsCount++;
        } catch (qErr) {
          console.warn("[Copilot] Gagal insert soal:", qErr);
        }
      }
    }

    return {
      success: true,
      examId: createdExam.id,
      message: `Bank soal "${title}" berhasil dibuat${insertedQuestionsCount > 0 ? ` bersama ${insertedQuestionsCount} butir soal awal` : ""}!`
    };
  } catch (error: any) {
    console.error("[Copilot] Gagal membuat bank soal:", error);
    return {
      success: false,
      message: error?.message || "Gagal membuat bank soal."
    };
  }
};

/**
 * Eksekusi pembukaan Ruang Ujian baru di PocketBase dengan jadwal presisi
 */
export const executeCreateExamRoom = async (
  pb: PocketBase,
  payload: any
): Promise<{ success: boolean; roomId?: string; roomCode?: string; message: string; scheduleText?: string }> => {
  try {
    let examId = payload.examId || "";
    let examTitle = payload.examTitle || "Ujian";

    // 1. Verifikasi apakah examId benar-benar ada di collection exams
    if (examId) {
      try {
        const existing = await pb.collection("exams").getOne(examId, { fields: "id,title" });
        examId = existing.id;
        examTitle = existing.title;
      } catch {
        // ID tidak valid / tidak ditemukan di DB, reset agar dicari / dibuat
        examId = "";
      }
    }

    // 2. Jika examId belum valid, cari bank soal yang cocok berdasarkan judul
    if (!examId && examTitle) {
      try {
        const cleanSearch = examTitle.replace(/^Bank Soal\s+/i, "").replace(/"/g, "").trim();
        const searchList = await pb.collection("exams").getList(1, 10, {
          sort: "-created"
        });
        const matched = searchList.items.find(
          e =>
            e.title.toLowerCase().includes(cleanSearch.toLowerCase()) ||
            cleanSearch.toLowerCase().includes(e.title.toLowerCase())
        );
        if (matched) {
          examId = matched.id;
          examTitle = matched.title;
        }
      } catch {}
    }

    // 3. Jika masih belum ada, ambil bank soal aktif pertama yang tersedia di sistem
    if (!examId) {
      try {
        const fallbackList = await pb.collection("exams").getList(1, 1, {
          sort: "-created"
        });
        if (fallbackList.items.length > 0) {
          examId = fallbackList.items[0].id;
          examTitle = fallbackList.items[0].title;
        }
      } catch {}
    }

    // 4. Jika di sistem belum ada bank soal sama sekali, buat bank soal baru dengan helper aman
    if (!examId) {
      const cleanSubject = examTitle.replace(/^Bank Soal\s+/i, "").trim() || "Umum";
      const bankSoalRes = await executeCreateBankSoal(pb, {
        title: `Bank Soal ${cleanSubject}`,
        subject: cleanSubject,
        examType: "Ulangan"
      });
      if (bankSoalRes.success && bankSoalRes.examId) {
        examId = bankSoalRes.examId;
      } else {
        throw new Error(bankSoalRes.message || "Gagal membuat bank soal otomatis.");
      }
    }

    const roomName = (payload.roomName || `Ruang ${examTitle}`).trim();

    // 🗓️ Hitung jadwal & durasi secara akurat
    const schedule = resolveExamSchedule({
      date: payload.date,
      time: payload.time,
      duration: payload.duration,
      text: `${roomName} ${examTitle}`
    });

    const startISO = payload.startTime || schedule.startISO;
    const endISO = payload.endTime || schedule.endISO;
    const durationMinutes = Number(payload.duration) || schedule.durationMinutes || 90;

    // Ambil daftar kelas aktif agar siswa dapat mengakses ruang ujian
    let classIds: string[] = Array.isArray(payload.classIds) ? payload.classIds : [];
    let isAllClasses = payload.allClasses !== false;

    // Jika user memilih kelas spesifik namun array kosong, fallback ke semua kelas
    if (!isAllClasses && classIds.length === 0) {
      isAllClasses = true;
    }

    if (isAllClasses) {
      try {
        const classList = await pb.collection("classes").getFullList({ fields: "id" });
        classIds = classList.map(c => c.id);
      } catch {
        classIds = [];
      }
    }

    // Bangun string className (koma terpisah nama kelas) jika memilih kelas spesifik
    let classNameStr = "";
    if (!isAllClasses && classIds.length > 0) {
      try {
        const filterStr = classIds.map(id => `id="${id}"`).join(" || ");
        const classRecords = await pb.collection("classes").getFullList({
          fields: "id,name",
          filter: filterStr
        });
        classNameStr = classRecords.map(c => c.name).join(", ");
      } catch {}
    }

    // Generate token ruang ujian 6 karakter unik
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let roomCode = "";
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const roomData = {
      title: roomName,
      room_name: roomName,
      group_name: (payload.group_name || "").trim(),
      examId,
      startTime: startISO,
      start_time: startISO,
      endTime: endISO,
      end_time: endISO,
      classIds,
      classId: classIds,
      className: classNameStr,
      allClasses: isAllClasses,
      all_classes: isAllClasses,
      duration: durationMinutes,
      cheat_limit: Number(payload.cheat_limit) || 3,
      submit_window: Number(payload.submit_window) || 10,
      max_questions: Number(payload.max_questions) || 0,
      randomize_questions: payload.randomize !== false,
      room_code: roomCode,
      show_result: !!payload.show_result,
      is_exambro: false,
      isActive: true,
      status: "active",
      isDisabled: false
    };

    const createdRoom = await pb.collection("exam_rooms").create(roomData);

    return {
      success: true,
      roomId: createdRoom.id,
      roomCode,
      scheduleText: schedule.formattedSchedule,
      message: `Ruang ujian "${roomName}" berhasil dibuka dengan Token: ${roomCode} | Jadwal: ${schedule.formattedSchedule}.`
    };
  } catch (error: any) {
    console.error("[Copilot] Gagal membuat ruang ujian:", error);
    if (error?.response?.data) {
      console.error("[Copilot] Field errors:", error.response.data);
    }
    const detailMsg = error?.response?.data
      ? Object.entries(error.response.data)
          .map(([k, v]: [string, any]) => `${k}: ${v?.message || JSON.stringify(v)}`)
          .join(", ")
      : "";
    return {
      success: false,
      message: detailMsg ? `Gagal: ${detailMsg}` : (error?.message || "Gagal membuka ruang ujian.")
    };
  }
};

/**
 * Eksekusi pembukaan beberapa Ruang Ujian sekaligus di PocketBase
 */
export const executeCreateMultipleExamRooms = async (
  pb: PocketBase,
  payload: any
): Promise<{
  success: boolean;
  createdRooms: Array<{ id: string; name: string; token: string; schedule: string }>;
  message: string;
}> => {
  try {
    const rooms = payload.rooms || [];
    const enabledRooms = rooms.filter((r: any) => r.enabled !== false);
    if (enabledRooms.length === 0) {
      throw new Error("Pilih minimal 1 ruang ujian untuk dibuka.");
    }

    const createdRooms: Array<{ id: string; name: string; token: string; schedule: string }> = [];

    for (const r of enabledRooms) {
      const res = await executeCreateExamRoom(pb, {
        roomName: r.roomName,
        examId: r.examId,
        examTitle: r.examTitle || r.subject,
        date: r.date,
        time: r.time,
        startTime: r.startTime,
        endTime: r.endTime,
        duration: r.duration
      });

      if (!res.success) {
        throw new Error(res.message || `Gagal membuka ${r.roomName}`);
      }

      createdRooms.push({
        id: res.roomId!,
        name: r.roomName,
        token: res.roomCode || "-",
        schedule: res.scheduleText || ""
      });
    }

    const summary = createdRooms
      .map((cr, idx) => `• Sesi ${idx + 1}: **${cr.name}** | Token: \`${cr.token}\` | ${cr.schedule}`)
      .join("\n");

    return {
      success: true,
      createdRooms,
      message: `Berhasil membuka ${createdRooms.length} ruang ujian sekaligus!\n\n${summary}`
    };
  } catch (error: any) {
    console.error("[Copilot] Gagal membuka multiple ruang ujian:", error);
    return {
      success: false,
      createdRooms: [],
      message: error?.message || "Gagal membuka multiple ruang ujian."
    };
  }
};

/**
 * Eksekusi pembaruan/penyesuaian jadwal & parameter Ruang Ujian di PocketBase
 */
export const executeUpdateExamRoom = async (
  pb: PocketBase,
  payload: any
): Promise<{ success: boolean; roomId?: string; roomName?: string; scheduleText?: string; message: string }> => {
  try {
    let roomId = payload.roomId;

    if (!roomId) {
      const latest = await pb.collection("exam_rooms").getList(1, 1, {
        filter: 'status != "archive"',
        sort: "-created"
      });
      if (latest.items.length > 0) {
        roomId = latest.items[0].id;
      } else {
        throw new Error("Tidak ditemukan ruang ujian aktif untuk diperbarui.");
      }
    }

    const currentRoom = await pb.collection("exam_rooms").getOne(roomId);

    const schedule = resolveExamSchedule({
      date: payload.date,
      time: payload.time,
      duration: payload.duration || currentRoom.duration,
      text: `${payload.changeSummary || ""} ${payload.text || ""}`
    });

    const updateData: any = {
      startTime: schedule.startISO,
      start_time: schedule.startISO,
      endTime: schedule.endISO,
      end_time: schedule.endISO,
      duration: schedule.durationMinutes
    };

    if (payload.roomName && payload.roomName.trim()) {
      updateData.title = payload.roomName.trim();
      updateData.room_name = payload.roomName.trim();
    }

    const updated = await pb.collection("exam_rooms").update(roomId, updateData);
    const roomName = updated.room_name || updated.title || "Ruang Ujian";

    return {
      success: true,
      roomId: updated.id,
      roomName,
      scheduleText: schedule.formattedSchedule,
      message: `Jadwal "${roomName}" berhasil diperbarui: ${schedule.formattedSchedule}.`
    };
  } catch (error: any) {
    console.error("[Copilot] Gagal memperbarui ruang ujian:", error);
    return {
      success: false,
      message: error?.message || "Gagal memperbarui ruang ujian."
    };
  }
};
