import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";

export default async function SeriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("id,name,slug,updated_at")
    .order("updated_at", { ascending: false });

  if (isSchemaNotReadyError(error)) {
    return <SetupRequired missing="public.series" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (error) throw new Error(error.message);

  return (
    <main className="space-y-6">
      <section className="card flex items-center justify-between p-5">
        <div>
          <h1 className="text-2xl font-semibold">Series</h1>
          <p className="text-sm text-slate-500">Cada serie se gestiona en vista separada con pasos.</p>
        </div>
        <Link href="/admin/series/new" className="btn-primary">Nueva serie</Link>
      </section>
      <section className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Serie</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Actualizada</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-3 font-semibold">{row.name}</td>
                <td className="px-4 py-3">{row.slug}</td>
                <td className="px-4 py-3">{row.updated_at ? new Date(row.updated_at).toLocaleString("es-ES") : "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link href={`/admin/series/${row.id}`} className="btn-secondary">Abrir</Link>
                    <Link
                      href={`/admin/series/${row.id}/delete`}
                      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition-all duration-150 hover:-translate-y-px hover:bg-red-50 active:scale-[0.98]"
                    >
                      Eliminar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
