import React from "react";
import { Check, ChevronDown, Copy, Folder, Plus, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { NeonModal } from "../ui/NeonModal";
import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import {
  AcademicPeriodRecord,
  AcademicYearFilterValue,
  GROUP_AGENDA_PRESETS,
  SemesterFilterValue,
  SemesterType,
  getAcademicYearOptions,
  getNextAcademicPeriod,
  getSemesterBadgeClass,
  getStructuredGroupOptions,
  normalizeAcademicYear,
  normalizeSemester,
  resolveAcademicPeriod,
} from "../../lib/academicPeriod";

interface AcademicPeriodBadgesProps {
  record: AcademicPeriodRecord;
  managedGroups?: readonly string[];
  compact?: boolean;
  showGroup?: boolean;
  showUnsetHint?: boolean;
  className?: string;
}

export const AcademicPeriodBadges: React.FC<AcademicPeriodBadgesProps> = ({
  record,
  managedGroups = GROUP_AGENDA_PRESETS,
  compact = false,
  showGroup = true,
  showUnsetHint = false,
  className,
}) => {
  const resolved = resolveAcademicPeriod(record, managedGroups);
  const hasStructuredGroup = Boolean(showGroup && resolved.structuredGroup);
  const hasAny = Boolean(resolved.academicYear || resolved.semester || hasStructuredGroup);
  if (!hasAny && !showUnsetHint) return null;

  const sizeClass = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]";

  return (
    <div className={cn("inline-flex items-center gap-1 flex-wrap min-w-0", className)}>
      {resolved.semester && (
        <span
          className={cn(
            "inline-flex items-center rounded font-semibold border shrink-0",
            sizeClass,
            getSemesterBadgeClass(resolved.semester)
          )}
          title={
            resolved.isInferredSemester
              ? `Semester ${resolved.semester} (terdeteksi dari label lama)`
              : `Semester ${resolved.semester}`
          }
        >
          {resolved.semester}
        </span>
      )}

      {resolved.academicYear && (
        <span
          className={cn(
            "inline-flex items-center rounded font-mono font-medium border shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
            sizeClass
          )}
          title={
            resolved.isInferredYear
              ? `Tahun Ajaran ${resolved.academicYear} (terdeteksi dari label lama)`
              : `Tahun Ajaran ${resolved.academicYear}`
          }
        >
          {resolved.academicYear}
        </span>
      )}

      {hasStructuredGroup && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded font-medium border shrink-0 max-w-[160px] truncate bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
            sizeClass
          )}
          title={`Agenda: ${resolved.structuredGroup}`}
        >
          <Folder className="h-2.5 w-2.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
          <span className="truncate">{resolved.structuredGroup}</span>
        </span>
      )}

      {!resolved.semester && !resolved.academicYear && showUnsetHint && (
        <span
          className={cn(
            "inline-flex items-center rounded font-medium border shrink-0 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-dashed border-neutral-300 dark:border-neutral-700",
            sizeClass
          )}
        >
          Periode belum diatur
        </span>
      )}
    </div>
  );
};

interface AcademicPeriodFilterFieldsProps {
  yearFilter: AcademicYearFilterValue;
  semesterFilter: SemesterFilterValue;
  onYearChange: (year: AcademicYearFilterValue) => void;
  onSemesterChange: (sem: SemesterFilterValue) => void;
  activeAcademicYear: string;
  activeSemester: SemesterType;
  managedAcademicYears?: string[];
  managedGroups?: readonly string[];
  records?: AcademicPeriodRecord[];
  hasUnassignedOption?: boolean;
}

/**
 * Compact Tahun Ajaran & Semester filter controls meant to live inside a single Filter popover.
 */
