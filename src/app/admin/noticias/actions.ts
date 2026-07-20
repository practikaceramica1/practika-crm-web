"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorToUserMessage } from "@/lib/errorMessage";
import { slugify } from "@/lib/text";
import { deleteObjectFromR2, signR2PutObjectUrl } from "@/lib/uploads/r2";

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

function isExpectedNewsAssetKey(sectionId: string, fileKey: string) {
  if (!fileKey || fileKey.includes("..")) return false;
  return fileKey.startsWith(`site/noticias/${sectionId}/`);
}

async function allocateUniqueNewsSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string,
  excludeSectionId?: string
) {
  const base = slugify(title);
  if (!base || base.length < 2) {
    throw new Error("No se pudo generar un identificador desde el título.");
  }
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    let q = supabase.from("news_sections").select("id").eq("slug", candidate);
    if (excludeSectionId) q = q.neq("id", excludeSectionId);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
  }
  throw new Error("No se pudo generar un identificador único para la sección.");
}

export type NewsSectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  sort_order: number;
};

export type NewsSectionAssetRow = {
  id: string;
  section_id: string;
  asset_type: "image" | "pdf";
  is_favorite: boolean;
  ordinal: number;
  storage_provider: string;
  file_key: string;
  mime_type: string | null;
  title: string | null;
};

export type SignNewsAssetUploadResult =
  | { ok: true; putUrl: string; fileKey: string; contentType: string; ordinal: number; assetType: "image" | "pdf" }
  | { ok: false; message: string };

