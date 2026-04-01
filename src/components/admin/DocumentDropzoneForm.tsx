"use client";

import { FileUp, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";

type DocType = "technical_panel" | "catalog_pdf" | "ambient_image";

export function DocumentDropzoneForm({
  title,
  type,
  seriesId,
  accept,
  action,
}: {
  title: string;
  type: DocType;
  seriesId: string;
  accept: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [languageCode, setLanguageCode] = useState(type === "catalog_pdf" ? "es-en" : "na");
  const icon = type === "ambient_image" ? <ImageIcon className="h-5 w-5" /> : <FileUp className="h-5 w-5" />;
  const total = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <input type="hidden" name="seriesId" value={seriesId} />
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
      <button className="btn-primary mt-2 text-xs" disabled={files.length === 0}>
        Subir {files.length || 0} archivo(s)
      </button>
    </form>
  );
}
