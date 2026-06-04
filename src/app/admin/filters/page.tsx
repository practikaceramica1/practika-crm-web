import { createClient } from "@/lib/supabase/server";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  createFilterGroupAction,
  createFilterOptionAction,
  deleteFilterOptionAction,
  updateFilterOptionAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ groupId?: string }>;
};

function translationsInputValue(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([, v]) => typeof v === "string" && v.trim()
  );
  return entries.length ? JSON.stringify(Object.fromEntries(entries), null, 0) : "";
}

export default async function FiltersPage({ searchParams }: PageProps) {
  const { groupId: selectedGroupId = "" } = await searchParams;
  const supabase = await createClient();
  const [{ data: groups, error: groupsError }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from("filter_groups").select("id,key,name,sort_order").order("sort_order"),
    supabase
      .from("filter_options")
      .select("id,label,filter_group_id,is_active,translations")
      .order("label"),
  ]);
  if (isSchemaNotReadyError(groupsError) || isSchemaNotReadyError(optionsError)) {
    return <SetupRequired missing="public.filter_groups / public.filter_options" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (groupsError) throw new Error(groupsError.message);
  if (optionsError) throw new Error(optionsError.message);

  const visibleGroups = (groups || []).filter((g) => g.key !== "formats");
  const groupIdForSelect = visibleGroups.some((g) => g.id === selectedGroupId) ? selectedGroupId : "";
  const grouped = visibleGroups.map((group) => ({
    ...group,
    options: (options || []).filter((o) => o.filter_group_id === group.id),
  }));

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Filtros</h1>
        <p className="mt-1 text-sm text-slate-500">
          Los <strong>grupos</strong> son las categorías del sidebar de la web (Material, Espesor, Acabado…). Las{" "}
          <strong>opciones</strong> son los valores dentro de cada grupo (Porcelánico, 9mm, Silky…). Los formatos (33×33,
          60×60…) se generan solos desde la pantalla Formatos.
        </p>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nuevo grupo</h2>
          <p className="mt-1 text-xs text-slate-500">Solo si necesitas una categoría nueva en el catálogo.</p>
          <form action={createFilterGroupAction} className="mt-3 space-y-3">
            <FormPendingSection className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Clave interna</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Identificador fijo en BD y web (sin espacios). Ej.: <code className="text-slate-600">finishSurface</code>
                </span>
                <input name="key" className="input mt-1" placeholder="finishSurface" required />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Nombre en el CRM</span>
                <span className="mt-0.5 block text-xs text-slate-500">Lo que ves en el admin. Ej.: Acabado superficial</span>
                <input name="name" className="input mt-1" placeholder="Acabado superficial" required />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Orden</span>
                <span className="mt-0.5 block text-xs text-slate-500">Orden en listados (menor = más arriba)</span>
                <input name="sortOrder" className="input mt-1 w-24" type="number" defaultValue={0} />
              </label>
              <SubmitButton pendingText="Guardando grupo...">Guardar grupo</SubmitButton>
            </FormPendingSection>
          </form>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nueva opción</h2>
          <p className="mt-1 text-xs text-slate-500">
            Añade un valor al grupo elegido. El texto en español es el que verá el catálogo por defecto.
          </p>
          <form action={createFilterOptionAction} className="mt-3 space-y-3">
            <FormPendingSection className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Grupo</span>
                <select name="groupId" className="input mt-1" required defaultValue={groupIdForSelect}>
                  <option value="">Selecciona grupo</option>
                  {visibleGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.key})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Etiqueta (español)</span>
                <span className="mt-0.5 block text-xs text-slate-500">Nombre visible en web y CRM. Ej.: Silky, 9mm</span>
                <input name="label" className="input mt-1" placeholder="Silky" required />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Orden</span>
                <input name="sortOrder" className="input mt-1 w-24" type="number" defaultValue={0} />
              </label>
              <SubmitButton pendingText="Guardando opción...">Guardar opción</SubmitButton>
            </FormPendingSection>
          </form>
        </article>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        {grouped.map((group) => (
          <article key={group.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{group.name}</h3>
              <span className="text-xs text-slate-500">{group.options.length} opciones</span>
            </div>
            <p className="text-xs text-slate-500">
              Clave: <code>{group.key}</code>
            </p>
            <ul className="mt-3 space-y-2">
              {group.options.map((opt) => {
                const translations = translationsInputValue(opt.translations);
                return (
                  <li
                    key={opt.id}
                    className={`rounded-lg border p-2 ${opt.is_active ? "border-emerald-100 bg-emerald-50/30" : "border-slate-200 bg-slate-50"}`}
                  >
                    <form action={updateFilterOptionAction} className="space-y-2">
                      <FormPendingSection className="space-y-2">
                        <input type="hidden" name="optionId" value={opt.id} />
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            name="label"
                            className="input min-w-[8rem] flex-1 text-sm"
                            defaultValue={opt.label}
                            required
                            aria-label={`Etiqueta de ${opt.label}`}
                          />
                          <SubmitButton className="btn-primary text-xs" pendingText="Guardando...">
                            Renombrar
                          </SubmitButton>
                        </div>
                        <label className="block text-xs text-slate-500">
                          Traducciones (opcional, JSON)
                          <input
                            name="translationsJson"
                            className="input mt-1 font-mono text-xs"
                            placeholder='{"en":"Silky","fr":"Soie","de":"Silky","pt":"Silky"}'
                            defaultValue={translations}
                          />
                        </label>
                      </FormPendingSection>
                    </form>
                    <form action={deleteFilterOptionAction} className="mt-2">
                      <input type="hidden" name="optionId" value={opt.id} />
                      <SubmitButton
                        className="text-xs text-red-600 hover:underline"
                        showSpinner={false}
                        pendingText="Eliminando..."
                        confirmMessage={`¿Eliminar «${opt.label}»? Se quitará de series, formatos y colores vinculados.`}
                      >
                        Eliminar
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
