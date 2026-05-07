import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

export const revalidate = 30;

export type PublicNewsItem = {
  id: string;
  ordinal: number;
  isFavorite: boolean;
  kind: "image" | "pdf";
  url: string;
  title: string | null;
};

export type PublicNewsSection = {
  slug: string;
  title: string;
  description: string | null;
  items: PublicNewsItem[];
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: sections, error: sErr } = await supabase
      .from("news_sections")
      .select("id,slug,title,description,status,sort_order")
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    const outSections: PublicNewsSection[] = [];

    for (const sec of sections || []) {
      const { data: rows, error: aErr } = await supabase
        .from("news_section_assets")
        .select("id,ordinal,is_favorite,asset_type,file_key,title")
        .eq("section_id", sec.id)
        .order("is_favorite", { ascending: false })
        .order("ordinal", { ascending: true });
      if (aErr) throw new Error(aErr.message);

      const items: PublicNewsItem[] = (rows || [])
        .map((r) => {
          const url = getAssetPublicUrl("r2", r.file_key);
          if (!url) return null;
          const kind = r.asset_type === "pdf" ? "pdf" : "image";
          return {
            id: r.id,
            ordinal: Number(r.ordinal) || 0,
            isFavorite: Boolean(r.is_favorite),
            kind,
            url,
            title: r.title,
          };
        })
        .filter(Boolean) as PublicNewsItem[];

      if (!items.length) continue;

      outSections.push({
        slug: sec.slug,
        title: String(sec.title || ""),
        description: sec.description ? String(sec.description) : null,
        items,
      });
    }

    return NextResponse.json({ sections: outSections });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message, sections: [] }, { status: 500 });
  }
}
