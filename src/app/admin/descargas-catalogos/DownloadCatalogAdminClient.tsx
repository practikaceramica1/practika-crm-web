"use client";

import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogLang, CatalogTranslations, DownloadCatalogItemRow } from "./downloadCatalogTypes";
import { CATALOG_EXTRA_LANGS } from "./downloadCatalogTypes";
import {
  applyDownloadCatalogPdfReplaceAction,
  deleteDownloadCatalogItemAction,
  registerNewDownloadCatalogItemAction,
  reorderDownloadCatalogItemsAction,
  signNewDownloadCatalogPdfAction,
  signReplaceDownloadCatalogPdfAction,
  updateDownloadCatalogItemMetaAction,
} from "./actions";

const ALL_LANGS: { code: "es" | CatalogLang; label: string; name: string }[] = [
  { code: "es", label: "ES", name: "Español" },
  { code: "en", label: "EN", name: "English" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "pt", label: "PT", name: "Português" },
];

type LangState = { title: string; subtitle: string };
type TranslationDraft = { es: LangState } & { [K in CatalogLang]: LangState };

function buildDraft(row: DownloadCatalogItemRow): TranslationDraft {
  const draft = {
    es: { title: row.title, subtitle: row.subtitle ?? "" },
  } as TranslationDraft;
  for (const lang of CATALOG_EXTRA_LANGS) {
    draft[lang] = {
      title: row.translations?.[lang]?.title ?? "",
      subtitle: row.translations?.[lang]?.subtitle ?? "",
    };
  }
  return draft;
}

function draftToTranslationsJson(draft: TranslationDraft): string {
  const out: CatalogTranslations = {};
  for (const lang of CATALOG_EXTRA_LANGS) {
    const e = draft[lang];
    if (e.title.trim() || e.subtitle.trim()) {
      out[lang] = { title: e.title.trim(), subtitle: e.subtitle.trim() };
    }
  }
  return JSON.stringify(out);
}

/** Mini portada Practika – mismo diseño que la web */
function CatalogCoverPreview({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col relative select-none">
      {/* top amber accent */}
      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-amber-400 to-amber-500" />
      {/* brand */}
      <div className="flex-shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-[10px] font-bold tracking-[0.3em] text-[#1a1f3d] uppercase">PRACTIKA</p>
        <p className="text-[8px] tracking-[0.2em] text-slate-400 mt-0.5 uppercase">cerámica</p>
      </div>
      {/* content */}
      <div className="flex flex-1 flex-col justify-center px-4 py-4">
        <span className="mb-2 inline-block w-8 h-0.5 bg-amber-400" />
        <p className="text-xs font-bold leading-tight text-[#1a1f3d] break-words">
          {title || <span className="text-slate-300 italic">Título</span>}
        </p>
        {subtitle ? (
          <p className="mt-1.5 text-[10px] text-slate-500 uppercase tracking-wide leading-tight break-words">
            {subtitle}
          </p>
        ) : null}
      </div>
      {/* bottom strip */}
      <div className="flex-shrink-0 h-0.5 bg-[#1a1f3d]/10" />
    </div>
  );
}

