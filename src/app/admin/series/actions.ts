"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorToUserMessage } from "@/lib/errorMessage";
import { slugify } from "@/lib/text";
import { prepareAmbientImageForUpload } from "@/lib/uploads/prepareAmbientImage";
import { copyObjectInR2, deleteObjectFromR2, signR2PutObjectUrl, uploadToR2 } from "@/lib/uploads/r2";
import {
  deleteCloudinaryImage,
  renameCloudinaryImage,
  signAmbientImageUpload,
  uploadImageToCloudinary,
} from "@/lib/uploads/cloudinary";

const createSeriesSchema = z.object({ name: z.string().min(2) });
const toggleSeriesNewSchema = z.object({
  seriesId: z.string().uuid(),
  isNew: z.coerce.boolean(),
});
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
const renameAssetSchema = z.object({
  assetId: z.string().uuid(),
  newName: z.string().min(1),
});
const deleteAssetSchema = z.object({
  assetId: z.string().uuid(),
});

type DocAssetType = "technical_panel" | "catalog_pdf" | "ambient_image";

export type UploadedSeriesAssetRow = {
  id: string;
  asset_type: DocAssetType;
  title: string | null;
  file_key: string;
  storage_provider: string;
  sort_order?: number | null;
};

/** Resultado serializable: en producción Next.js oculta el mensaje si la acción hace `throw`. */
export type UploadSeriesDocumentsResult =
  | { ok: true; assets: UploadedSeriesAssetRow[] }
  | { ok: false; message: string };

/** Firma para subir el ambiente desde el cliente a Cloudinary (evita el límite de body en Vercel). */
export type SignAmbientUploadResult =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
      publicId: string;
      assetTitle: string;
      sortOrder: number;
      languageCode: string;
    }
  | { ok: false; message: string };

/** Firma PUT a R2 para PDFs de panel/catálogo (evita límite de body en Server Actions y topes de Cloudinary en raw). */
export type SignR2PdfUploadResult =
  | {
      ok: true;
      putUrl: string;
      fileKey: string;
      assetTitle: string;
      sortOrder: number;
      languageCode: string;
      assetType: "technical_panel" | "catalog_pdf";
      contentType: string;
    }
  | { ok: false; message: string };

/** En Node, entradas de FormData a veces no pasan `instanceof File`; aceptamos cualquier Blob con arrayBuffer. */
function getFilePartsFromFormData(formData: FormData): File[] {
  const items = formData.getAll("files");
  return items.filter((x): x is File => {
    if (x == null || typeof x === "string") return false;
    const b = x as Blob;
    return typeof b.arrayBuffer === "function" && typeof b.size === "number";
  }) as File[];
}

function getAssetSection(assetType: DocAssetType) {
  if (assetType === "technical_panel") return "panel-tecnico";
  if (assetType === "catalog_pdf") return "catalogo";
  return "ambiente";
}

function getAssetFolder(assetType: DocAssetType) {
  if (assetType === "technical_panel") return "paneles-tecnicos";
  if (assetType === "catalog_pdf") return "catalogos";
  return "ambientes";
}

function inferExtension(fileName: string, mimeType?: string | null) {
  const cleanName = fileName.trim().toLowerCase();
  const fromName = cleanName.includes(".") ? cleanName.split(".").pop() || "" : "";
  if (fromName) return fromName;
  if (!mimeType) return "bin";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("avif")) return "avif";
  if (mimeType.includes("heic") || mimeType.includes("heif")) return "heic";
  if (mimeType.includes("bmp")) return "bmp";
  if (mimeType.includes("tif")) return "tif";
  return "bin";
}

const IMAGE_FILE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "tif",
  "tiff",
  "bmp",
  "svg",
  "avif",
  "heic",
  "heif",
]);

function isPdfUpload(ext: string, mime: string | null) {
  const e = ext.toLowerCase();
  if (e === "pdf") return true;
  return (mime || "").toLowerCase().includes("pdf");
}

function isImageUpload(ext: string, mime: string | null) {
  if ((mime || "").toLowerCase().startsWith("image/")) return true;
  return IMAGE_FILE_EXTENSIONS.has(ext.toLowerCase());
}

