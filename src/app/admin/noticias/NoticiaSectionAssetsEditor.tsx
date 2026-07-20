"use client";

import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsSectionAssetRow } from "./actions";
import {
  deleteNewsAssetAction,
  registerNewsAssetAction,
  reorderNewsAssetsInBucketAction,
  signNewsAssetR2UploadAction,
  toggleNewsAssetFavoriteAction,
  updateNewsAssetTitleAction,
} from "./actions";

function fileIsImageOrPdf(file: File) {
  if ((file.type || "").toLowerCase().includes("pdf")) return true;
  if ((file.type || "").toLowerCase().startsWith("image/")) return true;
  const n = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|tif|tiff|svg|avif|heic|heif|pdf)$/i.test(n);
}

function partitionAssets(assets: NewsSectionAssetRow[]) {
  const fav = assets.filter((a) => a.is_favorite).sort((x, y) => x.ordinal - y.ordinal);
  const std = assets.filter((a) => !a.is_favorite).sort((x, y) => x.ordinal - y.ordinal);
  return { favorites: fav, standard: std };
}

function EditableAssetRow({
  a,
  bucket,
  onDragStart,
  onDragOver,
  onDropOn,
  onToggleFav,
  onRemove,
  onTitleSaved,
}: {
  a: NewsSectionAssetRow;
  bucket: "favorite" | "standard";
  onDragStart: (id: string, bucket: "favorite" | "standard") => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropOn: (targetId: string, bucket: "favorite" | "standard") => void;
  onToggleFav: (id: string) => void;
  onRemove: (id: string) => void;
  onTitleSaved: (id: string, title: string | null) => void;
}) {
  const { notify } = useAdminSnackbar();
  const [draft, setDraft] = useState(a.title ?? "");
  useEffect(() => {
    setDraft(a.title ?? "");
  }, [a.id, a.title]);

  const baseline = (a.title ?? "").trim();
  const dirty = draft.trim() !== baseline;
  const fileHint = a.file_key.split("/").pop() || a.file_key;

  const saveTitle = async () => {
    try {
      const fd = new FormData();
      fd.set("assetId", a.id);
      fd.set("title", draft);
      await updateNewsAssetTitleAction(fd);
      onTitleSaved(a.id, draft.trim() || null);
      notify({ type: "success", message: "Título guardado." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el título." });
    }
  };

  return (
    <li
      draggable
      onDragStart={() => onDragStart(a.id, bucket)}
      onDragOver={onDragOver}
      onDrop={() => onDropOn(a.id, bucket)}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-center lg:pt-1">
          <span className="cursor-grab select-none text-slate-400" title="Arrastrar para reordenar">
            ⋮⋮
          </span>
          <span className="text-xs font-semibold tabular-nums text-slate-500">{a.ordinal}.</span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">Título en la web</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="input flex-1 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={240}
                placeholder="Ej. Campaña primavera, Proyecto en Valencia…"
                aria-label="Título visible en la web"
              />
              <button
                type="button"
                className="btn-primary shrink-0 px-3 py-2 text-xs disabled:pointer-events-none disabled:opacity-35"
                disabled={!dirty}
                onClick={() => void saveTitle()}
              >
                Guardar título
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Se muestra bajo la imagen o como encabezado del PDF. Si lo dejas vacío, en la lista se usa el nombre del
              archivo: <span className="font-mono text-slate-600">{fileHint}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-2 lg:flex-col lg:items-stretch lg:border-0 lg:pt-1">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-center text-xs text-slate-600">{a.asset_type}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => void onToggleFav(a.id)}>
            {a.is_favorite ? "Quitar destacado" : "Destacar"}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={() => void onRemove(a.id)}>
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

export function NoticiaSectionAssetsEditor({
  sectionId,
  initialAssets,
}: {
  sectionId: string;
  initialAssets: NewsSectionAssetRow[];
}) {
  const { favorites: initialFav, standard: initialStd } = useMemo(
    () => partitionAssets(initialAssets),
    [initialAssets]
  );
  const [favorites, setFavorites] = useState(initialFav);
  const [standard, setStandard] = useState(initialStd);
  const { notify } = useAdminSnackbar();
  const [uploading, setUploading] = useState(false);
  const [uploadBucket, setUploadBucket] = useState<"favorite" | "standard">("standard");
  const dragId = useRef<string | null>(null);
  const dragBucket = useRef<"favorite" | "standard" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistBucketOrder = useCallback(
    async (bucket: "favorite" | "standard", orderedIds: string[]) => {
      const fd = new FormData();
      fd.set("sectionId", sectionId);
      fd.set("isFavorite", bucket === "favorite" ? "true" : "false");
      fd.set("orderedIdsJson", JSON.stringify(orderedIds));
      await reorderNewsAssetsInBucketAction(fd);
    },
    [sectionId]
  );

  const moveWithin = useCallback(
    async (bucket: "favorite" | "standard", fromId: string, toId: string, list: NewsSectionAssetRow[], setList: (v: NewsSectionAssetRow[]) => void) => {
      if (fromId === toId) return;
      const snapshot = [...list];
      const i = list.findIndex((x) => x.id === fromId);
      const j = list.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...list];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((a, idx) => ({ ...a, ordinal: idx + 1 }));
      setList(reindexed);
      try {
        await persistBucketOrder(bucket, reindexed.map((a) => a.id));
      } catch (e) {
        setList(snapshot);
        notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [persistBucketOrder]
  );

  const onDragStart = (id: string, bucket: "favorite" | "standard") => {
    dragId.current = id;
    dragBucket.current = bucket;
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOn = (targetId: string, bucket: "favorite" | "standard") => {
    const from = dragId.current;
    const fromB = dragBucket.current;
    dragId.current = null;
    dragBucket.current = null;
    if (!from || fromB !== bucket) return;
    if (bucket === "favorite") void moveWithin("favorite", from, targetId, favorites, setFavorites);
    else void moveWithin("standard", from, targetId, standard, setStandard);
  };

  const addFiles = async (list: FileList | File[] | null) => {
    const raw = Array.from(list || []).filter((f) => fileIsImageOrPdf(f));
    if (!raw.length) {
      if (list && Array.from(list).length) notify({ type: "error", message: "Solo imágenes o PDF." });
      return;
    }
    setUploading(true);
    const bucket = uploadBucket;
    try {
      for (const file of raw) {
        const signFd = new FormData();
        signFd.set("sectionId", sectionId);
        signFd.set("originalFileName", file.name);
        signFd.set("mimeHint", file.type || "");
        signFd.set("bucket", bucket);
        const signed = await signNewsAssetR2UploadAction(signFd);
        if (!signed.ok) throw new Error(signed.message);

        const put = await fetch(signed.putUrl, {
          method: "PUT",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": signed.contentType },
          body: file,
        });
        if (!put.ok) {
          const detail = await put.text().catch(() => "");
          throw new Error(`Error al subir (HTTP ${put.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
        }

        const regFd = new FormData();
        regFd.set("sectionId", sectionId);
        regFd.set("fileKey", signed.fileKey);
        regFd.set("ordinal", String(signed.ordinal));
        regFd.set("assetType", signed.assetType);
        regFd.set("mimeType", signed.contentType);
        regFd.set("title", file.name.replace(/\.[^/.]+$/, ""));
        regFd.set("isFavorite", bucket === "favorite" ? "true" : "false");
        await registerNewsAssetAction(regFd);
      }
      notify({ type: "success", message: "Archivos añadidos." });
      window.location.reload();
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "Error al subir." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAsset = async (id: string) => {
    try {
      const fd = new FormData();
      fd.set("assetId", id);
      await deleteNewsAssetAction(fd);
      setFavorites((p) => p.filter((x) => x.id !== id));
      setStandard((p) => p.filter((x) => x.id !== id));
      notify({ type: "success", message: "Eliminado." });
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo eliminar." });
    }
  };

  const toggleFav = async (id: string) => {
    try {
      const fd = new FormData();
      fd.set("assetId", id);
      await toggleNewsAssetFavoriteAction(fd);
      window.location.reload();
    } catch (e) {
      notify({ type: "error", message: e instanceof Error ? e.message : "No se pudo actualizar." });
    }
  };

  const patchAssetTitle = useCallback((id: string, title: string | null) => {
    setFavorites((p) => p.map((x) => (x.id === id ? { ...x, title } : x)));
    setStandard((p) => p.map((x) => (x.id === id ? { ...x, title } : x)));
  }, []);

  const renderRow = (a: NewsSectionAssetRow, bucket: "favorite" | "standard") => (
    <EditableAssetRow
      key={a.id}
      a={a}
      bucket={bucket}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDropOn={onDropOn}
      onToggleFav={toggleFav}
      onRemove={removeAsset}
      onTitleSaved={patchAssetTitle}
    />
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <p className="text-sm font-semibold text-slate-800">Subir archivos</p>
        <p className="mt-1 text-xs text-slate-600">
          Elige si van a <strong>Destacados</strong> (se muestran primero en la web) o al bloque general.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-700">
            Destino
            <select
              className="input ml-2 max-w-[14rem] text-xs"
              value={uploadBucket}
              onChange={(e) => setUploadBucket(e.target.value as "favorite" | "standard")}
            >
              <option value="standard">Bloque general</option>
              <option value="favorite">Destacados</option>
            </select>
          </label>
        </div>
        <label
          className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50/50"
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void addFiles(e.dataTransfer.files);
          }}
        >
          Arrastra imágenes o PDF aquí, o haz clic
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void addFiles(e.target.files)}
          />
        </label>
        {uploading ? <p className="mt-2 text-sm text-indigo-600">Subiendo…</p> : null}
      </div>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Destacados</h3>
          <span className="text-xs text-slate-500">Orden en la web: arriba del todo en esta sección</span>
        </div>
        <ul className="mt-2 space-y-2">
          {favorites.length === 0 ? (
            <li className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 px-3 py-4 text-center text-sm text-amber-900/80">
              Sin destacados. Sube archivos con destino «Destacados» o pulsa «Destacar» en un archivo del bloque
              general.
            </li>
          ) : (
            favorites.map((a) => renderRow(a, "favorite"))
          )}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Bloque general</h3>
          <span className="text-xs text-slate-500">Tras los destacados, mismo orden que aquí</span>
        </div>
        <ul className="mt-2 space-y-2">
          {standard.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              Sin archivos en el bloque general.
            </li>
          ) : (
            standard.map((a) => renderRow(a, "standard"))
          )}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        <Link href="/admin/noticias" className="text-indigo-600 hover:underline">
          ← Volver a secciones
        </Link>
      </p>
    </div>
  );
}
