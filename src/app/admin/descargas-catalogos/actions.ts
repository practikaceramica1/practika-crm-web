"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorToUserMessage } from "@/lib/errorMessage";
import { deleteObjectFromR2, signR2PutObjectUrl } from "@/lib/uploads/r2";
import type { CatalogTranslations, DownloadCatalogItemRow, SignDownloadCatalogPdfResult } from "./downloadCatalogTypes";
import { CATALOG_EXTRA_LANGS } from "./downloadCatalogTypes";

function isExpectedDownloadCatalogKey(itemId: string, fileKey: string) {
  if (!fileKey || fileKey.includes("..")) return false;
  return fileKey.startsWith(`site/descargas/catalogos/${itemId}/`);
}

export async function listDownloadCatalogItemsAdmin(): Promise<DownloadCatalogItemRow[]> {
  await requireAdminUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("download_catalog_items")
    .select(
      "id,title,subtitle,storage_provider,file_key,mime_type,file_size_hint,sort_order,status,translations"
    )
    .order("sort_order", { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data || []) as DownloadCatalogItemRow[];
}

export async function reorderDownloadCatalogItemsAction(formData: FormData) {
  await requireAdminUser();
  const orderedIds = JSON.parse(String(formData.get("orderedIdsJson") || "[]")) as string[];
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => z.string().uuid().safeParse(id).success)) {
    throw new Error("Orden no válido.");
  }
  const supabase = await createClient();
  const { data: rows } = await supabase.from("download_catalog_items").select("id");
  const set = new Set((rows || []).map((r) => r.id));
  if (orderedIds.length !== set.size || !orderedIds.every((id) => set.has(id))) {
    throw new Error("La lista no coincide con los catálogos guardados.");
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const u = await supabase.from("download_catalog_items").update({ sort_order: i + 1 }).eq("id", orderedIds[i]);
    if (u.error) throw new Error(u.error.message);
  }
  revalidatePath("/admin/descargas-catalogos");
}

