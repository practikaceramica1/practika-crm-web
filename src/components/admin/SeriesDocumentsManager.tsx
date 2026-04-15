"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import type {
  SignAmbientUploadResult,
  SignR2PdfUploadResult,
  UploadSeriesDocumentsResult,
} from "@/app/admin/series/actions";
import { DocumentDropzoneForm } from "./DocumentDropzoneForm";
import { Snackbar } from "./Snackbar";

type AssetType = "technical_panel" | "catalog_pdf" | "ambient_image";

type AssetRow = {
  id: string;
  asset_type: AssetType;
  title: string | null;
  file_key: string;
  storage_provider: string;
  sort_order?: number | null;
  publicUrl?: string;
};

const SECTION_LABELS: Record<AssetType, string> = {
  technical_panel: "Paneles técnicos",
  catalog_pdf: "Catálogos PDF",
  ambient_image: "Ambientes",
};

/** PDF e imágenes en las tres zonas de documentos (mismo criterio que el servidor). */
const SERIES_DOCUMENT_FILE_ACCEPT =
  "application/pdf,.pdf,image/*,.png,.jpg,.jpeg,.jpe,.webp,.gif,.tif,.tiff,.bmp,.svg,.avif,.heic,.heif";

function buildPublicUrl(
  storageProvider: string,
  fileKey: string,
  r2BaseUrl: string,
  cloudinaryCloudName: string
): string {
  if (!fileKey) return "";
  if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) return fileKey;
  const cleanKey = fileKey.replace(/^\/+/, "");
  const p = storageProvider.toLowerCase();
  const isCloudinary = p === "cloudinary" || (!p && cleanKey.startsWith("practika/"));
  if (isCloudinary) {
    if (!cloudinaryCloudName) return "";
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto/${cleanKey}`;
  }
  if (!r2BaseUrl) return "";
  return `${r2BaseUrl.replace(/\/$/, "")}/${cleanKey}`;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function SeriesDocumentsManager({
  seriesId,
  r2BaseUrl,
  cloudinaryCloudName,
  initialAssets,
  uploadAction,
  ambientSignAction,
  ambientRegisterAction,
  pdfSignAction,
  pdfRegisterAction,
  renameAction,
  deleteAction,
}: {
  seriesId: string;
  r2BaseUrl: string;
  cloudinaryCloudName: string;
  initialAssets: AssetRow[];
  uploadAction: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  /** Subida firmada a Cloudinary desde el navegador (evita límite de body en producción). */
  ambientSignAction?: (formData: FormData) => Promise<SignAmbientUploadResult>;
  ambientRegisterAction?: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  /** Subida firmada a R2 (PDF panel/catálogo) desde el navegador. */
  pdfSignAction?: (formData: FormData) => Promise<SignR2PdfUploadResult>;
  pdfRegisterAction?: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  renameAction: (formData: FormData) => Promise<{ asset: AssetRow }>;
  deleteAction: (formData: FormData) => Promise<{ assetId: string }>;
}) {
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [editingName, setEditingName] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const resolveUrl = (asset: AssetRow) =>
    asset.publicUrl || buildPublicUrl(asset.storage_provider, asset.file_key, r2BaseUrl, cloudinaryCloudName);

  const grouped = useMemo(
    () => ({
      technical_panel: assets.filter((a) => a.asset_type === "technical_panel"),
      catalog_pdf: assets.filter((a) => a.asset_type === "catalog_pdf"),
      ambient_image: assets.filter((a) => a.asset_type === "ambient_image"),
    }),
    [assets]
  );

  const upsertAssets = (nextAssets: AssetRow[]) => {
    setAssets((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      nextAssets.forEach((a) => map.set(a.id, a));
      return Array.from(map.values()).sort((a, b) => Number(b.sort_order || 0) - Number(a.sort_order || 0));
    });
  };

  const handleRename = async (asset: AssetRow) => {
    const value = (editingName[asset.id] ?? asset.title ?? "").trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("assetId", asset.id);
    fd.set("newName", value);
    setPending((p) => ({ ...p, [asset.id]: true }));
    try {
      const result = await renameAction(fd);
      upsertAssets([result.asset]);
      setSnackbar({ type: "success", message: "Archivo renombrado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo renombrar el archivo";
      setSnackbar({ type: "error", message });
    } finally {
      setPending((p) => ({ ...p, [asset.id]: false }));
    }
  };

  const handleDelete = async (asset: AssetRow) => {
    const fd = new FormData();
    fd.set("assetId", asset.id);
    setPending((p) => ({ ...p, [asset.id]: true }));
    try {
      await deleteAction(fd);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setSnackbar({ type: "success", message: "Archivo eliminado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el archivo";
      setSnackbar({ type: "error", message });
    } finally {
      setPending((p) => ({ ...p, [asset.id]: false }));
    }
  };

  const handleDownloadAll = (type: AssetType) => {
    const items = grouped[type];
    items.forEach((asset, i) => {
      const url = resolveUrl(asset);
      if (!url) return;
      setTimeout(() => triggerDownload(url, asset.title || asset.file_key.split("/").pop() || `file-${i}`), i * 300);
    });
  };

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Subidas directas</h2>
          <p className="mt-1 text-sm text-slate-500">
            En cada sección puedes subir PDF o imagen (JPEG, PNG, WebP, TIFF, etc.). Nombres automáticos: serie + sección + numeración.
            Los PDF de panel y catálogo se suben directamente a R2 desde el navegador (sin límite de tamaño del servidor). Si falla el PUT,
            revisa CORS del bucket R2 para el origen de este CRM. Las imágenes de más de ~10&nbsp;MB o TIFF/HEIC grandes van por el servidor (compresión) para respetar el límite de Cloudinary en subida directa; no hace falta CORS extra en Cloudinary.
          </p>
          <div className="mt-4 grid gap-3">
            <DocumentDropzoneForm
              title="Panel técnico"
              type="technical_panel"
              seriesId={seriesId}
              accept={SERIES_DOCUMENT_FILE_ACCEPT}
              action={uploadAction}
              signPdfUpload={pdfSignAction}
              registerPdfAsset={pdfRegisterAction}
              onUploaded={(newAssets) => {
                upsertAssets(newAssets);
                setSnackbar({ type: "success", message: "Panel técnico subido" });
              }}
            />
            <DocumentDropzoneForm
              title="PDF serie / catálogo"
              type="catalog_pdf"
              seriesId={seriesId}
              accept={SERIES_DOCUMENT_FILE_ACCEPT}
              action={uploadAction}
              signPdfUpload={pdfSignAction}
              registerPdfAsset={pdfRegisterAction}
              onUploaded={(newAssets) => {
                upsertAssets(newAssets);
                setSnackbar({ type: "success", message: "Catálogo subido" });
              }}
            />
            <DocumentDropzoneForm
              title="Ambientes"
              type="ambient_image"
              seriesId={seriesId}
              accept={SERIES_DOCUMENT_FILE_ACCEPT}
              action={uploadAction}
              signAmbientUpload={ambientSignAction}
              registerAmbientAsset={ambientRegisterAction}
              onUploaded={(newAssets) => {
                upsertAssets(newAssets);
                setSnackbar({ type: "success", message: "Ambientes subidos" });
              }}
            />
          </div>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Documentos cargados</h2>
          <div className="mt-3 space-y-3 text-sm">
            {(["technical_panel", "catalog_pdf", "ambient_image"] as AssetType[]).map((type) => (
              <div key={type} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {SECTION_LABELS[type]} ({grouped[type].length})
                  </p>
                  {grouped[type].length > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-150 hover:-translate-y-px hover:bg-slate-50 active:scale-[0.98]"
                      onClick={() => handleDownloadAll(type)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar todo
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {grouped[type].map((asset) => {
                    const publicUrl = resolveUrl(asset);
                    return (
                      <div key={asset.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                          <input
                            className="input"
                            value={editingName[asset.id] ?? asset.title ?? ""}
                            onChange={(e) => setEditingName((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                            disabled={pending[asset.id]}
                          />
                          <div className="flex items-center gap-1.5">
                            {publicUrl && (
                              <>
                                <a
                                  href={publicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition-all duration-150 hover:-translate-y-px hover:bg-slate-50 hover:text-indigo-600 active:scale-[0.98]"
                                  title="Abrir en nueva pestaña"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition-all duration-150 hover:-translate-y-px hover:bg-slate-50 hover:text-indigo-600 active:scale-[0.98]"
                                  title="Descargar"
                                  onClick={() =>
                                    triggerDownload(publicUrl, asset.title || asset.file_key.split("/").pop() || "file")
                                  }
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={
                                pending[asset.id] ||
                                (editingName[asset.id] ?? asset.title ?? "").trim().length === 0 ||
                                (editingName[asset.id] ?? asset.title ?? "").trim() === (asset.title ?? "").trim()
                              }
                              onClick={() => {
                                const nextName = (editingName[asset.id] ?? asset.title ?? "").trim();
                                const ok = window.confirm(`¿Renombrar archivo a "${nextName}"?`);
                                if (!ok) return;
                                void handleRename(asset);
                              }}
                            >
                              Renombrar
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-all duration-150 hover:-translate-y-px hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={pending[asset.id]}
                              onClick={() => {
                                const ok = window.confirm(
                                  `¿Eliminar archivo "${asset.title || asset.file_key}"?`
                                );
                                if (!ok) return;
                                void handleDelete(asset);
                              }}
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {grouped[type].length === 0 ? <p className="text-slate-500">Sin documentos.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </>
  );
}
