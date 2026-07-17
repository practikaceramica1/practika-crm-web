"use client";

import { useMemo, useState } from "react";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  assignCatalogFormatAction,
  deleteFormatMaterialAction,
  updateSeriesFormatPackingAction,
} from "@/app/admin/series/actions";

export type CatalogOptionPacking = {
  id: string;
  label: string;
};

export type CatalogOption = {
  id: string;
  label: string;
  materialName: string;
  packings: CatalogOptionPacking[];
};

export type AssignedFormatRow = {
  id: string;
  label: string;
  materialName: string;
  characteristic: string;
  catalogFormatMaterialId: string | null;
  selectedPackingId: string | null;
  packings: CatalogOptionPacking[];
};

export function SeriesFormatsAssignClient({
  seriesId,
  catalogOptions,
  assigned,
}: {
  seriesId: string;
  catalogOptions: CatalogOption[];
  assigned: AssignedFormatRow[];
}) {
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const selectedCatalog = useMemo(
    () => catalogOptions.find((c) => c.id === selectedCatalogId) || null,
    [catalogOptions, selectedCatalogId]
  );

  const availableOptions = useMemo(() => {
    const used = new Set(assigned.map((a) => a.catalogFormatMaterialId).filter(Boolean));
    return catalogOptions.filter((c) => !used.has(c.id));
  }, [assigned, catalogOptions]);

  return (
    <section className="space-y-4">
      <article className="card p-5">
        <h2 className="text-lg font-semibold">Asignar formato + material</h2>
        <p className="mt-1 text-sm text-slate-500">
          Elige un formato ya creado en{" "}
          <a href="/admin/formats" className="font-medium text-[#1a1f3d] underline">
            Formatos
          </a>{" "}
          y el packing que usará esta serie en la web / pedidos. No se crean formatos aquí.
        </p>
        {availableOptions.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            No hay más formatos del catálogo disponibles para asignar. Crea uno en Formatos o quita uno de esta serie.
          </p>
        ) : (
          <form action={assignCatalogFormatAction} className="mt-3 grid gap-2 md:grid-cols-3">
            <FormPendingSection className="contents">
              <input type="hidden" name="seriesId" value={seriesId} />
              <label className="block text-xs text-slate-600 md:col-span-1">
                Formato + material
                <select
                  className="input mt-1"
                  name="catalogFormatMaterialId"
                  required
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                >
                  <option value="" disabled>
                    Seleccionar
                  </option>
                  {availableOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-600">
                Packing de la serie
                <select
                  className="input mt-1"
                  name="packingId"
                  required
                  disabled={!selectedCatalog}
                  defaultValue=""
                  key={selectedCatalogId || "none"}
                >
                  <option value="" disabled>
                    {selectedCatalog ? "Seleccionar packing" : "Elige formato primero"}
                  </option>
                  {(selectedCatalog?.packings || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <SubmitButton pendingText="Asignando…" className="w-full">
                  Asignar
                </SubmitButton>
              </div>
            </FormPendingSection>
          </form>
        )}
      </article>

      <article className="card p-5">
        <h2 className="text-lg font-semibold">Formatos de la serie</h2>
        <p className="mt-1 text-sm text-slate-500">
          Puedes cambiar el packing asignado. Al quitar el formato se eliminan también sus colores.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {assigned.length === 0 ? (
            <p className="text-sm text-slate-500">Ningún formato asignado todavía.</p>
          ) : (
            assigned.map((f) => (
              <div key={f.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {f.materialName || "—"}
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {f.label}
                    {f.characteristic ? (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {f.characteristic}
                      </span>
                    ) : null}
                  </p>
                </div>
                <form action={updateSeriesFormatPackingAction} className="space-y-2">
                  <FormPendingSection className="space-y-2">
                    <input type="hidden" name="seriesId" value={seriesId} />
                    <input type="hidden" name="formatMaterialId" value={f.id} />
                    <label className="block text-xs text-slate-600">
                      Packing (web / pedido)
                      <select
                        className="input mt-1"
                        name="packingId"
                        required
                        defaultValue={f.selectedPackingId || f.packings[0]?.id || ""}
                      >
                        {f.packings.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton className="btn-secondary" pendingText="Guardando…">
                      Guardar packing
                    </SubmitButton>
                  </FormPendingSection>
                </form>
                <form action={deleteFormatMaterialAction} className="border-t border-slate-100 pt-3">
                  <FormPendingSection>
                    <input type="hidden" name="seriesId" value={seriesId} />
                    <input type="hidden" name="formatMaterialId" value={f.id} />
                    <SubmitButton
                      className="w-full border border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
                      pendingText="Eliminando…"
                      confirmMessage="¿Quitar este formato de la serie? Se borrarán también todos sus colores."
                    >
                      Quitar de la serie
                    </SubmitButton>
                  </FormPendingSection>
                </form>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
