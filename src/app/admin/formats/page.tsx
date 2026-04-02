import { createClient } from "@/lib/supabase/server";
import { FormatsListTable, type FormatsListRow } from "@/components/admin/FormatsListTable";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";

export default async function FormatsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("format_materials")
    .select("id,format_label,width_cm,height_cm,series(id,name),materials(name)")
    .order("created_at", { ascending: false });
  if (isSchemaNotReadyError(error)) {
    return <SetupRequired missing="public.format_materials" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (error) throw new Error(error.message);

  const rows: FormatsListRow[] = (data || []).map((row) => {
    const series = Array.isArray(row.series) ? row.series[0] : row.series;
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    return {
      id: row.id,
      seriesId: series?.id ?? null,
      seriesName: series?.name ?? "-",
      formatLabel: `${row.format_label} (${row.width_cm}x${row.height_cm} cm)`,
      materialName: material?.name ?? "-",
    };
  });

  rows.sort((a, b) => a.seriesName.localeCompare(b.seriesName, "es", { sensitivity: "base" }));

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Formatos globales</h1>
        <p className="text-sm text-slate-500">Aquí ves todos los formatos creados en todas las series.</p>
      </section>
      <section className="card overflow-hidden">
        <FormatsListTable rows={rows} />
      </section>
    </main>
  );
}
