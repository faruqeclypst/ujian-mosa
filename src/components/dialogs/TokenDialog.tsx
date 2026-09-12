import { useState, useRef, useEffect, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { useTenant } from "../../context/TenantContext";
import { useStudentAuth } from "../../context/StudentAuthContext";

interface TokenDialogProps {
  selectedRoom: any | null;
  onClose: () => void;
}

const TokenDialog = memo(({ selectedRoom, onClose }: TokenDialogProps) => {
  const { pb } = useTenant();
  const { student } = useStudentAuth();
  const navigate = useNavigate();

  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevRoomIdRef = useRef<string | null>(null);

  // Fokus hanya satu kali saat modal pertama kali dibuka untuk room tertentu
  useEffect(() => {
    if (selectedRoom?.id) {
      if (selectedRoom.id !== prevRoomIdRef.current) {
        prevRoomIdRef.current = selectedRoom.id;
        setTokenInput("");
        setTokenError("");
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    } else {
      prevRoomIdRef.current = null;
    }
  }, [selectedRoom?.id]);

  const handleClose = () => {
    if (isValidating) return;
    setTokenInput("");
    setTokenError("");
    onClose();
  };

  // Typing handler yang ultra-responsif (0ms lag, langsung uppercase di JS agar keyboard HP tidak glitch)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/\s/g, "");
    setTokenInput(val);
    setTokenError("");
  }, []);

  const handleValidateToken = async () => {
    if (!selectedRoom || !student || !pb) return;
    const input = tokenInput.trim().toUpperCase();
    if (!input) return;

    setTokenError("");
    setIsValidating(true);

    try {
      // 1. FAST-PATH: Jika token langsung cocok dengan data room yang sudah di-load di memori
      const localRoomToken = (selectedRoom.token || "").toString().trim().toUpperCase();
      if (localRoomToken && input === localRoomToken) {
        sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
        document.documentElement.requestFullscreen?.().catch(() => {});
        navigate("/cbt");
        return;
      }

      // 2. SLOW-PATH: Jika belum cocok (misal proctor baru saja generate token baru atau pakai universal token)
      const [freshRoom, settingsRecords] = await Promise.all([
        pb.collection("exam_rooms").getOne(selectedRoom.id, { requestKey: null }).catch(async () => {
          const list = await pb.collection("exam_rooms").getFullList({
            filter: `id = "${selectedRoom.id}"`,
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
        throw new Error("Ruangan ini sudah tidak aktif atau Anda tidak memiliki akses.");
      }

      const globalToken = (
        settingsRecords?.universal_token ||
        settingsRecords?.global_token ||
        settingsRecords?.globalToken ||
        ""
      ).toString().trim().toUpperCase();
      const freshRoomToken = (freshRoom.token || "").toString().trim().toUpperCase();

      if (input !== globalToken && input !== freshRoomToken) {
        throw new Error("Token yang Anda masukkan belum tepat. Silakan cek kembali.");
      }

      sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
      document.documentElement.requestFullscreen?.().catch(() => {});
      navigate("/cbt");
    } catch (err: any) {
      setTokenError(err.message || "Terjadi kesalahan saat verifikasi.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={!!selectedRoom} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 rounded-xl border-none shadow-2xl p-0">
        <div className="bg-emerald-600 px-6 py-8 text-white relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <KeyRound className="w-16 h-16" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-tight">Verifikasi Akses</DialogTitle>
            <p className="text-emerald-50/80 text-[10px] font-bold uppercase tracking-widest mt-1.5 opacity-90">
              Masukkan Token Ruangan
            </p>
          </DialogHeader>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                Token Ujian
              </label>
              <input
                ref={inputRef}
                type="text"
                value={tokenInput}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tokenInput && !isValidating) {
                    e.preventDefault();
                    handleValidateToken();
                  }
                }}
                placeholder="ISI TOKEN"
                className="h-14 w-full text-center text-2xl font-black bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-none disabled:opacity-50 select-text pointer-events-auto"
                disabled={isValidating}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={20}
              />
              {tokenError && (
                <p className="text-rose-500 text-[9px] font-bold mt-2 flex items-center gap-1 uppercase text-left">
                  <AlertCircle className="w-3 h-3" /> {tokenError}
                </p>
              )}
            </div>
            <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800 text-left">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">
                ⚠️ Pastikan koneksi internet stabil sebelum mulai. Pengerjaan Anda akan tercatat secara otomatis.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleValidateToken}
              disabled={!tokenInput || isValidating}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
            >
              {isValidating ? "Memverifikasi..." : "Konfirmasi & Masuk"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
});

TokenDialog.displayName = "TokenDialog";

export default TokenDialog;
