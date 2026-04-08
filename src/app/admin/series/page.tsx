import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { SeriesListTable } from "@/components/admin/SeriesListTable";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";

export default async function SeriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("id,name,slug,is_new,updated_at")
    .order("name", { ascending: true });

  if (isSchemaNotReadyError(error)) {
    return <SetupRequired missing="public.series" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (error) throw new Error(error.message);

  const rows = (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    is_new: Boolean(r.is_new),
    updated_at: r.updated_at,
  }));

  return (
    <main className="space-y-6">
      <section className="card flex items-center justify-between p-5">
        <div>
          <h1 className="text-2xl font-semibold">Series</h1>
          <p className="text-sm text-slate-500">Cada serie se gestiona en vista separada con pasos.</p>
        </div>
        <Link href="/admin/series/new" className="btn-primary">
          Nueva serie
        </Link>
      </section>
      <section className="card overflow-hidden">
        <SeriesListTable rows={rows} />
      </section>
    </main>
  );
}
