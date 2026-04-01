"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/text";
import { uploadToR2 } from "@/lib/uploads/r2";
import { uploadImageToCloudinary } from "@/lib/uploads/cloudinary";

const createSeriesSchema = z.object({ name: z.string().min(2) });
const deleteSeriesSchema = z.object({ seriesId: z.string().uuid() });
const addFormatSchema = z.object({
  seriesId: z.string().uuid(),
  widthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  materialLabel: z.string().min(2),
});
const addColorSchema = z.object({
  seriesId: z.string().uuid(),
  formatMaterialId: z.string().uuid(),
  name: z.string().min(2),
  variantType: z.enum(["regular", "decor", "relieve", "c3"]).default("regular"),
});
const bulkColorSchema = z.object({
  seriesId: z.string().uuid(),
  formatMaterialId: z.string().uuid(),
  variantType: z.enum(["regular", "decor", "relieve", "c3"]).default("regular"),
  itemsJson: z.string().min(2),
});

export async function createSeriesAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = createSeriesSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Nombre inválido");

  const slug = slugify(parsed.data.name);
  const { data, error } = await supabase
    .from("series")
    .insert({ name: parsed.data.name.trim(), slug, status: "published", featured: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/series");
  redirect(`/admin/series/${data.id}`);
}

export async function deleteSeriesAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteSeriesSchema.safeParse({
    seriesId: formData.get("seriesId"),
  });
  if (!parsed.success) throw new Error("Serie inválida");

  const { error } = await supabase.from("series").delete().eq("id", parsed.data.seriesId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/series");
  redirect("/admin/series");
}

export async function addFormatMaterialAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = addFormatSchema.safeParse({
    seriesId: formData.get("seriesId"),
    widthCm: formData.get("widthCm"),
    heightCm: formData.get("heightCm"),
    materialLabel: formData.get("materialLabel"),
  });
  if (!parsed.success) throw new Error("Datos de formato inválidos");

  const materialLabel = parsed.data.materialLabel.trim();
  const materialSlug = slugify(materialLabel);
  const { data: existing } = await supabase.from("materials").select("id").eq("slug", materialSlug).maybeSingle();
  let materialId = existing?.id;
  if (!materialId) {
    const created = await supabase
      .from("materials")
      .insert({ slug: materialSlug, name: materialLabel, default_technical_properties: {}, is_active: true })
      .select("id")
      .single();
    if (created.error) throw new Error(created.error.message);
    materialId = created.data.id;
  }

  const width = String(parsed.data.widthCm).replace(".", ",");
  const height = String(parsed.data.heightCm).replace(".", ",");
  const formatLabel = `${width}x${height}`;
  const inserted = await supabase
    .from("format_materials")
    .insert({
      series_id: parsed.data.seriesId,
      material_id: materialId,
      format_label: formatLabel,
      width_cm: parsed.data.widthCm,
      height_cm: parsed.data.heightCm,
      status: "published",
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);

  const seriesFilters = await supabase
    .from("series_filter_options")
    .select("filter_option_id")
    .eq("series_id", parsed.data.seriesId);
  if ((seriesFilters.data || []).length > 0) {
    await supabase.from("format_material_filter_options").upsert(
      seriesFilters.data!.map((f) => ({ format_material_id: inserted.data.id, filter_option_id: f.filter_option_id })),
      { onConflict: "format_material_id,filter_option_id" }
    );
  }
  revalidatePath(`/admin/series/${parsed.data.seriesId}`);
}

export async function addColorAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = addColorSchema.safeParse({
    seriesId: formData.get("seriesId"),
    formatMaterialId: formData.get("formatMaterialId"),
    name: formData.get("name"),
    variantType: formData.get("variantType"),
  });
  if (!parsed.success) throw new Error("Color inválido");
  const slug = slugify(parsed.data.name);

  const inserted = await supabase
    .from("article_colors")
    .insert({
      format_material_id: parsed.data.formatMaterialId,
      color_name: parsed.data.name.trim(),
      color_slug: slug,
      variant_type: parsed.data.variantType,
      status: "published",
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);

  const inherited = await supabase
    .from("format_material_filter_options")
    .select("filter_option_id")
    .eq("format_material_id", parsed.data.formatMaterialId);
  if ((inherited.data || []).length > 0) {
    await supabase.from("article_color_filter_options").upsert(
      inherited.data!.map((f) => ({ article_color_id: inserted.data.id, filter_option_id: f.filter_option_id })),
      { onConflict: "article_color_id,filter_option_id" }
    );
  }

  revalidatePath(`/admin/series/${parsed.data.seriesId}`);
}

export async function addColorsBulkAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = bulkColorSchema.safeParse({
    seriesId: formData.get("seriesId"),
    formatMaterialId: formData.get("formatMaterialId"),
    variantType: formData.get("variantType"),
    itemsJson: formData.get("itemsJson"),
  });
  if (!parsed.success) throw new Error("Carga masiva inválida");

  let items: Array<{ name: string; sourceFile?: string }> = [];
  try {
    items = JSON.parse(parsed.data.itemsJson);
  } catch {
    throw new Error("No se pudieron leer los archivos cargados");
  }
  const clean = items
    .map((i) => ({ name: (i.name || "").trim(), slug: slugify(i.name || ""), sku: i.sourceFile?.trim() || null }))
    .filter((i) => i.name.length >= 2 && i.slug.length >= 2);
  if (!clean.length) throw new Error("No hay colores válidos");

  const inserted = await supabase.from("article_colors").upsert(
    clean.map((c) => ({
      format_material_id: parsed.data.formatMaterialId,
      color_name: c.name,
      color_slug: c.slug,
      variant_type: parsed.data.variantType,
      sku: c.sku,
      status: "published",
    })),
    { onConflict: "format_material_id,color_slug,variant_type" }
  );
  if (inserted.error) throw new Error(inserted.error.message);

  revalidatePath(`/admin/series/${parsed.data.seriesId}`);
}

