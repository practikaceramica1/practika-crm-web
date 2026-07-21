"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import { ColorImageUploadButton } from "@/components/admin/ColorImageUploadButton";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { MultiFilterPicker } from "@/components/admin/MultiFilterPicker";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  deleteArticleColorAction,
  renameArticleColorAction,
  reorderArticleColorsAction,
  setArticleColorImageAction,
  setArticleColorImageRotationAction,
  setColorFiltersAction,
  signSeriesR2ColorUploadAction,
} from "@/app/admin/series/actions";

export type SeriesColorCard = {
  id: string;
  color_name: string;
  variant_type: string;
  sku?: string | null;
  sort_order: number;
  colorImageUrl: string;
  rotationDeg: number;
  webObjectFit: "contain" | "cover";
  zoomPercent: number;
};

type FilterGroup = { key: string; name: string; options: { id: string; label: string }[] };

type SignResult =
  | { ok: true; putUrl: string; fileKey: string; contentType: string }
  | { ok: false; message: string };

export function SeriesFormatColorsClient({
  seriesId,
  formatMaterialId,
  initialColors,
  groupedFilters,
  colorFilterIdsByColor,
  formatFilterIds,
  seriesFilterIds,
}: {
  seriesId: string;
  formatMaterialId: string;
  initialColors: SeriesColorCard[];
  groupedFilters: FilterGroup[];
  colorFilterIdsByColor: Record<string, string[]>;
  formatFilterIds: string[];
  seriesFilterIds: string[];
}) {
  const [colors, setColors] = useState(initialColors);
  const { notify } = useAdminSnackbar();
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    setColors(initialColors);
  }, [initialColors]);

  const persistOrder = useCallback(
    async (next: SeriesColorCard[]) => {
      const fd = new FormData();
      fd.set("seriesId", seriesId);
      fd.set("formatMaterialId", formatMaterialId);
      fd.set("orderedIdsJson", JSON.stringify(next.map((c) => c.id)));
      await reorderArticleColorsAction(fd);
    },
    [seriesId, formatMaterialId]
  );

  const moveItem = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = [...colors];
      const i = colors.findIndex((x) => x.id === fromId);
      const j = colors.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...colors];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
      setColors(reindexed);
      try {
        await persistOrder(reindexed);
        notify({ type: "success", message: "Orden de colores guardado." });
      } catch (e) {
        setColors(snapshot);
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [colors, persistOrder, notify]
  );

  if (colors.length === 0) {
    return <p className="text-sm text-slate-500">Sin colores en este formato.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        Arrastra <span className="font-medium text-slate-700">⋮⋮</span> para ordenar cómo aparecen en la web (de
        izquierda a derecha).
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {colors.map((c) => {
          const variantLabel = c.variant_type === "c3" ? "Antideslizante (C3)" : c.variant_type;
          const variantType =
            c.variant_type === "decor" || c.variant_type === "relieve" || c.variant_type === "c3"
              ? c.variant_type
              : "regular";
          return (
            <article
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={() => {
                const from = dragId.current;
                dragId.current = null;
                if (!from) return;
                void moveItem(from, c.id);
              }}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  draggable
                  onDragStart={(e) => {
                    dragId.current = c.id;
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab select-none px-1 text-slate-400 active:cursor-grabbing"
                  title="Arrastrar para ordenar"
                >
                  ⋮⋮
                </span>
                <span className="text-[11px] font-medium tabular-nums text-slate-400">#{c.sort_order}</span>
              </div>
              <NotifyForm
                action={renameArticleColorAction}
                successMessage="Nombre del color guardado."
                className="space-y-2"
              >
                <input type="hidden" name="seriesId" value={seriesId} />
                <input type="hidden" name="articleColorId" value={c.id} />
                <input
                  className="input font-semibold"
                  name="name"
                  defaultValue={c.color_name}
                  required
                  minLength={2}
                />
                <SubmitButton className="btn-secondary text-xs" pendingText="Guardando color...">
                  Guardar nombre color
                </SubmitButton>
              </NotifyForm>
              <p className="text-xs text-slate-500">{variantLabel}</p>
              {c.sku ? (
                <div className="mt-2">
                  {c.colorImageUrl ? (
                    <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.colorImageUrl}
                        alt={c.color_name}
                        className={`h-full w-full ${c.webObjectFit === "cover" ? "object-cover" : "object-contain"}`}
                        style={{
                          transform: `rotate(${c.rotationDeg}deg) scale(${c.zoomPercent / 100})`,
                        }}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                      Falta{" "}
                      <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_R2_PUBLIC_BASE_URL</code> (o
                      equivalente) para mostrar la imagen.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-3 text-xs text-slate-500">
                  Sin imagen de color
                </div>
              )}
              <NotifyForm
                action={setArticleColorImageRotationAction}
                successMessage="Visualización web guardada."
                className="mt-2 space-y-2 rounded-md border border-slate-100 bg-slate-50/80 p-2"
              >
                <input type="hidden" name="seriesId" value={seriesId} />
                <input type="hidden" name="articleColorId" value={c.id} />
                <p className="text-xs font-medium text-slate-600">Visualización en la web</p>
                <p className="text-[11px] leading-snug text-slate-500">
                  No modifica el archivo; solo cómo se muestra en practikaceramica.com (marco del formato).
                </p>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600" htmlFor={`rot-${c.id}`}>
                    Orientación (giro)
                  </label>
                  <select
                    id={`rot-${c.id}`}
                    name="imageRotationDegrees"
                    className="input w-full text-xs"
                    defaultValue={String(c.rotationDeg)}
                  >
                    <option value="0">0° — tal cual la foto</option>
                    <option value="90">90° — sentido horario</option>
                    <option value="180">180°</option>
                    <option value="270">270° (90° antihorario)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600" htmlFor={`fit-${c.id}`}>
                    Encaje / zoom en el marco
                  </label>
                  <select
                    id={`fit-${c.id}`}
                    name="imageWebObjectFit"
                    className="input w-full text-xs"
                    defaultValue={c.webObjectFit}
                  >
                    <option value="contain">Encajar pieza completa (sin recortar)</option>
                    <option value="cover">Ampliar y rellenar el marco (puede recortar bordes)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600" htmlFor={`zoom-${c.id}`}>
                    Zoom en la web (%)
                  </label>
                  <input
                    id={`zoom-${c.id}`}
                    type="number"
                    name="imageWebZoomPercent"
                    min={25}
                    max={300}
                    step={5}
                    defaultValue={c.zoomPercent}
                    className="input w-full text-xs"
                  />
                  <p className="text-[10px] leading-snug text-slate-400">
                    100 = tamaño base con el encaje elegido; sube el % para acercar la pieza en el marco (puede
                    recortarse).
                  </p>
                </div>
                <SubmitButton className="btn-secondary text-xs" pendingText="Guardando…">
                  Guardar visualización web
                </SubmitButton>
              </NotifyForm>
              <p className="mt-2 mb-1 text-[11px] leading-snug text-slate-500">
                Si no había filtros guardados para este color, se precargan los del formato o de la serie. Pulsa
                «Guardar filtros color» para grabarlos en la base de datos en este color.
              </p>
              <div className="mt-2">
                <MultiFilterPicker
                  groups={groupedFilters}
                  initialSelectedIds={
                    colorFilterIdsByColor[c.id] ?? formatFilterIds ?? seriesFilterIds
                  }
                  hiddenIdName="articleColorId"
                  hiddenIdValue={c.id}
                  saveAction={setColorFiltersAction}
                  saveButton="Guardar filtros color"
                  confirmMessage="¿Guardar cambios en los filtros del color?"
                />
              </div>
              <ColorImageUploadButton
                seriesId={seriesId}
                formatMaterialId={formatMaterialId}
                articleColorId={c.id}
                colorName={c.color_name}
                variantType={variantType}
                signUploadAction={signSeriesR2ColorUploadAction as (fd: FormData) => Promise<SignResult>}
                setColorImageAction={setArticleColorImageAction}
              />
              <NotifyForm
                action={deleteArticleColorAction}
                successMessage="Color eliminado."
                className="mt-3 border-t border-slate-100 pt-3"
              >
                <FormPendingSection>
                  <input type="hidden" name="seriesId" value={seriesId} />
                  <input type="hidden" name="articleColorId" value={c.id} />
                  <SubmitButton
                    className="w-full border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
                    pendingText="Eliminando…"
                    confirmMessage={`¿Eliminar el color «${c.color_name}» (${variantLabel})? No se puede deshacer.`}
                  >
                    Eliminar color
                  </SubmitButton>
                </FormPendingSection>
              </NotifyForm>
            </article>
          );
        })}
      </div>
    </div>
  );
}
