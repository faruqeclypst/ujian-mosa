export type SemesterType = "Ganjil" | "Genap";
export type SemesterFilterValue = "all" | SemesterType | "__none__";
export type AcademicYearFilterValue = "all" | "__none__" | string;

export interface AcademicPeriodRecord {
  academic_year?: string | null;
  semester?: string | null;
  group_name?: string | null;
}

export interface ResolvedAcademicPeriod {
  academicYear: string;
  semester: SemesterType | "";
  groupName: string;
  structuredGroup: string;
  isInferredYear: boolean;
  isInferredSemester: boolean;
}

export const GROUP_AGENDA_PRESETS = [
  "PTS",
  "PAS",
  "PAT",
  "US",
  "Tryout",
  "Ulangan Harian",
  "Latihan",
  "Susulan",
] as const;

export function parseStringArraySetting(raw: unknown): string[] {
  if (!raw) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        list = parsed;
      } else {
        list = trimmed.split(",");
      }
    } catch {
      list = trimmed.split(",");
    }
  }
  const seen = new Set<string>();
  const result: string[] = [];
  list.forEach((item) => {
    const val = String(item || "").trim();
    const key = val.toLowerCase();
    if (val && !seen.has(key)) {
      seen.add(key);
      result.push(val);
    }
  });
  return result;
}

export function normalizeAcademicYear(raw?: string | null): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const fullRangeMatch = trimmed.match(/^(20\d{2})\s*[-/]\s*(20\d{2})$/);
  if (fullRangeMatch) {
    return `${fullRangeMatch[1]}/${fullRangeMatch[2]}`;
  }
  const shortRangeMatch = trimmed.match(/^(\d{2})\s*[-/]\s*(\d{2})$/);
  if (shortRangeMatch) {
    return `20${shortRangeMatch[1]}/20${shortRangeMatch[2]}`;
  }
  return trimmed;
}

export function normalizeSemester(raw?: string | null): SemesterType | "" {
  const lower = String(raw || "").trim().toLowerCase();
  if (!lower) return "";
  if (
    lower === "ganjil" ||
    lower === "gasal" ||
    lower === "1" ||
    lower === "semester 1" ||
    lower === "semester ganjil" ||
    lower === "smt 1"
  ) {
    return "Ganjil";
  }
  if (
    lower === "genap" ||
    lower === "2" ||
    lower === "semester 2" ||
    lower === "semester genap" ||
    lower === "smt 2"
  ) {
    return "Genap";
  }
  return "";
}

/**
 * Indonesian school academic year starts in July (Ganjil: Jul-Dec, Genap: Jan-Jun).
 */
export function getDefaultAcademicPeriod(now: Date = new Date()): {
  academicYear: string;
  semester: SemesterType;
} {
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 6) {
    return { academicYear: `${year}/${year + 1}`, semester: "Ganjil" };
  }
  return { academicYear: `${year - 1}/${year}`, semester: "Genap" };
}

export function getNextAcademicPeriod(
  academicYear?: string | null,
  semester?: string | null
): { academicYear: string; semester: SemesterType } {
  const normYear = normalizeAcademicYear(academicYear) || getDefaultAcademicPeriod().academicYear;
  const normSem = normalizeSemester(semester) || getDefaultAcademicPeriod().semester;

  if (normSem === "Ganjil") {
    return { academicYear: normYear, semester: "Genap" };
  }

  const m = normYear.match(/^(20\d{2})\/(20\d{2})$/);
  if (m) {
    const startYear = Number(m[1]) + 1;
    return { academicYear: `${startYear}/${startYear + 1}`, semester: "Ganjil" };
  }
  return getDefaultAcademicPeriod();
}

export function getDefaultManagedAcademicYears(now: Date = new Date()): string[] {
  const current = getDefaultAcademicPeriod(now).academicYear;
  const m = current.match(/^(20\d{2})\/(20\d{2})$/);
  if (!m) return [current];
  const start = Number(m[1]);
  return [`${start + 1}/${start + 2}`, current];
}

export function getAcademicYearOptions(
  managedYears: Array<string | null | undefined> = [],
  existingYears: Array<string | null | undefined> = [],
  activeYear?: string | null
): string[] {
  const set = new Set<string>();

  managedYears.forEach((yr) => {
    const norm = normalizeAcademicYear(yr);
    if (norm) set.add(norm);
  });

  const normActive = normalizeAcademicYear(activeYear);
  if (normActive) set.add(normActive);

  existingYears.forEach((yr) => {
    const norm = normalizeAcademicYear(yr);
    if (norm) set.add(norm);
  });

  if (set.size === 0) {
    getDefaultManagedAcademicYears().forEach((yr) => set.add(yr));
  }

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function getStructuredGroupOptions(managedGroups: string[] = []): string[] {
  const parsed = parseStringArraySetting(managedGroups);
  return parsed.length > 0 ? parsed : [...GROUP_AGENDA_PRESETS];
}

export function extractStructuredGroup(
  rawGroup?: string | null,
  allowedGroups: readonly string[] = GROUP_AGENDA_PRESETS
): string {
  const trimmed = String(rawGroup || "").trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  const options = allowedGroups.length > 0 ? allowedGroups : GROUP_AGENDA_PRESETS;

  const exact = options.find((g) => g.toLowerCase() === lower);
  if (exact) return exact;

  // Match official agenda keywords embedded inside legacy free-text labels.
  for (const candidate of options) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(trimmed)) {
      return candidate;
    }
  }

  if (/\btry\s*out\b/i.test(trimmed)) {
    const toMatch = options.find((g) => g.toLowerCase() === "tryout");
    if (toMatch) return toMatch;
  }

  return "";
}

