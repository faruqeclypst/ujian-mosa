import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  KeyRound,
  AlertCircle
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";

interface ExamConfirmationPageProps {
  room: any;
  student: any;
  universalToken?: string;
  onBack: () => void;
}

export const ExamConfirmationPage: React.FC<ExamConfirmationPageProps> = ({
  room,
  student,
  universalToken,
  onBack,
}) => {
  const navigate = useNavigate();
  const { pb } = useTenant();

  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const roomTitle = room.room_name || room.examTitle || room.name || "Ruang Ujian";
  const subjectName = room.subject || room.subjectName || room.subject_name || "";
  const duration = room.duration || 60;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isValidating) return;
    const raw = e.target.value;
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setTokenInput(cleaned);
    if (tokenError) setTokenError("");
  };

  const handleValidateAndStart = async () => {
    const input = tokenInput.trim().toUpperCase().replace(/\s/g, "");
    if (!input || !room || !student || !pb || isValidating) return;

    setIsValidating(true);
    setTokenError("");

    try {
      // 1. FAST-PATH: Cek token ruangan di memori (0ms delay)
      const localRoomToken = (room.token || "").toString().trim().toUpperCase().replace(/\s/g, "");
      if (localRoomToken && input === localRoomToken) {
        sessionStorage.setItem("activeCBTRoomId", room.id);
        document.documentElement.requestFullscreen?.().catch(() => {});
        navigate("/cbt");
        return;
      }

      // 2. FAST-PATH: Cek universal master token di memori (0ms delay)
      const localUniversal = (universalToken || "").toString().trim().toUpperCase().replace(/\s/g, "");
      if (localUniversal && input === localUniversal) {
        sessionStorage.setItem("activeCBTRoomId", room.id);
        document.documentElement.requestFullscreen?.().catch(() => {});
        navigate("/cbt");
        return;
      }

      // 3. SLOW-PATH: Validasi langsung ke database PocketBase jika di memori belum cocok
      const [freshRoom, settingsRecords] = await Promise.all([
        pb.collection("exam_rooms").getOne(room.id, { requestKey: null }).catch(async () => {
          const list = await pb.collection("exam_rooms").getFullList({
            filter: `id = "${room.id}"`,
            limit: 1,
            requestKey: null,
          });
          return list[0] ?? null;
        }),
        pb.collection("settings").getFirstListItem("", {
          requestKey: "token_settings",
          fields: "universal_token,global_token,globalToken",
        }).catch(() => null),
      ]);

      if (!freshRoom) {
        throw new Error("Ruangan ujian ini sudah tidak aktif atau Anda tidak memiliki akses.");
      }

      const globalToken = (
        settingsRecords?.universal_token ||
        settingsRecords?.global_token ||
        settingsRecords?.globalToken ||
        ""
      ).toString().trim().toUpperCase().replace(/\s/g, "");
      const freshRoomToken = (freshRoom.token || "").toString().trim().toUpperCase().replace(/\s/g, "");

      if (input !== globalToken && input !== freshRoomToken) {
        throw new Error("Token ujian tidak cocok. Silakan periksa kembali.");
      }

      sessionStorage.setItem("activeCBTRoomId", room.id);
      document.documentElement.requestFullscreen?.().catch(() => {});
      navigate("/cbt");
    } catch (err: any) {
      setTokenError(err.message || "Token tidak cocok. Periksa kembali.");
      setIsValidating(false);
      setTokenInput("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isValidating && tokenInput.length === 6) {
      e.preventDefault();
      handleValidateAndStart();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center px-4 py-4 sm:py-6">
      <div className="max-w-md w-full mx-auto">
        {/* Kartu Utama: Super Simpel, Padat, Pas 1 Layar Tanpa Scrolling */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Header Info Ujian */}
          <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            {/* Baris 1: Nama Ruang di Kiri, Nama Mapel di Kanan (Sejajar 1 Baris) */}
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                {roomTitle}
              </h1>
              {subjectName && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider shrink-0 text-right">
                  {subjectName}
                </span>
              )}
            </div>

            {/* Baris 2: Nama Siswa di Kiri, Durasi Waktu di Kanan (Sejajar) */}
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="truncate max-w-[200px]">
                {student?.name} {student?.className ? `(${student.className})` : ""}
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 shrink-0">
                <Clock className="w-3.5 h-3.5 text-emerald-500" /> {duration} Menit
              </span>
            </div>
          </div>

          {/* Form Input Token (Tanpa Tombol Tempel) */}
          <div className="space-y-2">
            <label htmlFor="token-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Token Ujian (6 Digit)
            </label>

            <input
              id="token-input"
              ref={inputRef}
              type="text"
              inputMode="text"
              maxLength={6}
              value={tokenInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isValidating}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="TOKEN"
              className="w-full h-14 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl text-center font-mono font-black text-2xl tracking-[0.3em] uppercase text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-bold focus:outline-none transition-colors"
            />

            {tokenError && (
              <p className="text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 text-center mt-1">
                <AlertCircle className="w-4 h-4 shrink-0" /> {tokenError}
              </p>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={handleValidateAndStart}
              disabled={isValidating || tokenInput.length < 6}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-md transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {isValidating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memeriksa Token...</span>
                </>
              ) : (
                <>
                  <span>Mulai Ujian</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              disabled={isValidating}
              className="w-full py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold text-center transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamConfirmationPage;
