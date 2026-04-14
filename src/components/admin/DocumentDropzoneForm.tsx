"use client";

import { FileUp, ImageIcon, Loader2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import type { UploadSeriesDocumentsResult } from "@/app/admin/series/actions";
import { FormPendingSection } from "./FormPendingSection";
import { Snackbar } from "./Snackbar";

function DocumentUploadSubmitButton({
  filesLength,
  beforeSubmit,
}: {
  filesLength: number;
  beforeSubmit: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary mt-2 w-full text-xs"
      disabled={filesLength === 0 || pending}
      aria-busy={pending}
      onMouseDown={() => beforeSubmit()}
    >
      {pending ? (
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

export function DocumentDropzoneForm({
  title,
  type,
  seriesId,
  accept,
  action,
  onUploaded,
}: {
  title: string;
  type: DocType;
  seriesId: string;
  accept: string;
  action: (formData: FormData) => Promise<UploadSeriesDocumentsResult>;
  onUploaded?: (assets: Array<{ id: string; asset_type: DocType; title: string | null; file_key: string; storage_provider: string; sort_order?: number | null }>) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [languageCode, setLanguageCode] = useState(type === "catalog_pdf" ? "es-en" : "na");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icon = type === "ambient_image" ? <ImageIcon className="h-5 w-5" /> : <FileUp className="h-5 w-5" />;
  const total = files.reduce((sum, f) => sum + f.size, 0);

  const handlePickFiles = (list: FileList | null) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked]);
  };

  const removeFileAt = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Next.js serializa mal los File si se arma FormData a mano; el submit nativo necesita el input. */
  const syncQueuedFilesToInput = () => {
    const input = fileInputRef.current;
    if (!input || files.length === 0) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  };

  const submitAction = async (formData: FormData) => {
    try {
      const result = await action(formData);
      if (!result.ok) {
        setSnackbar({ type: "error", message: result.message });
        return;
      }
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploaded && result.assets.length) onUploaded(result.assets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la subida";
      setSnackbar({ type: "error", message });
    }
  };

  return (
    <form
      action={submitAction}
      className="rounded-xl border border-slate-200 bg-white p-3"
      onSubmit={() => {
        syncQueuedFilesToInput();
      }}
    >
      <FormPendingSection>
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <input
          type="hidden"
          name="seriesId"
          value={seriesId}
        />
        <input type="hidden" name="assetType" value={type} />
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
              <input type="hidden" name="languageCode" value="na" />
              <div className="input bg-slate-50 text-xs text-slate-500">Sin idioma (no aplica)</div>
            </>
          )}
          <div className="input bg-slate-50 text-xs text-slate-500">
            {files.length} archivo(s) · {(total / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700">
          Arrastra archivos o haz clic para seleccionar
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            name="files"
            accept={accept}
            multiple
            onChange={(e) => {
              handlePickFiles(e.target.files);
              e.target.value = "";
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
                  onClick={() => removeFileAt(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <DocumentUploadSubmitButton filesLength={files.length} beforeSubmit={syncQueuedFilesToInput} />
      </FormPendingSection>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </form>
  );
}
