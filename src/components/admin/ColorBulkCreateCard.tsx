"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

function nameFromFile(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ColorBulkCreateCard({
  seriesId,
  formatMaterialId,
  variantType = "regular",
  title = "Carga masiva de colores",
  action,
}: {
  seriesId: string;
  formatMaterialId: string;
  variantType?: "regular" | "decor" | "relieve" | "c3";
  title?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string; sourceFile: string; previewUrl: string }>>([]);
  const itemsJson = useMemo(() => JSON.stringify(items.map((i) => ({ name: i.name, sourceFile: i.sourceFile }))), [items]);

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [items]);

  return (
    <form action={action} className="rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="seriesId" value={seriesId} />
      <input type="hidden" name="formatMaterialId" value={formatMaterialId} />
      <input type="hidden" name="itemsJson" value={itemsJson} />
      <input type="hidden" name="variantType" value={variantType} />
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="input bg-slate-50 text-xs text-slate-500">{variantType === "c3" ? "Antideslizante (C3)" : variantType}</div>
        <div className="input bg-slate-50 text-xs text-slate-500">Producción</div>
      </div>
      <label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50">
        Arrastra imágenes aquí o haz clic
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            const added = files.map((file) => ({
              id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
              name: nameFromFile(file.name),
              sourceFile: file.name,
              previewUrl: URL.createObjectURL(file),
            }));
            setItems((prev) => [...prev, ...added]);
          }}
        />
      </label>
      {items.length > 0 ? (
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[52px_1fr_auto] gap-2 rounded-md border border-slate-200 bg-white p-2">
              <Image
                src={item.previewUrl}
                alt={item.name}
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 rounded-md object-cover"
              />
              <input
                className="input"
                value={item.name}
                onChange={(e) => setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setItems((prev) => {
                    const target = prev.find((x) => x.id === item.id);
                    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                    return prev.filter((x) => x.id !== item.id);
                  })
                }
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <button className="btn-primary mt-2 text-xs" disabled={items.length === 0}>Crear {items.length || 0} colores</button>
    </form>
  );
}
