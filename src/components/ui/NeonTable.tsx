import * as React from "react";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Skeleton } from "./skeleton";

export interface NeonTableColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => React.ReactNode;
}

export interface NeonTableProps<T> {
  data: T[];
  columns: NeonTableColumn<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  className?: string;

  // Header & Title
  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  // Search & Filter Toolbar
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;

  // Selection
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  isItemSelectable?: (item: T) => boolean;
  batchActions?: React.ReactNode;

  // Active Row (e.g. for Inspector panel)
  activeKey?: string | null;
  onRowClick?: (item: T) => void;

  // Expandable Row (for master-detail or accordion, e.g. student answers)
  isRowExpanded?: (item: T) => boolean;
  renderExpandedRow?: (item: T, index: number) => React.ReactNode;

  // Pagination (internal or controlled)
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  serverSide?: boolean;
  onPageSizeChange?: (size: number) => void;

  // Compact / Dense layout
  compact?: boolean;

  // Empty state
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyAction?: React.ReactNode;
}

export function NeonTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  className,
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cari data...",
  filterSlot,
  actionSlot,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  isItemSelectable,
  batchActions,
  activeKey,
  onRowClick,
  isRowExpanded,
  renderExpandedRow,
  pagination = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  currentPage: controlledPage,
  onPageChange,
  compact = false,
  totalCount,
  serverSide = false,
  onPageSizeChange,
  emptyTitle = "Tidak ada data",
  emptySubtitle = "Belum ada data yang tersedia untuk ditampilkan.",
  emptyAction,
}: NeonTableProps<T>) {
  const [internalPage, setInternalPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);

  const activePage = controlledPage !== undefined ? controlledPage : internalPage;

  // Reset page when data length changes drastically
  React.useEffect(() => {
    if (controlledPage === undefined) {
      setInternalPage(1);
    }
  }, [data.length, controlledPage]);

  // Pagination computations
  const totalItems = totalCount !== undefined ? totalCount : data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, activePage), totalPages);

  const handlePageChange = (newPage: number) => {
    const target = Math.min(Math.max(1, newPage), totalPages);
    if (onPageChange) {
      onPageChange(target);
    } else {
      setInternalPage(target);
    }
  };

  const paginatedData = React.useMemo(() => {
    if (!pagination || serverSide) return data;
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pagination, serverSide, safePage, pageSize]);

  // Selection computations
  const selectableItems = React.useMemo(() => {
    if (!selectable) return [];
    return data.filter((item) => (isItemSelectable ? isItemSelectable(item) : true));
  }, [data, selectable, isItemSelectable]);

  const allSelectableKeys = React.useMemo(() => {
    return selectableItems.map(keyExtractor);
  }, [selectableItems, keyExtractor]);

  const isAllSelected =
    allSelectableKeys.length > 0 &&
    allSelectableKeys.every((key) => selectedKeys.includes(key));

  const isPartiallySelected =
    !isAllSelected && allSelectableKeys.some((key) => selectedKeys.includes(key));

  const handleToggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      // Unselect all selectable items
      const newKeys = selectedKeys.filter((key) => !allSelectableKeys.includes(key));
      onSelectionChange(newKeys);
    } else {
      // Select all selectable items
      const merged = Array.from(new Set([...selectedKeys, ...allSelectableKeys]));
      onSelectionChange(merged);
    }
  };

  const handleToggleRowSelect = (
    item: T,
    index: number,
    event: React.MouseEvent<HTMLInputElement>
  ) => {
    if (!onSelectionChange) return;
    const key = keyExtractor(item);
    const isChecked = selectedKeys.includes(key);

    let nextSelected = [...selectedKeys];

    // Shift + Click range selection
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeItems = paginatedData.slice(start, end + 1);
      const validRangeKeys = rangeItems
        .filter((it) => (isItemSelectable ? isItemSelectable(it) : true))
        .map(keyExtractor);

      if (isChecked) {
        nextSelected = nextSelected.filter((k) => !validRangeKeys.includes(k));
      } else {
        nextSelected = Array.from(new Set([...nextSelected, ...validRangeKeys]));
      }
    } else {
      if (isChecked) {
        nextSelected = nextSelected.filter((k) => k !== key);
      } else {
        nextSelected.push(key);
      }
    }

    setLastSelectedIndex(index);
    onSelectionChange(nextSelected);
  };

  const startEntry = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endEntry = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] shadow-2xs overflow-hidden flex flex-col",
        className
      )}
    >
      {/* ── Optional Title / Subtitle Header ── */}
      {(title || subtitle) && (
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actionSlot && <div className="flex items-center gap-2">{actionSlot}</div>}
        </div>
      )}

      {/* ── Toolbar: Search & Filters ── */}
      {(onSearchChange !== undefined || filterSlot || actionSlot) && (
        <div className="p-3.5 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {/* Search Input Box */}
            {onSearchChange !== undefined && (
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchValue || ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Filter Slot (e.g. status pills / select) */}
            {filterSlot && (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {filterSlot}
              </div>
            )}
          </div>

          {/* Right Toolbar Controls (Counts & Actions) */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Total:{" "}
              <strong className="text-neutral-900 dark:text-neutral-100 font-semibold font-mono">
                {totalItems}
              </strong>
            </span>
            {!title && actionSlot && <div>{actionSlot}</div>}
          </div>
        </div>
      )}

      {/* ── Selection Action Banner (when items are selected) ── */}
      {selectable && selectedKeys.length > 0 && (
        <div className="px-4 py-2 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-200/70 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200 transition-colors">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-blue-600 text-white text-[10px] font-bold">
              ✓
            </span>
            <span className="font-semibold">
              {selectedKeys.length} item terpilih
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <button
              type="button"
              onClick={() => onSelectionChange && onSelectionChange([])}
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
            >
              Batalkan
            </button>
          </div>

          {/* Batch Actions Button Slot */}
          {batchActions && (
            <div className="flex items-center gap-1.5">{batchActions}</div>
          )}
        </div>
      )}

      {/* ── Main Table Grid ── */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full table-fixed sm:table-auto text-left text-xs border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#111214] text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider select-none">
              {/* Checkbox column */}
              {selectable && (
                <th
                  className={cn(
                    compact
                      ? "w-10 px-2.5 sm:px-3 py-2.5 sm:py-3 text-center"
                      : "w-9 sm:w-12 px-2 sm:px-5 py-3 sm:py-3.5 text-center"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected;
                    }}
                    onChange={handleToggleSelectAll}
                    disabled={selectableItems.length === 0}
                    className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 accent-neutral-900 dark:accent-neutral-100 cursor-pointer disabled:opacity-40"
                    title="Pilih semua data"
                  />
                </th>
              )}

              {/* Data Columns */}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    compact
                      ? "px-2.5 sm:px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                      : "px-3 sm:px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400",
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                      ? "text-right"
                      : "text-left",
                    col.headerClassName || col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850/80">
            {isLoading ? (
              // Skeleton Rows
              Array.from({ length: Math.min(pageSize, 6) }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {selectable && (
                    <td className={cn(compact ? "px-2.5 sm:px-3 py-2.5 sm:py-3 text-center" : "px-4 sm:px-5 py-3.5 sm:py-4 text-center")}>
                      <Skeleton className="h-3.5 w-3.5 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={cn(compact ? "px-3 sm:px-3.5 py-2.5 sm:py-3" : "px-4 sm:px-5 py-3.5 sm:py-4")}>
                      <Skeleton
                        className={cn(
                          "h-4 rounded",
                          cIdx === 0 ? "w-6" : cIdx === 1 ? "w-44" : "w-24"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-12 px-4 text-center"
                >
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                    <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 flex items-center justify-center mb-3">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      {emptyTitle}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {emptySubtitle}
                    </p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              // Normal Data Rows
              paginatedData.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selectedKeys.includes(key);
                const isActive = activeKey === key;
                const isItemCanSelect = isItemSelectable ? isItemSelectable(item) : true;
                const isExpanded = isRowExpanded ? isRowExpanded(item) : false;

                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={() => onRowClick && onRowClick(item)}
                      className={cn(
                        "transition-colors group",
                        onRowClick ? "cursor-pointer" : "",
                        // Active/Inspected row highlighting (Subtle accent)
                        isActive
                          ? "bg-emerald-500/[0.05] dark:bg-emerald-500/[0.09] relative"
                          : isExpanded
                          ? "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.05]"
                          : "hover:bg-neutral-50/80 dark:hover:bg-[#131517]",
                        // Selected row style
                        isSelected && !isActive
                          ? "bg-blue-50/40 dark:bg-blue-950/20"
                          : ""
                      )}
                    >
                      {/* Selection Checkbox */}
                      {selectable && (
                        <td
                          className={cn(
                            compact
                              ? "w-9 px-2 sm:px-2.5 py-2 text-center align-middle relative"
                              : "w-9 sm:w-11 px-2.5 sm:px-3 py-2.5 sm:py-3 text-center align-middle relative",
                            isActive ? "border-l-[3px] border-l-emerald-500" : ""
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isItemCanSelect ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onClick={(e) => handleToggleRowSelect(item, index, e)}
                              onChange={() => {}}
                              className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                            />
                          ) : (
                            <div className="w-3.5 h-3.5 mx-auto" />
                          )}
                        </td>
                      )}

                      {/* Content Columns */}
                      {columns.map((col, cIdx) => (
                        <td
                          key={col.key}
                          style={{ width: col.width }}
                          className={cn(
                            compact
                              ? "px-2.5 sm:px-3 py-2 text-xs align-middle text-neutral-700 dark:text-neutral-300"
                              : "px-3 sm:px-4 py-2.5 sm:py-3 text-xs align-middle text-neutral-700 dark:text-neutral-300",
                            !selectable && cIdx === 0 && isActive
                              ? "border-l-[3px] border-l-emerald-500"
                              : "",
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                              ? "text-right"
                              : "text-left",
                            col.className
                          )}
                        >
                          {col.render(item, (safePage - 1) * pageSize + index)}
                        </td>
                      ))}
                    </tr>

                    {/* Expandable Sub-Row (e.g. lembar jawaban siswa) */}
                    {isExpanded && renderExpandedRow && (
                      <tr className="bg-neutral-50/50 dark:bg-[#08090a] border-b border-neutral-200 dark:border-neutral-800">
                        <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-0">
                          {renderExpandedRow(item, (safePage - 1) * pageSize + index)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer / Pagination Bar ── */}
      {pagination && totalItems > 0 && (
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          {/* Entries summary */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto">
            <span>
              Menampilkan{" "}
              <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                {startEntry}
              </strong>{" "}
              –{" "}
              <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                {endEntry}
              </strong>{" "}
              dari{" "}
              <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                {totalItems}
              </strong>{" "}
              data
            </span>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 border-l border-neutral-200 dark:border-neutral-800 shrink-0">
              <span className="text-[11px] text-neutral-400">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  if (onPageSizeChange) onPageSizeChange(newSize);
                  if (onPageChange) onPageChange(1);
                  else setInternalPage(1);
                }}
                className="bg-transparent text-[11px] font-mono font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-white dark:bg-neutral-900">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pagination Navigation Buttons */}
          <div className="flex items-center justify-center sm:justify-end gap-1 w-full sm:w-auto pt-1 sm:pt-0">
            {/* First Page */}
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={safePage <= 1}
              className="h-7 w-7 rounded flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="h-7 w-7 rounded flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {/* Current Page Pill */}
            <div className="px-2.5 h-7 rounded flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[11px] font-medium font-mono text-neutral-700 dark:text-neutral-300">
              {safePage} / {totalPages}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              className="h-7 w-7 rounded flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={safePage >= totalPages}
              className="h-7 w-7 rounded flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
