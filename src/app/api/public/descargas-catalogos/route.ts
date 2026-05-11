import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetPublicUrl } from "@/lib/storageUrl";

export const revalidate = 60;

export type PublicCatalogTranslationEntry = { title: string; subtitle: string };
export type PublicCatalogTranslations = Partial<Record<string, PublicCatalogTranslationEntry>>;

export type PublicDownloadCatalogItem = {
  id: string;
  title: string;
  subtitle: string | null;
  fileUrl: string;
  fileSizeHint: string | null;
  fileKey: string;
  translations: PublicCatalogTranslations;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("download_catalog_items")
      .select("id,title,subtitle,storage_provider,file_key,file_size_hint,translations")
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
          fileUrl,
          fileSizeHint: r.file_size_hint ? String(r.file_size_hint) : null,
          fileKey: String(r.file_key),
          translations: (r.translations as PublicCatalogTranslations) ?? {},
        };
      })
      .filter(Boolean) as PublicDownloadCatalogItem[];

    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
