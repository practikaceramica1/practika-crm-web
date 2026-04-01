import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteSeriesAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DeleteSeriesPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: series } = await supabase.from("series").select("id,name,slug").eq("id", id).single();

  if (!series) notFound();

  return (
    <main className="space-y-6">
      <section className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Acción destructiva</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Eliminar serie</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vas a eliminar la serie <strong>{series.name}</strong> ({series.slug}) y todo su contenido relacionado
          (formatos, colores, filtros asociados y documentos registrados).
        </p>

        <form action={deleteSeriesAction} className="mt-5 flex items-center gap-3">
          <input type="hidden" name="seriesId" value={series.id} />
          <button className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Sí, eliminar serie
          </button>
          <Link href={`/admin/series/${series.id}`} className="btn-secondary">
            Cancelar
          </Link>
        </form>
      </section>
    </main>
  );
}
