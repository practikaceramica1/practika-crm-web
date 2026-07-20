import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteSeriesAction } from "../../actions";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";

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

        <NotifyForm action={deleteSeriesAction} notifySuccess={false} className="mt-5 flex items-center gap-3">
          <FormPendingSection className="flex items-center gap-3">
            <input type="hidden" name="seriesId" value={series.id} />
            <SubmitButton
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              pendingText="Eliminando..."
              confirmMessage="¿Seguro que quieres eliminar esta serie y todo su contenido?"
            >
              Sí, eliminar serie
            </SubmitButton>
            <Link href={`/admin/series/${series.id}`} className="btn-secondary">
              Cancelar
            </Link>
          </FormPendingSection>
        </NotifyForm>
      </section>
    </main>
  );
}
