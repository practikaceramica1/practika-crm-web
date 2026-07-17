import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatLabelFromCm } from "@/lib/formatDisplay";

export const dynamic = "force-dynamic";

/**
 * Packing list público agrupado por material (orden materials.sort_order).
 * Solo packings con is_published = true.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: materials, error: materialsError } = await supabase
      .from("materials")
      .select("id,slug,name,sort_order,translations")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (materialsError) throw new Error(materialsError.message);

    const { data: packings, error: packingsError } = await supabase
      .from("format_packings")
      .select(
        "id,supplier,pieces_box,m2_box,kg_box,boxes_pallet,m2_pallet,kg_pallet,sort_order,catalog_format_materials(id,width_cm,height_cm,format_label,characteristic,material_id,status)"
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (packingsError) {
      if (String(packingsError.message || "").includes("format_packings")) {
        return NextResponse.json(
          { categories: [], error: "Schema packing no migrado" },
          { status: 503 }
        );
      }
      throw new Error(packingsError.message);
    }

    type Item = {
      packingId: string;
      catalogFormatMaterialId: string;
      format: string;
      formatNormalized: string;
      characteristic: string;
      supplier: string | null;
      box: { pieces: number; m2: number; kg: number };
      pallet: { boxes: number; m2: number; kg: number };
    };

    const itemsByMaterial = new Map<string, Item[]>();
    for (const row of packings || []) {
      const catalog = Array.isArray(row.catalog_format_materials)
        ? row.catalog_format_materials[0]
        : row.catalog_format_materials;
      if (!catalog || catalog.status !== "published") continue;
      const width = Number(catalog.width_cm);
      const height = Number(catalog.height_cm);
      const format =
        Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
          ? formatLabelFromCm(width, height).replace(/x/i, "×")
          : String(catalog.format_label || "").replace(/x/i, "×");
      const formatNormalized = formatLabelFromCm(width, height);
      const item: Item = {
        packingId: row.id,
        catalogFormatMaterialId: catalog.id,
        format,
        formatNormalized,
        characteristic: catalog.characteristic || "",
        supplier: row.supplier,
        box: {
          pieces: Number(row.pieces_box),
          m2: Number(row.m2_box),
          kg: Number(row.kg_box),
        },
        pallet: {
          boxes: Number(row.boxes_pallet),
          m2: Number(row.m2_pallet),
          kg: Number(row.kg_pallet),
        },
      };
      const list = itemsByMaterial.get(catalog.material_id) || [];
      list.push(item);
      itemsByMaterial.set(catalog.material_id, list);
    }

    const categories = (materials || [])
      .map((m) => {
        const items = (itemsByMaterial.get(m.id) || []).sort((a, b) => {
          const [aw, ah] = a.formatNormalized.split("x").map((x) => Number(String(x).replace(",", ".")) || 0);
          const [bw, bh] = b.formatNormalized.split("x").map((x) => Number(String(x).replace(",", ".")) || 0);
          if (aw !== bw) return aw - bw;
          if (ah !== bh) return ah - bh;
          return a.characteristic.localeCompare(b.characteristic, "es");
        });
        if (items.length === 0) return null;
        return {
          id: m.slug,
          name: m.name,
          sortOrder: m.sort_order,
          translations: m.translations ?? null,
          items,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      categories,
      totalItems: categories.reduce((sum, c) => sum + (c?.items.length || 0), 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error packing-list" },
      { status: 500 }
    );
  }
}
