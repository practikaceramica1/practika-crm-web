import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApiUser } from "@/lib/adminApiAuth";
import { getSeriesPublicUrl } from "@/lib/seriesPublicUrl";
import { generateSeriesQrPngBuffer } from "@/lib/seriesQr.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdminApiUser();
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status });
  }

  const supabase = await createClient();
  const { data: seriesRows, error } = await supabase.from("series").select("slug").order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const zip = new JSZip();
  for (const row of seriesRows || []) {
    const slug = String(row.slug || "").trim();
    if (!slug) continue;
    const png = await generateSeriesQrPngBuffer(getSeriesPublicUrl(slug));
    zip.file(`${slug}.png`, png);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `qr-series-practika-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