function isExpectedR2SeriesPdfKey(seriesSlug: string, assetType: "technical_panel" | "catalog_pdf", fileKey: string) {
  if (!fileKey || fileKey.includes("..")) return false;
  const prefix = `series/${seriesSlug}/`;
  if (!fileKey.startsWith(prefix)) return false;
  const seg = assetType === "technical_panel" ? "paneles-tecnicos" : "catalogos";
  return fileKey.startsWith(`${prefix}${seg}/`);
}

function buildPatternFileName(seriesSlug: string, assetType: DocAssetType, order: number, ext: string) {
  const section = getAssetSection(assetType);
  const index = String(order).padStart(2, "0");
  return `${seriesSlug}-${section}-${index}.${ext}`;
}

export async function createSeriesAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = createSeriesSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Nombre inválido");

  const slug = slugify(parsed.data.name);
  const { data, error } = await supabase
    .from("series")
    .insert({ name: parsed.data.name.trim(), slug, status: "published", featured: false, is_new: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/series");
  redirect(`/admin/series/${data.id}`);
}

export async function toggleSeriesNewAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = toggleSeriesNewSchema.safeParse({
    seriesId: formData.get("seriesId"),
    isNew: formData.get("isNew") === "true",
  });
  if (!parsed.success) throw new Error("Datos inválidos");

  const { error } = await supabase
    .from("series")
    .update({ is_new: parsed.data.isNew })
    .eq("id", parsed.data.seriesId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/series");
  revalidatePath(`/admin/series/${parsed.data.seriesId}`);
}

export async function deleteSeriesAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteSeriesSchema.safeParse({
    seriesId: formData.get("seriesId"),
  });
  if (!parsed.success) throw new Error("Serie inválida");

  const seriesId = parsed.data.seriesId;

  const assetsResult = await supabase
    .from("series_assets")
    .select("id,storage_provider,file_key")
    .eq("series_id", seriesId);
  if (assetsResult.error) throw new Error(assetsResult.error.message);

  for (const asset of assetsResult.data || []) {
    if (asset.storage_provider === "r2") {
      await deleteObjectFromR2(asset.file_key);
    } else {
      await deleteCloudinaryImage(asset.file_key);
    }
  }

  const formatsResult = await supabase.from("format_materials").select("id").eq("series_id", seriesId);
  if (formatsResult.error) throw new Error(formatsResult.error.message);
  const formatIds = (formatsResult.data || []).map((f) => f.id);

  if (formatIds.length > 0) {
    const colorsResult = await supabase
      .from("article_colors")
      .select("id")
      .in("format_material_id", formatIds);
    if (colorsResult.error) throw new Error(colorsResult.error.message);
    const colorIds = (colorsResult.data || []).map((c) => c.id);

    if (colorIds.length > 0) {
      const colorFiltersDelete = await supabase
        .from("article_color_filter_options")
        .delete()
        .in("article_color_id", colorIds);
      if (colorFiltersDelete.error) throw new Error(colorFiltersDelete.error.message);
    }

    const formatFiltersDelete = await supabase
      .from("format_material_filter_options")
      .delete()
      .in("format_material_id", formatIds);
    if (formatFiltersDelete.error) throw new Error(formatFiltersDelete.error.message);

    const colorsDelete = await supabase
      .from("article_colors")
      .delete()
      .in("format_material_id", formatIds);
    if (colorsDelete.error) throw new Error(colorsDelete.error.message);
  }

  const seriesFiltersDelete = await supabase.from("series_filter_options").delete().eq("series_id", seriesId);
  if (seriesFiltersDelete.error) throw new Error(seriesFiltersDelete.error.message);

  const assetsDelete = await supabase.from("series_assets").delete().eq("series_id", seriesId);
  if (assetsDelete.error) throw new Error(assetsDelete.error.message);

  const formatsDelete = await supabase.from("format_materials").delete().eq("series_id", seriesId);
  if (formatsDelete.error) throw new Error(formatsDelete.error.message);

  const { error } = await supabase.from("series").delete().eq("id", seriesId);
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
  revalidatePath("/admin/formats");
}

const updateFormatSchema = z.object({
  seriesId: z.string().uuid(),
  formatMaterialId: z.string().uuid(),
  widthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  materialLabel: z.string().min(2),
});

