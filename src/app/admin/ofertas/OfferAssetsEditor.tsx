"use client";

import { useCallback, useRef, useState } from "react";
import { Snackbar } from "@/components/admin/Snackbar";
import type { OfferAssetRow, OfferRow, SignOfferR2UploadResult } from "./actions";
import {
  deleteOfferAssetAction,
  registerOfferAssetAction,
  reorderOfferAssetsAction,
  signOfferR2UploadAction,
  updateOfferAction,
} from "./actions";

function fileIsPdf(file: File) {
  if (file.name.toLowerCase().endsWith(".pdf")) return true;
  return (file.type || "").toLowerCase().includes("pdf");
}

function fileIsImageOrPdf(file: File) {
  if (fileIsPdf(file)) return true;
  if ((file.type || "").toLowerCase().startsWith("image/")) return true;
  const n = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|tif|tiff|svg|avif|heic|heif|pdf)$/i.test(n);
}

export function OfferAssetsEditor({
  initialOffer,
  initialAssets,
  signUploadAction,
}: {
  initialOffer: OfferRow;
  initialAssets: OfferAssetRow[];
  signUploadAction: (formData: FormData) => Promise<SignOfferR2UploadResult>;
}) {
  const [title, setTitle] = useState(initialOffer.title);
  const [status, setStatus] = useState<"draft" | "published">(initialOffer.status);
  const [assets, setAssets] = useState<OfferAssetRow[]>(initialAssets);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const dragId = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistOrder = useCallback(
    async (next: OfferAssetRow[]) => {
      const fd = new FormData();
      fd.set("offerId", initialOffer.id);
      fd.set("orderedIdsJson", JSON.stringify(next.map((a) => a.id)));
      await reorderOfferAssetsAction(fd);
    },
    [initialOffer.id]
  );

  const moveItem = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const snapshot = [...assets];
      const i = assets.findIndex((x) => x.id === fromId);
      const j = assets.findIndex((x) => x.id === toId);
      if (i < 0 || j < 0) return;
      const copy = [...assets];
      const [removed] = copy.splice(i, 1);
      copy.splice(j, 0, removed);
      const reindexed = copy.map((a, idx) => ({ ...a, sort_order: idx + 1 }));
      setAssets(reindexed);
      try {
        await persistOrder(reindexed);
      } catch (e) {
        setAssets(snapshot);
        setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar el orden." });
      }
    },
    [assets, persistOrder]
  );

  const onDragStart = (id: string) => {
    dragId.current = id;
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOn = (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from) return;
    void moveItem(from, targetId);
  };

  const addFiles = async (list: FileList | File[] | null) => {
    const raw = Array.from(list || []).filter((f) => fileIsImageOrPdf(f));
    if (!raw.length) {
      if (list && Array.from(list).length) {
        setSnackbar({ type: "error", message: "Solo imágenes o PDF." });
      }
      return;
    }
    setUploading(true);
    setSnackbar(null);
    try {
      for (const file of raw) {
        const signFd = new FormData();
        signFd.set("offerId", initialOffer.id);
        signFd.set("originalFileName", file.name);
        signFd.set("mimeHint", file.type || "");
        const signed = await signUploadAction(signFd);
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
        regFd.set("offerId", initialOffer.id);
        regFd.set("fileKey", signed.fileKey);
        regFd.set("sortOrder", String(signed.sortOrder));
        regFd.set("assetType", signed.assetType);
        regFd.set("mimeType", signed.contentType);
        regFd.set("title", file.name.replace(/\.[^/.]+$/, ""));
        await registerOfferAssetAction(regFd);
      }
      setSnackbar({ type: "success", message: "Archivos añadidos." });
      window.location.reload();
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "Error al subir." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAsset = async (id: string) => {
    try {
      const fd = new FormData();
      fd.set("assetId", id);
      await deleteOfferAssetAction(fd);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSnackbar({ type: "success", message: "Eliminado." });
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo eliminar." });
    }
  };

  const saveMeta = async () => {
    try {
      const fd = new FormData();
      fd.set("offerId", initialOffer.id);
      fd.set("title", title.trim());
      fd.set("status", status);
      await updateOfferAction(fd);
      setSnackbar({ type: "success", message: "Oferta guardada." });
    } catch (e) {
      setSnackbar({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar." });
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-lg font-semibold text-slate-900">Publicación</h2>
        <p className="mt-1 text-sm text-slate-600">
          Solo las ofertas en estado <strong>Publicada</strong> y con contenido aparecen en la web. El orden de la
          lista es el orden en la página de ofertas.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Título (cabecera en la web)</span>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Estado</span>
            <select
              className="input mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            >
              <option value="draft">Borrador (no visible en la web)</option>
              <option value="published">Publicada</option>
            </select>
          </label>
        </div>
        <button type="button" className="btn-primary mt-3 text-sm" onClick={() => void saveMeta()}>
          Guardar título y estado
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Imágenes generadas con <strong>practika-pdf-creator</strong> se pueden subir aquí como PNG/JPEG o PDF.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-slate-900">Archivos</h2>
        <label
          className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50"
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
          Arrastra imágenes o PDF aquí, o haz clic para elegir
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

        <ul className="mt-4 space-y-2">
          {assets.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
              Aún no hay archivos. Sube imágenes o PDF en el orden deseado (o reordena después arrastrando).
            </li>
          ) : (
            assets.map((a) => (
              <li
                key={a.id}
                draggable
                onDragStart={() => onDragStart(a.id)}
                onDragOver={onDragOver}
                onDrop={() => onDropOn(a.id)}
                className="flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 active:cursor-grabbing"
              >
                <span className="text-slate-400 select-none" title="Arrastrar para reordenar">
                  ⋮⋮
                </span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800">
                  {a.sort_order}. {a.title || a.file_key.split("/").pop()}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.asset_type}</span>
                <button type="button" className="btn-secondary text-xs" onClick={() => void removeAsset(a.id)}>
                  Quitar
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Arrastra una fila sobre otra para colocarla en esa posición. Los cambios de orden se guardan al soltar.
        </p>
      </section>

      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </div>
  );
}
