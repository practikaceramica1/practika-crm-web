"use client";

import Link from "next/link";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";

export type FormatsListRow = {
  id: string;
  seriesId: string | null;
  seriesName: string;
  formatLabel: string;
  materialName: string;
};

const columns: AdminTableColumn<FormatsListRow>[] = [
  { id: "seriesName", header: "Serie", sortable: true, field: "seriesName", initialWidth: 200, minWidth: 100 },
  { id: "formatLabel", header: "Formato", sortable: true, field: "formatLabel", initialWidth: 260, minWidth: 120 },
  { id: "materialName", header: "Material", sortable: true, field: "materialName", initialWidth: 180, minWidth: 100 },
  { id: "actions", header: "Abrir", sortable: false, align: "right", initialWidth: 120, minWidth: 100 },
];

export function FormatsListTable({ rows }: { rows: FormatsListRow[] }) {
  return (
    <AdminDataTable<FormatsListRow>
      columns={columns}
      rows={rows}
      defaultSort={{ columnId: "seriesName", direction: "asc" }}
      tieBreaker={(a, b) =>
        a.formatLabel.localeCompare(b.formatLabel, "es", { sensitivity: "base" })
      }
      renderCell={(row, colId) => {
        if (colId === "seriesName") return <span className="font-semibold">{row.seriesName}</span>;
        if (colId === "formatLabel") return row.formatLabel;
        if (colId === "materialName") return row.materialName;
        if (colId === "actions") {
          return row.seriesId ? (
            <Link href={`/admin/series/${row.seriesId}`} className="btn-secondary">
              Serie
            </Link>
          ) : (
            "-"
          );
        }
        return null;
      }}
    />
  );
}
