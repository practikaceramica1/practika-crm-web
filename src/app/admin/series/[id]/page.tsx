import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Filter, Layers3, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl, resolveR2PublicBaseUrl } from "@/lib/storageUrl";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { MultiFilterPicker } from "@/components/admin/MultiFilterPicker";
import { ColorBulkCreateCard } from "@/components/admin/ColorBulkCreateCard";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SeriesDocumentsManager } from "@/components/admin/SeriesDocumentsManager";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  addColorsBulkAction,
  addFormatMaterialAction,
  deleteArticleColorAction,
  deleteFormatMaterialAction,
  deleteSeriesAssetAction,
  renameSeriesAssetAction,
  setColorFiltersAction,
  setFormatFiltersAction,
  setSeriesFiltersAction,
  toggleSeriesNewAction,
  updateFormatMaterialAction,
  registerSeriesAmbientAssetAction,
  registerSeriesAmbientFromR2StagingAction,
  registerSeriesR2PdfAssetAction,
  signSeriesAmbientR2StagingUploadAction,
  signSeriesAmbientUploadAction,
  signSeriesR2PdfUploadAction,
} from "../actions";

/** Subidas grandes (p. ej. TIFF) por Server Action en esta ruta. En Vercel depende del plan. */
export const maxDuration = 300;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function parseFormatForSort(label: string): [number, number] {
  const cleaned = label.replace(",", ".").toLowerCase();
  const [w, h] = cleaned.split("x");
  return [Number(w) || 0, Number(h) || 0];
}

function tabClass(active: boolean) {
  return active
    ? "inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f3d] px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px active:scale-[0.98]"
    : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-all duration-150 hover:-translate-y-px hover:bg-slate-50 active:scale-[0.98]";
}

function isTransientFetchError(error: { message?: string } | null) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("fetch failed") || msg.includes("network");
}

