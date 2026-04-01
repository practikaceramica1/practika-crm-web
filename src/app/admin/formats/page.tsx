import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Formatos globales</h1>
        <p className="text-sm text-slate-500">Aquí ves todos los formatos creados en todas las series.</p>
      </section>
      <section className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Serie</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3 text-right">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              (() => {
                const series = Array.isArray(row.series) ? row.series[0] : row.series;
                const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;

                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{series?.name || "-"}</td>
                <td className="px-4 py-3">{row.format_label} ({row.width_cm}x{row.height_cm} cm)</td>
                    <td className="px-4 py-3">{material?.name || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {series?.id ? <Link href={`/admin/series/${series.id}`} className="btn-secondary">Serie</Link> : "-"}
                    </td>
                  </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
