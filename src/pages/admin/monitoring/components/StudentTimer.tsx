import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface StudentTimerProps {
  attempt: any;
  room: any;
}

// 🕒 Real-time Student Timer Component (Clean Neon Style)
export const StudentTimer = ({ attempt, room }: StudentTimerProps) => {
  const [timeLabel, setTimeLabel] = useState<string>("--:--");

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

        setTimeLabel(timeStr);
      } else if (attempt?.status === "LOCKED") {
        setTimeLabel("Terkunci");
      } else {
        setTimeLabel("--:--");
      }
      return;
    }

    const calculateTime = () => {
      const start = new Date(attempt.startedAt || attempt.startTime || attempt.created).getTime();
      const durationMs = (room?.duration || 0) * 60 * 1000;
      const endByDuration = start + durationMs;

      const now = Date.now();
      const diff = endByDuration - now;

      if (diff <= 0) {
        setTimeLabel("Habis");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLabel(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setTimeLabel(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [attempt, room]);

  if (!attempt || attempt.status === "OFFLINE") return null;

  return (
    <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
      <Clock className="h-2.5 w-2.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
      <span>{timeLabel}</span>
    </div>
  );
};
