"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { formatLabelFromCm } from "@/lib/formatDisplay";
import { createClient } from "@/lib/supabase/server";

const catalogIdSchema = z.object({
  catalogFormatMaterialId: z.string().uuid(),
});

const createCatalogSchema = z.object({
  widthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  materialId: z.string().uuid(),
  characteristic: z.string().optional(),
  piecesBox: z.coerce.number().min(0),
  m2Box: z.coerce.number().min(0),
  kgBox: z.coerce.number().min(0),
  boxesPallet: z.coerce.number().min(0),
  m2Pallet: z.coerce.number().min(0),
  kgPallet: z.coerce.number().min(0),
  supplier: z.string().optional(),
  isPublished: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.null(), z.undefined()])
    .transform((v) => v === "on" || v === "true" || v === "1"),
});

const updateCatalogSchema = z.object({
  catalogFormatMaterialId: z.string().uuid(),
  widthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  materialId: z.string().uuid(),
  characteristic: z.string().optional(),
});

const packingSchema = z.object({
  catalogFormatMaterialId: z.string().uuid(),
  packingId: z.string().uuid().optional(),
  supplier: z.string().optional(),
  piecesBox: z.coerce.number().min(0),
  m2Box: z.coerce.number().min(0),
  kgBox: z.coerce.number().min(0),
  boxesPallet: z.coerce.number().min(0),
  m2Pallet: z.coerce.number().min(0),
  kgPallet: z.coerce.number().min(0),
  isPublished: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.null(), z.undefined()])
    .transform((v) => v === "on" || v === "true" || v === "1"),
});

function revalidateFormats() {
  revalidatePath("/admin/formats");
  revalidatePath("/admin/series");
}

async function syncSeriesFormatRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogId: string,
  patch: {
    material_id: string;
    width_cm: number;
    height_cm: number;
    format_label: string;
  }
) {
  const { error } = await supabase
    .from("format_materials")
    .update(patch)
    .eq("catalog_format_material_id", catalogId);
  if (error) throw new Error(error.message);
}

export async function createCatalogFormatAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = createCatalogSchema.safeParse({
    widthCm: formData.get("widthCm"),
    heightCm: formData.get("heightCm"),
    materialId: formData.get("materialId"),
    characteristic: formData.get("characteristic") || "",
    piecesBox: formData.get("piecesBox"),
    m2Box: formData.get("m2Box"),
    kgBox: formData.get("kgBox"),
    boxesPallet: formData.get("boxesPallet"),
    m2Pallet: formData.get("m2Pallet"),
    kgPallet: formData.get("kgPallet"),
    supplier: formData.get("supplier") || "",
    isPublished: formData.get("isPublished"),
  });
  if (!parsed.success) throw new Error("Datos de formato inválidos");

  const characteristic = (parsed.data.characteristic || "").trim();
  const formatLabel = formatLabelFromCm(parsed.data.widthCm, parsed.data.heightCm);

  const inserted = await supabase
    .from("catalog_format_materials")
    .insert({
      material_id: parsed.data.materialId,
      width_cm: parsed.data.widthCm,
      height_cm: parsed.data.heightCm,
      format_label: formatLabel,
      characteristic,
      status: "published",
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      throw new Error("Ya existe ese formato + material + característica.");
    }
    throw new Error(inserted.error.message);
  }

  const packing = await supabase.from("format_packings").insert({
    catalog_format_material_id: inserted.data.id,
    supplier: (parsed.data.supplier || "").trim() || null,
    pieces_box: parsed.data.piecesBox,
    m2_box: parsed.data.m2Box,
    kg_box: parsed.data.kgBox,
    boxes_pallet: parsed.data.boxesPallet,
    m2_pallet: parsed.data.m2Pallet,
    kg_pallet: parsed.data.kgPallet,
    is_published: parsed.data.isPublished,
    sort_order: 0,
  });
  if (packing.error) throw new Error(packing.error.message);

  revalidateFormats();
}

export async function updateCatalogFormatAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = updateCatalogSchema.safeParse({
    catalogFormatMaterialId: formData.get("catalogFormatMaterialId"),
    widthCm: formData.get("widthCm"),
    heightCm: formData.get("heightCm"),
    materialId: formData.get("materialId"),
    characteristic: formData.get("characteristic") || "",
  });
  if (!parsed.success) throw new Error("Datos de formato inválidos");

  const characteristic = (parsed.data.characteristic || "").trim();
  const formatLabel = formatLabelFromCm(parsed.data.widthCm, parsed.data.heightCm);
  const patch = {
    material_id: parsed.data.materialId,
    width_cm: parsed.data.widthCm,
    height_cm: parsed.data.heightCm,
    format_label: formatLabel,
    characteristic,
  };

  const { error } = await supabase
    .from("catalog_format_materials")
    .update(patch)
    .eq("id", parsed.data.catalogFormatMaterialId);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe ese formato + material + característica.");
    }
    throw new Error(error.message);
  }

  await syncSeriesFormatRows(supabase, parsed.data.catalogFormatMaterialId, {
    material_id: patch.material_id,
    width_cm: patch.width_cm,
    height_cm: patch.height_cm,
    format_label: patch.format_label,
  });

  revalidateFormats();
}

