import Link from "next/link";

export function SetupRequired({
  missing,
  migration,
}: {
  missing: string;
  migration: string;
}) {
  return (
    <section className="card p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Setup requerido</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Configuración pendiente de Supabase</h2>
      <p className="mt-2 text-sm text-slate-600">Falta la tabla: <code>{missing}</code>.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Abre SQL Editor en tu proyecto Supabase.</li>
        <li>Ejecuta <code>{migration}</code>.</li>
        <li>Recarga el CRM.</li>
      </ol>
      <div className="mt-4">
        <Link href="/admin" className="btn-secondary">Volver</Link>
      </div>
    </section>
  );
}
