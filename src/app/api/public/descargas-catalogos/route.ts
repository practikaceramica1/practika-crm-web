import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

export const revalidate = 60;

export type PublicDownloadCatalogItem = {
  id: string;
  title: string;
  subtitle: string | null;
  year: string | null;
  coverStyle: string;
  fileUrl: string;
  fileSizeHint: string | null;
  fileKey: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("download_catalog_items")
      .select("id,title,subtitle,year,cover_style,storage_provider,file_key,file_size_hint")
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const items: PublicDownloadCatalogItem[] = (rows || [])
      .map((r) => {
        const fileUrl = getAssetPublicUrl(String(r.storage_provider || "r2"), String(r.file_key));
        if (!fileUrl) return null;
        return {
          id: r.id,
          title: String(r.title || ""),
          subtitle: r.subtitle ? String(r.subtitle) : null,
          year: r.year ? String(r.year) : null,
          coverStyle: String(r.cover_style || "light"),
          fileUrl,
          fileSizeHint: r.file_size_hint ? String(r.file_size_hint) : null,
          fileKey: String(r.file_key),
        };
      })
      .filter(Boolean) as PublicDownloadCatalogItem[];

    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
