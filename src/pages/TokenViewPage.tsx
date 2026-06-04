import { useEffect, useState, useCallback } from "react";
import { useTenant } from "../context/TenantContext";
import PinGate from "../components/PinGate";

const TOKEN_VIEW_PIN = (() => {
  const now = new Date();
  const dd = now.getDate().toString().padStart(2, "0");
  return `${dd}0426`;
})();

interface LockedStudent {
  attId: string;
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  roomName: string;
  cheatCount: number;
  answeredCount: number;
  totalQuestions: number;
}

const TokenViewPage = () => {
  const { pb, school } = useTenant();

  // PIN gate
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem("token_view_unlocked") === "1");

  // Token state
  const [token, setToken] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("--:--");
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Locked students state
  const [lockedStudents, setLockedStudents] = useState<LockedStudent[]>([]);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null);

  // Fetch token from settings
  useEffect(() => {
    if (!pb) return;
    let isMounted = true;

    const fetchToken = async () => {
      try {
        const records = await pb.collection("settings").getFullList({ limit: 1, sort: "created" });
        if (!isMounted) return;
        if (records.length > 0) {
          setToken(records[0].universal_token || "");
          setTokenUpdatedAt(records[0].universal_token_updated_at || records[0].updated || "");
        }
      } catch (e) {
        // silently fail
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchToken();

    const unsub = pb.collection("settings").subscribe("*", (e) => {
      if (!isMounted) return;
      if (e.action === "update" || e.action === "create") {
        setToken(e.record.universal_token || "");
        setTokenUpdatedAt(e.record.universal_token_updated_at || e.record.updated || "");
      }
    });

    return () => {
      isMounted = false;
      unsub.then((fn) => fn()).catch(() => {});
    };
  }, [pb]);

  // Fetch locked students
  const fetchLockedStudents = useCallback(async () => {
    if (!pb) return;
    try {
      // Hanya fetch attempts yang LOCKED, expand relasi yang dibutuhkan sekaligus
      const attempts = await pb.collection("attempts").getFullList({
        filter: 'status = "LOCKED"',
        expand: "studentId,examRoomId",
      });

      if (attempts.length === 0) {
        setLockedStudents([]);
        return;
      }

      // Kumpulkan classId dan examId unik saja
      const classIds = [...new Set(
        attempts.map((a: any) => a.expand?.studentId?.classId).filter(Boolean)
      )];
      const examIds = [...new Set(
        attempts.map((a: any) => a.expand?.examRoomId?.examId).filter(Boolean)
      )];

      // Fetch classes & question counts secara paralel — filter hanya yang relevan
      const [classes, questionCounts] = await Promise.all([
        classIds.length > 0
          ? pb.collection("classes").getFullList({
              filter: classIds.map(id => `id = "${id}"`).join(" || "),
              fields: "id,name",
            })
          : Promise.resolve([]),
        examIds.length > 0
          ? Promise.all(
              examIds.map((examId: string) =>
                pb.collection("questions")
                  .getList(1, 1, { filter: `examId = "${examId}"`, fields: "id", skipTotal: false })
                  .then((r: any) => ({ examId, total: r.totalItems }))
              )
            )
          : Promise.resolve([]),
      ]);

      const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c.name]));
      const questionCountMap = Object.fromEntries(
        (questionCounts as { examId: string; total: number }[]).map(({ examId, total }) => [examId, total])
      );

      const mapped: LockedStudent[] = attempts.map((att: any) => {
        const student = att.expand?.studentId;
        const room = att.expand?.examRoomId;
        const answers = att.answers || {};
        const answeredCount = Object.keys(answers).filter(
          k => k !== "__overrides__" && answers[k] !== null && answers[k] !== undefined && answers[k] !== ""
        ).length;

        return {
          attId: att.id,
          studentId: att.studentId,
          studentName: student?.name || "Tidak Dikenal",
          nisn: student?.username || student?.nisn || "-",
          className: classMap[student?.classId] || "-",
          roomName: room?.room_name || "-",
          cheatCount: att.cheatCount || 0,
          answeredCount,
          totalQuestions: questionCountMap[room?.examId] ?? 0,
        };
      });

      setLockedStudents(mapped);
    } catch (e) {
      // silently fail
    }
  }, [pb]);

  useEffect(() => {
    if (!pb) return;
    fetchLockedStudents();

    const unsub = pb.collection("attempts").subscribe("*", (e) => {
      if (e.record.status === "LOCKED" || e.action === "delete") {
        fetchLockedStudents();
      } else if (e.action === "update" && e.record.status !== "LOCKED") {
        setLockedStudents(prev => prev.filter(s => s.attId !== e.record.id));
      }
    });

    return () => { unsub.then(fn => fn()).catch(() => {}); };
  }, [pb, fetchLockedStudents]);

  // Countdown timer
  useEffect(() => {
    if (!tokenUpdatedAt) return;
    const INTERVAL_MS = 5 * 60 * 1000;
    const tick = () => {
      const diff = new Date(tokenUpdatedAt).getTime() + INTERVAL_MS - Date.now();
      if (diff <= 0) { setTimeLeft("00:00"); return; }
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [tokenUpdatedAt]);

  // Unlock student
  const handleUnlock = async (attId: string) => {
    if (!pb || unlocking) return;
    setUnlocking(attId);
    try {
      await pb.collection("attempts").update(attId, { status: "ongoing", cheatCount: 0 });
      setLockedStudents(prev => prev.filter(s => s.attId !== attId));
      setUnlockSuccess(attId);
      setTimeout(() => setUnlockSuccess(null), 2000);
    } catch (e) {
      // silently fail
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 select-none overflow-hidden relative">

      {/* PIN Gate */}
      {!pinUnlocked && (
        <PinGate
          correctPin={TOKEN_VIEW_PIN}
          onUnlocked={() => setPinUnlocked(true)}
        />
      )}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      {/* Main layout: token left, locked students right */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* LEFT — Token */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0">
          {school?.name && (
            <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.3em] mb-8">
              {school.name}
            </p>
          )}
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em] mb-6">
            Token Akses Ujian
          </p>

          {/* Token chars */}
          <div className="flex items-center justify-center">
            {loading ? (
              <div className="flex gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-14 h-20 sm:w-20 sm:h-28 rounded-2xl bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : token ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {token.split("").map((char, i) => (
                  <div key={i} className="w-14 h-20 sm:w-20 sm:h-28 md:w-24 md:h-32 rounded-2xl sm:rounded-3xl bg-slate-900 border border-amber-500/20 flex items-center justify-center shadow-2xl">
                    <span className="text-4xl sm:text-6xl md:text-7xl font-black font-mono text-amber-400 tabular-nums">
                      {char}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-lg font-bold">Token tidak tersedia</p>
            )}
          </div>

          {token && (
            <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Berlaku</span>
              <span className="text-amber-400 text-sm font-black font-mono tabular-nums">{timeLeft}</span>
            </div>
          )}
          <p className="mt-4 text-slate-700 text-[10px] font-medium uppercase tracking-widest">
            Token diperbarui otomatis setiap 5 menit
          </p>
        </div>

        {/* RIGHT — Locked Students */}
        <div className="w-full lg:w-[420px] xl:w-[480px] border-t lg:border-t-0 lg:border-l border-slate-800/60 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${lockedStudents.length > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-700"}`} />
              <span className="text-slate-300 text-sm font-black uppercase tracking-widest">Siswa Terkunci</span>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${lockedStudents.length > 0 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-slate-800 text-slate-600 border border-slate-700"}`}>
              {lockedStudents.length} siswa
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {lockedStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-widest text-center">Tidak ada siswa terkunci</p>
              </div>
            ) : (
              lockedStudents.map((s) => (
                <div key={s.attId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  {/* Student info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 text-sm font-black truncate">{s.studentName}</p>
                      <p className="text-slate-500 text-[11px] font-mono">{s.nisn}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      TERKUNCI
                    </span>
                  </div>

                  {/* Detail grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/50 rounded-xl p-2.5">
                      <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mb-0.5">Kelas</p>
                      <p className="text-slate-300 text-xs font-bold truncate">{s.className}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5">
                      <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mb-0.5">Ruang Ujian</p>
                      <p className="text-slate-300 text-xs font-bold truncate">{s.roomName}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5">
                      <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mb-0.5">Soal Dijawab</p>
                      <p className="text-slate-300 text-xs font-bold">
                        {s.answeredCount}
                        {s.totalQuestions > 0 && <span className="text-slate-600"> / {s.totalQuestions}</span>}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5">
                      <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mb-0.5">Pelanggaran</p>
                      <p className="text-rose-400 text-xs font-black">{s.cheatCount}x</p>
                    </div>
                  </div>

                  {/* Unlock button */}
                  <button
                    onClick={() => handleUnlock(s.attId)}
                    disabled={!!unlocking}
                    className={`w-full h-10 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      unlockSuccess === s.attId
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    {unlocking === s.attId ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Membuka...
                      </>
                    ) : unlockSuccess === s.attId ? (
                      <>✓ Berhasil Dibuka</>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                        Buka Kunci
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenViewPage;