export async function setSeriesFiltersAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const seriesId = z.string().uuid().parse(formData.get("seriesId"));
  const optionIds = JSON.parse(String(formData.get("optionIdsJson") || "[]")) as string[];
  await supabase.from("series_filter_options").delete().eq("series_id", seriesId);
  if (optionIds.length) {
    await supabase.from("series_filter_options").insert(optionIds.map((id) => ({ series_id: seriesId, filter_option_id: id })));
  }
  revalidatePath(`/admin/series/${seriesId}`);
}

export async function setFormatFiltersAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const formatMaterialId = z.string().uuid().parse(formData.get("formatMaterialId"));
  const optionIds = JSON.parse(String(formData.get("optionIdsJson") || "[]")) as string[];
  await supabase.from("format_material_filter_options").delete().eq("format_material_id", formatMaterialId);
  if (optionIds.length) {
    await supabase
      .from("format_material_filter_options")
      .insert(optionIds.map((id) => ({ format_material_id: formatMaterialId, filter_option_id: id })));
  }
  const fm = await supabase.from("format_materials").select("series_id").eq("id", formatMaterialId).single();
  if (fm.data?.series_id) revalidatePath(`/admin/series/${fm.data.series_id}`);
}

export async function setColorFiltersAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const articleColorId = z.string().uuid().parse(formData.get("articleColorId"));
  const optionIds = JSON.parse(String(formData.get("optionIdsJson") || "[]")) as string[];
  await supabase.from("article_color_filter_options").delete().eq("article_color_id", articleColorId);
  if (optionIds.length) {
    await supabase
      .from("article_color_filter_options")
      .insert(optionIds.map((id) => ({ article_color_id: articleColorId, filter_option_id: id })));
  }
}

export async function uploadSeriesDocumentsAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const seriesId = z.string().uuid().parse(formData.get("seriesId"));
  const assetType = z.enum(["technical_panel", "catalog_pdf", "ambient_image"]).parse(formData.get("assetType"));
  const languageCode = String(formData.get("languageCode") || "es");
  const files = formData.getAll("files").filter((x): x is File => x instanceof File);
  if (!files.length) throw new Error("Sin archivos");

  const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
  if (!series.data?.slug) throw new Error("Serie no encontrada");

  const rows: Array<Record<string, unknown>> = [];
  const prefix = Date.now();
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
    if (assetType === "ambient_image") {
      const result = await uploadImageToCloudinary(buffer, `practika/series/${series.data.slug}/ambientes`, `${prefix}-${i}-${safe.replace(/\.[^/.]+$/, "")}`);
      rows.push({
        series_id: seriesId,
        asset_type: assetType,
        storage_provider: "cloudinary",
        file_key: result.publicId,
        mime_type: file.type || null,
        language_code: languageCode,
        title: file.name,
        sort_order: i,
      });
    } else {
      const folder = assetType === "technical_panel" ? "paneles-tecnicos" : "catalogos";
      const key = `series/${series.data.slug}/${folder}/${prefix}-${i}-${safe}`;
      await uploadToR2(key, buffer, file.type || "application/octet-stream");
      rows.push({
        series_id: seriesId,
        asset_type: assetType,
        storage_provider: "r2",
        file_key: key,
        mime_type: file.type || null,
        language_code: languageCode,
        title: file.name,
        sort_order: i,
      });
    }
  }
  const inserted = await supabase.from("series_assets").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);
  revalidatePath(`/admin/series/${seriesId}`);
}
