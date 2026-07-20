import { createClient } from "@/lib/supabase/server";
import { formatLabelFromCm } from "@/lib/formatDisplay";
import type { AdminSeriesSearchItem } from "@/lib/adminSeriesSearchTypes";

export type { AdminSeriesSearchItem };

function parseFormatForSort(label: string): [number, number] {
  const clean = label.replace(",", ".").toLowerCase();
  const [w, h] = clean.split("x");
  return [Number(w) || 0, Number(h) || 0];
}

/** Índice ligero de series + formatos para el buscador del header admin. */
export async function getAdminSeriesSearchIndex(): Promise<AdminSeriesSearchItem[]> {
  const supabase = await createClient();
  const { data: series, error } = await supabase
    .from("series")
    .select("id,name,slug")
    .order("name", { ascending: true });
  if (error || !series?.length) return [];

  const seriesIds = series.map((s) => s.id);
  const formatsBySeries = new Map<string, string[]>();

  const { data: formatRows } = await supabase
    .from("format_materials")
    .select("series_id,format_label,width_cm,height_cm")
    .in("series_id", seriesIds);

  for (const row of formatRows || []) {
    const width = Number(row.width_cm);
    const height = Number(row.height_cm);
    const label =
      Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
        ? formatLabelFromCm(width, height)
        : String(row.format_label || "").trim();
    if (!label || !row.series_id) continue;
    const list = formatsBySeries.get(row.series_id) || [];
    if (!list.includes(label)) list.push(label);
    formatsBySeries.set(row.series_id, list);
  }

  for (const [seriesId, labels] of formatsBySeries) {
    labels.sort((a, b) => {
      const [aw, ah] = parseFormatForSort(a);
      const [bw, bh] = parseFormatForSort(b);
      if (aw !== bw) return aw - bw;
      return ah - bh;
    });
    formatsBySeries.set(seriesId, labels);
  }

  return series.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    formats: formatsBySeries.get(s.id) || [],
  }));
}