export const AcademicPeriodFilterFields: React.FC<AcademicPeriodFilterFieldsProps> = ({
  yearFilter,
  semesterFilter,
  onYearChange,
  onSemesterChange,
  activeAcademicYear,
  activeSemester,
  managedAcademicYears = [],
  managedGroups = GROUP_AGENDA_PRESETS,
  records = [],
  hasUnassignedOption = true,
}) => {
  const existingYears = React.useMemo(() => {
    const years: string[] = [];
    records.forEach((r) => {
      const res = resolveAcademicPeriod(r, managedGroups);
      if (res.academicYear) years.push(res.academicYear);
    });
    return years;
  }, [records, managedGroups]);

  const yearOptions = React.useMemo(
    () => getAcademicYearOptions(managedAcademicYears, existingYears, activeAcademicYear),
    [managedAcademicYears, existingYears, activeAcademicYear]
  );

  const unassignedCount = React.useMemo(() => {
    return records.filter((r) => {
      const res = resolveAcademicPeriod(r, managedGroups);
      return !res.academicYear || !res.semester;
    }).length;
  }, [records, managedGroups]);

  const isFilteringActivePeriod =
    yearFilter === activeAcademicYear && semesterFilter === activeSemester;

  const handleToggleActivePeriod = () => {
    if (isFilteringActivePeriod) {
      onYearChange("all");
      onSemesterChange("all");
    } else {
      onYearChange(activeAcademicYear);
      onSemesterChange(activeSemester);
    }
  };

  return (
    <div className="space-y-2.5 pb-2.5 border-b border-neutral-100 dark:border-neutral-800">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="filter-academic-year"
            className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
          >
            Tahun Ajaran
          </label>
          <button
            type="button"
            onClick={handleToggleActivePeriod}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded px-1",
              isFilteringActivePeriod
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-emerald-600 dark:text-emerald-400 hover:underline"
            )}
            title={`Set ke periode aktif (${activeAcademicYear} - ${activeSemester})`}
          >
            {isFilteringActivePeriod && <Check className="h-3 w-3 shrink-0" />}
            <span>{isFilteringActivePeriod ? "Periode Aktif" : `Aktif: ${activeAcademicYear}`}</span>
          </button>
        </div>

        <select
          id="filter-academic-year"
          value={yearFilter}
          onChange={(e) => onYearChange(e.target.value)}
          className="h-8 w-full text-xs font-medium rounded-md bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 px-2.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400 cursor-pointer transition-colors"
        >
          <option value="all">Semua Tahun Ajaran</option>
          {yearOptions.map((yr) => (
            <option key={yr} value={yr}>
              TA {yr}
              {yr === activeAcademicYear ? " (Aktif)" : ""}
            </option>
          ))}
          {hasUnassignedOption && unassignedCount > 0 && (
            <option value="__none__">Belum Diatur ({unassignedCount})</option>
          )}
        </select>
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
          Semester
        </span>
        <div
          role="group"
          aria-label="Filter Semester"
          className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800"
        >
          {(
            [
              { id: "all", label: "Semua" },
              { id: "Ganjil", label: "Ganjil" },
              { id: "Genap", label: "Genap" },
            ] as const
          ).map((item) => {
            const active = semesterFilter === item.id;
            let activeStyle =
              "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-2xs";
            if (active && item.id === "Ganjil") {
              activeStyle =
                "bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100 font-semibold shadow-2xs";
            } else if (active && item.id === "Genap") {
              activeStyle =
                "bg-sky-100 text-sky-900 dark:bg-sky-900/70 dark:text-sky-100 font-semibold shadow-2xs";
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSemesterChange(item.id)}
                className={cn(
                  "h-7 rounded-md text-xs transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  active
                    ? activeStyle
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-white/70 dark:hover:bg-neutral-800"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {hasUnassignedOption && unassignedCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onSemesterChange(semesterFilter === "__none__" ? "all" : "__none__")
            }
            className={cn(
              "mt-1 text-[11px] font-medium cursor-pointer hover:underline focus:outline-none",
              semesterFilter === "__none__"
                ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            {semesterFilter === "__none__"
              ? "Menampilkan item belum diatur (klik untuk semua)"
              : `Lihat yang belum diatur (${unassignedCount})`}
          </button>
        )}
      </div>
    </div>
  );
};

interface ActivePeriodFilterChipsProps {
  yearFilter: AcademicYearFilterValue;
  semesterFilter: SemesterFilterValue;
  groupFilter?: string;
  onClearYear: () => void;
  onClearSemester: () => void;
  onClearGroup?: () => void;
}

/**
 * Dismissible pills showing active Tahun Ajaran, Semester, or Agenda filters directly in the toolbar.
 */
export const ActivePeriodFilterChips: React.FC<ActivePeriodFilterChipsProps> = ({
  yearFilter,
  semesterFilter,
  groupFilter = "all",
  onClearYear,
  onClearSemester,
  onClearGroup,
}) => {
  const hasAny =
    yearFilter !== "all" || semesterFilter !== "all" || (groupFilter && groupFilter !== "all");
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {yearFilter !== "all" && (
        <button
          type="button"
          onClick={onClearYear}
          aria-label="Hapus filter Tahun Ajaran"
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          title="Klik untuk hapus filter Tahun Ajaran"
        >
          <span>{yearFilter === "__none__" ? "TA Belum Diatur" : `TA ${yearFilter}`}</span>
          <X className="h-3 w-3 opacity-70" />
        </button>
      )}

      {semesterFilter !== "all" && (
        <button
          type="button"
          onClick={onClearSemester}
          aria-label="Hapus filter Semester"
          className={cn(
            "inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer hover:opacity-85",
            semesterFilter === "Ganjil" || semesterFilter === "Genap"
              ? getSemesterBadgeClass(semesterFilter)
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700"
          )}
          title="Klik untuk hapus filter Semester"
        >
          <span>{semesterFilter === "__none__" ? "Semester Belum Diatur" : semesterFilter}</span>
          <X className="h-3 w-3 opacity-70" />
        </button>
      )}

      {groupFilter && groupFilter !== "all" && onClearGroup && (
        <button
          type="button"
          onClick={onClearGroup}
          aria-label="Hapus filter Agenda"
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
          title="Klik untuk hapus filter Agenda"
        >
          <span>{groupFilter === "__none__" ? "Tanpa Agenda" : groupFilter}</span>
          <X className="h-3 w-3 opacity-70" />
        </button>
      )}
    </div>
  );
};

interface AcademicPeriodFormFieldsProps {
  academicYear: string;
  semester: SemesterType | "";
  groupName: string;
  onAcademicYearChange: (value: string) => void;
  onSemesterChange: (value: SemesterType | "") => void;
  onGroupNameChange: (value: string) => void;
  activeAcademicYear: string;
  activeSemester: SemesterType;
  managedAcademicYears?: string[];
  managedGroups?: string[];
  existingYears?: string[];
  allowUnset?: boolean;
  allowCustomYear?: boolean;
  groupLabel?: string;
  compact?: boolean;
}

export const AcademicPeriodFormFields: React.FC<AcademicPeriodFormFieldsProps> = ({
  academicYear,
  semester,
  groupName,
  onAcademicYearChange,
  onSemesterChange,
  onGroupNameChange,
  activeAcademicYear,
  activeSemester,
  managedAcademicYears = [],
  managedGroups = [],
  existingYears = [],
  allowUnset = true,
  allowCustomYear = false,
  groupLabel = "Agenda / Group Ujian",
  compact = false,
}) => {
  const [showCustomYearInput, setShowCustomYearInput] = React.useState(false);
  const [customYearDraft, setCustomYearDraft] = React.useState("");

  const yearOptions = React.useMemo(
    () =>
      getAcademicYearOptions(
        managedAcademicYears,
        [...existingYears, academicYear],
        activeAcademicYear
      ),
    [managedAcademicYears, existingYears, academicYear, activeAcademicYear]
  );

  const structuredGroups = React.useMemo(
    () => getStructuredGroupOptions(managedGroups),
    [managedGroups]
  );

  const selectedStructuredGroup = React.useMemo(() => {
    const trimmed = groupName.trim();
    if (!trimmed) return "";
    const match = structuredGroups.find((g) => g.toLowerCase() === trimmed.toLowerCase());
    return match || "";
  }, [groupName, structuredGroups]);

  const handleApplyCustomYear = () => {
    const normalized = normalizeAcademicYear(customYearDraft);
    if (!normalized) return;
    onAcademicYearChange(normalized);
    setCustomYearDraft("");
    setShowCustomYearInput(false);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Tahun Ajaran */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Tahun Ajaran
            </label>
            <div className="flex items-center gap-2">
              {academicYear !== activeAcademicYear && (
                <button
                  type="button"
                  onClick={() => {
                    onAcademicYearChange(activeAcademicYear);
                    if (!semester) onSemesterChange(activeSemester);
                  }}
                  className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Pakai aktif ({activeAcademicYear})
                </button>
              )}
              {allowCustomYear && (
                <button
                  type="button"
                  onClick={() => setShowCustomYearInput((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Lainnya</span>
                </button>
              )}
            </div>
          </div>

          {showCustomYearInput && allowCustomYear ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={customYearDraft}
                onChange={(e) => setCustomYearDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyCustomYear();
                  }
                }}
                placeholder="cth: 2027/2028"
                className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
              <NeonButton
                type="button"
                size="xs"
                variant="primary"
                color="brand"
                onClick={handleApplyCustomYear}
                disabled={!customYearDraft.trim()}
              >
                Pakai
              </NeonButton>
            </div>
          ) : (
            <div className="relative">
              <select
                aria-label="Pilih Tahun Ajaran"
                value={academicYear}
                onChange={(e) => onAcademicYearChange(e.target.value)}
                className="w-full h-10 sm:h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs px-3 pr-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 appearance-none cursor-pointer"
              >
                {allowUnset && <option value="">-- Belum ditentukan --</option>}
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                    {yr === activeAcademicYear ? " (Aktif)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Semester */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Semester
            </label>
            {allowUnset && semester && (
              <button
                type="button"
                onClick={() => onSemesterChange("")}
                className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label="Pilih Semester"
            className="grid grid-cols-2 gap-1.5 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60"
          >
            {(["Ganjil", "Genap"] as const).map((sem) => {
              const selected = semester === sem;
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => onSemesterChange(sem)}
                  className={cn(
                    "h-8 sm:h-7 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    selected
                      ? sem === "Ganjil"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100 border border-amber-300 dark:border-amber-700"
                        : "bg-sky-100 text-sky-900 dark:bg-sky-900/70 dark:text-sky-100 border border-sky-300 dark:border-sky-700"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  {selected && <Check className="h-3 w-3 shrink-0" />}
                  <span>{sem}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Structured Group / Agenda Selector (no free-text teacher input) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {groupLabel}
          </label>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Terstruktur (Opsional)
          </span>
        </div>

        <div className="relative">
          <select
            aria-label={groupLabel}
            value={selectedStructuredGroup}
            onChange={(e) => onGroupNameChange(e.target.value)}
            className="w-full h-10 sm:h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs px-3 pr-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 appearance-none cursor-pointer"
          >
            <option value="">-- Tanpa Agenda / Group --</option>
            {structuredGroups.map((agenda) => (
              <option key={agenda} value={agenda}>
                {agenda}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
        </div>

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {structuredGroups.map((preset) => {
            const active = selectedStructuredGroup.toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onGroupNameChange(active ? "" : preset)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  active
                    ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                    : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-emerald-500"
                )}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface DuplicateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceExam: {
    id: string;
    title: string;
    academic_year?: string;
    semester?: string;
    group_name?: string;
    teacherName?: string;
  } | null;
  isMine: boolean;
  activeAcademicYear: string;
  activeSemester: SemesterType;
  managedAcademicYears?: string[];
  managedGroups?: string[];
  existingYears?: string[];
  allowCustomYear?: boolean;
  isSubmitting?: boolean;
  onConfirm: (values: {
    title: string;
    academic_year: string;
    semester: SemesterType | "";
    group_name: string;
  }) => Promise<void> | void;
}

export const DuplicateExamModal: React.FC<DuplicateExamModalProps> = ({
  isOpen,
  onClose,
  sourceExam,
  isMine,
  activeAcademicYear,
  activeSemester,
  managedAcademicYears = [],
  managedGroups = [],
  existingYears = [],
  allowCustomYear = false,
  isSubmitting = false,
  onConfirm,
}) => {
  const [title, setTitle] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [semester, setSemester] = React.useState<SemesterType | "">("");
  const [groupName, setGroupName] = React.useState("");

  React.useEffect(() => {
    if (!isOpen || !sourceExam) return;
    const resolved = resolveAcademicPeriod(
      sourceExam,
      managedGroups.length > 0 ? managedGroups : GROUP_AGENDA_PRESETS
    );
    const defaultTitle = isMine
      ? `(Salinan) ${sourceExam.title}`
      : `${sourceExam.title} (Salinan Saya)`;
    setTitle(defaultTitle);

    // Suggest active school period if source differs, otherwise suggest next academic period.
    const sameAsActive =
      resolved.academicYear === activeAcademicYear &&
      resolved.semester === activeSemester;
    if (sameAsActive) {
      const next = getNextAcademicPeriod(activeAcademicYear, activeSemester);
      setAcademicYear(next.academicYear);
      setSemester(next.semester);
    } else {
      setAcademicYear(activeAcademicYear);
      setSemester(activeSemester);
    }
    setGroupName(resolved.structuredGroup);
  }, [isOpen, sourceExam, isMine, activeAcademicYear, activeSemester, managedGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onConfirm({
      title: title.trim(),
      academic_year: normalizeAcademicYear(academicYear),
      semester: normalizeSemester(semester),
      group_name: groupName.trim(),
    });
  };

  if (!sourceExam) return null;

  return (
    <NeonModal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={isMine ? "Duplikat Bank Soal" : "Salin ke Bank Soal Saya"}
      subtitle={
        isMine
          ? "Salin paket dan seluruh butir soal ke semester atau tahun ajaran tujuan."
          : `Salin paket karya ${sourceExam.teacherName || "rekan guru"} ke koleksi Anda.`
      }
      icon={Copy}
      size="md"
      asForm
      onSubmit={handleSubmit}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <NeonButton
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Batal
          </NeonButton>
          <NeonButton
            type="submit"
            variant="primary"
            color="brand"
            size="sm"
            loading={isSubmitting}
            disabled={!title.trim() || isSubmitting}
          >
            {isMine ? "Duplikat Paket" : "Salin ke Koleksi"}
          </NeonButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="duplicate-exam-title"
            className="text-xs font-semibold text-neutral-800 dark:text-neutral-200"
          >
            Judul Bank Soal Baru <span className="text-rose-500">*</span>
          </label>
          <Input
            id="duplicate-exam-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Masukkan judul bank soal hasil salinan..."
            className="h-10 text-xs rounded-lg bg-neutral-50/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800"
          />
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Target Periode &amp; Agenda
            </span>
            <button
              type="button"
              onClick={() => {
                setAcademicYear(activeAcademicYear);
                setSemester(activeSemester);
              }}
              className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Set ke periode aktif ({activeAcademicYear} - {activeSemester})
            </button>
          </div>
          <AcademicPeriodFormFields
            academicYear={academicYear}
            semester={semester}
            groupName={groupName}
            onAcademicYearChange={setAcademicYear}
            onSemesterChange={setSemester}
            onGroupNameChange={setGroupName}
            activeAcademicYear={activeAcademicYear}
            activeSemester={activeSemester}
            managedAcademicYears={managedAcademicYears}
            managedGroups={managedGroups}
            existingYears={existingYears}
            allowCustomYear={allowCustomYear}
            compact
          />
        </div>
      </div>
    </NeonModal>
  );
};
