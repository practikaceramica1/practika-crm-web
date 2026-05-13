import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapFilterGroup } from "@/lib/catalogFilterGroupMap";

export const dynamic = "force-dynamic";

function adminsFromEnv() {
  return (process.env.CRM_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

/**
 * Diagnóstico de enlace «Madera» (y mapeo a `effect` en API pública).
 * Uso: iniciar sesión como admin en el CRM y abrir
 * `GET /api/admin/catalog-filter-diagnostics?label=Madera`
 * (o pegar la URL en el navegador). Así comprobamos CRM + BD sin Supabase Studio.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }
  const admins = adminsFromEnv();
  if (admins.length > 0 && !admins.includes(user.email.toLowerCase())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const labelParam = (searchParams.get("label") || "Madera").trim() || "Madera";

  const { data: options, error: optErr } = await supabase
    .from("filter_options")
    .select("id,label,is_active,filter_groups(key,name)")
    .ilike("label", `%${labelParam.replace(/%/g, "")}%`);

  if (optErr) {
    return NextResponse.json({ ok: false, error: optErr.message }, { status: 500 });
  }

  const rows = (options || []).map((opt) => {
    const g = pickRelation(opt.filter_groups as { key?: string | null; name?: string | null } | null);
    const mapped = mapFilterGroup(g);
    return {
      id: opt.id,
      label: opt.label,
      is_active: opt.is_active,
      filterGroupKey: g?.key ?? null,
      filterGroupName: g?.name ?? null,
      mappedForPublicApi: mapped,
      isEffectForWeb: mapped === "effect",
    };
  });

  const exact = rows.filter((r) => String(r.label).trim().toLowerCase() === labelParam.toLowerCase());
  const targetIds = exact.length ? exact.map((r) => r.id) : rows.map((r) => r.id);

  const counts: Record<string, number> = {};
  const samples: unknown[] = [];
  let seriesInPublishedCatalog: Array<{
    id: string;
    name: string;
    slug: string;
    status: string | null;
    appliedVia: ("serie" | "formato")[];
  }> = [];

  if (targetIds.length) {
    const [{ count: cSeries }, { count: cFmt }, { count: cColor }, colorSamples] = await Promise.all([
      supabase
        .from("series_filter_options")
        .select("filter_option_id", { count: "exact", head: true })
        .in("filter_option_id", targetIds),
      supabase
        .from("format_material_filter_options")
        .select("filter_option_id", { count: "exact", head: true })
        .in("filter_option_id", targetIds),
      supabase
        .from("article_color_filter_options")
        .select("filter_option_id", { count: "exact", head: true })
        .in("filter_option_id", targetIds),
      supabase
        .from("article_color_filter_options")
        .select("article_color_id")
        .in("filter_option_id", targetIds)
        .limit(15),
    ]);

    counts.series_filter_options = cSeries ?? 0;
    counts.format_material_filter_options = cFmt ?? 0;
    counts.article_color_filter_options = cColor ?? 0;

    const { data: seriesFilterRows } = await supabase
      .from("series_filter_options")
      .select("series_id")
      .in("filter_option_id", targetIds);
    const directSeriesIds = new Set((seriesFilterRows || []).map((r) => r.series_id).filter(Boolean) as string[]);

    const { data: fmtFilterRows } = await supabase
      .from("format_material_filter_options")
      .select("format_material_id")
      .in("filter_option_id", targetIds);
    const linkedFormatIds = [...new Set((fmtFilterRows || []).map((r) => r.format_material_id).filter(Boolean))] as string[];
    const formatSeriesIds = new Set<string>();
    if (linkedFormatIds.length) {
      const { data: fmsPub } = await supabase
        .from("format_materials")
        .select("series_id")
        .in("id", linkedFormatIds)
        .eq("status", "published");
      for (const f of fmsPub || []) {
        if (f.series_id) formatSeriesIds.add(f.series_id);
      }
    }

    const unionSeriesIds = [...new Set([...directSeriesIds, ...formatSeriesIds])];
    if (unionSeriesIds.length) {
      const { data: ser } = await supabase
        .from("series")
        .select("id,name,slug,status")
        .in("id", unionSeriesIds)
        .order("name");
      seriesInPublishedCatalog = (ser || []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        appliedVia: [
          ...(directSeriesIds.has(s.id) ? (["serie"] as const) : []),
          ...(formatSeriesIds.has(s.id) ? (["formato"] as const) : []),
        ],
      }));
    }

    const colorIds = (colorSamples.data || []).map((r) => r.article_color_id).filter(Boolean);
    if (colorIds.length) {
      const { data: colors } = await supabase
        .from("article_colors")
        .select("id,color_name,format_material_id")
        .in("id", colorIds);
      const fmIds = [...new Set((colors || []).map((c) => c.format_material_id).filter(Boolean))] as string[];
      const seriesByFm = new Map<string, { name: string; slug: string }>();
      if (fmIds.length) {
        const { data: fms } = await supabase.from("format_materials").select("id,series_id").in("id", fmIds);
        const sids = [...new Set((fms || []).map((f) => f.series_id).filter(Boolean))] as string[];
        const { data: seriesRows } = await supabase.from("series").select("id,name,slug").in("id", sids);
        const seriesMap = new Map((seriesRows || []).map((s) => [s.id, { name: s.name, slug: s.slug }]));
        for (const f of fms || []) {
          const ser = seriesMap.get(f.series_id);
          if (ser) seriesByFm.set(f.id, ser);
        }
      }
      for (const c of colors || []) {
        const ser = seriesByFm.get(c.format_material_id);
        samples.push({
          articleColorId: c.id,
          colorName: c.color_name,
          seriesName: ser?.name ?? null,
          seriesSlug: ser?.slug ?? null,
        });
      }
    }
  }

  const hints: string[] = [];
  if (!rows.length) {
    hints.push(`No hay filter_options cuyo label coincida (ilike) con «${labelParam}». Crea la opción en Admin → Filtros.`);
  }
  if (rows.length && !rows.some((r) => r.isEffectForWeb)) {
    hints.push(
      "Ninguna opción coincidente mapea a «effect» para la API pública: revisa el grupo (key/nombre) en filter_groups; debe ser reconocible como Efecto."
    );
  }
  const nSeries = counts.series_filter_options || 0;
  const nFmt = counts.format_material_filter_options || 0;
  const nColor = counts.article_color_filter_options || 0;
  if (targetIds.length && nSeries === 0 && nFmt === 0 && nColor === 0) {
    hints.push("La opción no está enlazada en ninguna de las tres tablas de filtros (serie / formato / color).");
  } else if (targetIds.length && nColor === 0 && (nSeries > 0 || nFmt > 0)) {
    hints.push(
      "No hay filas en article_color_filter_options para esta opción (sí hay en serie y/o formato/material). La API pública fusiona esas capas: Madera debería salir en catálogo para las series afectadas. Usa «Guardar filtros color» solo si necesitas Madera distinta por chip de color."
    );
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    labelQuery: labelParam,
    filterOptionsMatchingLabel: rows,
    targetFilterOptionIds: targetIds,
    linkCounts: counts,
    seriesWithThisFilter: seriesInPublishedCatalog.filter((s) => s.status === "published"),
    seriesWithThisFilterIncludingNonPublished: seriesInPublishedCatalog,
    sampleColorsWithLink: samples,
    hints,
  });
}
