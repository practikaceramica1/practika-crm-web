"use client";

import type { FormEvent } from "react";
import { FileUp, ImageIcon, Loader2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import type {
  SignAmbientUploadResult,
  SignR2AmbientStagingUploadResult,
  SignR2PdfUploadResult,
  UploadSeriesDocumentsResult,
} from "@/app/admin/series/actions";
import { FormPendingSection } from "./FormPendingSection";
import { Snackbar } from "./Snackbar";

const SERIES_DOCUMENTS_UPLOAD_API = "/api/admin/series/upload-documents";

/** Vercel Functions: https://vercel.com/docs/functions/limitations#request-body-size */
const VERCEL_SERVERLESS_BODY_LIMIT_BYTES = 4_500_000;

async function postSeriesDocumentsUpload(formData: FormData): Promise<UploadSeriesDocumentsResult> {
  const res = await fetch(SERIES_DOCUMENTS_UPLOAD_API, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  let json: UploadSeriesDocumentsResult;
  try {
    json = (await res.json()) as UploadSeriesDocumentsResult;
  } catch {
    const hint =
      res.status === 504 || res.status === 502
        ? " Suele indicar timeout en el servidor (archivos muy grandes o plan sin maxDuration suficiente)."
        : "";
    return { ok: false, message: `Respuesta no válida del servidor (HTTP ${res.status}).${hint}` };
  }
  if (!res.ok) {
    if (res.status === 413) {
      return {
        ok: false,
        message:
          "El servidor rechazó el cuerpo de la petición (413). En Vercel el POST a la función está limitado a ~4.5 MB: para TIFF/imágenes grandes hace falta la subida directa a R2 (staging) con R2 configurado.",
      };
    }
    return json && typeof json === "object" && "ok" in json && json.ok === false
      ? json
      : {
          ok: false,
          message: `Error al subir (HTTP ${res.status}). Si es 504, el proceso superó el tiempo máximo en producción.`,
        };
  }
  return json;
}

function readAmbientDirectThresholdBytes(): number {
  const raw = process.env.NEXT_PUBLIC_AMBIENT_DIRECT_UPLOAD_MIN_BYTES?.trim();
  if (!raw) return 2_800_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 200_000 ? n : 2_800_000;
}

/**
 * Tope de bytes que Cloudinary acepta en upload directo desde el navegador (plan free ≈ 10 MiB).
 * Por encima hay que pasar por Server Action + `prepareAmbientImageForUpload` (reescala/JPEG).
 * https://cloudinary.com/documentation/upload_images#uploading_assets
 */
function readCloudinaryDirectUploadMaxBytes(): number {
  const raw = process.env.NEXT_PUBLIC_CLOUDINARY_MAX_DIRECT_UPLOAD_BYTES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return Math.max(1_000_000, Math.min(n, 100 * 1024 * 1024));
  }
  return 10_000_000;
}

/** Subida firmada a Cloudinary manda el archivo tal cual: no usar si supera el tope del plan o conviene sharp (TIFF/HEIC grandes). */
function ambientMustUseServerPipeline(file: File): boolean {
  const maxDirect = readCloudinaryDirectUploadMaxBytes();
  if (file.size > maxDirect) return true;
  const n = file.name.toLowerCase();
  if (n.endsWith(".tif") || n.endsWith(".tiff") || n.endsWith(".heic") || n.endsWith(".heif")) {
    return file.size >= readAmbientDirectThresholdBytes();
  }
  return false;
}

function DocumentUploadSubmitButton({
  filesLength,
  beforeSubmit,
  busyOverride,
}: {
  filesLength: number;
  beforeSubmit: () => void;
  busyOverride: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = busyOverride || pending;
  return (
    <button
      type="submit"
      className="btn-primary mt-2 w-full text-xs"
      disabled={filesLength === 0 || busy}
      aria-busy={busy}
      onMouseDown={() => beforeSubmit()}
    >
      {busy ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Subiendo...
        </span>
      ) : (
        <>Subir {filesLength || 0} archivo(s)</>
      )}
    </button>
  );
}

type DocType = "technical_panel" | "catalog_pdf" | "ambient_image";

function fileIsPdf(file: File): boolean {
  if (file.name.toLowerCase().endsWith(".pdf")) return true;
  return (file.type || "").toLowerCase().includes("pdf");
}

function filterFilesByAccept(files: File[], accept: string): File[] {
  const tokens = accept.split(",").map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return files;
  return files.filter((file) =>
    tokens.some((tok) => {
      if (tok === "image/*") return file.type.startsWith("image/");
      if (tok.toLowerCase() === ".pdf" || tok === "application/pdf") {
        return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      }
      if (tok.startsWith(".")) return file.name.toLowerCase().endsWith(tok.toLowerCase());
      if (tok.endsWith("/*")) return file.type.startsWith(`${tok.slice(0, -1)}`);
      return file.type === tok;
    })
  );
}

export function DocumentDropzoneForm({
  title,
  type,
  seriesId,
  accept,
  onUploaded,
  signAmbientUpload,
  registerAmbientAsset,
  signAmbientR2StagingUpload,
  registerAmbientR2StagingAsset,
  signPdfUpload,
  registerPdfAsset,
}: {
  title: string;
  type: DocType;
  seriesId: string;
  accept: string;
  onUploaded?: (assets: Array<{ id: string; asset_type: DocType; title: string | null; file_key: string; storage_provider: string; sort_order?: number | null }>) => void;
  /** Si están definidos, los ambientes ≥ umbral se suben del navegador a Cloudinary (recomendado en Vercel). */
  signAmbientUpload?: (formData: FormData) => Promise<SignAmbientUploadResult>;
  registerAmbientAsset?: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  /** Ambientes que van por servidor (TIFF grande, etc.): PUT a R2 temporal + registro (evita POST >4.5 MB en Vercel). */
  signAmbientR2StagingUpload?: (formData: FormData) => Promise<SignR2AmbientStagingUploadResult>;
  registerAmbientR2StagingAsset?: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  /** PDF de panel/catálogo: subida firmada a R2 (evita límite de body en Server Actions). */
  signPdfUpload?: (formData: FormData) => Promise<SignR2PdfUploadResult>;
  registerPdfAsset?: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [languageCode, setLanguageCode] = useState(type === "catalog_pdf" ? "es-en" : "na");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icon = type === "ambient_image" ? <ImageIcon className="h-5 w-5" /> : <FileUp className="h-5 w-5" />;
  const total = files.reduce((sum, f) => sum + f.size, 0);

  const useAmbientDirect =
    type === "ambient_image" && typeof signAmbientUpload === "function" && typeof registerAmbientAsset === "function";

  const useAmbientR2Staging =
    type === "ambient_image" &&
    typeof signAmbientR2StagingUpload === "function" &&
    typeof registerAmbientR2StagingAsset === "function";

  const usePdfDirect =
    (type === "technical_panel" || type === "catalog_pdf") &&
    typeof signPdfUpload === "function" &&
    typeof registerPdfAsset === "function";

  const handlePickFiles = (list: FileList | null) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    const allowed = filterFilesByAccept(picked, accept);
    if (!allowed.length) {
      if (picked.length) {
        setSnackbar({
          type: "error",
          message: "Ningún archivo coincide con el tipo permitido en esta sección.",
        });
      }
      return;
    }
    setFiles((prev) => [...prev, ...allowed]);
  };

  const removeFileAt = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const syncQueuedFilesToInput = () => {
    const input = fileInputRef.current;
    if (!input || files.length === 0) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  };

  async function uploadOneAmbientViaCloudinary(file: File): Promise<UploadSeriesDocumentsResult> {
    const sign = signAmbientUpload!;
    const register = registerAmbientAsset!;

    const sfd = new FormData();
    sfd.set("seriesId", seriesId);
    sfd.set("originalFileName", file.name);
    sfd.set("mimeHint", file.type || "");
    sfd.set("languageCode", languageCode);
    const signed = await sign(sfd);
    if (!signed.ok) {
      return { ok: false, message: signed.message };
    }

    const cfd = new FormData();
    cfd.append("file", file);
    cfd.append("api_key", signed.apiKey);
    cfd.append("timestamp", String(signed.timestamp));
    cfd.append("signature", signed.signature);
    cfd.append("folder", signed.folder);
    cfd.append("public_id", signed.publicId);
    cfd.append("overwrite", "true");

    const url = `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`;
    const res = await fetch(url, { method: "POST", body: cfd });
    const data = (await res.json()) as { public_id?: string; format?: string; error?: { message?: string } };
    if (!res.ok) {
      const msg = data?.error?.message || `Cloudinary HTTP ${res.status}`;
      return { ok: false, message: msg };
    }

    const pid = String(data.public_id || "").trim();
    if (!pid) {
      return { ok: false, message: "Cloudinary no devolvió public_id." };
    }

    const mime =
      (file.type && file.type.length > 0 && file.type) ||
      (typeof data.format === "string" ? `image/${data.format}` : "image/jpeg");

    const regFd = new FormData();
    regFd.set("seriesId", seriesId);
    regFd.set("publicId", pid);
    regFd.set("assetTitle", signed.assetTitle);
    regFd.set("sortOrder", String(signed.sortOrder));
    regFd.set("languageCode", signed.languageCode);
    regFd.set("mimeType", mime);
    return register(regFd);
  }

  async function uploadOneAmbientViaR2Staging(file: File): Promise<UploadSeriesDocumentsResult> {
    const sign = signAmbientR2StagingUpload!;
    const register = registerAmbientR2StagingAsset!;

    const sfd = new FormData();
    sfd.set("seriesId", seriesId);
    sfd.set("originalFileName", file.name);
    sfd.set("mimeHint", file.type || "");
    sfd.set("languageCode", languageCode);

    const signed = await sign(sfd);
    if (!signed.ok) {
      return { ok: false, message: signed.message };
    }

    let res: Response;
    try {
      res = await fetch(signed.putUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": signed.contentType,
        },
        body: file,
      });
    } catch (err) {
      const isNetwork =
        err instanceof TypeError &&
        (err.message === "Failed to fetch" || err.message.toLowerCase().includes("network"));
      return {
        ok: false,
        message: isNetwork
          ? "El navegador bloqueó la subida a R2 (CORS o red). Revisa CORS del bucket para el origen del CRM (PUT, Content-Type). Ver https://developers.cloudflare.com/r2/buckets/cors/"
          : `Error de red al subir la imagen a almacenamiento: ${err instanceof Error ? err.message : "desconocido"}`,
      };
    }

    if (!res.ok) {
      const hint =
        res.status === 403
          ? " 403 suele ser firma incompleta o política del bucket. Revisa CORS en R2."
          : "";
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 240);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        message: `No se pudo subir la imagen temporal a R2 (HTTP ${res.status}).${hint}${detail ? ` ${detail}` : ""}`,
      };
    }

    const regFd = new FormData();
    regFd.set("seriesId", seriesId);
    regFd.set("fileKey", signed.fileKey);
    regFd.set("sortOrder", String(signed.sortOrder));
    regFd.set("languageCode", signed.languageCode);
    regFd.set("mimeHint", file.type || "");
    return register(regFd);
  }

  async function uploadOnePdfViaR2(file: File): Promise<UploadSeriesDocumentsResult> {
    const sign = signPdfUpload!;
    const register = registerPdfAsset!;

    const sfd = new FormData();
    sfd.set("seriesId", seriesId);
    sfd.set("assetType", type);
    sfd.set("originalFileName", file.name);
    sfd.set("mimeHint", file.type || "");
    sfd.set("languageCode", languageCode);

    const signed = await sign(sfd);
    if (!signed.ok) {
      return { ok: false, message: signed.message };
    }

    let res: Response;
    try {
      res = await fetch(signed.putUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": signed.contentType,
        },
        body: file,
      });
    } catch (err) {
      const isNetwork =
        err instanceof TypeError &&
        (err.message === "Failed to fetch" || err.message.toLowerCase().includes("network"));
      return {
        ok: false,
        message: isNetwork
          ? "El navegador bloqueó la subida (CORS o red). En Cloudflare R2 → bucket → CORS: AllowedOrigins = origen exacto del CRM; AllowedMethods solo GET, PUT, HEAD y/o DELETE (no OPTIONS — R2 no lo admite en la política). AllowedHeaders: Content-Type o *. Ver https://developers.cloudflare.com/r2/buckets/cors/"
          : `Error de red al subir el PDF: ${err instanceof Error ? err.message : "desconocido"}`,
      };
    }

    if (!res.ok) {
      const hint =
        res.status === 403
          ? " 403 suele ser firma incompleta (recarga y vuelve a intentar) o política del bucket. Revisa CORS (sin OPTIONS en AllowedMethods en R2)."
          : "";
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 240);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        message: `No se pudo subir el PDF a almacenamiento (HTTP ${res.status}).${hint}${detail ? ` ${detail}` : ""}`,
      };
    }

    const regFd = new FormData();
    regFd.set("seriesId", seriesId);
    regFd.set("fileKey", signed.fileKey);
    regFd.set("assetTitle", signed.assetTitle);
    regFd.set("sortOrder", String(signed.sortOrder));
    regFd.set("languageCode", signed.languageCode);
    regFd.set("assetType", signed.assetType);
    regFd.set("mimeType", signed.contentType);
    return register(regFd);
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncQueuedFilesToInput();
    if (files.length === 0) return;

    setUploading(true);
    setSnackbar(null);
    try {
      const collected: Array<{
        id: string;
        asset_type: DocType;
        title: string | null;
        file_key: string;
        storage_provider: string;
        sort_order?: number | null;
      }> = [];

      if (useAmbientDirect) {
        const threshold = readAmbientDirectThresholdBytes();
        for (const file of files) {
          let result: UploadSeriesDocumentsResult;
          if (file.size >= threshold && !ambientMustUseServerPipeline(file)) {
            result = await uploadOneAmbientViaCloudinary(file);
          } else if (useAmbientR2Staging && ambientMustUseServerPipeline(file)) {
            result = await uploadOneAmbientViaR2Staging(file);
          } else {
            if (
              ambientMustUseServerPipeline(file) &&
              !useAmbientR2Staging &&
              file.size > VERCEL_SERVERLESS_BODY_LIMIT_BYTES
            ) {
              setSnackbar({
                type: "error",
                message:
                  "Este archivo supera el límite de ~4.5 MB para subidas por API en Vercel (413). Configura R2 (mismas variables que los PDF) para poder subir TIFF/imágenes grandes: el binario va directo al bucket y el servidor solo procesa y registra.",
              });
              return;
            }
            const fd = new FormData();
            fd.set("seriesId", seriesId);
            fd.set("assetType", type);
            fd.set("languageCode", languageCode);
            fd.append("files", file);
            result = await postSeriesDocumentsUpload(fd);
          }
          if (!result.ok) {
            setSnackbar({ type: "error", message: result.message });
            return;
          }
          collected.push(...result.assets);
        }
      } else if (usePdfDirect) {
        for (const file of files) {
          let result: UploadSeriesDocumentsResult;
          if (fileIsPdf(file)) {
            result = await uploadOnePdfViaR2(file);
          } else {
            const fd = new FormData();
            fd.set("seriesId", seriesId);
            fd.set("assetType", type);
            fd.set("languageCode", languageCode);
            fd.append("files", file);
            result = await postSeriesDocumentsUpload(fd);
          }
          if (!result.ok) {
            setSnackbar({ type: "error", message: result.message });
            return;
          }
          collected.push(...result.assets);
        }
      } else {
        const fd = new FormData();
        fd.set("seriesId", seriesId);
        fd.set("assetType", type);
        fd.set("languageCode", languageCode);
        files.forEach((f) => fd.append("files", f));
        const result = await postSeriesDocumentsUpload(fd);
        if (!result.ok) {
          setSnackbar({ type: "error", message: result.message });
          return;
        }
        collected.push(...result.assets);
      }

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploaded && collected.length) onUploaded(collected);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar la subida";
      setSnackbar({ type: "error", message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="rounded-xl border border-slate-200 bg-white p-3" onSubmit={(e) => void handleSubmit(e)}>
      <FormPendingSection busy={uploading}>
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <input type="hidden" name="seriesId" value={seriesId} readOnly />
        <input type="hidden" name="assetType" value={type} readOnly />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {type === "catalog_pdf" ? (
            <select
              className="input"
              name="languageCode"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
            >
              <option value="es-en">Español + Inglés</option>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="languageCode" value="na" readOnly />
              <div className="input bg-slate-50 text-xs text-slate-500">Sin idioma (no aplica)</div>
            </>
          )}
          <div className="input bg-slate-50 text-xs text-slate-500">
            {files.length} archivo(s) · {(total / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <label
          className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
          onDragEnter={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          }}
          onDragOver={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            ev.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            handlePickFiles(ev.dataTransfer.files);
          }}
        >
          Arrastra archivos o haz clic para seleccionar
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            name="files"
            accept={accept}
            multiple
            disabled={uploading}
            onChange={(ev) => {
              handlePickFiles(ev.target.files);
              ev.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            {files.map((file, idx) => (
              <li
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center gap-2 rounded-md bg-white/80 px-1.5 py-1 text-slate-700"
              >
                <span className="min-w-0 flex-1 truncate" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Quitar ${file.name}`}
                  disabled={uploading}
                  onClick={() => removeFileAt(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <DocumentUploadSubmitButton filesLength={files.length} beforeSubmit={syncQueuedFilesToInput} busyOverride={uploading} />
      </FormPendingSection>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </form>
  );
}