export async function deleteCatalogFormatAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = catalogIdSchema.safeParse({
    catalogFormatMaterialId: formData.get("catalogFormatMaterialId"),
  });
  if (!parsed.success) throw new Error("Formato inválido");

  const { count, error: countErr } = await supabase
    .from("format_materials")
    .select("id", { count: "exact", head: true })
    .eq("catalog_format_material_id", parsed.data.catalogFormatMaterialId);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      `No se puede eliminar: ${count} serie(s) usan este formato. Quítalo de las series antes.`
    );
  }

  const { error } = await supabase
    .from("catalog_format_materials")
    .delete()
    .eq("id", parsed.data.catalogFormatMaterialId);
  if (error) throw new Error(error.message);

  revalidateFormats();
}

export async function addPackingAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = packingSchema.safeParse({
    catalogFormatMaterialId: formData.get("catalogFormatMaterialId"),
    supplier: formData.get("supplier") || "",
    piecesBox: formData.get("piecesBox"),
    m2Box: formData.get("m2Box"),
    kgBox: formData.get("kgBox"),
    boxesPallet: formData.get("boxesPallet"),
    m2Pallet: formData.get("m2Pallet"),
    kgPallet: formData.get("kgPallet"),
    isPublished: formData.get("isPublished"),
  });
  if (!parsed.success) throw new Error("Datos de packing inválidos");

  const { data: maxRow } = await supabase
    .from("format_packings")
    .select("sort_order")
    .eq("catalog_format_material_id", parsed.data.catalogFormatMaterialId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("format_packings").insert({
    catalog_format_material_id: parsed.data.catalogFormatMaterialId,
    supplier: (parsed.data.supplier || "").trim() || null,
    pieces_box: parsed.data.piecesBox,
    m2_box: parsed.data.m2Box,
    kg_box: parsed.data.kgBox,
    boxes_pallet: parsed.data.boxesPallet,
    m2_pallet: parsed.data.m2Pallet,
    kg_pallet: parsed.data.kgPallet,
    is_published: parsed.data.isPublished,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
  });
  if (error) throw new Error(error.message);

  revalidateFormats();
}

export async function updatePackingAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = packingSchema
    .extend({ packingId: z.string().uuid() })
    .safeParse({
      catalogFormatMaterialId: formData.get("catalogFormatMaterialId"),
      packingId: formData.get("packingId"),
      supplier: formData.get("supplier") || "",
      piecesBox: formData.get("piecesBox"),
      m2Box: formData.get("m2Box"),
      kgBox: formData.get("kgBox"),
      boxesPallet: formData.get("boxesPallet"),
      m2Pallet: formData.get("m2Pallet"),
      kgPallet: formData.get("kgPallet"),
      isPublished: formData.get("isPublished"),
    });
  if (!parsed.success) throw new Error("Datos de packing inválidos");

  const { error } = await supabase
    .from("format_packings")
    .update({
      supplier: (parsed.data.supplier || "").trim() || null,
      pieces_box: parsed.data.piecesBox,
      m2_box: parsed.data.m2Box,
      kg_box: parsed.data.kgBox,
      boxes_pallet: parsed.data.boxesPallet,
      m2_pallet: parsed.data.m2Pallet,
      kg_pallet: parsed.data.kgPallet,
      is_published: parsed.data.isPublished,
    })
    .eq("id", parsed.data.packingId)
    .eq("catalog_format_material_id", parsed.data.catalogFormatMaterialId);
  if (error) throw new Error(error.message);

  revalidateFormats();
}

export async function deletePackingAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = z
    .object({
      catalogFormatMaterialId: z.string().uuid(),
      packingId: z.string().uuid(),
    })
    .safeParse({
      catalogFormatMaterialId: formData.get("catalogFormatMaterialId"),
      packingId: formData.get("packingId"),
    });
  if (!parsed.success) throw new Error("Packing inválido");

  const { count, error: countErr } = await supabase
    .from("format_packings")
    .select("id", { count: "exact", head: true })
    .eq("catalog_format_material_id", parsed.data.catalogFormatMaterialId);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) <= 1) {
    throw new Error("Debe quedar al menos un packing por formato + material.");
  }

  const { error } = await supabase
    .from("format_packings")
    .delete()
    .eq("id", parsed.data.packingId)
    .eq("catalog_format_material_id", parsed.data.catalogFormatMaterialId);
  if (error) throw new Error(error.message);

  revalidateFormats();
}
