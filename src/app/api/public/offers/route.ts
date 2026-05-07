import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

export const revalidate = 30;

const PRINCIPAL_SLUG = "principal";

export type PublicOfferItem = {
  id: string;
  sortOrder: number;
  kind: "image" | "pdf";
  url: string;
  title: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .select("id,title,status")
      .eq("slug", PRINCIPAL_SLUG)
      .maybeSingle();
    if (offerErr) throw new Error(offerErr.message);
    if (!offer?.id || offer.status !== "published") {
      return NextResponse.json({
        published: false,
        title: null as string | null,
        items: [] as PublicOfferItem[],
      });
    }

    const { data: rows, error: assetsErr } = await supabase
      .from("offer_assets")
      .select("id,sort_order,asset_type,file_key,title")
      .eq("offer_id", offer.id)
      .order("sort_order", { ascending: true });
    if (assetsErr) throw new Error(assetsErr.message);

    const items: PublicOfferItem[] = (rows || [])
      .map((r) => {
        const url = getAssetPublicUrl("r2", r.file_key);
        if (!url) return null;
        const kind = r.asset_type === "pdf" ? "pdf" : "image";
        return {
          id: r.id,
          sortOrder: Number(r.sort_order) || 0,
          kind,
          url,
          title: r.title,
        };
      })
      .filter(Boolean) as PublicOfferItem[];

    return NextResponse.json({
      published: true,
      title: String(offer.title || "Ofertas"),
      items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