/**
 * Extracts academic year and semester from legacy free-text group_name values.
 */
export function inferPeriodFromLegacyText(text?: string | null): {
  academicYear: string;
  semester: SemesterType | "";
} {
  const raw = String(text || "").trim();
  if (!raw) return { academicYear: "", semester: "" };

  let semester: SemesterType | "" = "";
  if (
    /\b(ganjil|gasal)\b/i.test(raw) ||
    /\b(semester|smt)\s*([1357]|i|iii|v)\b/i.test(raw)
  ) {
    semester = "Ganjil";
  } else if (
    /\bgenap\b/i.test(raw) ||
    /\b(semester|smt)\s*([2468]|ii|iv|vi)\b/i.test(raw)
  ) {
    semester = "Genap";
  }

  let academicYear = "";
  const rangeMatch = raw.match(/(20\d{2})\s*[-/]\s*(20\d{2})/);
  const shortRangeMatch = raw.match(/\b(?:tp|ta)?\s*(\d{2})\s*[-/]\s*(\d{2})\b/i);
  if (rangeMatch) {
    academicYear = `${rangeMatch[1]}/${rangeMatch[2]}`;
  } else if (shortRangeMatch && Number(shortRangeMatch[2]) === Number(shortRangeMatch[1]) + 1) {
    academicYear = `20${shortRangeMatch[1]}/20${shortRangeMatch[2]}`;
  } else if (semester) {
    // Map single calendar year using Indonesian academic cycle when semester is explicit.
    const singleYearMatch = raw.match(/\b(20\d{2})\b/);
    if (singleYearMatch) {
      const y = Number(singleYearMatch[1]);
      academicYear = semester === "Ganjil" ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    }
  }

  return { academicYear, semester };
}

export function resolveAcademicPeriod(
  record?: AcademicPeriodRecord | null,
  allowedGroups: readonly string[] = GROUP_AGENDA_PRESETS
): ResolvedAcademicPeriod {
  const explicitYear = normalizeAcademicYear(record?.academic_year);
  const explicitSemester = normalizeSemester(record?.semester);
  const groupName = String(record?.group_name || "").trim();
  const structuredGroup = extractStructuredGroup(groupName, allowedGroups);

  if (explicitYear && explicitSemester) {
    return {
      academicYear: explicitYear,
      semester: explicitSemester,
      groupName,
      structuredGroup,
      isInferredYear: false,
      isInferredSemester: false,
    };
  }

  const inferred = inferPeriodFromLegacyText(groupName);
  return {
    academicYear: explicitYear || inferred.academicYear,
    semester: explicitSemester || inferred.semester,
    groupName,
    structuredGroup,
    isInferredYear: !explicitYear && Boolean(inferred.academicYear),
    isInferredSemester: !explicitSemester && Boolean(inferred.semester),
  };
}

export function formatAcademicPeriodLabel(
  academicYear?: string | null,
  semester?: string | null,
  fallback = "Periode belum diatur"
): string {
  const y = normalizeAcademicYear(academicYear);
  const s = normalizeSemester(semester);
  if (y && s) return `${y} • ${s}`;
  if (s) return `Semester ${s}`;
  if (y) return y;
  return fallback;
}

export function matchesPeriodAndGroupFilter(
  record: AcademicPeriodRecord,
  yearFilter: AcademicYearFilterValue,
  semesterFilter: SemesterFilterValue,
  groupFilter: string = "all",
  allowedGroups: readonly string[] = GROUP_AGENDA_PRESETS
): boolean {
  const resolved = resolveAcademicPeriod(record, allowedGroups);

  if (yearFilter !== "all") {
    if (yearFilter === "__none__") {
      if (resolved.academicYear) return false;
    } else if (resolved.academicYear !== normalizeAcademicYear(yearFilter)) {
      return false;
    }
  }

  if (semesterFilter !== "all") {
    if (semesterFilter === "__none__") {
      if (resolved.semester) return false;
    } else if (resolved.semester !== semesterFilter) {
      return false;
    }
  }

  if (groupFilter !== "all") {
    if (groupFilter === "__none__") {
      if (resolved.structuredGroup) return false;
    } else if (resolved.structuredGroup.toLowerCase() !== groupFilter.trim().toLowerCase()) {
      return false;
    }
  }

  return true;
}

export function getSemesterBadgeClass(semester?: SemesterType | "" | null): string {
  if (semester === "Ganjil") {
    return "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60";
  }
  if (semester === "Genap") {
    return "bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60";
  }
  return "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
}