export async function signNewDownloadCatalogPdfAction(formData: FormData): Promise<SignDownloadCatalogPdfResult> {
  await requireAdminUser();
  try {
    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };
    const lower = originalFileName.toLowerCase();
    if (!lower.endsWith(".pdf")) return { ok: false, message: "Solo se admiten archivos PDF." };

    const itemId = randomUUID();
    const fileKey = `site/descargas/catalogos/${itemId}/${randomUUID()}.pdf`;
    const contentType = "application/pdf";
    const putUrl = await signR2PutObjectUrl(fileKey, contentType);
    return { ok: true, putUrl, fileKey, contentType, itemId };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

export async function signReplaceDownloadCatalogPdfAction(formData: FormData): Promise<SignDownloadCatalogPdfResult> {
  await requireAdminUser();
  try {
    const itemId = z.string().uuid().parse(formData.get("itemId"));
    const originalFileName = String(formData.get("originalFileName") || "").trim();
    if (originalFileName.length < 2) return { ok: false, message: "Nombre de archivo no válido." };
    const lower = originalFileName.toLowerCase();
    if (!lower.endsWith(".pdf")) return { ok: false, message: "Solo se admiten archivos PDF." };

    const supabase = await createClient();
    const { data: row } = await supabase.from("download_catalog_items").select("id").eq("id", itemId).maybeSingle();
    if (!row) return { ok: false, message: "Elemento no encontrado." };

    const fileKey = `site/descargas/catalogos/${itemId}/${randomUUID()}.pdf`;
    const putUrl = await signR2PutObjectUrl(fileKey, "application/pdf");
    return { ok: true, putUrl, fileKey, contentType: "application/pdf", itemId };
  } catch (e) {
    return { ok: false, message: errorToUserMessage(e) };
  }
}

function parseTranslationsJson(raw: string | null): CatalogTranslations | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: CatalogTranslations = {};
    for (const lang of CATALOG_EXTRA_LANGS) {
      const entry = parsed[lang];
      if (entry && typeof entry === "object") {
        out[lang] = {
          title: String((entry as Record<string, unknown>).title ?? ""),
          subtitle: String((entry as Record<string, unknown>).subtitle ?? ""),
        };
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function registerNewDownloadCatalogItemAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      fileKey: z.string().min(12),
      title: z.string().min(1).max(240),
      subtitle: z.string().max(240).optional(),
      fileSizeHint: z.string().max(32).optional(),
      translationsJson: z.string().optional(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      fileKey: formData.get("fileKey"),
      title: formData.get("title"),
      subtitle: formData.get("subtitle") ?? "",
      fileSizeHint: formData.get("fileSizeHint") ?? "",
      translationsJson: formData.get("translationsJson") ?? "",
    });
  if (!parsed.success) throw new Error("Datos incompletos o no válidos.");
  if (!isExpectedDownloadCatalogKey(parsed.data.itemId, parsed.data.fileKey)) {
    throw new Error("La ruta del archivo no es válida.");
  }

  const translations = parseTranslationsJson(parsed.data.translationsJson ?? null);

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("download_catalog_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = Number(last?.sort_order || 0) + 1;

  const ins = await supabase
    .from("download_catalog_items")
    .insert({
      id: parsed.data.itemId,
      title: parsed.data.title.trim(),
      subtitle: parsed.data.subtitle?.trim() || null,
      storage_provider: "r2",
      file_key: parsed.data.fileKey,
      mime_type: "application/pdf",
      file_size_hint: parsed.data.fileSizeHint?.trim() || null,
      sort_order: nextOrder,
      status: "draft",
      translations,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  revalidatePath("/admin/descargas-catalogos");
}

export async function updateDownloadCatalogItemMetaAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      title: z.string().min(1).max(240),
      subtitle: z.string().max(240).optional(),
      fileSizeHint: z.string().max(32).optional(),
      status: z.enum(["draft", "published"]),
      translationsJson: z.string().optional(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      title: formData.get("title"),
      subtitle: formData.get("subtitle") ?? "",
      fileSizeHint: formData.get("fileSizeHint") ?? "",
      status: formData.get("status"),
      translationsJson: formData.get("translationsJson") ?? "",
    });
  if (!parsed.success) throw new Error("Datos no válidos.");

  const translations = parseTranslationsJson(parsed.data.translationsJson ?? null);

  const supabase = await createClient();
  const u = await supabase
    .from("download_catalog_items")
    .update({
      title: parsed.data.title.trim(),
      subtitle: parsed.data.subtitle?.trim() || null,
      file_size_hint: parsed.data.fileSizeHint?.trim() || null,
      status: parsed.data.status,
      translations,
    })
    .eq("id", parsed.data.itemId);
  if (u.error) throw new Error(u.error.message);
  revalidatePath("/admin/descargas-catalogos");
}

export async function applyDownloadCatalogPdfReplaceAction(formData: FormData) {
  await requireAdminUser();
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      newFileKey: z.string().min(12),
      oldFileKey: z.string().min(12),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      newFileKey: formData.get("newFileKey"),
      oldFileKey: formData.get("oldFileKey"),
    });
  if (!parsed.success) throw new Error("Datos no válidos.");
  if (!isExpectedDownloadCatalogKey(parsed.data.itemId, parsed.data.newFileKey)) {
    throw new Error("La ruta del archivo nuevo no es válida.");
  }
  if (!isExpectedDownloadCatalogKey(parsed.data.itemId, parsed.data.oldFileKey)) {
    throw new Error("La ruta del archivo anterior no es válida.");
  }

  const supabase = await createClient();
  const u = await supabase
    .from("download_catalog_items")
    .update({ file_key: parsed.data.newFileKey, mime_type: "application/pdf" })
    .eq("id", parsed.data.itemId);
  if (u.error) throw new Error(u.error.message);
  await deleteObjectFromR2(parsed.data.oldFileKey).catch(() => {});
  revalidatePath("/admin/descargas-catalogos");
}

export async function deleteDownloadCatalogItemAction(formData: FormData) {
  await requireAdminUser();
  const itemId = z.string().uuid().parse(formData.get("itemId"));
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("download_catalog_items")
    .select("id,file_key")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("No encontrado.");

  const del = await supabase.from("download_catalog_items").delete().eq("id", itemId);
  if (del.error) throw new Error(del.error.message);
  if (row.file_key) await deleteObjectFromR2(String(row.file_key)).catch(() => {});

  const { data: rest } = await supabase
    .from("download_catalog_items")
    .select("id")
    .order("sort_order", { ascending: true });
  const ids = (rest || []).map((r) => r.id);
  for (let i = 0; i < ids.length; i++) {
    await supabase.from("download_catalog_items").update({ sort_order: i + 1 }).eq("id", ids[i]);
  }
  revalidatePath("/admin/descargas-catalogos");
}
