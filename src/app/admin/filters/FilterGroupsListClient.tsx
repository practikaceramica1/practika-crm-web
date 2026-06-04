"use client";

import { useCallback, useRef, useState } from "react";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Snackbar } from "@/components/admin/Snackbar";
import {
  deleteFilterOptionAction,
  reorderFilterGroupsAction,
  updateFilterOptionAction,
} from "./actions";

export type FilterOptionRow = {
  id: string;
  label: string;
  is_active: boolean;
  translationsJson: string;
};

export type FilterGroupRow = {
  id: string;
  key: string;
  name: string;
  sort_order: number;
  options: FilterOptionRow[];
};

function sortOptionsByLabel(options: FilterOptionRow[]) {
  return [...options].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export default function FilterGroupsListClient({ initialGroups }: { initialGroups: FilterGroupRow[] }) {
  const [groups, setGroups] = useState(() =>
    initialGroups.map((g) => ({ ...g, options: sortOptionsByLabel(g.options) }))
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(initialGroups.map((g) => g.id)));
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const dragId = useRef<string | null>(null);

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
        setSnackbar({ type: "success", message: "Orden de grupos guardado." });
      } catch (e) {
        setGroups(snapshot);
        setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [groups, persistGroupOrder]
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
          se ordenan alfabéticamente en el catálogo (según idioma en la web).
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
          return (
            <li
              key={group.id}
              draggable
              onDragStart={() => {
                dragId.current = group.id;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={() => {
                const from = dragId.current;
                dragId.current = null;
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
                  {group.options.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin opciones en este grupo.</p>
                  ) : (
                    group.options.map((opt) => (
                      <div
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
                                defaultValue={opt.translationsJson}
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
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </section>
  );
}
