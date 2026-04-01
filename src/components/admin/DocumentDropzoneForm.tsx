"use client";

import { FileUp, ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import { FormPendingSection } from "./FormPendingSection";
import { Snackbar } from "./Snackbar";
import { SubmitButton } from "./SubmitButton";

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
  action: (formData: FormData) => Promise<{ assets?: Array<{ id: string; asset_type: DocType; title: string | null; file_key: string; storage_provider: string; sort_order?: number | null }> }>;
  onUploaded?: (assets: Array<{ id: string; asset_type: DocType; title: string | null; file_key: string; storage_provider: string; sort_order?: number | null }>) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [languageCode, setLanguageCode] = useState(type === "catalog_pdf" ? "es-en" : "na");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icon = type === "ambient_image" ? <ImageIcon className="h-5 w-5" /> : <FileUp className="h-5 w-5" />;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const submitAction = async (formData: FormData) => {
    try {
      const result = await action(formData);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploaded && result.assets?.length) onUploaded(result.assets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la subida";
      setSnackbar({ type: "error", message });
    }
  };

  return (
    <form action={submitAction} className="rounded-xl border border-slate-200 bg-white p-3">
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
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>
        {files.length > 0 ? (
          <div className="mt-2 max-h-28 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="truncate text-slate-600">
                {file.name}
              </div>
            ))}
          </div>
        ) : null}
        <SubmitButton className="btn-primary mt-2 text-xs" disabled={files.length === 0} pendingText="Subiendo...">
          Subir {files.length || 0} archivo(s)
        </SubmitButton>
      </FormPendingSection>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </form>
  );
}