export async function listNewsSectionsAdmin(): Promise<NewsSectionRow[]> {
  await requireAdminUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_sections")
    .select("id,slug,title,description,status,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data || []) as NewsSectionRow[];
}

export async function getNewsSectionWithAssets(sectionId: string): Promise<{
  section: NewsSectionRow | null;
  assets: NewsSectionAssetRow[];
}> {
  await requireAdminUser();
  const supabase = await createClient();
  const { data: section, error: sErr } = await supabase
    .from("news_sections")
    .select("id,slug,title,description,status,sort_order")
    .eq("id", sectionId)
    .maybeSingle();
  if (sErr) throw Object.assign(new Error(sErr.message), { code: sErr.code });
  if (!section?.id) return { section: null, assets: [] };

  const { data: assets, error: aErr } = await supabase
    .from("news_section_assets")
    .select("id,section_id,asset_type,is_favorite,ordinal,storage_provider,file_key,mime_type,title")
    .eq("section_id", sectionId)
    .order("is_favorite", { ascending: false })
    .order("ordinal", { ascending: true });
  if (aErr) throw Object.assign(new Error(aErr.message), { code: aErr.code });

  return { section: section as NewsSectionRow, assets: (assets || []) as NewsSectionAssetRow[] };
}

export async function createNewsSectionAction(formData: FormData) {
  await requireAdminUser();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2) {
    redirect(`/admin/noticias?error=${encodeURIComponent("Título demasiado corto.")}`);
  }
  const description = String(formData.get("description") || "").trim() || null;

  try {
    const supabase = await createClient();
    const slug = await allocateUniqueNewsSlug(supabase, title);
    const { data: last } = await supabase
      .from("news_sections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = Number(last?.sort_order || 0) + 1;

    const ins = await supabase
      .from("news_sections")
      .insert({
        slug,
        title,
        description,
        status: "draft",
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    revalidatePath("/admin/noticias");
    redirect(`/admin/noticias/${ins.data.id}`);
  } catch (e) {
    // redirect() de Next lanza un error controlado: hay que repropagarlo.
    const digest = e && typeof e === "object" && "digest" in e ? String((e as { digest: unknown }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw e;
    const message = errorToUserMessage(e);
    redirect(
      `/admin/noticias?error=${encodeURIComponent(message || "No se pudo crear la sección.")}`
    );
  }
}

export async function updateNewsSectionMetaAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      sectionId: z.string().uuid(),
      title: z.string().min(2).max(200),
      description: z.string().max(8000).optional(),
      status: z.enum(["draft", "published"]),
    })
    .safeParse({
      sectionId: formData.get("sectionId"),
      title: formData.get("title"),
      description: formData.get("description") ?? "",
      status: formData.get("status"),
    });
  if (!parsed.success) throw new Error("Datos de sección no válidos.");

  const title = parsed.data.title.trim();
  const supabase = await createClient();
  const slug = await allocateUniqueNewsSlug(supabase, title, parsed.data.sectionId);

  const upd = await supabase
    .from("news_sections")
    .update({
      title,
      slug,
      description: parsed.data.description?.trim() || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.sectionId);
  if (upd.error) throw new Error(upd.error.message);
  revalidatePath("/admin/noticias");
  revalidatePath(`/admin/noticias/${parsed.data.sectionId}`);
}

export async function reorderNewsSectionsAction(formData: FormData) {
  await requireAdminUser();
  const orderedIds = JSON.parse(String(formData.get("orderedIdsJson") || "[]")) as string[];
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => z.string().uuid().safeParse(id).success)) {
    throw new Error("Orden de secciones no válido.");
  }
  const supabase = await createClient();
  const { data: rows } = await supabase.from("news_sections").select("id");
  const set = new Set((rows || []).map((r) => r.id));
  if (orderedIds.length !== set.size || !orderedIds.every((id) => set.has(id))) throw new Error("Lista incompleta.");

  for (let i = 0; i < orderedIds.length; i++) {
    const u = await supabase.from("news_sections").update({ sort_order: i + 1 }).eq("id", orderedIds[i]);
    if (u.error) throw new Error(u.error.message);
  }
  revalidatePath("/admin/noticias");
}

export async function deleteNewsSectionAction(formData: FormData) {
  await requireAdminUser();
  const sectionId = z.string().uuid().parse(formData.get("sectionId"));
  const supabase = await createClient();

  const { data: assets } = await supabase.from("news_section_assets").select("file_key").eq("section_id", sectionId);
  for (const a of assets || []) {
    if (a.file_key) await deleteObjectFromR2(String(a.file_key)).catch(() => {});
  }
  const del = await supabase.from("news_sections").delete().eq("id", sectionId);
  if (del.error) throw new Error(del.error.message);
  revalidatePath("/admin/noticias");
}

export async function signNewsAssetR2UploadAction(formData: FormData): Promise<SignNewsAssetUploadResult> {
  await requireAdminUser();
  try {
    const sectionId = z.string().uuid().parse(formData.get("sectionId"));
    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };
    const mimeHint = String(formData.get("mimeHint") || "").trim() || null;
    const ext = inferExtension(originalFileName, mimeHint);

    let assetType: "image" | "pdf";
    if (isPdfUpload(ext, mimeHint)) assetType = "pdf";
    else if (isImageUpload(ext, mimeHint)) assetType = "image";
    else return { ok: false, message: "Solo se admiten imágenes o PDF." };

    const supabase = await createClient();
    const sec = await supabase.from("news_sections").select("id").eq("id", sectionId).maybeSingle();
    if (sec.error) return { ok: false, message: errorToUserMessage(sec.error) };
    if (!sec.data) return { ok: false, message: "Sección no encontrada." };

    const isFavorite = String(formData.get("bucket") || "standard") === "favorite";
    const { data: last } = await supabase
      .from("news_section_assets")
      .select("ordinal")
      .eq("section_id", sectionId)
      .eq("is_favorite", isFavorite)
      .order("ordinal", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ordinal = Number(last?.ordinal || 0) + 1;
    const key = `site/noticias/${sectionId}/${randomUUID()}.${ext}`;
    const contentType =
      assetType === "pdf"
        ? mimeHint && mimeHint.toLowerCase().includes("pdf")
          ? mimeHint
          : "application/pdf"
        : mimeHint && mimeHint.toLowerCase().startsWith("image/")
          ? mimeHint
          : "application/octet-stream";

    const putUrl = await signR2PutObjectUrl(key, contentType);
    return { ok: true, putUrl, fileKey: key, contentType, ordinal, assetType };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function registerNewsAssetAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      sectionId: z.string().uuid(),
      fileKey: z.string().min(12),
      ordinal: z.coerce.number().int().nonnegative(),
      assetType: z.enum(["image", "pdf"]),
      mimeType: z.string().min(3).max(120),
      title: z.string().max(240).optional(),
      isFavorite: z.boolean(),
    })
    .safeParse({
      sectionId: formData.get("sectionId"),
      fileKey: formData.get("fileKey"),
      ordinal: formData.get("ordinal"),
      assetType: formData.get("assetType"),
      mimeType: formData.get("mimeType"),
      title: formData.get("title") || undefined,
      isFavorite: formData.get("isFavorite") === "true" || formData.get("isFavorite") === "1",
    });
  if (!parsed.success) throw new Error("Datos de registro incompletos.");
  if (!isExpectedNewsAssetKey(parsed.data.sectionId, parsed.data.fileKey)) {
    throw new Error("La ruta del archivo no es válida para esta sección.");
  }

  const supabase = await createClient();
  const ins = await supabase
    .from("news_section_assets")
    .insert({
      section_id: parsed.data.sectionId,
      asset_type: parsed.data.assetType,
      is_favorite: parsed.data.isFavorite,
      ordinal: parsed.data.ordinal,
      storage_provider: "r2",
      file_key: parsed.data.fileKey,
      mime_type: parsed.data.mimeType,
      title: parsed.data.title?.trim() || null,
    })
    .select("id,section_id,asset_type,is_favorite,ordinal,storage_provider,file_key,mime_type,title")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  revalidatePath("/admin/noticias");
  revalidatePath(`/admin/noticias/${parsed.data.sectionId}`);
  return ins.data as NewsSectionAssetRow;
}

