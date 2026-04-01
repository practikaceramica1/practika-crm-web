import Link from "next/link";

const cards = [
  { href: "/admin/series", title: "Series", text: "Vista principal por pasos y sub-vistas.", cta: "Abrir series" },
  { href: "/admin/formats", title: "Formatos", text: "Listado global de formatos/materiales creados.", cta: "Ver formatos" },
  { href: "/admin/filters", title: "Filtros", text: "Catálogo maestro de filtros agrupados.", cta: "Ver filtros" },
];

export default function AdminDashboardPage() {
  return (
    <main className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a1f3d] via-[#223067] to-[#111a35] px-6 py-8 text-white">
          <p className="text-xs uppercase tracking-widest text-indigo-200">Practika Cerámica</p>
          <h1 className="mt-2 text-3xl font-semibold">CRM v3 · Estructura por vistas</h1>
          <p className="mt-2 max-w-3xl text-sm text-indigo-100">
            Diseño modular tipo plataforma: separa documentos, formatos y artículos dentro de cada serie.
          </p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.href} className="card p-5">
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{card.text}</p>
            <Link href={card.href} className="btn-primary mt-4">
              {card.cta}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
