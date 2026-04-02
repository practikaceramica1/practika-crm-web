"use client";

import { useMemo, useState, useCallback, type ReactNode } from "react";

export type AdminTableColumn<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right";
  minWidth?: number;
  /** Ancho inicial en px */
  initialWidth?: number;
  /** Valor para ordenar; si no, se usa `field` */
  getSortValue?: (row: T) => string | number | Date | null | undefined;
  field?: keyof T;
};

type SortState = { columnId: string; direction: "asc" | "desc" };

function getCellSortValue<T>(
  col: AdminTableColumn<T>,
  row: T
): string | number | Date | null | undefined {
  if (col.getSortValue) return col.getSortValue(row);
  if (col.field !== undefined) return row[col.field] as string | number | Date | null | undefined;
  return undefined;
}

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  dir: "asc" | "desc"
): number {
  const mul = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mul;
  if (b == null) return -1 * mul;
  if (a instanceof Date && b instanceof Date) {
    return (a.getTime() - b.getTime()) * mul;
  }
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mul;
  }
  const as = a instanceof Date ? a.toISOString() : String(a);
  const bs = b instanceof Date ? b.toISOString() : String(b);
  return as.localeCompare(bs, "es", { sensitivity: "base" }) * mul;
}

function ResizeHandle({ onResize }: { onResize: (deltaPx: number) => void }) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let lastX = e.clientX;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        onResize(dx);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize select-none hover:bg-indigo-400/40"
      onMouseDown={onMouseDown}
      title="Arrastra para cambiar ancho"
    />
  );
}

export function AdminDataTable<T extends { id: string }>({
  columns,
  rows,
  defaultSort,
  renderCell,
  tieBreaker,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  defaultSort: SortState;
  renderCell: (row: T, columnId: string) => ReactNode;
  /** Si el valor ordenado es igual, aplicar este criterio (p. ej. segunda columna). */
  tieBreaker?: (a: T, b: T) => number;
}) {
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [widths, setWidths] = useState<number[]>(() =>
    columns.map((c) => c.initialWidth ?? 160)
  );

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortable) return [...rows];
    const copy = [...rows];
    copy.sort((ra, rb) => {
      const va = getCellSortValue(col, ra);
      const vb = getCellSortValue(col, rb);
      const primary = compareValues(va, vb, sort.direction);
      if (primary !== 0) return primary;
      if (tieBreaker) {
        const t = tieBreaker(ra, rb);
        if (t !== 0) return t;
      }
      return String(ra.id).localeCompare(String(rb.id));
    });
    return copy;
  }, [rows, sort, columns, tieBreaker]);

  const toggleSort = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.sortable) return;
    setSort((prev) => {
      if (prev.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const handleResize = useCallback(
    (columnIndex: number, deltaPx: number) => {
      if (columnIndex >= widths.length - 1) return;
      const minA = columns[columnIndex].minWidth ?? 80;
      const minB = columns[columnIndex + 1].minWidth ?? 80;
      setWidths((prev) => {
        const next = [...prev];
        const a0 = next[columnIndex];
        const b0 = next[columnIndex + 1];
        let newA = a0 + deltaPx;
        newA = Math.max(minA, newA);
        let newB = b0 - (newA - a0);
        if (newB < minB) {
          newB = minB;
          newA = Math.max(minA, a0 + (b0 - minB));
        }
        next[columnIndex] = newA;
        next[columnIndex + 1] = newB;
        return next;
      });
    },
    [columns, widths.length]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          {columns.map((col, i) => (
            <col key={col.id} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.id}
                className={`relative px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}
                style={{ minWidth: col.minWidth ?? 80 }}
                aria-sort={
                  col.sortable
                    ? sort.columnId === col.id
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                }
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    onClick={() => toggleSort(col.id)}
                  >
                    <span className="truncate">{col.header}</span>
                    {sort.columnId === col.id ? (
                      <span className="shrink-0 text-indigo-600" aria-hidden>
                        {sort.direction === "asc" ? "↑" : "↓"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-slate-300" aria-hidden>
                        ↕
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="font-semibold">{col.header}</span>
                )}
                {i < columns.length - 1 ? <ResizeHandle onResize={(dx) => handleResize(i, dx)} /> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={`px-4 py-3 align-top ${col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {renderCell(row, col.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
