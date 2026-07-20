"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  addPackingAction,
  createCatalogFormatAction,
  deleteCatalogFormatAction,
  deletePackingAction,
  updateCatalogFormatAction,
  updatePackingAction,
} from "@/app/admin/formats/actions";

export type CatalogPackingRow = {
  id: string;
  supplier: string | null;
  piecesBox: number;
  m2Box: number;
  kgBox: number;
  boxesPallet: number;
  m2Pallet: number;
  kgPallet: number;
  isPublished: boolean;
};

export type CatalogFormatRow = {
  id: string;
  widthCm: number;
  heightCm: number;
  formatLabel: string;
  characteristic: string;
  materialId: string;
  materialName: string;
  seriesCount: number;
  packings: CatalogPackingRow[];
};

export type MaterialOption = { id: string; name: string };

function formatNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return String(n).replace(".", ",");
}

function packingCellInputClassName() {
  return "input mx-auto w-full min-w-[3.5rem] max-w-[5.5rem] px-1.5 py-1 text-center text-xs tabular-nums";
}

function PackingsTable({
  catalogFormatMaterialId,
  formatLabel,
  characteristic,
  packings,
  editingPackingId,
  onEdit,
  onCancelEdit,
}: {
  catalogFormatMaterialId: string;
  formatLabel: string;
  characteristic: string;
  packings: CatalogPackingRow[];
  editingPackingId: string | null;
  onEdit: (packingId: string) => void;
  onCancelEdit: () => void;
}) {
  const th = "border-b border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600";
  const td = "border-t border-slate-100 px-2 py-2 align-middle";

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th rowSpan={2} className={`${th} w-[18%] px-3`}>
              Formato
            </th>
            <th colSpan={3} className={`${th} text-center`}>
              Caja
            </th>
            <th colSpan={3} className={`${th} text-center`}>
              Palet
            </th>
            <th rowSpan={2} className={`${th} w-[12%] px-3`}>
              Estado
            </th>
            <th rowSpan={2} className={`${th} w-[140px] px-2 text-right`}>
              Acciones
            </th>
          </tr>
          <tr>
            <th className={`${th} text-center font-medium`}>Nº piezas</th>
            <th className={`${th} text-center font-medium`}>m²</th>
            <th className={`${th} text-center font-medium`}>kg</th>
            <th className={`${th} text-center font-medium`}>Cajas</th>
            <th className={`${th} text-center font-medium`}>m²</th>
            <th className={`${th} text-center font-medium`}>kg</th>
          </tr>
        </thead>
        <tbody>
          {packings.map((p) => {
            const editing = editingPackingId === p.id;
            const formId = `packing-edit-${p.id}`;

            return (
              <tr key={p.id} className={editing ? "bg-slate-50/80" : "bg-white"}>
                <td className={`${td} px-3`}>
                  <span className="font-medium text-slate-900">{formatLabel}</span>
                  {characteristic ? (
                    <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                      {characteristic}
                    </span>
                  ) : null}
                  {editing ? (
                    <label className="mt-1.5 block text-[11px] text-slate-500">
                      Proveedor
                      <input
                        form={formId}
                        className="input mt-0.5 w-full px-1.5 py-1 text-xs"
                        name="supplier"
                        defaultValue={p.supplier || ""}
                        placeholder="Opcional"
                      />
                    </label>
                  ) : p.supplier ? (
                    <span className="mt-0.5 block text-[11px] text-slate-500">Prov. {p.supplier}</span>
                  ) : null}
                </td>
                {(
                  [
                    ["piecesBox", p.piecesBox],
                    ["m2Box", p.m2Box],
                    ["kgBox", p.kgBox],
                    ["boxesPallet", p.boxesPallet],
                    ["m2Pallet", p.m2Pallet],
                    ["kgPallet", p.kgPallet],
                  ] as const
                ).map(([name, value]) => (
                  <td key={name} className={`${td} text-center tabular-nums text-slate-800`}>
                    {editing ? (
                      <input
                        form={formId}
                        className={packingCellInputClassName()}
                        name={name}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        defaultValue={value}
                      />
                    ) : (
                      formatNum(value)
                    )}
                  </td>
                ))}
                <td className={`${td} px-3`}>
                  {editing ? (
                    <label className="flex items-center gap-1.5 text-xs text-slate-700">
                      <input form={formId} type="checkbox" name="isPublished" defaultChecked={p.isPublished} />
                      Publicado
                    </label>
                  ) : p.isPublished ? (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                      Publicado
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                      No publicado
                    </span>
                  )}
                </td>
                <td className={`${td} px-2 text-right`}>
                  {editing ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <NotifyForm
                        id={formId}
                        action={updatePackingAction}
                        successMessage="Packing guardado."
                        className="flex flex-wrap items-center justify-end gap-1.5"
                      >
                        <input type="hidden" name="catalogFormatMaterialId" value={catalogFormatMaterialId} />
                        <input type="hidden" name="packingId" value={p.id} />
                        <SubmitButton className="btn-secondary text-xs" pendingText="Guardando…">
                          Guardar
                        </SubmitButton>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                          onClick={onCancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </NotifyForm>
                      <NotifyForm action={deletePackingAction} successMessage="Packing eliminado.">
                        <input type="hidden" name="catalogFormatMaterialId" value={catalogFormatMaterialId} />
                        <input type="hidden" name="packingId" value={p.id} />
                        <SubmitButton
                          className="text-xs text-red-600 hover:underline"
                          showSpinner={false}
                          pendingText="Eliminando…"
                          confirmMessage="¿Eliminar este packing?"
                        >
                          Eliminar
                        </SubmitButton>
                      </NotifyForm>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => onEdit(p.id)}
                      title="Editar packing"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PackingFields({
  defaults,
}: {
  defaults?: Partial<CatalogPackingRow>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
      <label className="block text-xs text-slate-600">
        Piezas/caja
        <input
          className="input mt-1"
          name="piecesBox"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.piecesBox ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        m²/caja
        <input
          className="input mt-1"
          name="m2Box"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.m2Box ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        kg/caja
        <input
          className="input mt-1"
          name="kgBox"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.kgBox ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        Cajas/palet
        <input
          className="input mt-1"
          name="boxesPallet"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.boxesPallet ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        m²/palet
        <input
          className="input mt-1"
          name="m2Pallet"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.m2Pallet ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        kg/palet
        <input
          className="input mt-1"
          name="kgPallet"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.kgPallet ?? 0}
        />
      </label>
      <label className="block text-xs text-slate-600">
        Proveedor
        <input className="input mt-1" name="supplier" defaultValue={defaults?.supplier || ""} placeholder="Opcional" />
      </label>
    </div>
  );
}

export function FormatsCatalogClient({
  initialRows,
  materials,
}: {
  initialRows: CatalogFormatRow[];
  materials: MaterialOption[];
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [editingFormatId, setEditingFormatId] = useState<string | null>(null);
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [addingForCatalogId, setAddingForCatalogId] = useState<string | null>(null);
  const { notify } = useAdminSnackbar();

  const sorted = useMemo(
    () =>
      [...initialRows].sort((a, b) => {
        if (a.widthCm !== b.widthCm) return a.widthCm - b.widthCm;
        if (a.heightCm !== b.heightCm) return a.heightCm - b.heightCm;
        const mat = a.materialName.localeCompare(b.materialName, "es", { sensitivity: "base" });
        if (mat !== 0) return mat;
        return a.characteristic.localeCompare(b.characteristic, "es", { sensitivity: "base" });
      }),
    [initialRows]
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setAddingForCatalogId((cur) => (cur === id ? null : cur));
        setEditingFormatId((cur) => (cur === id ? null : cur));
        setEditingPackingId((cur) => {
          const stillVisible = initialRows.find((r) => r.id === id)?.packings.some((p) => p.id === cur);
          return stillVisible ? null : cur;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Crear formato + material</h2>
        <p className="mt-1 text-sm text-slate-500">
          El formato va unido al material (y opcionalmente a una característica). Cada fila puede tener varios packings
          (proveedores).
        </p>
        <NotifyForm
          action={createCatalogFormatAction}
          successMessage="Formato creado."
          className="mt-4 space-y-3"
        >
          <FormPendingSection className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="block text-xs text-slate-600">
                Ancho (cm)
                <input className="input mt-1" name="widthCm" type="number" step="0.01" min="0.01" required />
              </label>
              <label className="block text-xs text-slate-600">
                Alto (cm)
                <input className="input mt-1" name="heightCm" type="number" step="0.01" min="0.01" required />
              </label>
              <label className="block text-xs text-slate-600">
                Material
                <select className="input mt-1" name="materialId" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar
                  </option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-600">
                Característica (opcional)
                <input className="input mt-1" name="characteristic" placeholder="RECT., ESP., Antihielo…" />
              </label>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primer packing</p>
              <div className="mt-2">
                <PackingFields />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="isPublished" defaultChecked />
                Publicar en packing-list de la web
              </label>
            </div>
            <SubmitButton pendingText="Creando…">Crear formato</SubmitButton>
          </FormPendingSection>
        </NotifyForm>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {sorted.length} formato(s), ordenados por tamaño (como en packing-list). Expande una fila para ver packings.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setOpenIds(new Set())}>
              Colapsar todo
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setOpenIds(new Set(sorted.map((r) => r.id)))}
            >
              Expandir todo
            </button>
          </div>
        </div>

        <ul className="space-y-2">
          {sorted.map((row) => {
            const isOpen = openIds.has(row.id);
            const publishedCount = row.packings.filter((p) => p.isPublished).length;
            const isAdding = addingForCatalogId === row.id;
            const isEditingFormat = editingFormatId === row.id;
            return (
              <li key={row.id} className="card overflow-hidden">
                <div className="flex items-stretch border-b border-slate-100 bg-slate-50/80">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"
                    onClick={() => toggle(row.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-slate-500">{isOpen ? "▼" : "▶"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900">
                        {row.formatLabel}
                        {row.characteristic ? (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                            {row.characteristic}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {row.materialName} · {row.packings.length} packing(s) · {publishedCount} publicados ·{" "}
                        {row.seriesCount} serie(s)
                      </span>
                    </span>
                  </button>
                </div>

                {isOpen ? (
                  <div className="space-y-4 p-4">
                    {!isEditingFormat ? (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <dl className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <dt className="text-xs text-slate-500">Ancho</dt>
                            <dd className="text-sm font-medium text-slate-900">{row.widthCm} cm</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Alto</dt>
                            <dd className="text-sm font-medium text-slate-900">{row.heightCm} cm</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Material</dt>
                            <dd className="text-sm font-medium text-slate-900">{row.materialName}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Característica</dt>
                            <dd className="text-sm font-medium text-slate-900">{row.characteristic || "—"}</dd>
                          </div>
                        </dl>
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setEditingFormatId(row.id);
                            setEditingPackingId(null);
                            setAddingForCatalogId(null);
                          }}
                          title="Editar formato"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Editando formato
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                            onClick={() => setEditingFormatId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </div>
                        <NotifyForm
                          action={updateCatalogFormatAction}
                          successMessage="Formato guardado."
                          className="space-y-2"
                        >
                          <FormPendingSection className="space-y-2">
                            <input type="hidden" name="catalogFormatMaterialId" value={row.id} />
                            <div className="grid gap-2 md:grid-cols-4">
                              <label className="block text-xs text-slate-600">
                                Ancho (cm)
                                <input
                                  className="input mt-1"
                                  name="widthCm"
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                  defaultValue={row.widthCm}
                                />
                              </label>
                              <label className="block text-xs text-slate-600">
                                Alto (cm)
                                <input
                                  className="input mt-1"
                                  name="heightCm"
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                  defaultValue={row.heightCm}
                                />
                              </label>
                              <label className="block text-xs text-slate-600">
                                Material
                                <select className="input mt-1" name="materialId" required defaultValue={row.materialId}>
                                  {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-xs text-slate-600">
                                Característica
                                <input
                                  className="input mt-1"
                                  name="characteristic"
                                  defaultValue={row.characteristic}
                                  placeholder="Opcional"
                                />
                              </label>
                            </div>
                            <SubmitButton className="btn-secondary" pendingText="Guardando…">
                              Guardar formato
                            </SubmitButton>
                          </FormPendingSection>
                        </NotifyForm>
                      </div>
                    )}

                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">Packings</h3>
                        {!isAdding ? (
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                            onClick={() => {
                              setAddingForCatalogId(row.id);
                              setEditingPackingId(null);
                              setEditingFormatId(null);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Añadir packing
                          </button>
                        ) : null}
                      </div>

                      {row.packings.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin packings todavía.</p>
                      ) : (
                        <PackingsTable
                          catalogFormatMaterialId={row.id}
                          formatLabel={row.formatLabel}
                          characteristic={row.characteristic}
                          packings={row.packings}
                          editingPackingId={editingPackingId}
                          onEdit={(packingId) => {
                            setEditingPackingId(packingId);
                            setAddingForCatalogId(null);
                            setEditingFormatId(null);
                          }}
                          onCancelEdit={() => setEditingPackingId(null)}
                        />
                      )}

                      {isAdding ? (
                        <div className="rounded-lg border border-dashed border-slate-300 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo packing</p>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                              onClick={() => setAddingForCatalogId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </button>
                          </div>
                          <NotifyForm
                            action={addPackingAction}
                            successMessage="Packing añadido."
                            className="space-y-2"
                          >
                            <FormPendingSection className="space-y-2">
                              <input type="hidden" name="catalogFormatMaterialId" value={row.id} />
                              <PackingFields />
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" name="isPublished" defaultChecked />
                                Publicar en packing-list
                              </label>
                              <SubmitButton pendingText="Añadiendo…">Guardar packing</SubmitButton>
                            </FormPendingSection>
                          </NotifyForm>
                        </div>
                      ) : null}
                    </div>

                    <NotifyForm
                      action={deleteCatalogFormatAction}
                      successMessage="Formato eliminado del catálogo."
                      className="border-t border-slate-100 pt-3"
                      onSubmit={(e) => {
                        if (row.seriesCount > 0) {
                          e.preventDefault();
                          notify({
                            type: "error",
                            message: "Quita este formato de las series antes de eliminarlo del catálogo.",
                          });
                        }
                      }}
                    >
                      <input type="hidden" name="catalogFormatMaterialId" value={row.id} />
                      <SubmitButton
                        className="text-sm font-semibold text-red-700 hover:underline"
                        showSpinner={false}
                        pendingText="Eliminando…"
                        confirmMessage="¿Eliminar este formato del catálogo global? Se borrarán todos sus packings."
                      >
                        Eliminar formato del catálogo
                      </SubmitButton>
                    </NotifyForm>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
