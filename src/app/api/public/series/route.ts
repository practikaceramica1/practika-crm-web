import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

type CatalogTagI18nMap = Record<string, Partial<Record<"en" | "fr" | "de" | "pt", string>>>;

type ProductLike = {
  id: string;
  name: string;
  slug: string;
  image: string;
  ambientes: string[];
  description?: string;
  colors: string[];
  decorColors: string[];
  relieveColors: string[];
  c3Colors: string[];
  materials: string[];
  formats: string[];
  finishCut: string[];
  finishSurface: string[];
  thickness: string[];
  style: string[];
  surfaceType: string[];
  effect: string[];
  catalogTagI18n?: CatalogTagI18nMap;
  collection?: string;
  featured?: boolean;
  new?: boolean;
  createdAt?: string;
  seriesDownloads?: {
    technicalPanels: string[];
    catalogPdfs: string[];
  };
  catalogFormats?: Array<{
    formatLabel: string;
    formatMaterialId: string;
    materialSlug: string;
    materialName: string;
    widthCm: number;
    heightCm: number;
    finishCut?: string[];
    finishSurface?: string[];
    thickness?: string[];
    style?: string[];
    surfaceType?: string[];
    effect?: string[];
    articleColors: Array<{
      id: string;
      name: string;
      slug: string;
      variantType: "regular" | "decor" | "relieve" | "c3";
      image?: string;
      /** Giro visual en grados en sentido horario (como CSS `rotate(...)` positivo). 0 si la foto ya está bien. */
      imageRotationDegrees?: 0 | 90 | 180 | 270;
      sourceFile?: string;
      finishCut?: string[];
      finishSurface?: string[];
      thickness?: string[];
      style?: string[];
      surfaceType?: string[];
      effect?: string[];
    }>;
  }>;
};

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapFilterKey(key: string):
  | "finishCut"
  | "finishSurface"
  | "thickness"
  | "style"
  | "surfaceType"
  | "effect"
  | "materials"
  | "formats"
  | "colors"
  | null {
  const k = normalizeKey(key);
  if (k === "finishcut" || k === "acabadocorte") return "finishCut";
  if (k === "finishsurface" || k === "acabadosuperficial") return "finishSurface";
  if (k === "thickness" || k === "espesor") return "thickness";
  if (k === "style" || k === "estilo" || k === "estilos") return "style";
  if (k === "surfacetype" || k === "tipo") return "surfaceType";
  if (k === "effect" || k === "efecto" || k === "efectos") return "effect";
  if (k === "materials" || k === "material") return "materials";
  if (k === "formats" || k === "format") return "formats";
  if (k === "colors" || k === "color") return "colors";
  return null;
}

/** Coincidencia por palabras en el nombre visible del grupo (p. ej. «Tipo de estilo»). */
function mapFilterGroupFromNameLabel(name: string) {
  const raw = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = raw.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t === "estilo" || t === "estilos")) return "style";
  if (tokens.some((t) => t === "efecto" || t === "efectos")) return "effect";
  if (tokens.some((t) => t === "espesor")) return "thickness";
  if (tokens.some((t) => t === "corte") && tokens.includes("acabado")) return "finishCut";
  if (tokens.some((t) => t === "superficie") && tokens.includes("acabado")) return "finishSurface";
  if (tokens.some((t) => t === "pavimento" || t === "revestimiento")) return "surfaceType";
  return null;
}

/** Clave libre en CRM + nombre visible: mapear por `key` y si no, por `name` (p. ej. key `fg2` + name «Estilo»). */
function mapFilterGroup(group: { key?: string | null; name?: string | null } | null | undefined) {
  const key = (group?.key || "").trim();
  const name = (group?.name || "").trim();
  return mapFilterKey(key) || mapFilterKey(name) || (name ? mapFilterGroupFromNameLabel(name) : null);
}

function parseFormatForSort(label: string): [number, number] {
  const clean = label.replace(",", ".").toLowerCase();
  const [w, h] = clean.split("x");
  return [Number(w) || 0, Number(h) || 0];
}

function mergeRawTranslationsIntoMap(
  target: CatalogTagI18nMap,
  category: string,
  labelEs: string,
  raw: unknown
) {
  const trimmed = (labelEs || "").trim();
  if (!trimmed || raw === null || raw === undefined) return;
  if (typeof raw !== "object") return;
  const key = `${category}::${trimmed}`;
  const src = raw as Record<string, unknown>;
  const langs = ["en", "fr", "de", "pt"] as const;
  const next: Partial<Record<(typeof langs)[number], string>> = { ...(target[key] || {}) };
  for (const lang of langs) {
    const v = src[lang];
    if (typeof v === "string" && v.trim()) next[lang] = v.trim();
  }
  if (Object.keys(next).length) target[key] = next;
}

