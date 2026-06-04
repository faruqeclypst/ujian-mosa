import { useState, useCallback, useEffect, memo } from "react";

interface PinGateProps {
  correctPin: string;
  onUnlocked: () => void;
}

const PinGate = memo(({ correctPin, onUnlocked }: PinGateProps) => {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const handleSubmit = useCallback((input: string) => {
    if (input === correctPin) {
      sessionStorage.setItem("token_view_unlocked", "1");
      onUnlocked();
    } else {
      setPinError(true);
      setPinInput("");
    }
  }, [correctPin, onUnlocked]);

  const press = useCallback((digit: string) => {
    setPinError(false);
    setPinInput(prev => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) {
        // submit di frame berikutnya agar dot ke-6 sempat render
        setTimeout(() => handleSubmit(next), 0);
      }
      return next;
    });
  }, [handleSubmit]);

  const backspace = useCallback(() => {
    setPinError(false);
    setPinInput(prev => prev.slice(0, -1));
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-slate-300 text-base font-black uppercase tracking-[0.3em]">Masukkan PIN</p>
        {/* <p className="text-slate-600 text-xs font-medium">PIN: tanggal hari ini + 0426</p> */}
      </div>

      {/* Dots */}
      <div className="flex gap-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-100 ${
              i < pinInput.length ? "bg-amber-400 border-amber-400" : "bg-transparent border-slate-700"
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 mt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            onClick={() => press(String(n))}
            className="w-16 h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xl font-black transition-colors active:scale-95 border border-slate-700/50"
          >
            {n}
          </button>
        ))}
        <button
          onClick={backspace}
          className="w-16 h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-400 text-sm font-black transition-colors active:scale-95 border border-slate-700/50"
        >
          ⌫
        </button>
        <button
          onClick={() => press("0")}
          className="w-16 h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xl font-black transition-colors active:scale-95 border border-slate-700/50"
        >
          0
        </button>
        <button
          onClick={() => pinInput.length === 6 && handleSubmit(pinInput)}
          className="w-16 h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-sm font-black transition-colors active:scale-95"
        >
          ✓
        </button>
      </div>

      {pinError && (
        <p className="text-rose-400 text-xs font-bold animate-in fade-in duration-200">
          PIN salah, coba lagi
        </p>
      )}
    </div>
  );
});

PinGate.displayName = "PinGate";

export default PinGate;