export async function reorderNewsAssetsInBucketAction(formData: FormData) {
  await requireAdminUser();
  const sectionId = z.string().uuid().parse(formData.get("sectionId"));
  const isFavorite = formData.get("isFavorite") === "true" || formData.get("isFavorite") === "1";
  const orderedIds = JSON.parse(String(formData.get("orderedIdsJson") || "[]")) as string[];
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => z.string().uuid().safeParse(id).success)) {
    throw new Error("Orden no válido.");
  }
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("news_section_assets")
    .select("id")
    .eq("section_id", sectionId)
    .eq("is_favorite", isFavorite);
  const set = new Set((rows || []).map((r) => r.id));
  if (orderedIds.length !== set.size || !orderedIds.every((id) => set.has(id))) {
    throw new Error("Los elementos no coinciden con el bloque.");
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const u = await supabase.from("news_section_assets").update({ ordinal: i + 1 }).eq("id", orderedIds[i]);
    if (u.error) throw new Error(u.error.message);
  }
  revalidatePath(`/admin/noticias/${sectionId}`);
}

export async function toggleNewsAssetFavoriteAction(formData: FormData) {
  await requireAdminUser();
  const assetId = z.string().uuid().parse(formData.get("assetId"));
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("news_section_assets")
    .select("id,section_id,is_favorite")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Archivo no encontrado.");

  const nextFav = !row.is_favorite;
  const { data: last } = await supabase
    .from("news_section_assets")
    .select("ordinal")
    .eq("section_id", row.section_id)
    .eq("is_favorite", nextFav)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordinal = Number(last?.ordinal || 0) + 1;

  const u = await supabase
    .from("news_section_assets")
    .update({ is_favorite: nextFav, ordinal })
    .eq("id", assetId);
  if (u.error) throw new Error(u.error.message);
  revalidatePath(`/admin/noticias/${row.section_id}`);
}

export async function updateNewsAssetTitleAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      assetId: z.string().uuid(),
      title: z.string().max(240),
    })
    .safeParse({
      assetId: formData.get("assetId"),
      title: formData.get("title") ?? "",
    });
  if (!parsed.success) throw new Error("Título no válido.");

  const nextTitle = parsed.data.title.trim() || null;
  const supabase = await createClient();
  const { data: row, error: fErr } = await supabase
    .from("news_section_assets")
    .select("id,section_id,title")
    .eq("id", parsed.data.assetId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!row) throw new Error("Archivo no encontrado.");

  if ((row.title || "").trim() === (nextTitle || "").trim()) {
    return { ok: true as const };
  }

  const u = await supabase.from("news_section_assets").update({ title: nextTitle }).eq("id", parsed.data.assetId);
  if (u.error) throw new Error(u.error.message);
  revalidatePath("/admin/noticias");
  revalidatePath(`/admin/noticias/${row.section_id}`);
  return { ok: true as const };
}

export async function deleteNewsAssetAction(formData: FormData) {
  await requireAdminUser();
  const assetId = z.string().uuid().parse(formData.get("assetId"));
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("news_section_assets")
    .select("id,file_key,section_id")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Archivo no encontrado.");

  const del = await supabase.from("news_section_assets").delete().eq("id", assetId);
  if (del.error) throw new Error(del.error.message);
  if (row.file_key) await deleteObjectFromR2(String(row.file_key)).catch(() => {});
  revalidatePath(`/admin/noticias/${row.section_id}`);
}
