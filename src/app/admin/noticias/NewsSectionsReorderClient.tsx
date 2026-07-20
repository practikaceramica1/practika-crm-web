"use client";

import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { NewsSectionRow } from "./actions";
import { deleteNewsSectionAction, reorderNewsSectionsAction } from "./actions";

export default function NewsSectionsReorderClient({ initialSections }: { initialSections: NewsSectionRow[] }) {
  const [sections, setSections] = useState(initialSections);
  const { notify } = useAdminSnackbar();
  const dragId = useRef<string | null>(null);

  const persistOrder = useCallback(async (next: NewsSectionRow[]) => {
    const fd = new FormData();
    fd.set("orderedIdsJson", JSON.stringify(next.map((s) => s.id)));
    await reorderNewsSectionsAction(fd);
  }, []);

  const moveItem = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = [...sections];
      const i = sections.findIndex((x) => x.id === fromId);
      const j = sections.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...sections];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((s, idx) => ({ ...s, sort_order: idx + 1 }));
      setSections(reindexed);
      try {
        await persistOrder(reindexed);
      } catch (e) {
        setSections(snapshot);
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [sections, persistOrder]
  );

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`¿Eliminar la sección «${title}» y todos sus archivos?`)) return;
    try {
      const fd = new FormData();
      fd.set("sectionId", id);
      await deleteNewsSectionAction(fd);
      setSections((p) => p.filter((s) => s.id !== id));
      notify({ type: "success", message: "Sección eliminada." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo eliminar." });
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-slate-900">Secciones</h2>
      <p className="mt-1 text-sm text-slate-600">Arrastra para ordenar cómo aparecen en la web (de arriba a abajo).</p>
      <ul className="mt-4 space-y-2">
        {sections.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={() => {
              dragId.current = s.id;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={() => {
              const from = dragId.current;
              dragId.current = null;
              if (!from) return;
              void moveItem(from, s.id);
            }}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
          >
            <span className="cursor-grab text-slate-400 select-none" title="Arrastrar">
              ⋮⋮
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{s.title}</p>
              <p className="truncate text-xs text-slate-500">
                /{s.slug} · {s.status === "published" ? "Publicada" : "Borrador"}
              </p>
            </div>
            <Link href={`/admin/noticias/${s.id}`} className="btn-secondary text-xs">
              Editar
            </Link>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => void remove(s.id, s.title)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
