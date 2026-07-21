import { createClient } from "@/lib/supabase/server";
import type {
  SeriesPendingGap,
  SeriesPendingRow,
  SeriesPendingSummary,
} from "@/lib/seriesPendingTypes";

export type {
  SeriesPendingGap,
  SeriesPendingRow,
  SeriesPendingSummary,
} from "@/lib/seriesPendingTypes";
export { SERIES_PENDING_GAP_LABELS } from "@/lib/seriesPendingTypes";

function chunkIds<T>(ids: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Series con material incompleto para la web/CRM.
 * Criterios: ≥1 formato, ≥1 panel técnico, ≥1 ambiente, ≥1 PDF catálogo,
 * ≥1 color, todos los colores con imagen, todos los formatos con packing.
 */
export async function getSeriesPendingSummary(): Promise<SeriesPendingSummary> {
  const supabase = await createClient();
  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("id,name,slug,is_new")
    .order("name", { ascending: true });
  if (seriesError) throw new Error(seriesError.message);

  const list = series || [];
  if (list.length === 0) return { rows: [], incompleteCount: 0 };

  const seriesIds = list.map((s) => s.id);

  const assetsBySeries = new Map<string, Set<string>>();
  const formatsBySeries = new Map<string, Array<{ id: string; selected_packing_id: string | null }>>();
  const colorsByFormat = new Map<string, Array<{ sku: string | null }>>();

  for (const ids of chunkIds(seriesIds)) {
    const [{ data: assets, error: assetsError }, { data: formats, error: formatsError }] = await Promise.all([
      supabase.from("series_assets").select("series_id,asset_type").in("series_id", ids),
      supabase
        .from("format_materials")
        .select("id,series_id,selected_packing_id")
        .in("series_id", ids),
    ]);
    if (assetsError) throw new Error(assetsError.message);
    if (formatsError) throw new Error(formatsError.message);

    for (const a of assets || []) {
      if (!a.series_id || !a.asset_type) continue;
      const set = assetsBySeries.get(a.series_id) || new Set<string>();
      set.add(String(a.asset_type));
      assetsBySeries.set(a.series_id, set);
    }
    for (const f of formats || []) {
      if (!f.id || !f.series_id) continue;
      const arr = formatsBySeries.get(f.series_id) || [];
      arr.push({
        id: f.id,
        selected_packing_id: (f as { selected_packing_id?: string | null }).selected_packing_id || null,
      });
      formatsBySeries.set(f.series_id, arr);
    }
  }

  const allFormatIds = [...formatsBySeries.values()].flatMap((fs) => fs.map((f) => f.id));
  for (const ids of chunkIds(allFormatIds)) {
    if (!ids.length) continue;
    const { data: colors, error: colorsError } = await supabase
      .from("article_colors")
      .select("format_material_id,sku")
      .in("format_material_id", ids);
    if (colorsError) throw new Error(colorsError.message);
    for (const c of colors || []) {
      if (!c.format_material_id) continue;
      const arr = colorsByFormat.get(c.format_material_id) || [];
      arr.push({ sku: c.sku || null });
      colorsByFormat.set(c.format_material_id, arr);
    }
  }

  const rows: SeriesPendingRow[] = [];
  for (const s of list) {
    const assets = assetsBySeries.get(s.id) || new Set<string>();
    const formats = formatsBySeries.get(s.id) || [];
    const formatCount = formats.length;
    const formatsWithoutPacking = formats.filter((f) => !f.selected_packing_id).length;

    let colorCount = 0;
    let colorsWithoutImage = 0;
    for (const f of formats) {
      const colors = colorsByFormat.get(f.id) || [];
      colorCount += colors.length;
      colorsWithoutImage += colors.filter((c) => !String(c.sku || "").trim()).length;
    }

    const gaps: SeriesPendingGap[] = [];
    if (formatCount === 0) gaps.push("formats");
    if (!assets.has("technical_panel")) gaps.push("technical_panel");
    if (!assets.has("ambient_image")) gaps.push("ambient_image");
    if (!assets.has("catalog_pdf")) gaps.push("catalog_pdf");
    if (colorCount === 0) gaps.push("colors");
    else if (colorsWithoutImage > 0) gaps.push("color_images");
    if (formatCount > 0 && formatsWithoutPacking > 0) gaps.push("packing");

    if (gaps.length === 0) continue;

    rows.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      is_new: Boolean(s.is_new),
      gaps,
      formatCount,
      colorCount,
      colorsWithoutImage,
      formatsWithoutPacking,
    });
  }

  rows.sort((a, b) => b.gaps.length - a.gaps.length || a.name.localeCompare(b.name, "es"));

  return { rows, incompleteCount: rows.length };
}
