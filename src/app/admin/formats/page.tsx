import { createClient } from "@/lib/supabase/server";
import {
  FormatsCatalogClient,
  type CatalogFormatRow,
  type MaterialOption,
} from "@/components/admin/FormatsCatalogClient";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";

export default async function FormatsPage() {
  const supabase = await createClient();
  const [
    { data: catalog, error: catalogError },
    { data: packings, error: packingsError },
    { data: materials, error: materialsError },
    { data: seriesLinks, error: seriesLinksError },
  ] = await Promise.all([
    supabase
      .from("catalog_format_materials")
      .select("id,width_cm,height_cm,format_label,characteristic,material_id,materials(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("format_packings")
      .select(
        "id,catalog_format_material_id,supplier,pieces_box,m2_box,kg_box,boxes_pallet,m2_pallet,kg_pallet,is_published,sort_order"
      )
      .order("sort_order", { ascending: true }),
    supabase.from("materials").select("id,name").eq("is_active", true).order("name"),
    supabase.from("format_materials").select("catalog_format_material_id"),
  ]);

  if (
    isSchemaNotReadyError(catalogError) ||
    isSchemaNotReadyError(packingsError) ||
    String(catalogError?.message || "").includes("catalog_format_materials")
  ) {
    return (
      <SetupRequired
        missing="public.catalog_format_materials / public.format_packings"
        migration="supabase/migrations/20260717_catalog_formats_packings.sql"
      />
    );
  }
  if (catalogError) throw new Error(catalogError.message);
  if (packingsError) throw new Error(packingsError.message);
  if (materialsError) throw new Error(materialsError.message);
  if (seriesLinksError) throw new Error(seriesLinksError.message);

  const seriesCountByCatalog = new Map<string, number>();
  for (const link of seriesLinks || []) {
    const id = link.catalog_format_material_id as string | null;
    if (!id) continue;
    seriesCountByCatalog.set(id, (seriesCountByCatalog.get(id) || 0) + 1);
  }

  const packingsByCatalog = new Map<string, CatalogFormatRow["packings"]>();
  for (const p of packings || []) {
    const list = packingsByCatalog.get(p.catalog_format_material_id) || [];
    list.push({
      id: p.id,
      supplier: p.supplier,
      piecesBox: Number(p.pieces_box),
      m2Box: Number(p.m2_box),
      kgBox: Number(p.kg_box),
      boxesPallet: Number(p.boxes_pallet),
      m2Pallet: Number(p.m2_pallet),
      kgPallet: Number(p.kg_pallet),
      isPublished: Boolean(p.is_published),
    });
    packingsByCatalog.set(p.catalog_format_material_id, list);
  }

  const rows: CatalogFormatRow[] = (catalog || []).map((row) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    return {
      id: row.id,
      widthCm: Number(row.width_cm),
      heightCm: Number(row.height_cm),
      formatLabel: row.format_label,
      characteristic: row.characteristic || "",
      materialId: row.material_id,
      materialName: material?.name ?? "-",
      seriesCount: seriesCountByCatalog.get(row.id) || 0,
      packings: packingsByCatalog.get(row.id) || [],
    };
  });

  const materialOptions: MaterialOption[] = (materials || []).map((m) => ({ id: m.id, name: m.name }));

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Formatos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo global de formato + material (+ característica). Aquí se crean los packings que alimentan el{" "}
          <strong>packing-list</strong> de la web (si están publicados) y que las series eligen al asignar un formato.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El orden de grupos en packing-list sigue el orden de <strong>Materiales</strong> en Filtros (no el
          alfabético del catálogo). Arrastra las opciones del grupo Material para cambiar ese orden.
        </p>
      </section>
      <FormatsCatalogClient initialRows={rows} materials={materialOptions} />
    </main>
  );
}
