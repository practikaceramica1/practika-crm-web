import { createClient } from "@/lib/supabase/server";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  createFilterGroupAction,
  createFilterOptionAction,
} from "./actions";
import FilterGroupsListClient, { type FilterGroupRow, type FilterOptionRow } from "./FilterGroupsListClient";

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

  const clientGroups: FilterGroupRow[] = visibleGroups.map((group) => ({
    id: group.id,
    key: group.key,
    name: group.name,
    sort_order: group.sort_order,
    options: (options || [])
      .filter((o) => o.filter_group_id === group.id)
      .map(
        (opt): FilterOptionRow => ({
          id: opt.id,
          label: opt.label,
          is_active: Boolean(opt.is_active),
          translationsJson: translationsInputValue(opt.translations),
        })
      ),
  }));

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Filtros</h1>
        <p className="mt-1 text-sm text-slate-500">
          Los <strong>grupos</strong> son las categorías del sidebar de la web (Material, Espesor, Acabado…). Las{" "}
          <strong>opciones</strong> se ordenan en la web por alfabético según el idioma activo. El grupo Formato se
          gestiona desde Formatos y no aparece aquí.
        </p>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nuevo grupo</h2>
          <p className="mt-1 text-xs text-slate-500">
            Se añade al final; luego arrastra en la lista para colocarlo donde quieras.
          </p>
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
              <SubmitButton pendingText="Guardando grupo...">Guardar grupo</SubmitButton>
            </FormPendingSection>
          </form>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Nueva opción</h2>
          <p className="mt-1 text-xs text-slate-500">
            Añade un valor al grupo elegido. El texto en español es el valor canónico del catálogo.
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
                <span className="mt-0.5 block text-xs text-slate-500">Nombre visible. Ej.: Silky, 9mm</span>
                <input name="label" className="input mt-1" placeholder="Silky" required />
              </label>
              <SubmitButton pendingText="Guardando opción...">Guardar opción</SubmitButton>
            </FormPendingSection>
          </form>
        </article>
      </section>
      <FilterGroupsListClient initialGroups={clientGroups} />
    </main>
  );
}