function getOrCreateSeriesTagMap(map: Map<string, CatalogTagI18nMap>, seriesId: string): CatalogTagI18nMap {
  let v = map.get(seriesId);
  if (!v) {
    v = {};
    map.set(seriesId, v);
  }
  return v;
}

/** Opciones globales de filtro (para la web: sidebar aunque ninguna serie tenga aún `series_filter_options`). */
type CatalogFilterOptionsPayload = {
  finishCut: string[];
  finishSurface: string[];
  thickness: string[];
  style: string[];
  surfaceType: string[];
  effect: string[];
};

const CATALOG_FILTER_OPTION_GROUPS = [
  "finishCut",
  "finishSurface",
  "thickness",
  "style",
  "surfaceType",
  "effect",
] as const;

function buildCatalogFilterOptionsFromRows(
  filterOptionsRows: Array<{ label: string; filter_groups: unknown }>
): CatalogFilterOptionsPayload {
  const sets: Record<(typeof CATALOG_FILTER_OPTION_GROUPS)[number], Set<string>> = {
    finishCut: new Set(),
    finishSurface: new Set(),
    thickness: new Set(),
    style: new Set(),
    surfaceType: new Set(),
    effect: new Set(),
  };
  for (const opt of filterOptionsRows) {
    const group = Array.isArray(opt.filter_groups) ? opt.filter_groups[0] : opt.filter_groups;
    const mapped = mapFilterGroup(group as { key?: string | null; name?: string | null });
    if (
      !mapped ||
      !CATALOG_FILTER_OPTION_GROUPS.includes(mapped as (typeof CATALOG_FILTER_OPTION_GROUPS)[number])
    ) {
      continue;
    }
    const label = (opt.label || "").trim();
    if (!label) continue;
    sets[mapped as (typeof CATALOG_FILTER_OPTION_GROUPS)[number]].add(label);
  }
  const sortEs = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "es"));
  return {
    finishCut: sortEs(sets.finishCut),
    finishSurface: sortEs(sets.finishSurface),
    thickness: sortEs(sets.thickness),
    style: sortEs(sets.style),
    surfaceType: sortEs(sets.surfaceType),
    effect: sortEs(sets.effect),
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id,name,slug,description,collection,featured,is_new,created_at,status")
      .eq("status", "published")
      .order("name");
    if (seriesError) throw new Error(seriesError.message);

    const seriesIds = (series || []).map((s) => s.id);
    if (seriesIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const [
      { data: formats, error: formatsError },
      { data: assets, error: assetsError },
      { data: seriesFilterRows, error: seriesFilterRowsError },
      { data: filterOptions, error: filterOptionsError },
    ] = await Promise.all([
      supabase
        .from("format_materials")
        .select(
          "id,series_id,format_label,width_cm,height_cm,status,materials(name,slug,default_technical_properties,translations)"
        )
        .in("series_id", seriesIds)
        .eq("status", "published"),
      supabase
        .from("series_assets")
        .select("series_id,asset_type,file_key,storage_provider,sort_order")
        .in("series_id", seriesIds),
      supabase.from("series_filter_options").select("series_id,filter_option_id").in("series_id", seriesIds),
      supabase.from("filter_options").select("id,label,slug,translations,filter_groups(key,name)"),
    ]);

    if (formatsError) throw new Error(formatsError.message);
    if (assetsError) throw new Error(assetsError.message);
    if (seriesFilterRowsError) throw new Error(seriesFilterRowsError.message);
    if (filterOptionsError) throw new Error(filterOptionsError.message);

    const formatIds = (formats || []).map((f) => f.id);
    const { data: colors, error: colorsError } =
      formatIds.length > 0
        ? await supabase
            .from("article_colors")
            .select("id,format_material_id,color_name,color_slug,variant_type,sku,status,image_rotation_degrees")
            .in("format_material_id", formatIds)
            .eq("status", "published")
        : { data: [], error: null };
    if (colorsError) throw new Error(colorsError.message);

    const { data: formatMaterialFilterRows, error: formatMaterialFilterRowsError } =
      formatIds.length > 0
        ? await supabase
            .from("format_material_filter_options")
            .select("format_material_id,filter_option_id")
            .in("format_material_id", formatIds)
        : { data: [] as { format_material_id: string; filter_option_id: string }[], error: null };
    if (formatMaterialFilterRowsError) throw new Error(formatMaterialFilterRowsError.message);

    const articleColorIds = (colors || []).map((c) => c.id);
    const { data: articleColorFilterRows, error: articleColorFilterRowsError } =
      articleColorIds.length > 0
        ? await supabase
            .from("article_color_filter_options")
            .select("article_color_id,filter_option_id")
            .in("article_color_id", articleColorIds)
        : { data: [] as { article_color_id: string; filter_option_id: string }[], error: null };
    if (articleColorFilterRowsError) throw new Error(articleColorFilterRowsError.message);

    const formatsBySeries = new Map<string, typeof formats>();
    (formats || []).forEach((f) => {
      const arr = formatsBySeries.get(f.series_id) || [];
      arr.push(f);
      formatsBySeries.set(f.series_id, arr);
    });

    const colorsByFormat = new Map<string, typeof colors>();
    (colors || []).forEach((c) => {
      const arr = colorsByFormat.get(c.format_material_id) || [];
      arr.push(c);
      colorsByFormat.set(c.format_material_id, arr);
    });

    const assetsBySeries = new Map<string, typeof assets>();
    (assets || []).forEach((a) => {
      const arr = assetsBySeries.get(a.series_id) || [];
      arr.push(a);
      assetsBySeries.set(a.series_id, arr);
    });

    const optionsById = new Map<
      string,
      {
        label: string;
        slug: string;
        mappedGroup: ReturnType<typeof mapFilterGroup>;
        translations: unknown;
      }
    >();
    (filterOptions || []).forEach((opt) => {
      const group = Array.isArray(opt.filter_groups) ? opt.filter_groups[0] : opt.filter_groups;
      optionsById.set(opt.id, {
        label: opt.label,
        slug: String((opt as { slug?: string }).slug || ""),
        mappedGroup: mapFilterGroup(group),
        translations: (opt as { translations?: unknown }).translations,
      });
    });

    const seriesFiltersMap = new Map<
      string,
      {
        finishCut: Set<string>;
        finishSurface: Set<string>;
        thickness: Set<string>;
        style: Set<string>;
        surfaceType: Set<string>;
        effect: Set<string>;
      }
    >();
    const tagI18nBySeries = new Map<string, CatalogTagI18nMap>();
    (seriesFilterRows || []).forEach((row) => {
      const info = optionsById.get(row.filter_option_id);
      if (!info) return;
      const mapped = info.mappedGroup;
      if (!mapped) return;
      if (
        mapped !== "finishCut" &&
        mapped !== "finishSurface" &&
        mapped !== "thickness" &&
        mapped !== "style" &&
        mapped !== "surfaceType" &&
        mapped !== "effect"
      ) {
        return;
      }
      const bucket =
        seriesFiltersMap.get(row.series_id) || {
          finishCut: new Set<string>(),
          finishSurface: new Set<string>(),
          thickness: new Set<string>(),
          style: new Set<string>(),
          surfaceType: new Set<string>(),
          effect: new Set<string>(),
        };
      bucket[mapped].add(info.label);
      seriesFiltersMap.set(row.series_id, bucket);
      mergeRawTranslationsIntoMap(
        getOrCreateSeriesTagMap(tagI18nBySeries, row.series_id),
        mapped,
        info.label,
        info.translations
      );
    });

    const formatIdToSeriesId = new Map<string, string>();
    (formats || []).forEach((f) => formatIdToSeriesId.set(f.id, f.series_id));

    type FilterBucket = {
      finishCut: Set<string>;
      finishSurface: Set<string>;
      thickness: Set<string>;
      style: Set<string>;
      surfaceType: Set<string>;
      effect: Set<string>;
    };

    const createEmptyFilterBucket = (): FilterBucket => ({
      finishCut: new Set(),
      finishSurface: new Set(),
      thickness: new Set(),
      style: new Set(),
      surfaceType: new Set(),
      effect: new Set(),
    });

    const formatMaterialFiltersMap = new Map<string, FilterBucket>();
    (formatMaterialFilterRows || []).forEach((row) => {
      const info = optionsById.get(row.filter_option_id);
      if (!info) return;
      const mapped = info.mappedGroup;
      if (
        mapped !== "finishCut" &&
        mapped !== "finishSurface" &&
        mapped !== "thickness" &&
        mapped !== "style" &&
        mapped !== "surfaceType" &&
        mapped !== "effect"
      ) {
        return;
      }
      const seriesId = formatIdToSeriesId.get(row.format_material_id);
      if (!seriesId) return;

      const fmBucket = formatMaterialFiltersMap.get(row.format_material_id) || createEmptyFilterBucket();
      fmBucket[mapped].add(info.label);
      formatMaterialFiltersMap.set(row.format_material_id, fmBucket);

      const seriesBucket = seriesFiltersMap.get(seriesId) || createEmptyFilterBucket();
      seriesBucket[mapped].add(info.label);
      seriesFiltersMap.set(seriesId, seriesBucket);

      mergeRawTranslationsIntoMap(
        getOrCreateSeriesTagMap(tagI18nBySeries, seriesId),
        mapped,
        info.label,
        info.translations
      );
    });

    const articleColorIdToSeriesId = new Map<string, string>();
    (colors || []).forEach((c) => {
      const sid = formatIdToSeriesId.get(c.format_material_id);
      if (sid) articleColorIdToSeriesId.set(c.id, sid);
    });

    const articleColorFiltersMap = new Map<string, FilterBucket>();
    (articleColorFilterRows || []).forEach((row) => {
      const info = optionsById.get(row.filter_option_id);
      if (!info) return;
      const mapped = info.mappedGroup;
      if (
        mapped !== "finishCut" &&
        mapped !== "finishSurface" &&
        mapped !== "thickness" &&
        mapped !== "style" &&
        mapped !== "surfaceType" &&
        mapped !== "effect"
      ) {
        return;
      }
      const seriesId = articleColorIdToSeriesId.get(row.article_color_id);
      if (!seriesId) return;

      const colorBucket = articleColorFiltersMap.get(row.article_color_id) || createEmptyFilterBucket();
      colorBucket[mapped].add(info.label);
      articleColorFiltersMap.set(row.article_color_id, colorBucket);

      const seriesBucket = seriesFiltersMap.get(seriesId) || createEmptyFilterBucket();
      seriesBucket[mapped].add(info.label);
      seriesFiltersMap.set(seriesId, seriesBucket);

      mergeRawTranslationsIntoMap(
        getOrCreateSeriesTagMap(tagI18nBySeries, seriesId),
        mapped,
        info.label,
        info.translations
      );
    });

    const sortEs = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "es"));
    function serialiseFormatFilterBucket(b: FilterBucket | undefined) {
      if (!b) return {} as Record<string, string[]>;
      const out: Record<string, string[]> = {};
      if (b.finishCut.size) out.finishCut = sortEs(b.finishCut);
      if (b.finishSurface.size) out.finishSurface = sortEs(b.finishSurface);
      if (b.thickness.size) out.thickness = sortEs(b.thickness);
      if (b.style.size) out.style = sortEs(b.style);
      if (b.surfaceType.size) out.surfaceType = sortEs(b.surfaceType);
      if (b.effect.size) out.effect = sortEs(b.effect);
      return out;
    }

    const products: ProductLike[] = (series || []).map((s) => {
      const seriesFormats = [...(formatsBySeries.get(s.id) || [])].sort((a, b) => {
        const [aw, ah] = parseFormatForSort(a.format_label);
        const [bw, bh] = parseFormatForSort(b.format_label);
        if (aw !== bw) return aw - bw;
        return ah - bh;
      });
      const materialsSet = new Set<string>();
      const formatsSet = new Set<string>();
      const regularSet = new Set<string>();
      const decorSet = new Set<string>();
      const relieveSet = new Set<string>();
      const c3Set = new Set<string>();

      seriesFormats.forEach((f) => {
        const material = Array.isArray(f.materials) ? f.materials[0] : f.materials;
        if (material?.name) materialsSet.add(material.name);
        if (f.format_label) formatsSet.add(f.format_label);
        const formatColors = colorsByFormat.get(f.id) || [];
        formatColors.forEach((c) => {
          if (!c.color_name) return;
          if (c.variant_type === "decor") decorSet.add(c.color_name);
          else if (c.variant_type === "relieve") relieveSet.add(c.color_name);
          else if (c.variant_type === "c3") c3Set.add(c.color_name);
          else regularSet.add(c.color_name);
        });
      });

      const rowAssets = [...(assetsBySeries.get(s.id) || [])];
      rowAssets.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      const ambientes = rowAssets
        .filter((a) => a.asset_type === "ambient_image")
        .map((a) => getAssetPublicUrl(a.storage_provider, a.file_key))
        .filter(Boolean);

      const technicalPanels = rowAssets
        .filter((a) => a.asset_type === "technical_panel")
        .map((a) => getAssetPublicUrl(a.storage_provider, a.file_key))
        .filter(Boolean);
      const catalogPdfs = rowAssets
        .filter((a) => a.asset_type === "catalog_pdf")
        .map((a) => getAssetPublicUrl(a.storage_provider, a.file_key))
        .filter(Boolean);

      const catalogFormats = seriesFormats.map((f) => {
        const material = Array.isArray(f.materials) ? f.materials[0] : f.materials;
        const formatColors = colorsByFormat.get(f.id) || [];
        const articleColors = formatColors
          .filter((c) => c.color_name)
          .map((c) => {
            const rawDeg = Number(c.image_rotation_degrees);
            const imageRotationDegrees: 0 | 90 | 180 | 270 = [0, 90, 180, 270].includes(rawDeg)
              ? (rawDeg as 0 | 90 | 180 | 270)
              : 0;
            return {
            id: c.id,
            name: c.color_name!,
            slug: (c.color_slug || "").trim() || c.color_name!.toLowerCase().replace(/\s+/g, "-"),
            variantType: (c.variant_type === "decor" ||
            c.variant_type === "relieve" ||
            c.variant_type === "c3"
              ? c.variant_type
              : "regular") as "regular" | "decor" | "relieve" | "c3",
            image: c.sku ? getAssetPublicUrl("r2", c.sku) : undefined,
            imageRotationDegrees,
            sourceFile: c.sku || undefined,
            ...serialiseFormatFilterBucket(articleColorFiltersMap.get(c.id)),
          };
          });
        return {
          formatLabel: f.format_label,
          formatMaterialId: f.id,
          materialSlug: material?.slug ?? "",
          materialName: material?.name ?? "",
          widthCm: Number(f.width_cm),
          heightCm: Number(f.height_cm),
          articleColors,
          ...serialiseFormatFilterBucket(formatMaterialFiltersMap.get(f.id)),
        };
      });

      const seriesFilters = seriesFiltersMap.get(s.id);
      const catalogTagI18n: CatalogTagI18nMap = { ...(tagI18nBySeries.get(s.id) || {}) };
      seriesFormats.forEach((f) => {
        const matRel = Array.isArray(f.materials) ? f.materials[0] : f.materials;
        const mat = matRel as { name?: string; translations?: unknown } | undefined;
        if (mat?.name) {
          mergeRawTranslationsIntoMap(catalogTagI18n, "materials", mat.name, mat.translations);
        }
      });
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        image: ambientes[0] || "/images/placeholder-product.jpg",
        ambientes,
        description: s.description || undefined,
        colors: [...regularSet].sort((a, b) => a.localeCompare(b, "es")),
        decorColors: [...decorSet].sort((a, b) => a.localeCompare(b, "es")),
        relieveColors: [...relieveSet].sort((a, b) => a.localeCompare(b, "es")),
        c3Colors: [...c3Set].sort((a, b) => a.localeCompare(b, "es")),
        materials: [...materialsSet].sort((a, b) => a.localeCompare(b, "es")),
        formats: [...formatsSet],
        finishCut: [...(seriesFilters?.finishCut || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        finishSurface: [...(seriesFilters?.finishSurface || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        thickness: [...(seriesFilters?.thickness || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        style: [...(seriesFilters?.style || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        surfaceType: [...(seriesFilters?.surfaceType || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        effect: [...(seriesFilters?.effect || new Set<string>())].sort((a, b) => a.localeCompare(b, "es")),
        collection: s.collection || undefined,
        featured: Boolean(s.featured),
        new: Boolean(s.is_new),
        createdAt: s.created_at || undefined,
        seriesDownloads:
          technicalPanels.length > 0 || catalogPdfs.length > 0
            ? { technicalPanels, catalogPdfs }
            : undefined,
        catalogFormats,
        ...(Object.keys(catalogTagI18n).length > 0 ? { catalogTagI18n } : {}),
      };
    });

    const catalogFilterOptions = buildCatalogFilterOptionsFromRows(
      (filterOptions || []) as Array<{ label: string; filter_groups: unknown }>
    );

    return NextResponse.json({ products, catalogFilterOptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
