"use server";

import { revalidatePath } from "next/cache";
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
}
