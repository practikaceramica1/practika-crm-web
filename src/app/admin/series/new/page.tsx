import { createSeriesAction } from "../actions";

export default function NewSeriesPage() {
  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Nueva serie</h1>
        <p className="mt-1 text-sm text-slate-500">Solo nombre. El resto se construye por vistas en el detalle.</p>
      </section>
      <form action={createSeriesAction} className="card p-5">
        <label className="label">Nombre</label>
        <input name="name" className="input" placeholder="Kamen" required />
        <button className="btn-primary mt-4">Crear serie</button>
      </form>
    </main>
  );
}
