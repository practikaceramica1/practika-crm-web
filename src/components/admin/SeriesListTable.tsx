"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";

export type SeriesListRow = {
  id: string;
  name: string;
  slug: string;
  is_new: boolean;
  updated_at: string | null;
};

type FilterMode = "all" | "new" | "not_new";

const columns: AdminTableColumn<SeriesListRow>[] = [
  { id: "name", header: "Serie", sortable: true, field: "name", initialWidth: 260, minWidth: 120 },
  { id: "slug", header: "Slug", sortable: true, field: "slug", initialWidth: 160, minWidth: 80 },
  {
    id: "updated_at",
    header: "Actualizada",
    sortable: true,
    getSortValue: (r) => (r.updated_at ? new Date(r.updated_at) : null),
    initialWidth: 210,
    minWidth: 140,
  },
  { id: "actions", header: "Acciones", sortable: false, align: "right", initialWidth: 220, minWidth: 180 },
];

export function SeriesListTable({ rows }: { rows: SeriesListRow[] }) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const newCount = rows.filter((r) => r.is_new).length;
  const filtered =
    filter === "new"
      ? rows.filter((r) => r.is_new)
      : filter === "not_new"
        ? rows.filter((r) => !r.is_new)
        : rows;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtrar:</span>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Todas ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("new")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            filter === "new"
              ? "bg-orange-500 text-white"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
          }`}
        >
          Novedades ({newCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("not_new")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            filter === "not_new"
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Sin novedad ({rows.length - newCount})
        </button>
      </div>
      <AdminDataTable<SeriesListRow>
        columns={columns}
        rows={filtered}
        defaultSort={{ columnId: "name", direction: "asc" }}
        renderCell={(row, colId) => {
          if (colId === "name") {
            return (
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                {row.is_new && (
                  <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Nuevo
                  </span>
                )}
              </span>
            );
          }
          if (colId === "slug") return row.slug;
          if (colId === "updated_at") {
            return row.updated_at ? new Date(row.updated_at).toLocaleString("es-ES") : "-";
          }
          if (colId === "actions") {
            return (
              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                <Link href={`/admin/series/${row.id}`} className="btn-secondary">
                  Abrir
                </Link>
                <Link
                  href={`/admin/series/${row.id}/delete`}
                  className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition-all duration-150 hover:-translate-y-px hover:bg-red-50 active:scale-[0.98]"
                >
                  Eliminar
                </Link>
              </div>
            );
          }
          return null;
        }}
      />
    </div>
  );
}
