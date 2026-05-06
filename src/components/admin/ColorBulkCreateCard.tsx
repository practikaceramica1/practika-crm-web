"use client";

import { useEffect, useRef, useState } from "react";
import { needsRasterImagePreviewConversion, preprocessColorUploadFile } from "@/lib/uploads/ambientClientToJpeg";
import { FormPendingSection } from "./FormPendingSection";
import { Snackbar } from "./Snackbar";
import { SubmitButton } from "./SubmitButton";

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
  signUploadAction,
}: {
  seriesId: string;
  formatMaterialId: string;
  variantType?: "regular" | "decor" | "relieve" | "c3";
  title?: string;
  action: (formData: FormData) => void | Promise<void>;
  signUploadAction: (formData: FormData) => Promise<{ ok: true; putUrl: string; fileKey: string; contentType: string } | { ok: false; message: string }>;
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string; sourceFile: string; previewUrl: string; file: File }>>([]);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addImageFiles(list: FileList | File[] | null) {
    const raw = Array.from(list || []);
    const files = raw.filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|bmp|tif|tiff|svg|avif|heic|heif)$/i.test(f.name)
    );
    if (!files.length) {
      if (raw.length) {
        setSnackbar({ type: "error", message: "Solo se admiten archivos de imagen." });
      }
      return;
    }
    const added: Array<{ id: string; name: string; sourceFile: string; previewUrl: string; file: File }> = [];
    for (const file of files) {
      let previewBlob: Blob = file;
      if (needsRasterImagePreviewConversion(file)) {
        try {
          previewBlob = await preprocessColorUploadFile(file);
        } catch {
          previewBlob = file;
        }
      }
      added.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        name: nameFromFile(file.name),
        sourceFile: file.name,
        previewUrl: URL.createObjectURL(previewBlob),
        file,
      });
    }
    setItems((prev) => [...prev, ...added]);
  }

  const submitAction = async () => {
    try {
      const payloadItems: Array<{ name: string; sourceFile: string }> = [];
      for (const item of items) {
        let uploadFile = item.file;
        try {
          uploadFile = await preprocessColorUploadFile(item.file);
        } catch {
          uploadFile = item.file;
        }

        const signFd = new FormData();
        signFd.set("seriesId", seriesId);
        signFd.set("formatMaterialId", formatMaterialId);
        signFd.set("variantType", variantType);
        signFd.set("colorName", item.name);
        signFd.set("originalFileName", uploadFile.name);
        signFd.set("mimeHint", uploadFile.type || "");
        const signed = await signUploadAction(signFd);
        if (!signed.ok) throw new Error(signed.message);

        const putRes = await fetch(signed.putUrl, {
          method: "PUT",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: {
            "Content-Type": signed.contentType,
          },
          body: uploadFile,
        });
        if (!putRes.ok) {
          const detail = await putRes.text().catch(() => "");
          throw new Error(`No se pudo subir "${uploadFile.name}" (HTTP ${putRes.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
        }
        payloadItems.push({ name: item.name, sourceFile: signed.fileKey });
      }

      const fd = new FormData();
      fd.set("seriesId", seriesId);
      fd.set("formatMaterialId", formatMaterialId);
      fd.set("variantType", variantType);
      fd.set("itemsJson", JSON.stringify(payloadItems));
      await action(fd);
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setItems([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSnackbar({ type: "success", message: `${title}: guardado correcto` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron guardar los colores";
      setSnackbar({ type: "error", message });
    }
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [items]);

  return (
    <form action={submitAction} className="rounded-lg border border-slate-200 p-3">
      <FormPendingSection>
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="input bg-slate-50 text-xs text-slate-500">{variantType === "c3" ? "Antideslizante (C3)" : variantType}</div>
          <div className="input bg-slate-50 text-xs text-slate-500">Producción</div>
        </div>
        <label
          className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600 hover:border-indigo-500 hover:bg-indigo-50"
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
            void addImageFiles(e.dataTransfer.files);
          }}
        >
          Arrastra imágenes aquí o haz clic
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void addImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {items.length > 0 ? (
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[52px_1fr_auto] gap-2 rounded-md border border-slate-200 bg-white p-2">
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  width={48}
                  height={48}
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
        <SubmitButton className="btn-primary mt-2 text-xs" disabled={items.length === 0} pendingText="Creando colores...">
          Crear {items.length || 0} colores
        </SubmitButton>
      </FormPendingSection>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </form>
  );
}
