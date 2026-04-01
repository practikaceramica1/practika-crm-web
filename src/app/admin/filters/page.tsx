import { createClient } from "@/lib/supabase/server";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createFilterGroupAction, createFilterOptionAction } from "./actions";

export default async function FiltersPage() {
  const supabase = await createClient();
  const [{ data: groups, error: groupsError }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from("filter_groups").select("id,key,name,sort_order").order("sort_order"),
    supabase.from("filter_options").select("id,label,filter_group_id,is_active").order("label"),
  ]);
  if (isSchemaNotReadyError(groupsError) || isSchemaNotReadyError(optionsError)) {
    return <SetupRequired missing="public.filter_groups / public.filter_options" migration="supabase/migrations/20260331_0001_crm_init.sql" />;
  }
  if (groupsError) throw new Error(groupsError.message);
  if (optionsError) throw new Error(optionsError.message);

  const visibleGroups = (groups || []).filter((g) => g.key !== "formats");
  const grouped = visibleGroups.map((group) => ({
    ...group,
    options: (options || []).filter((o) => o.filter_group_id === group.id),
  }));

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Filtros</h1>
        <p className="text-sm text-slate-500">Estructura agrupada y fácil de editar. Formatos se gestionan aparte.</p>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nuevo grupo</h2>
          <form action={createFilterGroupAction} className="mt-3 space-y-2">
            <FormPendingSection className="space-y-2">
              <input name="key" className="input" placeholder="materials" required />
              <input name="name" className="input" placeholder="Material" required />
              <input name="sortOrder" className="input" type="number" defaultValue={0} />
              <SubmitButton pendingText="Guardando grupo...">Guardar grupo</SubmitButton>
            </FormPendingSection>
          </form>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nueva opción</h2>
          <form action={createFilterOptionAction} className="mt-3 space-y-2">
            <FormPendingSection className="space-y-2">
              <select name="groupId" className="input" required>
                <option value="">Selecciona grupo</option>
                {visibleGroups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.key})</option>)}
              </select>
              <input name="label" className="input" placeholder="Porcelánico" required />
              <input name="sortOrder" className="input" type="number" defaultValue={0} />
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
            <p className="text-xs text-slate-500">{group.key}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.options.map((opt) => (
                <span key={opt.id} className={`rounded-full px-2 py-1 text-xs ${opt.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {opt.label}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
