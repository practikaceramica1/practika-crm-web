"use client";

import Link from "next/link";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";

export type SeriesListRow = {
  id: string;
  name: string;
  slug: string;
  updated_at: string | null;
};

const columns: AdminTableColumn<SeriesListRow>[] = [
  { id: "name", header: "Serie", sortable: true, field: "name", initialWidth: 220, minWidth: 100 },
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
  return (
    <AdminDataTable<SeriesListRow>
      columns={columns}
      rows={rows}
      defaultSort={{ columnId: "name", direction: "asc" }}
      renderCell={(row, colId) => {
        if (colId === "name") return <span className="font-semibold">{row.name}</span>;
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
  );
}
