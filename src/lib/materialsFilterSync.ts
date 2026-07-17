import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/text";

const MATERIALS_GROUP_KEYS = new Set(["materials", "material"]);

export function isMaterialsFilterGroup(groupKey: string | null | undefined) {
  const k = (groupKey || "").trim().toLowerCase();
  return MATERIALS_GROUP_KEYS.has(k);
}

/** Crea o actualiza la fila en `materials` alineada con una opción del grupo Material. */
export async function upsertMaterialForFilterOption(
  supabase: SupabaseClient,
  label: string,
  slug?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const name = label.trim();
  const materialSlug = slug?.trim() || slugify(name);
  if (name.length < 2 || materialSlug.length < 2) {
    return { ok: false, message: "Nombre de material no válido." };
  }

  const { data: bySlug } = await supabase.from("materials").select("id").eq("slug", materialSlug).maybeSingle();
  if (bySlug?.id) {
    const u = await supabase.from("materials").update({ name, is_active: true }).eq("id", bySlug.id);
    if (u.error) return { ok: false, message: u.error.message };
    return { ok: true };
  }

  const ins = await supabase
    .from("materials")
    .insert({ slug: materialSlug, name, default_technical_properties: {}, is_active: true })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: ins.error.message };
  return { ok: true };
}

/**
 * Tras renombrar una opción Material: mueve formatos al material del slug nuevo
 * y elimina la fila huérfana del slug antiguo si ya no se usa.
 */
export async function migrateMaterialSlug(
  supabase: SupabaseClient,
  oldSlug: string,
  newSlug: string,
  newLabel: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const oldNorm = oldSlug.trim();
  const newNorm = newSlug.trim();
  const label = newLabel.trim();
  if (!oldNorm || !newNorm || !label) return { ok: false, message: "Slugs de material no válidos." };
  if (oldNorm === newNorm) {
    return upsertMaterialForFilterOption(supabase, label, newNorm);
  }

  const sync = await upsertMaterialForFilterOption(supabase, label, newNorm);
  if (!sync.ok) return sync;

  const { data: oldRow } = await supabase.from("materials").select("id").eq("slug", oldNorm).maybeSingle();
  const { data: newRow } = await supabase.from("materials").select("id").eq("slug", newNorm).maybeSingle();
  if (!newRow?.id) return { ok: false, message: "No se pudo resolver el material destino." };

  if (oldRow?.id && oldRow.id !== newRow.id) {
    const mv = await supabase
      .from("format_materials")
      .update({ material_id: newRow.id })
      .eq("material_id", oldRow.id);
    if (mv.error) return { ok: false, message: mv.error.message };

    const { count } = await supabase
      .from("format_materials")
      .select("id", { count: "exact", head: true })
      .eq("material_id", oldRow.id);
    if ((count ?? 0) === 0) {
      const del = await supabase.from("materials").delete().eq("id", oldRow.id);
      if (del.error) return { ok: false, message: del.error.message };
    }
  }

  return { ok: true };
}

/** Impide borrar una opción Material si algún formato sigue usando ese material. */
export async function assertMaterialFilterOptionDeletable(
  supabase: SupabaseClient,
  optionSlug: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: mat } = await supabase.from("materials").select("id").eq("slug", optionSlug).maybeSingle();
  if (!mat?.id) return { ok: true };

  const { count } = await supabase
    .from("format_materials")
    .select("id", { count: "exact", head: true })
    .eq("material_id", mat.id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `No se puede eliminar: ${count} formato(s) usan este material. Cambia el material en esos formatos antes.`,
    };
  }

  const del = await supabase.from("materials").delete().eq("id", mat.id);
  if (del.error) return { ok: false, message: del.error.message };
  return { ok: true };
}
