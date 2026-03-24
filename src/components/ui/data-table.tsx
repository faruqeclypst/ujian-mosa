import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, item: T, index?: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  exportable?: boolean;
  onExport?: (data: T[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  filterActions?: React.ReactNode;
}

interface DataTableState<T> {
  data: T[];
  filteredData: T[];
  currentPage: number;
  pageSize: number;
  sortColumn: keyof T | string | null;
  sortDirection: "asc" | "desc";
  searchTerm: string;
  visibleColumns: Set<string>;
  showFilters: boolean;
}

export function DataTable<T>({
  data,
  columns,
  title,
  description,
  searchPlaceholder = "Cari data...",
  onRowClick,
  actions,
  exportable = false,
  onExport,
  loading = false,
  emptyMessage = "Tidak ada data yang ditemukan.",
  filterActions,
}: DataTableProps<T>) {
  const [state, setState] = React.useState<DataTableState<T>>({
    data,
    filteredData: data,
    currentPage: 1,
    pageSize: 10,
    sortColumn: null,
    sortDirection: "asc",
    searchTerm: "",
    visibleColumns: new Set(columns.map(col => col.key.toString())),
    showFilters: false,
  });

  const [showColumnMenu, setShowColumnMenu] = React.useState(false);
  const columnMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnMenu]);

  // Update filtered data when data or search term changes
  React.useEffect(() => {
    let filtered = [...data];

    // Apply search filter
    if (state.searchTerm) {
      filtered = filtered.filter((item) =>
        columns.some((column) => {
          if (!state.visibleColumns.has(column.key.toString())) return false;

          const value = column.key.toString().split('.').reduce((obj: any, key) => obj?.[key], item);
          return value?.toString().toLowerCase().includes(state.searchTerm.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (state.sortColumn) {
      filtered.sort((a, b) => {
        const aValue = state.sortColumn!.toString().split('.').reduce((obj: any, key) => obj?.[key], a);
        const bValue = state.sortColumn!.toString().split('.').reduce((obj: any, key) => obj?.[key], b);

        if (aValue < bValue) return state.sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return state.sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    setState(prev => ({ ...prev, filteredData: filtered, currentPage: 1 }));
  }, [data, state.searchTerm, state.sortColumn, state.sortDirection, state.visibleColumns, columns]);

  const totalPages = Math.ceil(state.filteredData.length / state.pageSize);
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = startIndex + state.pageSize;
  const currentData = state.filteredData.slice(startIndex, endIndex);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    setState(prev => ({
      ...prev,
      sortColumn: prev.sortColumn === column.key ? prev.sortColumn : column.key,
      sortDirection: prev.sortColumn === column.key && prev.sortDirection === "asc" ? "desc" : "asc",
    }));
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setState(prev => ({ ...prev, pageSize, currentPage: 1 }));
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setState(prev => {
      const newVisibleColumns = new Set(prev.visibleColumns);
      if (newVisibleColumns.has(columnKey)) {
        newVisibleColumns.delete(columnKey);
      } else {
        newVisibleColumns.add(columnKey);
      }
      return { ...prev, visibleColumns: newVisibleColumns };
    });
  };

  const handleExport = () => {
    if (onExport) {
      onExport(state.filteredData);
    } else {
      // Default CSV export
      const headers = columns
        .filter(col => state.visibleColumns.has(col.key.toString()))
        .map(col => col.label)
        .join(",");

      const csvData = state.filteredData.map(item =>
        columns
          .filter(col => state.visibleColumns.has(col.key.toString()))
          .map(col => {
            const value = col.key.toString().split('.').reduce((obj: any, key) => obj?.[key], item);
            return `"${value?.toString().replace(/"/g, '""') || ""}"`;
          })
          .join(",")
      ).join("\n");

      const csv = `${headers}\n${csvData}`;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "data"}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {(title || description) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={state.searchTerm}
              onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="pl-9 text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {filterActions}
          <div className="relative" ref={columnMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Menu</span>
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <div className="px-2 py-1.5 text-sm font-semibold">Kolom</div>
                <div className="my-1 h-px bg-muted" />
                {columns.map((column) => (
                  <div
                    key={column.key.toString()}
                    className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
                    onClick={() => toggleColumnVisibility(column.key.toString())}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {state.visibleColumns.has(column.key.toString()) && (
                        <Check className="h-4 w-4" />
                      )}
                    </span>
                    {column.label}
                  </div>
                ))}
                {exportable && (
                  <>
                    <div className="my-1 h-px bg-muted" />
                    <div
                      className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
                      onClick={handleExport}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden bg-card">
        <div className="hidden sm:block">
          <Table>
          <TableHeader>
            <TableRow>
              {columns
                .filter(col => state.visibleColumns.has(col.key.toString()))
                .map((column) => (
                  <TableHead
                    key={column.key.toString()}
                    className={cn(
                      column.sortable && "cursor-pointer select-none hover:bg-muted/50",
                      column.className
                    )}
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && state.sortColumn === column.key && (
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            state.sortDirection === "desc" && "rotate-180"
                          )}
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              {actions && <TableHead className="w-[100px]">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="ml-2">Memuat...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : currentData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              currentData.map((item, index) => (
                <TableRow
                  key={index}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns
                    .filter(col => state.visibleColumns.has(col.key.toString()))
                    .map((column) => (
                      <TableCell key={column.key.toString()} className={column.className}>
                        {column.render
                          ? column.render(
                              column.key.toString().split('.').reduce((obj: any, key) => obj?.[key], item),
                              item,
                              (state.currentPage - 1) * state.pageSize + index
                            )
                          : column.key.toString().split('.').reduce((obj: any, key) => obj?.[key], item)?.toString() || "-"
                        }
                      </TableCell>
                    ))}
                  {actions && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {actions(item)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        
        {/* Mobile Card View */}
        <div className="sm:hidden space-y-3 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm">Memuat...</span>
            </div>
          ) : currentData.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            currentData.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "bg-card border rounded-lg p-4 space-y-3 shadow-sm",
                  onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns
                  .filter(col => state.visibleColumns.has(col.key.toString()) && col.key !== 'index')
                  .map((column, colIndex) => {
                    const value = column.key.toString().split('.').reduce((obj: any, key) => obj?.[key], item);
                    return (
                      <div key={column.key.toString()} className="flex justify-between items-start gap-3">
                        <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0">
                          {column.label}:
                        </span>
                        <div className="text-sm text-right min-w-0 flex-1">
                          {column.render
                            ? column.render(value, item, index)
                            : value?.toString() || "-"
                          }
                        </div>
                      </div>
                    );
                  })
                }
                {actions && (
                  <div className="pt-3 mt-3 border-t border-muted">
                    <div className="flex items-center justify-end gap-2">
                      {actions(item)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-900/40 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Menampilkan {startIndex + 1}-{Math.min(endIndex, state.filteredData.length)} dari {state.filteredData.length} data
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm shrink-0">Baris per halaman:</span>
              <select
                value={state.pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 sm:h-9 rounded border border-input bg-background px-2 text-xs sm:text-sm touch-manipulation"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={state.currentPage === 1}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">First page</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(state.currentPage - 1)}
                disabled={state.currentPage === 1}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">Previous page</span>
              </Button>

              <div className="flex items-center gap-1">
                {/* Show fewer page numbers on mobile */}
                <div className="flex items-center gap-1">
                  {/* Mobile: 3 pages max, Desktop: 5 pages max */}
                  <div className="sm:hidden flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (state.currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (state.currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i;
                      } else {
                        pageNum = state.currentPage - 1 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className={cn(
                            "h-8 w-8 p-0 text-xs rounded-lg transition-colors border",
                            state.currentPage === pageNum 
                              ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40 font-bold" 
                              : "border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (state.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (state.currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = state.currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className={cn(
                            "h-9 w-9 p-0 text-sm rounded-lg transition-colors border",
                            state.currentPage === pageNum 
                              ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40 font-bold" 
                              : "border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(state.currentPage + 1)}
                disabled={state.currentPage === totalPages}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">Next page</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={state.currentPage === totalPages}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sr-only">Last page</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}