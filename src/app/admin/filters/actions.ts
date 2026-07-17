"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import {
  assertMaterialFilterOptionDeletable,
  isMaterialsFilterGroup,
  migrateMaterialSlug,
  upsertMaterialForFilterOption,
} from "@/lib/materialsFilterSync";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/text";

const groupSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
});
const optionSchema = z.object({
  groupId: z.string().uuid(),
  label: z.string().min(1),
});
const reorderGroupsSchema = z.object({
  orderedIdsJson: z.string().min(2),
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
  });
  if (!parsed.success) throw new Error("Datos inválidos");
  if (parsed.data.key.trim() === "formats") {
    throw new Error("El grupo formats se genera desde formatos creados.");
  }

  const { data: maxRow } = await supabase
    .from("filter_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("filter_groups").upsert(
    {
      key: parsed.data.key.trim(),
      name: parsed.data.name.trim(),
      sort_order: nextSort,
    },
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
  });
  if (!parsed.success) throw new Error("Datos inválidos");

  const { data: group } = await supabase
    .from("filter_groups")
    .select("key")
    .eq("id", parsed.data.groupId)
    .maybeSingle();

  const slug = slugify(parsed.data.label);
  const label = parsed.data.label.trim();
  const { error } = await supabase.from("filter_options").upsert(
    {
      filter_group_id: parsed.data.groupId,
      label,
      slug,
      sort_order: 0,
      is_active: true,
    },
    { onConflict: "filter_group_id,slug" }
  );
  if (error) throw new Error(error.message);

  if (isMaterialsFilterGroup(group?.key)) {
    const sync = await upsertMaterialForFilterOption(supabase, label, slug);
    if (!sync.ok) throw new Error(sync.message);
    revalidatePath("/admin/series");
    revalidatePath("/admin/formats");
  }

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

  const { data: existing } = await supabase
    .from("filter_options")
    .select("slug, filter_groups(key)")
    .eq("id", parsed.data.optionId)
    .maybeSingle();
  const groupKey = Array.isArray(existing?.filter_groups)
    ? existing.filter_groups[0]?.key
    : (existing?.filter_groups as { key?: string } | null)?.key;

  const translations = parseTranslationsJson(parsed.data.translationsJson);
  const label = parsed.data.label.trim();
  const newSlug = slugify(label);
  const payload: {
    label: string;
    slug: string;
    translations?: Record<string, string>;
  } = {
    label,
    slug: newSlug,
  };
  if (translations !== null) payload.translations = translations;

  const { error } = await supabase
    .from("filter_options")
    .update(payload)
    .eq("id", parsed.data.optionId);
  if (error) throw new Error(error.message);

  if (isMaterialsFilterGroup(groupKey)) {
    const oldSlug = String(existing?.slug || "").trim();
    const sync = oldSlug
      ? await migrateMaterialSlug(supabase, oldSlug, newSlug, label)
      : await upsertMaterialForFilterOption(supabase, label, newSlug);
    if (!sync.ok) throw new Error(sync.message);
    revalidatePath("/admin/series");
    revalidatePath("/admin/formats");
  }

  revalidatePath("/admin/filters");
}

export async function deleteFilterOptionAction(formData: FormData) {
  await requireAdminUser();
  const supabase = await createClient();
  const parsed = deleteOptionSchema.safeParse({ optionId: formData.get("optionId") });
  if (!parsed.success) throw new Error("Datos inválidos");

  const { data: existing } = await supabase
    .from("filter_options")
    .select("slug, filter_groups(key)")
    .eq("id", parsed.data.optionId)
    .maybeSingle();
  const groupKey = Array.isArray(existing?.filter_groups)
    ? existing.filter_groups[0]?.key
    : (existing?.filter_groups as { key?: string } | null)?.key;

  if (isMaterialsFilterGroup(groupKey) && existing?.slug) {
    const guard = await assertMaterialFilterOptionDeletable(supabase, existing.slug);
    if (!guard.ok) throw new Error(guard.message);
  }

  const { error } = await supabase.from("filter_options").delete().eq("id", parsed.data.optionId);
  if (error) throw new Error(error.message);

  if (isMaterialsFilterGroup(groupKey)) {
    revalidatePath("/admin/series");
    revalidatePath("/admin/formats");
  }
  revalidatePath("/admin/filters");
}

/** Reordena grupos visibles en admin (el grupo `formats` conserva su hueco en BD). */
export async function reorderFilterGroupsAction(formData: FormData) {
  await requireAdminUser();
  const parsed = reorderGroupsSchema.safeParse({ orderedIdsJson: formData.get("orderedIdsJson") });
  if (!parsed.success) throw new Error("Orden no válido");

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(parsed.data.orderedIdsJson) as string[];
  } catch {
    throw new Error("Orden no válido");
  }
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => z.string().uuid().safeParse(id).success)) {
    throw new Error("Orden no válido");
  }

  const supabase = await createClient();
  const { data: allGroups, error: loadErr } = await supabase
    .from("filter_groups")
    .select("id,key,sort_order")
    .order("sort_order");
  if (loadErr) throw new Error(loadErr.message);

  const formatsGroup = (allGroups || []).find((g) => g.key === "formats");
  const visibleDb = (allGroups || []).filter((g) => g.key !== "formats");
  const visibleSet = new Set(visibleDb.map((g) => g.id));
  if (orderedIds.length !== visibleSet.size || !orderedIds.every((id) => visibleSet.has(id))) {
    throw new Error("Lista de grupos incompleta.");
  }

  const formatsSlot = formatsGroup?.sort_order ?? visibleDb.length + 1;
  let slot = 1;
  for (const id of orderedIds) {
    if (slot === formatsSlot) slot++;
    const u = await supabase.from("filter_groups").update({ sort_order: slot }).eq("id", id);
    if (u.error) throw new Error(u.error.message);
    slot++;
  }

  revalidatePath("/admin/filters");
}