function CatalogItemEditor({
  row,
  onDeleted,
  onMetaSaved,
  onPdfReplaced,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
}: {
  row: DownloadCatalogItemRow;
  onDeleted: (id: string) => void;
  onMetaSaved: (next: DownloadCatalogItemRow) => void;
  onPdfReplaced: (id: string, newFileKey: string) => void;
  onDragStartRow: () => void;
  onDragOverRow: (e: React.DragEvent) => void;
  onDropRow: () => void;
}) {
  const { notify } = useAdminSnackbar();
  const [activeLang, setActiveLang] = useState<"es" | CatalogLang>("es");
  const [draft, setDraft] = useState<TranslationDraft>(() => buildDraft(row));
  const [fileSizeHint, setFileSizeHint] = useState(row.file_size_hint ?? "");
  const [status, setStatus] = useState<"draft" | "published">(row.status);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const saved: TranslationDraft = buildDraft(row);
  const metaDirty =
    JSON.stringify(draft) !== JSON.stringify(saved) ||
    (fileSizeHint.trim() || "") !== (row.file_size_hint ?? "") ||
    status !== row.status;

  const setField = (lang: "es" | CatalogLang, field: "title" | "subtitle", value: string) => {
    setDraft((p) => ({ ...p, [lang]: { ...p[lang], [field]: value } }));
  };

  const saveMeta = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("itemId", row.id);
      fd.set("title", draft.es.title);
      fd.set("subtitle", draft.es.subtitle);
      fd.set("fileSizeHint", fileSizeHint);
      fd.set("status", status);
      fd.set("translationsJson", draftToTranslationsJson(draft));
      await updateDownloadCatalogItemMetaAction(fd);
      onMetaSaved({
        ...row,
        title: draft.es.title.trim(),
        subtitle: draft.es.subtitle.trim() || null,
        file_size_hint: fileSizeHint.trim() || null,
        status,
        translations: JSON.parse(draftToTranslationsJson(draft)) as CatalogTranslations,
      });
      notify({ type: "success", message: "Datos guardados." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "Error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  const onPickReplace = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      notify({ type: "error", message: "Elige un PDF." });
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
      notify({ type: "success", message: "PDF sustituido." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "Error al reemplazar." });
    } finally {
      setReplacing(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar «${row.title}»?`)) return;
    try {
      const fd = new FormData();
      fd.set("itemId", row.id);
      await deleteDownloadCatalogItemAction(fd);
      onDeleted(row.id);
      notify({ type: "success", message: "Eliminado." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo eliminar." });
    }
  };

  return (
    <li
      draggable
      onDragStart={onDragStartRow}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row">
        {/* Drag handle + preview column */}
        <div className="flex items-start gap-3 p-4 lg:w-52 lg:flex-col lg:items-center lg:border-r lg:border-slate-100 lg:bg-slate-50/60">
          <span
            className="cursor-grab select-none text-slate-300 lg:hidden"
            title="Arrastrar para ordenar"
          >
            ⋮⋮
          </span>
          <span
            className="hidden cursor-grab select-none text-slate-300 lg:block"
            title="Arrastrar para ordenar"
          >
            ⋮⋮
          </span>
          <div className="w-full max-w-[160px] mx-auto">
            <CatalogCoverPreview title={draft.es.title} subtitle={draft.es.subtitle || undefined} />
          </div>
          <p className="mt-1 text-center text-[10px] text-slate-400 hidden lg:block">Vista previa</p>
        </div>

        {/* Fields column */}
        <div className="flex-1 p-4 space-y-4">
          {/* Language tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-3">
            {ALL_LANGS.map((l) => {
              const hasContent =
                l.code === "es"
                  ? !!draft.es.title
                  : !!(draft[l.code as CatalogLang]?.title);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setActiveLang(l.code)}
                  title={l.name}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeLang === l.code
                      ? "bg-[#1a1f3d] text-white shadow-sm"
                      : hasContent
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
            <span className="ml-auto self-center text-[10px] text-slate-400">
              {activeLang === "es" ? "Principal (siempre requerido)" : `Traducción ${ALL_LANGS.find((l) => l.code === activeLang)?.name}`}
            </span>
          </div>

          {/* Title + subtitle for active language */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Título {activeLang !== "es" && <span className="text-slate-400">(opcional)</span>}
              </span>
              <input
                className="input mt-1 w-full text-sm"
                value={draft[activeLang].title}
                onChange={(e) => setField(activeLang, "title", e.target.value)}
                placeholder={
                  activeLang === "es"
                    ? "ej. Catálogo General 2026"
                    : `ej. ${activeLang === "en" ? "General Catalog 2026" : activeLang === "fr" ? "Catalogue Général 2026" : activeLang === "de" ? "Hauptkatalog 2026" : "Catálogo Geral 2026"}`
                }
                maxLength={240}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Subtítulo <span className="text-slate-400">(opcional)</span></span>
              <input
                className="input mt-1 w-full text-sm"
                value={draft[activeLang].subtitle}
                onChange={(e) => setField(activeLang, "subtitle", e.target.value)}
                placeholder={activeLang === "es" ? "ej. Edición 2026" : ""}
                maxLength={240}
              />
            </label>
          </div>

          {/* Shared fields */}
          <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Tamaño del PDF</span>
              <input
                className="input mt-1 w-full text-sm"
                value={fileSizeHint}
                onChange={(e) => setFileSizeHint(e.target.value)}
                placeholder="ej. 51 MB"
                maxLength={32}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Estado</span>
              <select
                className="input mt-1 w-full text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              >
                <option value="draft">Borrador (no visible en web)</option>
                <option value="published">Publicado</option>
              </select>
            </label>
          </div>

          <p className="text-[11px] text-slate-400">
            Archivo: <span className="font-mono text-slate-500">{row.file_key.split("/").pop()}</span>
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={!metaDirty || saving}
              onClick={() => void saveMeta()}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
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
            <button type="button" className="text-xs text-red-600 hover:underline ml-auto" onClick={() => void remove()}>
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
  const { notify } = useAdminSnackbar();
  const dragId = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const persistOrder = useCallback(
    async (ordered: DownloadCatalogItemRow[]) => {
      const fd = new FormData();
      fd.set("orderedIdsJson", JSON.stringify(ordered.map((x) => x.id)));
      await reorderDownloadCatalogItemsAction(fd);
      router.refresh();
    },
    [router]
  );

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
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [items, persistOrder]
  );

  const addPdf = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      notify({ type: "error", message: "Selecciona un PDF." });
      return;
    }
    setUploading(true);
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
      const titleDefault = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
      if (!titleDefault) throw new Error("El nombre del PDF no es válido.");
      const regFd = new FormData();
      regFd.set("itemId", signed.itemId);
      regFd.set("fileKey", signed.fileKey);
      regFd.set("title", titleDefault.slice(0, 240));
      const registered = await registerNewDownloadCatalogItemAction(regFd);
      if (!registered.ok) throw new Error(registered.message);
      notify({ type: "success", message: "PDF añadido (borrador). Edita el título, traducciones y publícalo." });
      router.refresh();
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "Error al añadir." });
    } finally {
      setUploading(false);
      if (addRef.current) addRef.current.value = "";
    }
  };

  return (
    <div className="card mt-6 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Catálogos en /descargas</h2>
      <p className="mt-1 text-sm text-slate-600">
        Solo los <strong>Publicados</strong> aparecen en la web. Si hay al menos uno publicado, la pestaña «Catálogos»
        usa esta lista (más la declaración DoP fija). Arrastra las tarjetas para reordenar.
      </p>

      {/* Add PDF */}
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <p className="mb-2 text-sm font-medium text-slate-800">Añadir catálogo</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1a1f3d] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {uploading ? "Subiendo…" : "Subir PDF"}
          <input
            ref={addRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void addPdf(e.target.files)}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Después de subir, edita el título en cada idioma y márcalo como Publicado.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">Aún no hay entradas. Sube el primer PDF arriba.</p>
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
    </div>
  );
}
