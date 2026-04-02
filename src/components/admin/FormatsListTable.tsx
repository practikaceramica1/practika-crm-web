"use client";

import Link from "next/link";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { deleteFormatMaterialAction } from "@/app/admin/series/actions";

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
  { id: "actions", header: "Acciones", sortable: false, align: "right", initialWidth: 200, minWidth: 160 },
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
          if (!row.seriesId) return "-";
          return (
            <div className="flex flex-col items-end gap-2">
              <Link href={`/admin/series/${row.seriesId}?view=formats`} className="btn-secondary text-xs">
                Editar en serie
              </Link>
              <form action={deleteFormatMaterialAction}>
                <FormPendingSection>
                  <input type="hidden" name="seriesId" value={row.seriesId} />
                  <input type="hidden" name="formatMaterialId" value={row.id} />
                  <SubmitButton
                    className="border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    pendingText="Eliminando…"
                    confirmMessage="¿Eliminar este formato y todos sus colores asociados? No se puede deshacer."
                  >
                    Eliminar
                  </SubmitButton>
                </FormPendingSection>
              </form>
            </div>
          );
        }
        return null;
      }}
    />
  );
}
