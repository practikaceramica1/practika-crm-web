import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApiUser } from "@/lib/adminApiAuth";
import { getSeriesPublicUrl } from "@/lib/seriesPublicUrl";
import { generateSeriesQrPngBuffer } from "@/lib/seriesQr.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status });
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: series, error } = await supabase.from("series").select("slug").eq("slug", slug).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!series) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const publicUrl = getSeriesPublicUrl(series.slug);
  const png = await generateSeriesQrPngBuffer(publicUrl);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${series.slug}.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
