import React, { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface StudentTimerProps {
  attempt: any;
  room: any;
}

// 🕒 Real-time Student Timer Component
export const StudentTimer = ({ attempt, room }: StudentTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("--:--");

  useEffect(() => {
    if (!attempt || attempt.status !== "ongoing") {
      if (attempt?.status === "finished") {
        const start = new Date(attempt.startedAt || attempt.startTime || attempt.created).getTime();
        const end = new Date(attempt.submittedAt || attempt.updated || Date.now()).getTime();
        const diff = Math.max(0, end - start);

        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const timeStr = hrs > 0
          ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        setTimeLeft(`Selesai (${timeStr})`);
      } else if (attempt?.status === "LOCKED") setTimeLeft("TERKUNCI");
      else setTimeLeft("--:--");
      return;
    }

    const calculateTime = () => {
      const start = new Date(attempt.startedAt || attempt.startTime || attempt.created).getTime();
      const durationMs = (room?.duration || 0) * 60 * 1000;
      const endByDuration = start + durationMs;

      const now = Date.now();
      const diff = endByDuration - now;

      if (diff <= 0) {
        setTimeLeft("HABIS");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [attempt, room]);

  const iconColor = timeLeft === "HABIS" || timeLeft === "TERKUNCI" ? "text-rose-400" :
    timeLeft.startsWith("Selesai") ? "text-emerald-400" :
      "text-blue-400";

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all ${timeLeft === "HABIS" || timeLeft === "TERKUNCI" ? "text-rose-600 border-rose-100 bg-rose-50" :
      timeLeft.startsWith("Selesai") ? "text-emerald-600 border-emerald-100 bg-emerald-50" :
        "text-blue-600 border-blue-50 bg-blue-50/30"
      }`}>
      <Timer className={`h-3 w-3 ${iconColor} ${attempt?.status === "ongoing" ? "animate-pulse" : ""}`} />
      <span className="font-mono font-bold text-[9px] tracking-tight whitespace-nowrap">
        {timeLeft}
      </span>
    </div>
  );
};
