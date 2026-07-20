"use client";

import { useCallback, useRef, useState } from "react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  deleteFilterOptionAction,
  reorderFilterGroupsAction,
  reorderMaterialOptionsAction,
  updateFilterOptionAction,
} from "./actions";
import { isMaterialsFilterGroup } from "@/lib/materialsFilterSync";

export type FilterOptionRow = {
  id: string;
  label: string;
  is_active: boolean;
  translationsJson: string;
  sort_order: number;
};

export type FilterGroupRow = {
  id: string;
  key: string;
  name: string;
  sort_order: number;
  options: FilterOptionRow[];
};

function sortOptionsForGroup(groupKey: string, options: FilterOptionRow[]) {
  if (isMaterialsFilterGroup(groupKey)) {
    return [...options].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "es"));
  }
  return [...options].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export default function FilterGroupsListClient({ initialGroups }: { initialGroups: FilterGroupRow[] }) {
  const [groups, setGroups] = useState(() =>
    initialGroups.map((g) => ({ ...g, options: sortOptionsForGroup(g.key, g.options) }))
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(initialGroups.map((g) => g.id)));
  const { notify } = useAdminSnackbar();
  const dragGroupId = useRef<string | null>(null);
  const dragOptionId = useRef<string | null>(null);

  const persistGroupOrder = useCallback(async (next: FilterGroupRow[]) => {
    const fd = new FormData();
    fd.set("orderedIdsJson", JSON.stringify(next.map((g) => g.id)));
    await reorderFilterGroupsAction(fd);
  }, []);

  const moveGroup = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = [...groups];
      const i = groups.findIndex((x) => x.id === fromId);
      const j = groups.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...groups];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((g, idx) => ({ ...g, sort_order: idx + 1 }));
      setGroups(reindexed);
      try {
        await persistGroupOrder(reindexed);
        notify({ type: "success", message: "Orden de grupos guardado." });
      } catch (e) {
        setGroups(snapshot);
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [groups, persistGroupOrder, notify]
  );

  const moveMaterialOption = useCallback(
    async (groupId: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = groups.map((g) => ({ ...g, options: [...g.options] }));
      const groupIndex = groups.findIndex((g) => g.id === groupId);
      if (groupIndex < 0) return;
      const group = groups[groupIndex];
      if (!isMaterialsFilterGroup(group.key)) return;
      const i = group.options.findIndex((x) => x.id === fromId);
      const j = group.options.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const opts = [...group.options];
      const [removed] = opts.splice(i, 1);
      opts.splice(j, 0, removed);
      const reindexed = opts.map((o, idx) => ({ ...o, sort_order: idx + 1 }));
      const next = [...groups];
      next[groupIndex] = { ...group, options: reindexed };
      setGroups(next);
      try {
        const fd = new FormData();
        fd.set("orderedIdsJson", JSON.stringify(reindexed.map((o) => o.id)));
        await reorderMaterialOptionsAction(fd);
        notify({ type: "success", message: "Orden de materiales guardado (packing-list)." });
      } catch (e) {
        setGroups(snapshot);
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [groups, notify]
  );

  const toggleGroup = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => setOpenIds(new Set());
  const expandAll = () => setOpenIds(new Set(groups.map((g) => g.id)));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Arrastra <span className="font-medium text-slate-800">⋮⋮</span> para ordenar los grupos en la web. Las opciones
          se ordenan alfabéticamente en el catálogo (según idioma en la web), excepto Materiales (ver abajo).
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={collapseAll}>
            Colapsar todo
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={expandAll}>
            Expandir todo
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {groups.map((group) => {
          const isOpen = openIds.has(group.id);
          const isMaterials = isMaterialsFilterGroup(group.key);
          return (
            <li
              key={group.id}
              draggable
              onDragStart={() => {
                dragGroupId.current = group.id;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={() => {
                const from = dragGroupId.current;
                dragGroupId.current = null;
                if (!from) return;
                void moveGroup(from, group.id);
              }}
              className="card overflow-hidden"
            >
              <div className="flex items-stretch gap-0 border-b border-slate-100 bg-slate-50/80">
                <span
                  className="flex cursor-grab items-center px-3 text-slate-400 select-none active:cursor-grabbing"
                  title="Arrastrar grupo"
                >
                  ⋮⋮
                </span>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-3 text-left"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                >
                  <span className="text-slate-500">{isOpen ? "▼" : "▶"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900">{group.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      <code>{group.key}</code> · {group.options.length} opciones
                    </span>
                  </span>
                </button>
              </div>

              {isOpen ? (
                <div className="space-y-2 p-3">
                  {isMaterials ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Arrastra las opciones de Material para definir el orden de grupos en la página{" "}
                      <strong>packing-list</strong> de la web. En el catálogo / filtros laterales siguen yendo en orden
                      alfabético.
                    </p>
                  ) : null}
                  {group.options.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin opciones en este grupo.</p>
                  ) : (
                    group.options.map((opt) => (
                      <div
                        key={opt.id}
                        draggable={isMaterials}
                        onDragStart={(e) => {
                          if (!isMaterials) return;
                          e.stopPropagation();
                          dragOptionId.current = opt.id;
                          dragGroupId.current = null;
                        }}
                        onDragOver={(e) => {
                          if (!isMaterials) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          if (!isMaterials) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const from = dragOptionId.current;
                          dragOptionId.current = null;
                          if (!from) return;
                          void moveMaterialOption(group.id, from, opt.id);
                        }}
                        className={`rounded-lg border p-2 ${opt.is_active ? "border-emerald-100 bg-emerald-50/30" : "border-slate-200 bg-slate-50"}`}
                      >
                        <NotifyForm
                          action={updateFilterOptionAction}
                          successMessage="Opción actualizada."
                          className="space-y-2"
                        >
                          <FormPendingSection className="space-y-2">
                            <input type="hidden" name="optionId" value={opt.id} />
                            <div className="flex flex-wrap items-center gap-2">
                              {isMaterials ? (
                                <span
                                  className="cursor-grab select-none px-1 text-slate-400 active:cursor-grabbing"
                                  title="Arrastrar material (orden packing-list)"
                                >
                                  ⋮⋮
                                </span>
                              ) : null}
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
                                defaultValue={opt.translationsJson}
                              />
                            </label>
                          </FormPendingSection>
                        </NotifyForm>
                        <NotifyForm action={deleteFilterOptionAction} successMessage="Opción eliminada." className="mt-2">
                          <input type="hidden" name="optionId" value={opt.id} />
                          <SubmitButton
                            className="text-xs text-red-600 hover:underline"
                            showSpinner={false}
                            pendingText="Eliminando..."
                            confirmMessage={`¿Eliminar «${opt.label}»? Se quitará de series, formatos y colores vinculados.`}
                          >
                            Eliminar
                          </SubmitButton>
                        </NotifyForm>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
