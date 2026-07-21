import { PendientesTable } from "@/components/admin/PendientesTable";
import { getSeriesPendingSummary } from "@/lib/seriesPending";

export default async function PendientesPage() {
  const { rows, incompleteCount } = await getSeriesPendingSummary();

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold text-slate-900">Pendientes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Series con algo incompleto para publicar en la web. Criterios: al menos 1 formato, 1 panel técnico, 1
          ambiente, 1 PDF de serie, 1 color; además, cada color con imagen y cada formato con packing.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-800">
          {incompleteCount === 0
            ? "No hay series pendientes."
            : `${incompleteCount} serie${incompleteCount === 1 ? "" : "s"} con pendientes`}
        </p>
      </section>

      {rows.length === 0 ? (
        <section className="card p-8 text-center text-sm text-slate-500">
          Todas las series cumplen el checklist mínimo.
        </section>
      ) : (
        <section className="card overflow-hidden">
          <PendientesTable rows={rows} />
        </section>
      )}
    </main>
  );
}
