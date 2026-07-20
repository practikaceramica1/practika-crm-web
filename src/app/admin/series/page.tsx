import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { SeriesListTable } from "@/components/admin/SeriesListTable";
import { formatLabelFromCm } from "@/lib/formatDisplay";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";

function parseFormatForSort(label: string): [number, number] {
  const clean = label.replace(",", ".").toLowerCase();
  const [w, h] = clean.split("x");
  return [Number(w) || 0, Number(h) || 0];
}

export default async function SeriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("id,name,slug,is_new,updated_at")
    .order("name", { ascending: true });

  if (isSchemaNotReadyError(error)) {
    return <SetupRequired missing="public.series" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (error) throw new Error(error.message);

  const seriesIds = (data || []).map((r) => r.id);
  const formatsBySeries = new Map<string, string[]>();

  if (seriesIds.length > 0) {
    const { data: formatRows, error: formatsError } = await supabase
      .from("format_materials")
      .select("series_id,format_label,width_cm,height_cm")
      .in("series_id", seriesIds);
    if (formatsError && !isSchemaNotReadyError(formatsError)) {
      throw new Error(formatsError.message);
    }
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
  }

  const rows = (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    is_new: Boolean(r.is_new),
    updated_at: r.updated_at,
    formats: formatsBySeries.get(r.id) || [],
  }));

  return (
    <main className="space-y-6">
      <section className="card flex items-center justify-between p-5">
        <div>
          <h1 className="text-2xl font-semibold">Series</h1>
          <p className="text-sm text-slate-500">Cada serie se gestiona en vista separada con pasos.</p>
        </div>
        <Link href="/admin/series/new" className="btn-primary">
          Nueva serie
        </Link>
      </section>
      <section className="card overflow-hidden">
        <SeriesListTable rows={rows} />
      </section>
    </main>
  );
}
