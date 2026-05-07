"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorToUserMessage } from "@/lib/errorMessage";
import { deleteObjectFromR2, signR2PutObjectUrl } from "@/lib/uploads/r2";

const PRINCIPAL_SLUG = "principal";

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

function isExpectedOfferR2Key(offerId: string, fileKey: string) {
  if (!fileKey || fileKey.includes("..")) return false;
  const prefix = `site/ofertas/${offerId}/`;
  return fileKey.startsWith(prefix);
}

export type OfferRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
};

export type OfferAssetRow = {
  id: string;
  offer_id: string;
  asset_type: "image" | "pdf";
  storage_provider: string;
  file_key: string;
  mime_type: string | null;
  title: string | null;
  sort_order: number;
};

export type SignOfferR2UploadResult =
  | { ok: true; putUrl: string; fileKey: string; contentType: string; sortOrder: number; assetType: "image" | "pdf" }
  | { ok: false; message: string };

export async function getPrincipalOfferWithAssets(): Promise<{
  offer: OfferRow | null;
  assets: OfferAssetRow[];
}> {
  await requireAdminUser();
  const supabase = await createClient();
  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select("id,slug,title,status")
    .eq("slug", PRINCIPAL_SLUG)
    .maybeSingle();
  if (offerErr) {
    throw Object.assign(new Error(offerErr.message), { code: offerErr.code });
  }
  if (!offer?.id) return { offer: null, assets: [] };

  const { data: assets, error: assetsErr } = await supabase
    .from("offer_assets")
    .select("id,offer_id,asset_type,storage_provider,file_key,mime_type,title,sort_order")
    .eq("offer_id", offer.id)
    .order("sort_order", { ascending: true });
  if (assetsErr) {
    throw Object.assign(new Error(assetsErr.message), { code: assetsErr.code });
  }

  return {
    offer: offer as OfferRow,
    assets: (assets || []) as OfferAssetRow[],
  };
}

export async function updateOfferAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      offerId: z.string().uuid(),
      title: z.string().min(1).max(200),
      status: z.enum(["draft", "published"]),
    })
    .safeParse({
      offerId: formData.get("offerId"),
      title: formData.get("title"),
      status: formData.get("status"),
    });
  if (!parsed.success) throw new Error("Datos de oferta no válidos");

  const supabase = await createClient();
  const upd = await supabase
    .from("offers")
    .update({ title: parsed.data.title.trim(), status: parsed.data.status })
    .eq("id", parsed.data.offerId);
  if (upd.error) throw new Error(upd.error.message);
  revalidatePath("/admin/ofertas");
}

export async function signOfferR2UploadAction(formData: FormData): Promise<SignOfferR2UploadResult> {
  await requireAdminUser();
  try {
    const offerIdParsed = z.string().uuid().safeParse(formData.get("offerId"));
    if (!offerIdParsed.success) return { ok: false, message: "Oferta no válida." };
    const offerId = offerIdParsed.data;

    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };

    const mimeHint = String(formData.get("mimeHint") || "").trim() || null;
    const ext = inferExtension(originalFileName, mimeHint);

    let assetType: "image" | "pdf";
    if (isPdfUpload(ext, mimeHint)) assetType = "pdf";
    else if (isImageUpload(ext, mimeHint)) assetType = "image";
    else return { ok: false, message: "Solo se admiten imágenes o PDF." };

    const supabase = await createClient();
    const offer = await supabase.from("offers").select("id").eq("id", offerId).maybeSingle();
    if (offer.error) return { ok: false, message: errorToUserMessage(offer.error) };
    if (!offer.data) return { ok: false, message: "Oferta no encontrada." };

    const { data: lastRow } = await supabase
      .from("offer_assets")
      .select("sort_order")
      .eq("offer_id", offerId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = Number(lastRow?.sort_order || 0) + 1;
    const key = `site/ofertas/${offerId}/${randomUUID()}.${ext}`;

    const contentType =
      assetType === "pdf"
        ? mimeHint && mimeHint.toLowerCase().includes("pdf")
          ? mimeHint
          : "application/pdf"
        : mimeHint && mimeHint.toLowerCase().startsWith("image/")
          ? mimeHint
          : "application/octet-stream";

    const putUrl = await signR2PutObjectUrl(key, contentType);
    return { ok: true, putUrl, fileKey: key, contentType, sortOrder, assetType };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function registerOfferAssetAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      offerId: z.string().uuid(),
      fileKey: z.string().min(12),
      sortOrder: z.coerce.number().int().nonnegative(),
      assetType: z.enum(["image", "pdf"]),
      mimeType: z.string().min(3).max(120),
      title: z.string().max(240).optional(),
    })
    .safeParse({
      offerId: formData.get("offerId"),
      fileKey: formData.get("fileKey"),
      sortOrder: formData.get("sortOrder"),
      assetType: formData.get("assetType"),
      mimeType: formData.get("mimeType"),
      title: formData.get("title") || undefined,
    });
  if (!parsed.success) throw new Error("Datos de registro incompletos.");

  if (!isExpectedOfferR2Key(parsed.data.offerId, parsed.data.fileKey)) {
    throw new Error("La ruta del archivo no es válida para esta oferta.");
  }

  const supabase = await createClient();
  const ins = await supabase
    .from("offer_assets")
    .insert({
      offer_id: parsed.data.offerId,
      asset_type: parsed.data.assetType,
      storage_provider: "r2",
      file_key: parsed.data.fileKey,
      mime_type: parsed.data.mimeType,
      title: parsed.data.title?.trim() || null,
      sort_order: parsed.data.sortOrder,
    })
    .select("id,offer_id,asset_type,storage_provider,file_key,mime_type,title,sort_order")
    .single();

  if (ins.error) throw new Error(ins.error.message);
  revalidatePath("/admin/ofertas");
  return ins.data as OfferAssetRow;
}

export async function reorderOfferAssetsAction(formData: FormData) {
  await requireAdminUser();
  const offerId = z.string().uuid().parse(formData.get("offerId"));
  let orderedIds: string[] = [];
  try {
    orderedIds = JSON.parse(String(formData.get("orderedIdsJson") || "[]"));
  } catch {
    throw new Error("Orden no válido.");
  }
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => z.string().uuid().safeParse(id).success)) {
    throw new Error("Lista de ids no válida.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("offer_assets")
    .select("id")
    .eq("offer_id", offerId);
  if (error) throw new Error(error.message);
  const existing = new Set((rows || []).map((r) => r.id));
  if (orderedIds.length !== existing.size || !orderedIds.every((id) => existing.has(id))) {
    throw new Error("Los elementos no coinciden con la oferta.");
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const u = await supabase.from("offer_assets").update({ sort_order: i + 1 }).eq("id", orderedIds[i]);
    if (u.error) throw new Error(u.error.message);
  }
  revalidatePath("/admin/ofertas");
}

export async function deleteOfferAssetAction(formData: FormData) {
  await requireAdminUser();
  const assetId = z.string().uuid().parse(formData.get("assetId"));
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("offer_assets")
    .select("id,file_key,offer_id")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Elemento no encontrado.");

  const del = await supabase.from("offer_assets").delete().eq("id", assetId);
  if (del.error) throw new Error(del.error.message);

  if (row.file_key) {
    await deleteObjectFromR2(String(row.file_key)).catch(() => {});
  }

  revalidatePath("/admin/ofertas");
}
