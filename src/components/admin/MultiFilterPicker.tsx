"use client";

import { useMemo, useState } from "react";
import { FormPendingSection } from "./FormPendingSection";
import { SubmitButton } from "./SubmitButton";

type Group = { key: string; name: string; options: { id: string; label: string }[] };

export function MultiFilterPicker({
  groups,
  initialSelectedIds,
  hiddenIdName,
  hiddenIdValue,
  saveAction,
  saveButton = "Guardar filtros",
  confirmMessage = "¿Confirmas guardar estos cambios?",
}: {
  groups: Group[];
  initialSelectedIds: string[];
  hiddenIdName: string;
  hiddenIdValue: string;
  saveAction: (formData: FormData) => void | Promise<void>;
  saveButton?: string;
  confirmMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const initialKey = useMemo(() => JSON.stringify([...initialSelectedIds].sort()), [initialSelectedIds]);
  const [selected, setSelected] = useState(new Set(initialSelectedIds));
  const selectedJson = useMemo(() => JSON.stringify(Array.from(selected)), [selected]);
  const hasChanges = useMemo(() => {
    const currentKey = JSON.stringify(Array.from(selected).sort());
    return currentKey !== initialKey;
  }, [selected, initialKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  return (
    <form action={saveAction} className="space-y-2">
      <FormPendingSection>
        <input type="hidden" name={hiddenIdName} value={hiddenIdValue} />
        <input type="hidden" name="optionIdsJson" value={selectedJson} />
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar filtro..." />
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          {filtered.map((group) => (
            <section key={group.key} className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</p>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {group.options.map((opt) => (
                  <label key={opt.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(opt.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.id)) next.delete(opt.id);
                          else next.add(opt.id);
                          return next;
                        })
                      }
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <SubmitButton
          className="btn-primary text-xs"
          pendingText="Guardando..."
          disabled={!hasChanges}
          confirmMessage={confirmMessage}
        >
          {saveButton}
        </SubmitButton>
      </FormPendingSection>
    </form>
  );
}
