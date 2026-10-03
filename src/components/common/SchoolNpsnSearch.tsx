import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  School,
  MapPin,
  CheckCircle2,
  X,
  Loader2,
  Edit,
  Building,
  GraduationCap
} from "lucide-react";
import {
  searchSekolah,
  SekolahApiItem,
  formatSchoolAddress,
  generateSlugFromName
} from "../../utils/sekolahApiHelper";
import { cn } from "../../lib/utils";

interface SchoolNpsnSearchProps {
  valueSchoolName: string;
  valueNpsn?: string;
  onSelectSchool: (school: SekolahApiItem) => void;
  onManualChange: (schoolName: string, npsn: string) => void;
  className?: string;
  initialCustomMode?: boolean;
}

export const SchoolNpsnSearch: React.FC<SchoolNpsnSearchProps> = ({
  valueSchoolName,
  valueNpsn,
  onSelectSchool,
  onManualChange,
  className,
  initialCustomMode = false
}) => {
  const [isCustomMode, setIsCustomMode] = useState<boolean>(initialCustomMode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SekolahApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SekolahApiItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lakukan debounce search saat query berubah
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 3) {
      setResults([]);
      setHasSearched(false);
      setIsOpenDropdown(false);
      return;
    }

    setLoading(true);
    setIsOpenDropdown(true);

    debounceRef.current = setTimeout(async () => {
      const items = await searchSekolah(val.trim());
      setResults(items);
      setLoading(false);
      setHasSearched(true);
    }, 350);
  };

  const handlePickSchool = (item: SekolahApiItem) => {
    setSelectedItem(item);
    setQuery("");
    setResults([]);
    setIsOpenDropdown(false);
    onSelectSchool(item);
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setQuery("");
    setResults([]);
    onManualChange("", "");
  };

  const handleSwitchToCustom = () => {
    setIsCustomMode(true);
    setSelectedItem(null);
    setIsOpenDropdown(false);
    onManualChange(valueSchoolName || query, valueNpsn || "");
  };

  const handleSwitchToSearch = () => {
    setIsCustomMode(false);
    setQuery(valueSchoolName || "");
  };

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      {/* Header bar: Label & Switcher */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <School size={14} className="text-blue-600" />
          <span>Nama Sekolah &amp; NPSN</span>
          <span className="text-blue-600">*</span>
        </label>

        <button
          type="button"
          onClick={isCustomMode ? handleSwitchToSearch : handleSwitchToCustom}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[32px] px-1"
        >
          {isCustomMode ? (
            <>
              <Search size={12} /> Cari Database Kemdikbud
            </>
          ) : (
            <>
              <Edit size={12} /> Masukkan Manual (Custom)
            </>
          )}
        </button>
      </div>

      {/* MODE 1: SEARCH KEMDIKBUD API (sekolah.devapi.id) */}
      {!isCustomMode && (
        <div className="relative">
          {/* Tampilan jika sekolah sudah terpilih */}
          {selectedItem || (valueSchoolName && !isCustomMode && valueNpsn) ? (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {selectedItem?.nama || valueSchoolName}
                  </span>
                  {(selectedItem?.npsn || valueNpsn) && (
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300/60 dark:border-blue-700/60">
                      NPSN: {selectedItem?.npsn || valueNpsn}
                    </span>
                  )}
                  {selectedItem?.bentukPendidikan && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {selectedItem.bentukPendidikan}
                    </span>
                  )}
                  {selectedItem?.akreditasi && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      Akreditasi {selectedItem.akreditasi}
                    </span>
                  )}
                </div>

                {selectedItem?.alamat && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1">
                    <MapPin size={12} className="shrink-0 mt-0.5 text-slate-400" />
                    <span>{formatSchoolAddress(selectedItem)}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Ganti pilihan sekolah"
                aria-label="Ganti pilihan sekolah"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            /* Input Pencarian */
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => {
                    if (results.length > 0) setIsOpenDropdown(true);
                  }}
                  placeholder="Ketik nama sekolah atau nomor NPSN (misal: SMAN 1 atau 10100170)..."
                  className="w-full h-12 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                {loading && (
                  <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />
                )}
              </div>

              {/* Dropdown Hasil Pencarian */}
              {isOpenDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-150">
                  {results.length > 0 ? (
                    results.map((item) => (
                      <button
                        key={item.npsn || item.nama}
                        type="button"
                        onClick={() => handlePickSchool(item)}
                        className="w-full p-3 text-left hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition-colors flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {item.nama}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {item.bentukPendidikan}
                            </span>
                            {item.statusSatuanPendidikan && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold text-slate-500">
                                {item.statusSatuanPendidikan}
                              </span>
                            )}
                          </div>
                          {item.alamat && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.alamat.nama_kecamatan ? `Kec. ${item.alamat.nama_kecamatan}, ` : ""}
                              {item.alamat.nama_kabupaten || item.alamat.nama_provinsi || ""}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            NPSN {item.npsn}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : hasSearched && !loading ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tidak ditemukan sekolah dengan kata kunci "{query}".
                      </p>
                      <button
                        type="button"
                        onClick={handleSwitchToCustom}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Edit size={13} /> Masukkan data sekolah secara manual (Custom)
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: INPUT MANUAL / CUSTOM */}
      {isCustomMode && (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span>Mode Input Mandiri (Custom)</span>
            <span className="text-[10px] text-slate-400">Cocok untuk bimbel, kampus, atau yayasan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap Institusi <span className="text-blue-600">*</span>
              </label>
              <input
                type="text"
                value={valueSchoolName}
                onChange={(e) => onManualChange(e.target.value, valueNpsn || "")}
                placeholder="Contoh: SMA Bina Bangsa Mandiri atau Universitas Terbuka"
                required
                className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                NPSN / Kode Institusi
              </label>
              <input
                type="text"
                value={valueNpsn || ""}
                onChange={(e) => onManualChange(valueSchoolName, e.target.value)}
                placeholder="Opsional (misal: 69901175)"
                className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