const deleteFormatSchema = z.object({
  seriesId: z.string().uuid(),
  formatMaterialId: z.string().uuid(),
});

const deleteArticleColorSchema = z.object({
  seriesId: z.string().uuid(),
  articleColorId: z.string().uuid(),
});

export async function updateFormatMaterialAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = updateFormatSchema.safeParse({
    seriesId: formData.get("seriesId"),
    formatMaterialId: formData.get("formatMaterialId"),
    widthCm: formData.get("widthCm"),
    heightCm: formData.get("heightCm"),
    materialLabel: formData.get("materialLabel"),
  });
  if (!parsed.success) throw new Error("Datos de formato inválidos");

  const { seriesId, formatMaterialId } = parsed.data;
  const { data: existing, error: existErr } = await supabase
    .from("format_materials")
    .select("id")
    .eq("id", formatMaterialId)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (existErr) throw new Error(existErr.message);
  if (!existing) throw new Error("Formato no encontrado o no pertenece a esta serie");

  const materialLabel = parsed.data.materialLabel.trim();
  const materialSlug = slugify(materialLabel);
  const { data: matExisting } = await supabase.from("materials").select("id").eq("slug", materialSlug).maybeSingle();
  let materialId = matExisting?.id;
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

  const { error: updErr } = await supabase
    .from("format_materials")
    .update({
      material_id: materialId,
      format_label: formatLabel,
      width_cm: parsed.data.widthCm,
      height_cm: parsed.data.heightCm,
    })
    .eq("id", formatMaterialId)
    .eq("series_id", seriesId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath(`/admin/series/${seriesId}`);
  revalidatePath("/admin/formats");
}

export async function deleteFormatMaterialAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteFormatSchema.safeParse({
    seriesId: formData.get("seriesId"),
    formatMaterialId: formData.get("formatMaterialId"),
  });
  if (!parsed.success) throw new Error("Formato inválido");

  const { seriesId, formatMaterialId } = parsed.data;

  const { data: fm, error: fmErr } = await supabase
    .from("format_materials")
    .select("id")
    .eq("id", formatMaterialId)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (fmErr) throw new Error(fmErr.message);
  if (!fm) throw new Error("Formato no encontrado o no pertenece a esta serie");

  const colorsResult = await supabase.from("article_colors").select("id").eq("format_material_id", formatMaterialId);
  if (colorsResult.error) throw new Error(colorsResult.error.message);
  const colorIds = (colorsResult.data || []).map((c) => c.id);

  if (colorIds.length > 0) {
    const colorFiltersDelete = await supabase
      .from("article_color_filter_options")
      .delete()
      .in("article_color_id", colorIds);
    if (colorFiltersDelete.error) throw new Error(colorFiltersDelete.error.message);
  }

  const formatFiltersDelete = await supabase
    .from("format_material_filter_options")
    .delete()
    .eq("format_material_id", formatMaterialId);
  if (formatFiltersDelete.error) throw new Error(formatFiltersDelete.error.message);

  const colorsDelete = await supabase.from("article_colors").delete().eq("format_material_id", formatMaterialId);
  if (colorsDelete.error) throw new Error(colorsDelete.error.message);

  const delFmt = await supabase.from("format_materials").delete().eq("id", formatMaterialId).eq("series_id", seriesId);
  if (delFmt.error) throw new Error(delFmt.error.message);

  revalidatePath(`/admin/series/${seriesId}`);
  revalidatePath("/admin/formats");
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

