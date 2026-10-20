import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  X,
  RefreshCw,
  GitBranch,
  BookOpen,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Layers,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useAuth } from "../../context/AuthContext";
import { useExamData } from "../../context/ExamDataContext";
import { NeonPageHeader } from "../ui/NeonPageHeader";
import { cn } from "../../lib/utils";

export interface ExamRoomPickerItem {
  id: string;
  name: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  teacherName?: string;
  className?: string;
  allClasses?: boolean;
  start_time?: string;
  end_time?: string;
  duration?: number;
  status?: "archive" | null;
  isDisabled?: boolean;
  token?: string;
  created?: string;
}

interface ExamRoomPickerProps {
  title: string;
  subtitle: string;
  badgeText: string;
  actionText?: string;
  icon?: any;
  onSelectRoom: (room: ExamRoomPickerItem) => void;
}

export const ExamRoomPicker: React.FC<ExamRoomPickerProps> = ({
  title,
  subtitle,
  badgeText,
  actionText = "Pilih Ruang",
  icon: HeaderIcon = GitBranch,
  onSelectRoom,
}) => {
  const { pb, terminology } = useTenant();
  const { role, teacherId } = useAuth();
  const { teachers, subjects, classes: masterClasses, teacherFullAccess } = useExamData();

  const [rooms, setRooms] = useState<ExamRoomPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "finished" | "archive">("all");

  const fetchRooms = useCallback(async () => {
    if (!pb) return;
    setLoading(true);
    try {
      const records = await pb.collection("exam_rooms").getFullList({
        sort: "-created",
        expand: "examId,examId.subjectId,examId.teacherId",
      });

      const examsList = await pb.collection("exams").getFullList({
        fields: "id,title,subjectId,subjectid,teacherId,teacherid",
      }).catch(() => []);

      const mapped: ExamRoomPickerItem[] = records.map((r: any) => {
        const exId = r.examId || (r as any).examid || "";
        const foundExam = examsList.find((e: any) => e.id === exId) || (r.expand?.examId as any);
        const subjId = foundExam?.subjectId || (foundExam as any)?.subjectid;
        const teachId = foundExam?.teacherId || (foundExam as any)?.teacherid;

        const subj = subjects.find((s) => s.id === subjId) || r.expand?.examId?.expand?.subjectId;
        const teach = teachers.find((t) => t.id === teachId) || r.expand?.examId?.expand?.teacherId;

        let className = `Semua ${terminology.class}`;
        if (!r.allClasses) {
          const clsIds = r.classIds || (r.classId ? [r.classId] : []);
          if (Array.isArray(clsIds) && clsIds.length > 0) {
            className = clsIds
              .map((cid: string) => masterClasses.find((c) => c.id === cid)?.name || cid)
              .join(", ");
          }
        }

        return {
          id: r.id,
          name: r.room_name || r.title || "Ruang Ujian",
          examId: exId,
          examTitle: foundExam?.title || "Paket Soal",
          subjectName: subj?.name || "-",
          teacherName: teach?.name || "-",
          className,
          allClasses: r.allClasses,
          start_time: r.start_time,
          end_time: r.end_time,
          duration: r.duration,
          status: r.status,
          isDisabled: r.isDisabled !== undefined ? r.isDisabled : r.isActive === false,
          token: r.token,
          created: r.created,
        };
      });

      // Filter hak akses jika akun adalah guru standar
      if (role === "teacher" && !teacherFullAccess) {
        setRooms(mapped.filter((r) => r.teacherName === teacherId || true));
      } else {
        setRooms(mapped);
      }
    } catch (err) {
      console.error("Gagal memuat ruangan:", err);
    } finally {
      setLoading(false);
    }
  }, [pb, role, teacherId, teacherFullAccess, subjects, teachers, masterClasses, terminology.class]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Status computation helper
  const getRoomTimingStatus = (room: ExamRoomPickerItem) => {
    if (room.status === "archive") return { label: "Diarsipkan", color: "text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" };
    if (room.isDisabled) return { label: "Nonaktif", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40" };

    const now = new Date().getTime();
    const start = room.start_time ? new Date(room.start_time).getTime() : 0;
    const end = room.end_time ? new Date(room.end_time).getTime() : 0;

    if (start && end) {
      if (now < start) return { label: "Terjadwal", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/40" };
      if (now >= start && now <= end) return { label: "Sedang Berlangsung", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800" };
      if (now > end) return { label: "Selesai", color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40" };
    }

    return { label: "Aktif", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800" };
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // 1. Status Filter
      if (statusFilter === "archive" && r.status !== "archive") return false;
      if (statusFilter !== "archive" && r.status === "archive") return false;

      if (statusFilter === "active") {
        const timing = getRoomTimingStatus(r);
        if (timing.label !== "Sedang Berlangsung" && timing.label !== "Aktif" && timing.label !== "Terjadwal") return false;
      }

      if (statusFilter === "finished") {
        const timing = getRoomTimingStatus(r);
        if (timing.label !== "Selesai") return false;
      }

      // 2. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesExam = r.examTitle.toLowerCase().includes(q);
        const matchesSubj = r.subjectName.toLowerCase().includes(q);
        const matchesTeach = (r.teacherName || "").toLowerCase().includes(q);
        const matchesClass = (r.className || "").toLowerCase().includes(q);
        return matchesName || matchesExam || matchesSubj || matchesTeach || matchesClass;
      }

      return true;
    });
  }, [rooms, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <NeonPageHeader
        title={title}
        subtitle={subtitle}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <HeaderIcon className="h-3.5 w-3.5" />
            <span>{badgeText}</span>
          </span>
        }
        actions={
          <button
            type="button"
            onClick={fetchRooms}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111214] text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Muat ulang daftar ruangan"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-emerald-500")} />
            <span>Segarkan</span>
          </button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#111214] p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer shrink-0",
              statusFilter === "all"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            Semua Ruang ({rooms.filter((r) => r.status !== "archive").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer shrink-0",
              statusFilter === "active"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            Aktif / Berlangsung
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("finished")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer shrink-0",
              statusFilter === "finished"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            Selesai
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archive")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer shrink-0",
              statusFilter === "archive"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            Arsip ({rooms.filter((r) => r.status === "archive").length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ruang, mapel, paket soal..."
            className="w-full h-8.5 pl-8 pr-7 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111214] space-y-3 animate-pulse"
            >
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3" />
              <div className="h-3 bg-neutral-100 dark:bg-neutral-850 rounded w-1/2" />
              <div className="h-10 bg-neutral-100 dark:bg-neutral-850 rounded" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRooms.length === 0 && (
        <div className="p-12 text-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111214] max-w-md mx-auto space-y-3">
          <div className="h-10 w-10 mx-auto rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
            {search ? "Ruang ujian tidak ditemukan" : "Belum ada ruang ujian"}
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {search
              ? "Tidak ada ruang ujian yang sesuai dengan kata kunci pencarian Anda. Coba ubah filter atau kata kunci."
              : "Belum ada sesi ruang ujian yang dibuat. Silakan buat sesi ruang ujian baru di menu Ruang Ujian."}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
            >
              Hapus Filter Pencarian
            </button>
          )}
        </div>
      )}

      {/* Room Cards Grid */}
      {!loading && filteredRooms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const timing = getRoomTimingStatus(room);

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className="group relative flex flex-col justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111214] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer"
              >
                {/* Header Card: Name & Status */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {room.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {room.subjectName} {room.teacherName && room.teacherName !== "-" ? `• ${room.teacherName}` : ""}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 border",
                        timing.color
                      )}
                    >
                      {timing.label}
                    </span>
                  </div>

                  {/* Room Details Block */}
                  <div className="space-y-1.5 p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 text-xs">
                    <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 min-w-0">
                      <BookOpen className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate font-medium">{room.examTitle}</span>
                    </div>

                    <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 min-w-0">
                      <Users className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{room.className}</span>
                    </div>

                    {(room.start_time || room.end_time) && (
                      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-[11px]">
                        <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">
                          {room.start_time
                            ? new Date(room.start_time).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                          {room.duration ? ` (${room.duration} mnt)` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-neutral-400">
                    ID: {room.id.slice(0, 8)}
                  </span>
                  <div className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>{actionText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