export default async function SeriesDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "documents";
  const supabase = await createClient();

  const needsFormats = view === "formats" || view === "filters" || view === "colors";
  const needsMaterials = view === "formats";
  const needsAssets = view === "documents";
  const needsFilters = view === "formats" || view === "filters" || view === "colors";
  const needsColors = view === "colors";

  const [
    { data: series, error: seriesError },
    { data: materials, error: materialsError },
    { data: formats, error: formatsError },
    { data: assets, error: assetsError },
    { data: filterOptions, error: filterOptionsError },
    { data: seriesFilters, error: seriesFiltersError },
    { data: formatFilters, error: formatFiltersError },
    { data: colorFilters, error: colorFiltersError },
  ] = await Promise.all([
    supabase.from("series").select("*").eq("id", id).single(),
    needsMaterials
      ? supabase.from("materials").select("id,name").order("name")
      : Promise.resolve({ data: [], error: null }),
    needsFormats
      ? supabase
          .from("format_materials")
          .select("id,format_label,width_cm,height_cm,materials(name)")
          .eq("series_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    needsAssets
      ? supabase
          .from("series_assets")
          .select("id,asset_type,title,file_key,storage_provider,sort_order")
          .eq("series_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    needsFilters
      ? supabase
          .from("filter_options")
          .select("id,label,filter_group_id,filter_groups(key,name)")
          .eq("is_active", true)
          .order("label")
      : Promise.resolve({ data: [], error: null }),
    needsFilters
      ? supabase.from("series_filter_options").select("filter_option_id").eq("series_id", id)
      : Promise.resolve({ data: [], error: null }),
    needsFilters
      ? supabase.from("format_material_filter_options").select("format_material_id,filter_option_id")
      : Promise.resolve({ data: [], error: null }),
    needsColors
      ? supabase.from("article_color_filter_options").select("article_color_id,filter_option_id")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const formatIds = (formats || []).map((f) => f.id);
  const { data: colors, error: colorsError } =
    needsColors && formatIds.length > 0
      ? await supabase
          .from("article_colors")
          .select("id,color_name,variant_type,format_material_id")
          .in("format_material_id", formatIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  let assetsRows = assets || [];
  let assetsQueryError = assetsError;
  if (needsAssets && isTransientFetchError(assetsError)) {
    const retryAssets = await supabase
      .from("series_assets")
      .select("id,asset_type,title,file_key,storage_provider,sort_order")
      .eq("series_id", id)
      .order("created_at", { ascending: false });
    assetsRows = retryAssets.data || [];
    assetsQueryError = retryAssets.error;
  }

  if (isSchemaNotReadyError(seriesError)) {
    return <SetupRequired missing="public.series" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (
    isSchemaNotReadyError(formatFiltersError) ||
    isSchemaNotReadyError(colorFiltersError)
  ) {
    return (
      <SetupRequired
        missing="public.format_material_filter_options / public.article_color_filter_options"
        migration="supabase/migrations/20260331_0002_filter_hierarchy.sql"
      />
    );
  }
  if (seriesError && seriesError.code !== "PGRST116") throw new Error(seriesError.message);
  if (materialsError) throw new Error(materialsError.message);
  if (formatsError) throw new Error(formatsError.message);
  if (colorsError) throw new Error(colorsError.message);
  if (assetsQueryError) throw new Error(assetsQueryError.message);
  if (filterOptionsError) throw new Error(filterOptionsError.message);
  if (seriesFiltersError) throw new Error(seriesFiltersError.message);
  if (formatFiltersError) throw new Error(formatFiltersError.message);
  if (colorFiltersError) throw new Error(colorFiltersError.message);
  if (!series) notFound();

  const materialFilterOptions = (filterOptions || [])
    .filter((opt) => {
      const group = pickRelation(opt.filter_groups);
      const key = String(group?.key || "").toLowerCase();
      const name = String(group?.name || "").toLowerCase();
      return key === "materials" || key === "material" || name.includes("material");
    })
    .map((opt) => ({ id: opt.id, label: opt.label }));

  const groupedFilters = Object.values(
    (filterOptions || [])
      .filter((x) => {
        const group = pickRelation(x.filter_groups);
        const key = String(group?.key || "").toLowerCase();
        const name = String(group?.name || "").toLowerCase();
        if (key === "formats") return false;
        if (key === "materials" || key === "material" || name.includes("material")) return false;
        return true;
      })
      .reduce<Record<string, { key: string; name: string; options: { id: string; label: string }[] }>>((acc, opt) => {
        const group = pickRelation(opt.filter_groups);
        const key = group?.key || "otros";
        if (!acc[key]) acc[key] = { key, name: group?.name || "Otros", options: [] };
        acc[key].options.push({ id: opt.id, label: opt.label });
        return acc;
      }, {})
  );

  const materialValues = [
    ...(materials || []).map((m) => ({ value: m.name, label: m.name })),
    ...materialFilterOptions
      .filter((m) => !(materials || []).some((x) => x.name.toLowerCase() === m.label.toLowerCase()))
      .map((m) => ({ value: m.label, label: m.label })),
  ].sort((a, b) => a.label.localeCompare(b.label, "es"));

  const colorRows = (colors || []) as Array<{
    id: string;
    color_name: string;
    variant_type: string;
    format_material_id: string;
  }>;
  const colorsByFormat = colorRows.reduce<Record<string, typeof colorRows>>((acc, c) => {
    if (!acc[c.format_material_id]) acc[c.format_material_id] = [];
    acc[c.format_material_id].push(c);
    return acc;
  }, {});
  const sortedFormats = [...(formats || [])].sort((a, b) => {
    const [aw, ah] = parseFormatForSort(a.format_label);
    const [bw, bh] = parseFormatForSort(b.format_label);
    if (aw !== bw) return aw - bw;
    return ah - bh;
  });
  Object.keys(colorsByFormat).forEach((formatId) => {
    colorsByFormat[formatId].sort((a, b) => a.color_name.localeCompare(b.color_name, "es"));
  });
  const seriesFilterIds = (seriesFilters || []).map((x) => x.filter_option_id);
  const formatFilterIdsByFormat = (formatFilters || []).reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.format_material_id]) acc[row.format_material_id] = [];
    acc[row.format_material_id].push(row.filter_option_id);
    return acc;
  }, {});
  const colorFilterIdsByColor = (colorFilters || []).reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.article_color_id]) acc[row.article_color_id] = [];
    acc[row.article_color_id].push(row.filter_option_id);
    return acc;
  }, {});

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{series.name}</h1>
              {series.is_new && (
                <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  Nuevo
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">Vista modular por pasos · {series.slug}</p>
          </div>
          <div className="flex items-center gap-3">
            <form action={toggleSeriesNewAction}>
              <input type="hidden" name="seriesId" value={series.id} />
              <input type="hidden" name="isNew" value={series.is_new ? "false" : "true"} />
              <button
                type="submit"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-px active:scale-[0.98] ${
                  series.is_new
                    ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {series.is_new ? "Quitar novedad" : "Marcar como novedad"}
              </button>
            </form>
            <Link
              href={`/admin/series/${series.id}/delete`}
              className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Eliminar serie
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/admin/series/${series.id}?view=documents`} className={tabClass(view === "documents")}><FileText className="h-4 w-4" />Documentos</Link>
          <Link href={`/admin/series/${series.id}?view=formats`} className={tabClass(view === "formats")}><Layers3 className="h-4 w-4" />Formatos y materiales</Link>
          <Link href={`/admin/series/${series.id}?view=colors`} className={tabClass(view === "colors")}><Palette className="h-4 w-4" />Artículos / colores</Link>
          <Link href={`/admin/series/${series.id}?view=filters`} className={tabClass(view === "filters")}><Filter className="h-4 w-4" />Filtros</Link>
        </div>
      </section>

      {view === "documents" ? (
        <SeriesDocumentsManager
          seriesId={series.id}
          r2BaseUrl={resolveR2PublicBaseUrl()}
          cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ""}
          initialAssets={(assetsRows as Array<{
            id: string;
            asset_type: "technical_panel" | "catalog_pdf" | "ambient_image";
            title: string | null;
            file_key: string;
            storage_provider: string;
            sort_order?: number | null;
          }>).map((a) => ({ ...a, publicUrl: getAssetPublicUrl(a.storage_provider, a.file_key) }))}
          ambientSignAction={signSeriesAmbientUploadAction}
          ambientRegisterAction={registerSeriesAmbientAssetAction}
          ambientR2StagingSignAction={signSeriesAmbientR2StagingUploadAction}
          ambientR2StagingRegisterAction={registerSeriesAmbientFromR2StagingAction}
          pdfSignAction={signSeriesR2PdfUploadAction}
          pdfRegisterAction={registerSeriesR2PdfAssetAction}
          renameAction={renameSeriesAssetAction}
          deleteAction={deleteSeriesAssetAction}
        />
      ) : null}

      {view === "formats" ? (
        <section className="space-y-4">
          <article className="card p-5">
            <h2 className="text-lg font-semibold">Crear formato + material</h2>
            <form action={addFormatMaterialAction} className="mt-3 grid gap-2 md:grid-cols-5">
              <FormPendingSection className="contents">
                <input type="hidden" name="seriesId" value={series.id} />
                <input className="input" name="widthCm" type="number" step="0.01" placeholder="Ancho" required />
                <input className="input" name="heightCm" type="number" step="0.01" placeholder="Alto" required />
                <select className="input" name="materialLabel" required>
                  <option value="">Material</option>
                  {materialValues.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="input bg-slate-50 text-xs text-slate-500">Producción</div>
                <SubmitButton pendingText="Creando formato...">Crear</SubmitButton>
              </FormPendingSection>
            </form>
          </article>
          <article className="card p-5">
            <h2 className="text-lg font-semibold">Formatos existentes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Edita dimensiones o material, o elimina el formato. Al eliminar se borran también todos los colores de ese formato.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {sortedFormats.map((f) => {
                const matName = pickRelation(f.materials)?.name || "";
                const hasMatOption = materialValues.some((m) => m.value === matName);
                return (
                  <div key={f.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Actual · {f.format_label} · {matName || "—"}
                    </p>
                    <form action={updateFormatMaterialAction} className="space-y-2">
                      <FormPendingSection>
                        <input type="hidden" name="seriesId" value={series.id} />
                        <input type="hidden" name="formatMaterialId" value={f.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block text-xs text-slate-600">
                            Ancho (cm)
                            <input
                              className="input mt-1"
                              name="widthCm"
                              type="number"
                              step="0.01"
                              min="0.01"
                              defaultValue={f.width_cm}
                              required
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
                              defaultValue={f.height_cm}
                              required
                            />
                          </label>
                        </div>
                        <label className="block text-xs text-slate-600">
                          Material
                          <select className="input mt-1" name="materialLabel" required defaultValue={matName}>
                            {!hasMatOption && matName ? (
                              <option value={matName}>{matName}</option>
                            ) : null}
                            {materialValues.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <SubmitButton
                          className="btn-secondary w-full sm:w-auto"
                          pendingText="Guardando…"
                          confirmMessage="¿Guardar cambios en este formato?"
                        >
                          Guardar cambios
                        </SubmitButton>
                      </FormPendingSection>
                    </form>
                    <form action={deleteFormatMaterialAction} className="border-t border-slate-100 pt-3">
                      <FormPendingSection>
                        <input type="hidden" name="seriesId" value={series.id} />
                        <input type="hidden" name="formatMaterialId" value={f.id} />
                        <SubmitButton
                          className="w-full border border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
                          pendingText="Eliminando…"
                          confirmMessage={`¿Eliminar el formato ${f.format_label} y todos sus colores asociados? Esta acción no se puede deshacer.`}
                        >
                          Eliminar formato
                        </SubmitButton>
                      </FormPendingSection>
                    </form>
                  </div>
                );
              })}
              {sortedFormats.length === 0 ? <p className="text-sm text-slate-500">No hay formatos creados.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {view === "filters" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <article className="card p-5">
            <h2 className="text-lg font-semibold">Filtros de serie</h2>
            <p className="mt-1 text-sm text-slate-500">Se heredan a formato/material y color por defecto.</p>
            <div className="mt-3">
              <MultiFilterPicker
                groups={groupedFilters}
                initialSelectedIds={seriesFilterIds}
                hiddenIdName="seriesId"
                hiddenIdValue={series.id}
                saveAction={setSeriesFiltersAction}
                confirmMessage="¿Guardar cambios en los filtros de la serie?"
              />
            </div>
          </article>
          <article className="card p-5">
            <h2 className="text-lg font-semibold">Resumen por formato</h2>
            <div className="mt-3 space-y-2 text-sm">
              {sortedFormats.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold">{f.format_label} · {pickRelation(f.materials)?.name}</p>
                  <p className="text-xs text-slate-500">{(formatFilterIdsByFormat[f.id] || seriesFilterIds).length} filtros activos</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {view === "colors" ? (
        <section className="space-y-3">
          {sortedFormats.map((f) => (
            <details key={f.id} className="card" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                <p className="font-semibold">{f.format_label} · {pickRelation(f.materials)?.name}</p>
                <span className="text-xs text-slate-500">{(colorsByFormat[f.id] || []).length} colores</span>
              </summary>
              <div className="border-t border-slate-200 p-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold">Filtros de formato/material</p>
                    <div className="mt-2">
                      <MultiFilterPicker
                        groups={groupedFilters}
                        initialSelectedIds={formatFilterIdsByFormat[f.id] || seriesFilterIds}
                        hiddenIdName="formatMaterialId"
                        hiddenIdValue={f.id}
                        saveAction={setFormatFiltersAction}
                        confirmMessage="¿Guardar cambios en los filtros del formato/material?"
                      />
                    </div>
                  </article>
                </div>
                <div className="mt-4">
                  <div className="grid gap-3 xl:grid-cols-2">
                    <ColorBulkCreateCard
                      title="Regular"
                      variantType="regular"
                      seriesId={series.id}
                      formatMaterialId={f.id}
                      action={addColorsBulkAction}
                    />
                    <ColorBulkCreateCard
                      title="Decor"
                      variantType="decor"
                      seriesId={series.id}
                      formatMaterialId={f.id}
                      action={addColorsBulkAction}
                    />
                    <ColorBulkCreateCard
                      title="Relieve"
                      variantType="relieve"
                      seriesId={series.id}
                      formatMaterialId={f.id}
                      action={addColorsBulkAction}
                    />
                    <ColorBulkCreateCard
                      title="Antideslizante (C3)"
                      variantType="c3"
                      seriesId={series.id}
                      formatMaterialId={f.id}
                      action={addColorsBulkAction}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {(colorsByFormat[f.id] || []).map((c) => (
                    <article key={c.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-semibold">{c.color_name}</p>
                      <p className="text-xs text-slate-500">{c.variant_type === "c3" ? "Antideslizante (C3)" : c.variant_type}</p>
                      <div className="mt-2">
                        <MultiFilterPicker
                          groups={groupedFilters}
                          initialSelectedIds={colorFilterIdsByColor[c.id] || formatFilterIdsByFormat[f.id] || seriesFilterIds}
                          hiddenIdName="articleColorId"
                          hiddenIdValue={c.id}
                          saveAction={setColorFiltersAction}
                          saveButton="Guardar filtros color"
                          confirmMessage="¿Guardar cambios en los filtros del color?"
                        />
                      </div>
                      <form action={deleteArticleColorAction} className="mt-3 border-t border-slate-100 pt-3">
                        <FormPendingSection>
                          <input type="hidden" name="seriesId" value={series.id} />
                          <input type="hidden" name="articleColorId" value={c.id} />
                          <SubmitButton
                            className="w-full border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
                            pendingText="Eliminando…"
                            confirmMessage={`¿Eliminar el color «${c.color_name}» (${c.variant_type === "c3" ? "C3" : c.variant_type})? No se puede deshacer.`}
                          >
                            Eliminar color
                          </SubmitButton>
                        </FormPendingSection>
                      </form>
                    </article>
                  ))}
                  {(colorsByFormat[f.id] || []).length === 0 ? <p className="text-sm text-slate-500">Sin colores en este formato.</p> : null}
                </div>
              </div>
            </details>
          ))}
          {sortedFormats.length === 0 ? <section className="card p-5 text-sm text-slate-500">Primero crea formatos en la vista Formatos y materiales.</section> : null}
        </section>
      ) : null}
    </main>
  );
}
