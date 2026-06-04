"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/text";

const groupSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  sortOrder: z.coerce.number().int().default(0),
});
const optionSchema = z.object({
  groupId: z.string().uuid(),
  label: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});
const updateOptionSchema = z.object({
  optionId: z.string().uuid(),
  label: z.string().min(1),
  translationsJson: z.string().optional(),
});
const deleteOptionSchema = z.object({
  optionId: z.string().uuid(),
});

function parseTranslationsJson(raw: string | undefined): Record<string, string> | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Traducciones: JSON inválido (ej. {\"en\":\"Silky\"})");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Traducciones: debe ser un objeto JSON");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export async function createFilterGroupAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = groupSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) throw new Error("Datos inválidos");
  if (parsed.data.key.trim() === "formats") {
    throw new Error("El grupo formats se genera desde formatos creados.");
  }

  const { error } = await supabase.from("filter_groups").upsert(
    { key: parsed.data.key.trim(), name: parsed.data.name.trim(), sort_order: parsed.data.sortOrder },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/filters");
}

export async function createFilterOptionAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = optionSchema.safeParse({
    groupId: formData.get("groupId"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) throw new Error("Datos inválidos");

  const slug = slugify(parsed.data.label);
  const { error } = await supabase.from("filter_options").upsert(
    {
      filter_group_id: parsed.data.groupId,
      label: parsed.data.label.trim(),
      slug,
      sort_order: parsed.data.sortOrder,
      is_active: true,
    },
    { onConflict: "filter_group_id,slug" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/filters");
  redirect(`/admin/filters?groupId=${encodeURIComponent(parsed.data.groupId)}`);
}

export async function updateFilterOptionAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = updateOptionSchema.safeParse({
    optionId: formData.get("optionId"),
    label: formData.get("label"),
    translationsJson: formData.get("translationsJson")?.toString(),
  });
  if (!parsed.success) throw new Error("Datos inválidos");

  const translations = parseTranslationsJson(parsed.data.translationsJson);
  const payload: {
    label: string;
    slug: string;
    translations?: Record<string, string>;
  } = {
    label: parsed.data.label.trim(),
    slug: slugify(parsed.data.label),
  };
  if (translations !== null) payload.translations = translations;

  const { error } = await supabase
    .from("filter_options")
    .update(payload)
    .eq("id", parsed.data.optionId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/filters");
}

export async function deleteFilterOptionAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteOptionSchema.safeParse({ optionId: formData.get("optionId") });
  if (!parsed.success) throw new Error("Datos inválidos");

  const { error } = await supabase.from("filter_options").delete().eq("id", parsed.data.optionId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/filters");
}
