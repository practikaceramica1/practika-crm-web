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
  if (targetIds.length && (counts.article_color_filter_options || 0) === 0) {
    hints.push(
      "No hay filas en article_color_filter_options para esta opción: en Colores, pulsa «Guardar filtros color» en cada variante donde quieras Madera."
    );
  }
  if (targetIds.length && (counts.series_filter_options || 0) === 0 && (counts.format_material_filter_options || 0) === 0 && (counts.article_color_filter_options || 0) === 0) {
    hints.push("La opción no está enlazada en ninguna de las tres tablas de filtros (serie / formato / color).");
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    labelQuery: labelParam,
    filterOptionsMatchingLabel: rows,
    targetFilterOptionIds: targetIds,
    linkCounts: counts,
    sampleColorsWithLink: samples,
    hints,
  });
}
