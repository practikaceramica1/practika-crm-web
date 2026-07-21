"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import {
  SERIES_PENDING_GAP_LABELS,
  type SeriesPendingGap,
  type SeriesPendingRow,
} from "@/lib/seriesPendingTypes";

const GAP_FILTERS: Array<{ id: "all" | SeriesPendingGap; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "technical_panel", label: "Sin panel técnico" },
  { id: "catalog_pdf", label: "Sin PDF de serie" },
  { id: "ambient_image", label: "Sin ambiente" },
  { id: "formats", label: "Sin formatos" },
  { id: "colors", label: "Sin colores" },
  { id: "color_images", label: "Colores sin imagen" },
  { id: "packing", label: "Sin packing" },
];

function gapHref(seriesId: string, gap: SeriesPendingGap): string {
  if (gap === "formats" || gap === "packing") return `/admin/series/${seriesId}?view=formats`;
  if (gap === "colors" || gap === "color_images") return `/admin/series/${seriesId}?view=colors`;
  return `/admin/series/${seriesId}?view=documents`;
}

function gapDetailText(row: SeriesPendingRow): string {
  const parts: string[] = [];
  if (row.gaps.includes("color_images") && row.colorsWithoutImage > 0) {
    parts.push(`${row.colorsWithoutImage} de ${row.colorCount} sin imagen`);
  }
  if (row.gaps.includes("packing") && row.formatsWithoutPacking > 0) {
    parts.push(`${row.formatsWithoutPacking} de ${row.formatCount} sin packing`);
  }
  return parts.join(" · ") || "—";
}

const columns: AdminTableColumn<SeriesPendingRow>[] = [
  { id: "name", header: "Serie", sortable: true, field: "name", initialWidth: 200, minWidth: 120 },
  { id: "slug", header: "Slug", sortable: true, field: "slug", initialWidth: 120, minWidth: 80 },
  {
    id: "gaps_count",
    header: "N.º",
    sortable: true,
    getSortValue: (r) => r.gaps.length,
    initialWidth: 72,
    minWidth: 56,
  },
  {
    id: "gaps",
    header: "Falta",
    sortable: true,
    getSortValue: (r) => r.gaps.map((g) => SERIES_PENDING_GAP_LABELS[g]).join(", "),
    initialWidth: 320,
    minWidth: 180,
  },
  {
    id: "detail",
    header: "Detalle",
    sortable: true,
    getSortValue: (r) => gapDetailText(r),
    initialWidth: 200,
    minWidth: 120,
  },
  { id: "actions", header: "Acciones", sortable: false, align: "right", initialWidth: 120, minWidth: 100 },
];

export function PendientesTable({ rows }: { rows: SeriesPendingRow[] }) {
  const [filter, setFilter] = useState<"all" | SeriesPendingGap>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<"all" | SeriesPendingGap, number>();
    map.set("all", rows.length);
    for (const gap of Object.keys(SERIES_PENDING_GAP_LABELS) as SeriesPendingGap[]) {
      map.set(gap, rows.filter((r) => r.gaps.includes(gap)).length);
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return rows.filter((r) => {
      if (filter !== "all" && !r.gaps.includes(filter)) return false;
      if (!q) return true;
      const hay = `${r.name} ${r.slug}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return hay.includes(q);
    });
  }, [rows, filter, query]);

  return (
    <div>
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtrar:</span>
          {GAP_FILTERS.map((f) => {
            const count = counts.get(f.id) ?? 0;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? f.id === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-amber-500 text-white"
                    : f.id === "all"
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar serie…"
            className="input max-w-xs py-1.5 text-sm"
            aria-label="Buscar serie pendiente"
          />
          <p className="text-xs text-slate-500">
            Mostrando {filtered.length} de {rows.length}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No hay series con ese filtro.
        </p>
      ) : (
        <AdminDataTable<SeriesPendingRow>
          columns={columns}
          rows={filtered}
          defaultSort={{ columnId: "name", direction: "asc" }}
          tieBreaker={(a, b) => a.name.localeCompare(b.name, "es")}
          renderCell={(row, colId) => {
            if (colId === "name") {
              return (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Link href={`/admin/series/${row.id}`} className="font-semibold text-[#1a1f3d] hover:underline">
                    {row.name}
                  </Link>
                  {row.is_new ? (
                    <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Nuevo
                    </span>
                  ) : null}
                </span>
              );
            }
            if (colId === "slug") {
              return <span className="text-slate-500">{row.slug}</span>;
            }
            if (colId === "gaps_count") {
              return <span className="tabular-nums font-medium text-slate-700">{row.gaps.length}</span>;
            }
            if (colId === "gaps") {
              return (
                <span className="inline-flex flex-wrap gap-1">
                  {row.gaps.map((gap) => (
                    <Link
                      key={gap}
                      href={gapHref(row.id, gap)}
                      className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                    >
                      {SERIES_PENDING_GAP_LABELS[gap]}
                    </Link>
                  ))}
                </span>
              );
            }
            if (colId === "detail") {
              const text = gapDetailText(row);
              return text === "—" ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span className="text-xs text-slate-600">{text}</span>
              );
            }
            if (colId === "actions") {
              return (
                <Link href={`/admin/series/${row.id}`} className="btn-secondary text-xs">
                  Abrir
                </Link>
              );
            }
            return null;
          }}
        />
      )}
    </div>
  );
}