export async function deleteArticleColorAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteArticleColorSchema.safeParse({
    seriesId: formData.get("seriesId"),
    articleColorId: formData.get("articleColorId"),
  });
  if (!parsed.success) throw new Error("Solicitud de borrado inválida");

  const { seriesId, articleColorId } = parsed.data;

  const { data: color, error: colorErr } = await supabase
    .from("article_colors")
    .select("id, format_material_id")
    .eq("id", articleColorId)
    .maybeSingle();
  if (colorErr) throw new Error(colorErr.message);
  if (!color) throw new Error("Color no encontrado");

  const { data: fm, error: fmErr } = await supabase
    .from("format_materials")
    .select("id")
    .eq("id", color.format_material_id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (fmErr) throw new Error(fmErr.message);
  if (!fm) throw new Error("Este color no pertenece a la serie indicada");

  const del = await supabase.from("article_colors").delete().eq("id", articleColorId);
  if (del.error) throw new Error(del.error.message);

  revalidatePath(`/admin/series/${seriesId}`);
  revalidatePath("/admin/formats");
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

export async function signSeriesAmbientUploadAction(formData: FormData): Promise<SignAmbientUploadResult> {
  await requireAdminUser();
  try {
    const seriesIdParsed = z.string().uuid().safeParse(formData.get("seriesId"));
    if (!seriesIdParsed.success) return { ok: false, message: "Serie no válida." };
    const seriesId = seriesIdParsed.data;

    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };

    const mimeHint = String(formData.get("mimeHint") || "").trim() || null;
    const languageCode = String(formData.get("languageCode") || "na").trim() || "na";

    const supabase = await createClient();
    const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
    if (!series.data?.slug) return { ok: false, message: "Serie no encontrada." };

    const currentOrder = await supabase
      .from("series_assets")
      .select("sort_order")
      .eq("series_id", seriesId)
      .eq("asset_type", "ambient_image")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentOrder.error) return { ok: false, message: errorToUserMessage(currentOrder.error) };

    const lastOrder = Number(currentOrder.data?.sort_order || 0);
    const sortOrder = lastOrder + 1;
    const ext = inferExtension(originalFileName, mimeHint);
    const normalizedFileName = buildPatternFileName(series.data.slug, "ambient_image", sortOrder, ext);
    const publicBase = normalizedFileName.replace(/\.[^/.]+$/, "");
    const folder = `practika/series/${series.data.slug}/${getAssetFolder("ambient_image")}`;
    const signed = signAmbientImageUpload(folder, publicBase);

    return {
      ok: true,
      cloudName: signed.cloudName,
      apiKey: signed.apiKey,
      timestamp: signed.timestamp,
      signature: signed.signature,
      folder: signed.folder,
      publicId: signed.publicId,
      assetTitle: normalizedFileName,
      sortOrder,
      languageCode,
    };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function registerSeriesAmbientAssetAction(formData: FormData): Promise<UploadSeriesDocumentsResult> {
  await requireAdminUser();
  try {
    const seriesIdParsed = z.string().uuid().safeParse(formData.get("seriesId"));
    if (!seriesIdParsed.success) return { ok: false, message: "Serie no válida." };
    const seriesId = seriesIdParsed.data;

    const publicIdRaw = String(formData.get("publicId") || "").trim();
    const assetTitle = String(formData.get("assetTitle") || "").trim();
    const sortOrderParsed = z.coerce.number().int().positive().safeParse(formData.get("sortOrder"));
    if (!sortOrderParsed.success) return { ok: false, message: "Orden de archivo no válido." };

    const languageCode = String(formData.get("languageCode") || "na").trim() || "na";
    const mimeType = String(formData.get("mimeType") || "image/jpeg").trim() || "image/jpeg";

    if (publicIdRaw.length < 8 || assetTitle.length < 4) {
      return { ok: false, message: "Datos de registro incompletos." };
    }

    const supabase = await createClient();
    const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
    if (!series.data?.slug) return { ok: false, message: "Serie no encontrada." };

    const prefix = `practika/series/${series.data.slug}/${getAssetFolder("ambient_image")}/`;
    let fileKey = publicIdRaw;
    if (!fileKey.startsWith(prefix)) {
      if (fileKey.includes("..") || fileKey.includes("/")) {
        return { ok: false, message: "Identificador de recurso no válido." };
      }
      fileKey = `${prefix}${fileKey}`;
    }

    if (!assetTitle.startsWith(`${series.data.slug}-`)) {
      return { ok: false, message: "El título del archivo no coincide con la serie." };
    }

    const inserted = await supabase
      .from("series_assets")
      .insert({
        series_id: seriesId,
        asset_type: "ambient_image",
        storage_provider: "cloudinary",
        file_key: fileKey,
        mime_type: mimeType,
        language_code: languageCode,
        title: assetTitle,
        sort_order: sortOrderParsed.data,
      })
      .select("id,asset_type,title,file_key,storage_provider,sort_order")
      .single();

    if (inserted.error) return { ok: false, message: errorToUserMessage(inserted.error) };

    revalidatePath(`/admin/series/${seriesId}`);
    revalidatePath("/admin/formats");

    return { ok: true, assets: (inserted.data ? [inserted.data] : []) as UploadedSeriesAssetRow[] };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function signSeriesR2PdfUploadAction(formData: FormData): Promise<SignR2PdfUploadResult> {
  await requireAdminUser();
  try {
    const seriesIdParsed = z.string().uuid().safeParse(formData.get("seriesId"));
    if (!seriesIdParsed.success) return { ok: false, message: "Serie no válida." };
    const seriesId = seriesIdParsed.data;

    const assetTypeParsed = z.enum(["technical_panel", "catalog_pdf"]).safeParse(formData.get("assetType"));
    if (!assetTypeParsed.success) return { ok: false, message: "Tipo de documento no válido para subida directa." };
    const assetType = assetTypeParsed.data;

    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };

    const mimeHint = String(formData.get("mimeHint") || "").trim() || null;
    const languageCode = String(formData.get("languageCode") || "es-en").trim() || "es-en";

    const ext = inferExtension(originalFileName, mimeHint);
    if (!isPdfUpload(ext, mimeHint)) {
      return { ok: false, message: "La subida firmada a R2 solo aplica a archivos PDF." };
    }

    const supabase = await createClient();
    const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
    if (!series.data?.slug) return { ok: false, message: "Serie no encontrada." };

    const currentOrder = await supabase
      .from("series_assets")
      .select("sort_order")
      .eq("series_id", seriesId)
      .eq("asset_type", assetType)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentOrder.error) return { ok: false, message: errorToUserMessage(currentOrder.error) };

    const lastOrder = Number(currentOrder.data?.sort_order || 0);
    const sortOrder = lastOrder + 1;
    const normalizedFileName = buildPatternFileName(series.data.slug, assetType, sortOrder, "pdf");
    const key = `series/${series.data.slug}/${getAssetFolder(assetType)}/${normalizedFileName}`;
    const contentType = mimeHint && mimeHint.toLowerCase().includes("pdf") ? mimeHint : "application/pdf";

    const putUrl = await signR2PutObjectUrl(key, contentType);

    return {
      ok: true,
      putUrl,
      fileKey: key,
      assetTitle: normalizedFileName,
      sortOrder,
      languageCode,
      assetType,
      contentType,
    };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function registerSeriesR2PdfAssetAction(formData: FormData): Promise<UploadSeriesDocumentsResult> {
  await requireAdminUser();
  try {
    const seriesIdParsed = z.string().uuid().safeParse(formData.get("seriesId"));
    if (!seriesIdParsed.success) return { ok: false, message: "Serie no válida." };
    const seriesId = seriesIdParsed.data;

    const assetTypeParsed = z.enum(["technical_panel", "catalog_pdf"]).safeParse(formData.get("assetType"));
    if (!assetTypeParsed.success) return { ok: false, message: "Tipo de documento no válido." };
    const assetType = assetTypeParsed.data;

    const fileKey = String(formData.get("fileKey") || "").trim();
    const assetTitle = String(formData.get("assetTitle") || "").trim();
    const sortOrderParsed = z.coerce.number().int().positive().safeParse(formData.get("sortOrder"));
    if (!sortOrderParsed.success) return { ok: false, message: "Orden de archivo no válido." };

    const languageCode = String(formData.get("languageCode") || "es-en").trim() || "es-en";
    const mimeType = String(formData.get("mimeType") || "application/pdf").trim() || "application/pdf";

    if (fileKey.length < 12 || assetTitle.length < 4) {
      return { ok: false, message: "Datos de registro incompletos." };
    }

    const supabase = await createClient();
    const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
    if (!series.data?.slug) return { ok: false, message: "Serie no encontrada." };

    if (!isExpectedR2SeriesPdfKey(series.data.slug, assetType, fileKey)) {
      return { ok: false, message: "La ruta del archivo no es válida para esta serie." };
    }

    if (!assetTitle.startsWith(`${series.data.slug}-`)) {
      return { ok: false, message: "El título del archivo no coincide con la serie." };
    }

    const inserted = await supabase
      .from("series_assets")
      .insert({
        series_id: seriesId,
        asset_type: assetType,
        storage_provider: "r2",
        file_key: fileKey,
        mime_type: mimeType,
        language_code: languageCode,
        title: assetTitle,
        sort_order: sortOrderParsed.data,
      })
      .select("id,asset_type,title,file_key,storage_provider,sort_order")
      .single();

    if (inserted.error) return { ok: false, message: errorToUserMessage(inserted.error) };

    revalidatePath(`/admin/series/${seriesId}`);

    return { ok: true, assets: (inserted.data ? [inserted.data] : []) as UploadedSeriesAssetRow[] };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function uploadSeriesDocumentsAction(formData: FormData): Promise<UploadSeriesDocumentsResult> {
  await requireAdminUser();
  try {
    const supabase = await createClient();
    const seriesIdParsed = z.string().uuid().safeParse(formData.get("seriesId"));
    if (!seriesIdParsed.success) {
      return { ok: false, message: "Identificador de serie no válido." };
    }
    const seriesId = seriesIdParsed.data;

    const assetTypeParsed = z.enum(["technical_panel", "catalog_pdf", "ambient_image"]).safeParse(formData.get("assetType"));
    if (!assetTypeParsed.success) {
      return { ok: false, message: "Tipo de documento no válido." };
    }
    const assetType = assetTypeParsed.data as DocAssetType;

    const languageCode = String(formData.get("languageCode") || "es");
    const files = getFilePartsFromFormData(formData);
    if (!files.length) {
      return { ok: false, message: "No se han recibido archivos. Si el archivo es muy grande, prueba a reducirlo o sube uno cada vez." };
    }

    const series = await supabase.from("series").select("slug").eq("id", seriesId).single();
    if (!series.data?.slug) {
      return { ok: false, message: "Serie no encontrada." };
    }

    const currentOrder = await supabase
      .from("series_assets")
      .select("sort_order")
      .eq("series_id", seriesId)
      .eq("asset_type", assetType)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentOrder.error) {
      return { ok: false, message: errorToUserMessage(currentOrder.error) };
    }
    const lastOrder = Number(currentOrder.data?.sort_order || 0);

    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (file.size === 0) {
        return {
          ok: false,
          message: `El archivo "${file.name || "sin nombre"}" está vacío o no se ha leído correctamente.`,
        };
      }
      let buffer = Buffer.from(await file.arrayBuffer());
      const sortOrder = lastOrder + i + 1;
      const mime = file.type || null;
      const initialExt = inferExtension(file.name, mime);
      const uploadAsPdf = isPdfUpload(initialExt, mime);
      const uploadAsImage = isImageUpload(initialExt, mime);

      if (!uploadAsPdf && !uploadAsImage) {
        return {
          ok: false,
          message: `Tipo no admitido en "${file.name || "archivo"}". Solo se permiten PDF e imágenes (JPEG, PNG, WebP, TIFF, etc.).`,
        };
      }

      let ext = initialExt;
      let mimeForRow: string | null = mime;

      if (uploadAsImage) {
        const prepared = await prepareAmbientImageForUpload(buffer, ext, mime);
        buffer = Buffer.from(prepared.buffer);
        ext = prepared.extension;
        mimeForRow = prepared.mimeType;
      } else {
        ext = "pdf";
        mimeForRow = mime || "application/pdf";
      }

      const normalizedFileName = buildPatternFileName(series.data.slug, assetType, sortOrder, ext);

      if (uploadAsImage) {
        const publicBase = normalizedFileName.replace(/\.[^/.]+$/, "");
        const result = await uploadImageToCloudinary(
          buffer,
          `practika/series/${series.data.slug}/${getAssetFolder(assetType)}`,
          publicBase
        );
        rows.push({
          series_id: seriesId,
          asset_type: assetType,
          storage_provider: "cloudinary",
          file_key: result.publicId,
          mime_type: mimeForRow,
          language_code: languageCode,
          title: normalizedFileName,
          sort_order: sortOrder,
        });
      } else {
        const key = `series/${series.data.slug}/${getAssetFolder(assetType)}/${normalizedFileName}`;
        await uploadToR2(key, buffer, mimeForRow || "application/pdf");
        rows.push({
          series_id: seriesId,
          asset_type: assetType,
          storage_provider: "r2",
          file_key: key,
          mime_type: mimeForRow,
          language_code: languageCode,
          title: normalizedFileName,
          sort_order: sortOrder,
        });
      }
    }
    const inserted = await supabase
      .from("series_assets")
      .insert(rows)
      .select("id,asset_type,title,file_key,storage_provider,sort_order");
    if (inserted.error) {
      return { ok: false, message: errorToUserMessage(inserted.error) };
    }
    revalidatePath(`/admin/series/${seriesId}`);

    return { ok: true, assets: (inserted.data || []) as UploadedSeriesAssetRow[] };
  } catch (e) {
    const raw = errorToUserMessage(e);
    const hint =
      raw.toLowerCase().includes("memory") || raw.toLowerCase().includes("allocation")
        ? " El archivo podría ser demasiado pesado para procesarlo en memoria."
        : "";
    return {
      ok: false,
      message: raw ? `${raw}${hint}` : `No se pudo completar la subida.${hint}`,
    };
  }
}

export async function renameSeriesAssetAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = renameAssetSchema.safeParse({
    assetId: formData.get("assetId"),
    newName: formData.get("newName"),
  });
  if (!parsed.success) throw new Error("Datos inválidos para renombrar");

  const assetResult = await supabase
    .from("series_assets")
    .select("id,series_id,asset_type,storage_provider,file_key,title,mime_type,sort_order")
    .eq("id", parsed.data.assetId)
    .single();
  if (assetResult.error || !assetResult.data) throw new Error("Archivo no encontrado");

  const raw = parsed.data.newName.trim();
  const ext = inferExtension(raw, assetResult.data.mime_type);
  const base = slugify(raw.replace(/\.[^/.]+$/, ""));
  if (!base) throw new Error("Nombre inválido");
  const normalizedTitle = `${base}.${ext}`;

  if (assetResult.data.storage_provider === "r2") {
    const oldKey = assetResult.data.file_key;
    const dir = oldKey.includes("/") ? oldKey.slice(0, oldKey.lastIndexOf("/")) : "";
    const newKey = dir ? `${dir}/${normalizedTitle}` : normalizedTitle;
    if (newKey !== oldKey) {
      await copyObjectInR2(oldKey, newKey);
      await deleteObjectFromR2(oldKey);
    }
    const updated = await supabase
      .from("series_assets")
      .update({ title: normalizedTitle, file_key: newKey })
      .eq("id", assetResult.data.id)
      .select("id,asset_type,title,file_key,storage_provider,sort_order")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    revalidatePath(`/admin/series/${assetResult.data.series_id}`);
    return { asset: updated.data };
  }

  const oldPublicId = assetResult.data.file_key;
  const dir = oldPublicId.includes("/") ? oldPublicId.slice(0, oldPublicId.lastIndexOf("/")) : "";
  const newPublicId = dir ? `${dir}/${base}` : base;
  if (newPublicId !== oldPublicId) {
    await renameCloudinaryImage(oldPublicId, newPublicId);
  }
  const updated = await supabase
    .from("series_assets")
    .update({ title: normalizedTitle, file_key: newPublicId })
    .eq("id", assetResult.data.id)
    .select("id,asset_type,title,file_key,storage_provider,sort_order")
    .single();
  if (updated.error) throw new Error(updated.error.message);
  revalidatePath(`/admin/series/${assetResult.data.series_id}`);
  return { asset: updated.data };
}

export async function deleteSeriesAssetAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteAssetSchema.safeParse({
    assetId: formData.get("assetId"),
  });
  if (!parsed.success) throw new Error("Archivo inválido");

  const assetResult = await supabase
    .from("series_assets")
    .select("id,series_id,storage_provider,file_key")
    .eq("id", parsed.data.assetId)
    .single();
  if (assetResult.error || !assetResult.data) throw new Error("Archivo no encontrado");

  if (assetResult.data.storage_provider === "r2") {
    await deleteObjectFromR2(assetResult.data.file_key);
  } else {
    await deleteCloudinaryImage(assetResult.data.file_key);
  }

  const deleted = await supabase.from("series_assets").delete().eq("id", parsed.data.assetId);
  if (deleted.error) throw new Error(deleted.error.message);
  revalidatePath(`/admin/series/${assetResult.data.series_id}`);
  return { assetId: parsed.data.assetId };
}
