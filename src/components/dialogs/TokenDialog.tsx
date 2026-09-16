import { useState, useRef, useEffect, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, AlertCircle, X, Clipboard, ArrowRight } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { cn } from "../../lib/utils";

interface TokenDialogProps {
  selectedRoom: any | null;
  universalToken?: string;
  onClose: () => void;
}

const PIN_LENGTH = 6;

const TokenDialog = memo(({ selectedRoom, universalToken, onClose }: TokenDialogProps) => {
  const { pb } = useTenant();
  const { student } = useStudentAuth();
  const navigate = useNavigate();

  const [tokenValue, setTokenValue] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const validatingRef = useRef(false);

  // Reset dan pasang fokus instan saat dialog dibuka
  useEffect(() => {
    if (selectedRoom) {
      setTokenValue("");
      setTokenError("");
      setIsValidating(false);
      validatingRef.current = false;
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.focus();
          setIsFocused(true);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedRoom?.id]);

  if (!selectedRoom) return null;

  const handleClose = () => {
    if (isValidating) return;
    setTokenError("");
    onClose();
  };

  const handleValidate = async (valToValidate?: string) => {
    const rawInput = valToValidate ?? tokenValue;
    const input = rawInput.trim().toUpperCase().replace(/\s/g, "");
    if (!input || !selectedRoom || !student || !pb || isValidating || validatingRef.current) return;

    validatingRef.current = true;
    setIsValidating(true);
    setTokenError("");

    try {
      // 1. FAST-PATH: Jika token cocok dengan token ruangan di memori (0ms delay)
      const localRoomToken = (selectedRoom.token || "").toString().trim().toUpperCase().replace(/\s/g, "");
      if (localRoomToken && input === localRoomToken) {
        sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
        document.documentElement.requestFullscreen?.().catch(() => {});
        navigate("/cbt");
        return;
      }

      // 2. FAST-PATH: Jika token cocok dengan master universal token di memori (0ms delay)
      const localUniversal = (universalToken || "").toString().trim().toUpperCase().replace(/\s/g, "");
      if (localUniversal && input === localUniversal) {
        sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
        document.documentElement.requestFullscreen?.().catch(() => {});
        navigate("/cbt");
        return;
      }

      // 3. SLOW-PATH: Cek fresh room dan master settings di server (fallback)
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
      ).toString().trim().toUpperCase().replace(/\s/g, "");
      const freshRoomToken = (freshRoom.token || "").toString().trim().toUpperCase().replace(/\s/g, "");

      if (input !== globalToken && input !== freshRoomToken) {
        throw new Error("Token ujian tidak cocok. Silakan periksa kembali.");
      }

      sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
      document.documentElement.requestFullscreen?.().catch(() => {});
      navigate("/cbt");
    } catch (err: any) {
      setTokenError(err.message || "Token ujian tidak cocok. Silakan periksa kembali.");
      setIsValidating(false);
      validatingRef.current = false;
      // RESET INPUT SAAT SALAH: kosongkan state dan input DOM agar siswa bisa langsung ketik ulang
      setTokenValue("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setTimeout(() => {
        inputRef.current?.focus();
        setIsFocused(true);
      }, 50);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isValidating || validatingRef.current) return;
    const raw = e.target.value;
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PIN_LENGTH);
    setTokenValue(cleaned);
    if (tokenError) setTokenError("");
  };

  const handleSubmit = (val?: string) => {
    handleValidate(val ?? tokenValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isValidating && tokenValue.length === PIN_LENGTH) {
      e.preventDefault();
      handleSubmit(tokenValue);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PIN_LENGTH);
      if (cleaned) {
        setTokenValue(cleaned);
        if (inputRef.current) inputRef.current.value = cleaned;
        if (tokenError) setTokenError("");
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const roomTitle = selectedRoom.room_name || selectedRoom.examTitle || selectedRoom.name || "Ujian";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-dialog-title"
    >
      <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Tombol Tutup */}
        <button
          onClick={handleClose}
          disabled={isValidating}
          className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-1.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Tutup dialog"
          aria-label="Tutup dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Dialog */}
        <div className="bg-emerald-600 px-6 py-6 text-white relative">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <KeyRound className="w-16 h-16" />
          </div>
          <div>
            <h2 id="token-dialog-title" className="text-lg font-bold uppercase tracking-tight">
              Verifikasi Akses Ujian
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded bg-white/15 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-100 max-w-[280px] truncate">
                {roomTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Konten Input PIN Box */}
        <div className="p-5 sm:p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Masukkan 6 Digit Token
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                disabled={isValidating}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1 p-1 -mr-1 rounded transition-colors disabled:opacity-50"
                title="Tempel token dari clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" /> Tempel Token
              </button>
            </div>

            {/* Container 6 Kotak PIN + Single Native Input Overlay */}
            <div
              className="relative cursor-pointer select-none"
              onClick={() => {
                inputRef.current?.focus();
                setIsFocused(true);
              }}
            >
              {/* Native Input Tersembunyi untuk Keyboard Responsif 0ms Lag */}
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                maxLength={PIN_LENGTH}
                value={tokenValue}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Token ujian 6 karakter"
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer pointer-events-auto"
              />

              {/* Tampilan Visual 6 Kotak PIN - Bebas GPU Lag & Transisi Berat */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 py-1">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => {
                  const char = tokenValue[index] || "";
                  const isCurrentSlot = isFocused && index === tokenValue.length;
                  const isFilled = Boolean(char);

                  return (
                    <div
                      key={index}
                      className={cn(
                        "h-14 sm:h-16 rounded-xl flex flex-col items-center justify-center font-mono font-black text-xl sm:text-2xl select-none border-2",
                        tokenError
                          ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          : isCurrentSlot
                          ? "border-emerald-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          : isFilled
                          ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600"
                      )}
                    >
                      {char ? (
                        <span className="leading-none">{char}</span>
                      ) : isCurrentSlot ? (
                        <span className="w-0.5 h-6 bg-emerald-600 rounded-full" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pesan Kesalahan */}
            {tokenError && (
              <p className="text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 text-center mt-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {tokenError}
              </p>
            )}
          </div>

          {/* Catatan / Panduan */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-left">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
              💡 Masukkan 6 digit token lalu klik tombol konfirmasi di bawah atau tekan Enter. Minta token kepada pengawas ruangan Anda.
            </p>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handleSubmit(tokenValue)}
              disabled={isValidating || tokenValue.length < PIN_LENGTH}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-md transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {isValidating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Token...</span>
                </>
              ) : (
                <>
                  <span>Konfirmasi & Masuk Ujian</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

TokenDialog.displayName = "TokenDialog";

export default TokenDialog;
