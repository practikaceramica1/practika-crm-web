import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

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
    articleColors: Array<{
      id: string;
      name: string;
      slug: string;
      variantType: "regular" | "decor" | "relieve" | "c3";
      image?: string;
      sourceFile?: string;
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
  if (k === "style" || k === "estilo") return "style";
  if (k === "surfacetype" || k === "tipo") return "surfaceType";
  if (k === "effect" || k === "efecto") return "effect";
  if (k === "materials" || k === "material") return "materials";
  if (k === "formats" || k === "format") return "formats";
  if (k === "colors" || k === "color") return "colors";
  return null;
}

function parseFormatForSort(label: string): [number, number] {
  const clean = label.replace(",", ".").toLowerCase();
  const [w, h] = clean.split("x");
  return [Number(w) || 0, Number(h) || 0];
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
          "id,series_id,format_label,width_cm,height_cm,status,materials(name,slug,default_technical_properties)"
        )
        .in("series_id", seriesIds)
        .eq("status", "published"),
      supabase
        .from("series_assets")
        .select("series_id,asset_type,file_key,storage_provider,sort_order")
        .in("series_id", seriesIds),
      supabase.from("series_filter_options").select("series_id,filter_option_id").in("series_id", seriesIds),
      supabase.from("filter_options").select("id,label,filter_groups(key,name)"),
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
            .select("id,format_material_id,color_name,color_slug,variant_type,sku,status")
            .in("format_material_id", formatIds)
            .eq("status", "published")
        : { data: [], error: null };
    if (colorsError) throw new Error(colorsError.message);

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
        groupKey: string;
      }
    >();
    (filterOptions || []).forEach((opt) => {
      const group = Array.isArray(opt.filter_groups) ? opt.filter_groups[0] : opt.filter_groups;
      optionsById.set(opt.id, {
        label: opt.label,
        groupKey: group?.key || group?.name || "",
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
    (seriesFilterRows || []).forEach((row) => {
      const info = optionsById.get(row.filter_option_id);
      if (!info) return;
      const mapped = mapFilterKey(info.groupKey);
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
    });

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
          .map((c) => ({
            id: c.id,
            name: c.color_name!,
            slug: (c.color_slug || "").trim() || c.color_name!.toLowerCase().replace(/\s+/g, "-"),
            variantType: (c.variant_type === "decor" ||
            c.variant_type === "relieve" ||
            c.variant_type === "c3"
              ? c.variant_type
              : "regular") as "regular" | "decor" | "relieve" | "c3",
            image: c.sku ? getAssetPublicUrl("r2", c.sku) : undefined,
            sourceFile: c.sku || undefined,
          }));
        return {
          formatLabel: f.format_label,
          formatMaterialId: f.id,
          materialSlug: material?.slug ?? "",
          materialName: material?.name ?? "",
          widthCm: Number(f.width_cm),
          heightCm: Number(f.height_cm),
          articleColors,
        };
      });

      const seriesFilters = seriesFiltersMap.get(s.id);
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
      };
    });

    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
