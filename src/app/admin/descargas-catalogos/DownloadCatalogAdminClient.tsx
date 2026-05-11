"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Snackbar } from "@/components/admin/Snackbar";
import type { DownloadCatalogCoverStyle, DownloadCatalogItemRow } from "./actions";
import {
  applyDownloadCatalogPdfReplaceAction,
  deleteDownloadCatalogItemAction,
  registerNewDownloadCatalogItemAction,
  reorderDownloadCatalogItemsAction,
  signNewDownloadCatalogPdfAction,
  signReplaceDownloadCatalogPdfAction,
  updateDownloadCatalogItemMetaAction,
} from "./actions";

const COVER_OPTIONS: { value: DownloadCatalogCoverStyle; label: string }[] = [
  { value: "dark-blue", label: "Azul / Novedades (año)" },
  { value: "dark-stone", label: "Gris oscuro / Catálogo general" },
  { value: "light", label: "Claro / Área técnica" },
  { value: "amber", label: "Metálico / Paneles" },
  { value: "regulatory-dop", label: "DoP / CE (reglamentario)" },
];

function CatalogItemEditor({
  row,
  onDeleted,
  onMetaSaved,
  onPdfReplaced,
  setSnackbar,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
}: {
  row: DownloadCatalogItemRow;
  onDeleted: (id: string) => void;
  onMetaSaved: (next: DownloadCatalogItemRow) => void;
  onPdfReplaced: (id: string, newFileKey: string) => void;
  setSnackbar: (v: { type: "success" | "error"; message: string } | null) => void;
  onDragStartRow: () => void;
  onDragOverRow: (e: React.DragEvent) => void;
  onDropRow: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [subtitle, setSubtitle] = useState(row.subtitle ?? "");
  const [year, setYear] = useState(row.year ?? "");
  const [coverStyle, setCoverStyle] = useState<DownloadCatalogCoverStyle>(row.cover_style);
  const [fileSizeHint, setFileSizeHint] = useState(row.file_size_hint ?? "");
  const [status, setStatus] = useState<"draft" | "published">(row.status);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const metaDirty =
    title.trim() !== row.title ||
    (subtitle.trim() || "") !== (row.subtitle ?? "") ||
    (year.trim() || "") !== (row.year ?? "") ||
    coverStyle !== row.cover_style ||
    (fileSizeHint.trim() || "") !== (row.file_size_hint ?? "") ||
    status !== row.status;

  const saveMeta = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("itemId", row.id);
      fd.set("title", title);
      fd.set("subtitle", subtitle);
      fd.set("year", year);
      fd.set("coverStyle", coverStyle);
      fd.set("fileSizeHint", fileSizeHint);
      fd.set("status", status);
      await updateDownloadCatalogItemMetaAction(fd);
      onMetaSaved({
        ...row,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        year: year.trim() || null,
        cover_style: coverStyle,
        file_size_hint: fileSizeHint.trim() || null,
        status,
      });
      setSnackbar({ type: "success", message: "Datos guardados." });
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "Error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  const onPickReplace = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setSnackbar({ type: "error", message: "Elige un PDF." });
      return;
    }
    setReplacing(true);
    try {
      const signFd = new FormData();
      signFd.set("itemId", row.id);
      signFd.set("originalFileName", file.name);
      const signed = await signReplaceDownloadCatalogPdfAction(signFd);
      if (!signed.ok) throw new Error(signed.message);
      const put = await fetch(signed.putUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": signed.contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`Error al subir (HTTP ${put.status})`);
      const appFd = new FormData();
      appFd.set("itemId", row.id);
      appFd.set("newFileKey", signed.fileKey);
      appFd.set("oldFileKey", row.file_key);
      await applyDownloadCatalogPdfReplaceAction(appFd);
      onPdfReplaced(row.id, signed.fileKey);
      setSnackbar({ type: "success", message: "PDF sustituido." });
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "Error al reemplazar." });
    } finally {
      setReplacing(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar «${row.title}» del listado y el archivo en almacenamiento?`)) return;
    try {
      const fd = new FormData();
      fd.set("itemId", row.id);
      await deleteDownloadCatalogItemAction(fd);
      onDeleted(row.id);
      setSnackbar({ type: "success", message: "Eliminado." });
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo eliminar." });
    }
  };

  return (
    <li
      draggable
      onDragStart={onDragStartRow}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="cursor-grab select-none pt-2 text-slate-400" title="Arrastrar para ordenar">
          ⋮⋮
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Título (web)</span>
              <input className="input mt-1 w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Subtítulo (portada)</span>
              <input
                className="input mt-1 w-full text-sm"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Año (portada azul)</span>
              <input className="input mt-1 w-full text-sm" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Tamaño mostrado</span>
              <input
                className="input mt-1 w-full text-sm"
                value={fileSizeHint}
                onChange={(e) => setFileSizeHint(e.target.value)}
                placeholder="ej. 51 MB"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-medium text-slate-700">Estilo de portada en la web</span>
              <select
                className="input mt-1 w-full max-w-lg text-sm"
                value={coverStyle}
                onChange={(e) => setCoverStyle(e.target.value as DownloadCatalogCoverStyle)}
              >
                {COVER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Estado</span>
              <select
                className="input mt-1 w-full text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              >
                <option value="draft">Borrador (no visible en la web)</option>
                <option value="published">Publicado</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            PDF: <span className="font-mono text-slate-600">{row.file_key.split("/").pop()}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" disabled={!metaDirty || saving} onClick={() => void saveMeta()}>
              {saving ? "Guardando…" : "Guardar datos"}
            </button>
            <label className="btn-secondary inline-flex cursor-pointer items-center text-xs">
              {replacing ? "Subiendo…" : "Reemplazar PDF"}
              <input
                ref={replaceRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={replacing}
                onChange={(e) => void onPickReplace(e.target.files)}
              />
            </label>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => void remove()}>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function DownloadCatalogAdminClient({ initialItems }: { initialItems: DownloadCatalogItemRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const dragId = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const persistOrder = useCallback(async (ordered: DownloadCatalogItemRow[]) => {
    const fd = new FormData();
    fd.set("orderedIdsJson", JSON.stringify(ordered.map((x) => x.id)));
    await reorderDownloadCatalogItemsAction(fd);
    router.refresh();
  }, [router]);

  const moveItem = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = [...items];
      const i = items.findIndex((x) => x.id === fromId);
      const j = items.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...items];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((row, idx) => ({ ...row, sort_order: idx + 1 }));
      setItems(reindexed);
      try {
        await persistOrder(reindexed);
      } catch (e) {
        setItems(snapshot);
        setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [items, persistOrder]
  );

  const addPdf = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setSnackbar({ type: "error", message: "Selecciona un PDF." });
      return;
    }
    setUploading(true);
    setSnackbar(null);
    try {
      const signFd = new FormData();
      signFd.set("originalFileName", file.name);
      const signed = await signNewDownloadCatalogPdfAction(signFd);
      if (!signed.ok) throw new Error(signed.message);
      const put = await fetch(signed.putUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": signed.contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`Error al subir (HTTP ${put.status})`);
      const titleDefault = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
      const regFd = new FormData();
      regFd.set("itemId", signed.itemId);
      regFd.set("fileKey", signed.fileKey);
      regFd.set("title", titleDefault);
      regFd.set("coverStyle", "light");
      await registerNewDownloadCatalogItemAction(regFd);
      setSnackbar({ type: "success", message: "Catálogo añadido (borrador). Ajusta datos y publícalo." });
      router.refresh();
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "Error al añadir." });
    } finally {
      setUploading(false);
      if (addRef.current) addRef.current.value = "";
    }
  };

  return (
    <div className="card mt-6 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Catálogos en /descargas</h2>
      <p className="mt-1 text-sm text-slate-600">
        Solo los marcados como <strong>Publicado</strong> salen en la web. Si hay al menos uno publicado, la pestaña
        «Catálogos» usa esta lista (más la declaración DoP fija). Si no hay ninguno publicado, se mantiene el listado
        clásico del código.
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <p className="text-sm font-medium text-slate-800">Añadir PDF</p>
        <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg bg-[#1a1f3d] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50">
          {uploading ? "Subiendo…" : "Elegir PDF"}
          <input
            ref={addRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void addPdf(e.target.files)}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">Aún no hay entradas. Sube el primer PDF arriba.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((row) => (
            <CatalogItemEditor
              key={row.id}
              row={row}
              onDeleted={(id) => setItems((p) => p.filter((x) => x.id !== id))}
              onMetaSaved={(next) => setItems((p) => p.map((x) => (x.id === next.id ? next : x)))}
              onPdfReplaced={(id, newFileKey) =>
                setItems((p) => p.map((x) => (x.id === id ? { ...x, file_key: newFileKey } : x)))
              }
              setSnackbar={setSnackbar}
              onDragStartRow={() => {
                dragId.current = row.id;
              }}
              onDragOverRow={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDropRow={() => {
                const from = dragId.current;
                dragId.current = null;
                if (!from) return;
                void moveItem(from, row.id);
              }}
            />
          ))}
        </ul>
      )}
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </div>
  );
}
