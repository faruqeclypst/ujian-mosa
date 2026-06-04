import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
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

  const handleClose = () => {
    if (isValidating) return;
    setTokenInput("");
    setTokenError("");
    onClose();
  };

  const handleValidateToken = async () => {
    if (!selectedRoom || !student || !pb) return;
    setTokenError("");
    setIsValidating(true);
    try {
      // Fetch room & settings secara paralel — hemat 1 round trip
      const [freshRoom, settingsRecords] = await Promise.all([
        pb.collection("exam_rooms").getOne(selectedRoom.id, { requestKey: null }).catch(async () => {
          // Fallback ke getList jika getOne tidak diizinkan oleh API rules
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
      const roomToken = (freshRoom.token || "").toString().trim().toUpperCase();
      const input = tokenInput.trim().toUpperCase();

      if (input !== globalToken && input !== roomToken) {
        throw new Error("Token yang Anda masukkan belum tepat. Silakan cek kembali.");
      }

      sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);

      // Fullscreen tidak perlu di-await — tidak memblokir navigasi
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
              <Input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && tokenInput && !isValidating) handleValidateToken(); }}
                placeholder="Contoh: EJ24A"
                className="h-14 text-center text-2xl font-black bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg uppercase"
                disabled={isValidating}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
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
