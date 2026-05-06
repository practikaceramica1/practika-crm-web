"use client";

import { useRef, useState } from "react";
import { preprocessColorUploadFile } from "@/lib/uploads/ambientClientToJpeg";
import { Snackbar } from "./Snackbar";

type SignResult = { ok: true; putUrl: string; fileKey: string; contentType: string } | { ok: false; message: string };

export function ColorImageUploadButton({
  seriesId,
  formatMaterialId,
  articleColorId,
  colorName,
  variantType,
  signUploadAction,
  setColorImageAction,
}: {
  seriesId: string;
  formatMaterialId: string;
  articleColorId: string;
  colorName: string;
  variantType: "regular" | "decor" | "relieve" | "c3";
  signUploadAction: (formData: FormData) => Promise<SignResult>;
  setColorImageAction: (formData: FormData) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handlePick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setSnackbar(null);
    try {
      let uploadFile = file;
      try {
        uploadFile = await preprocessColorUploadFile(file);
      } catch {
        uploadFile = file;
      }

      const sfd = new FormData();
      sfd.set("seriesId", seriesId);
      sfd.set("formatMaterialId", formatMaterialId);
      sfd.set("variantType", variantType);
      sfd.set("colorName", colorName);
      sfd.set("originalFileName", uploadFile.name);
      sfd.set("mimeHint", uploadFile.type || "");

      const signed = await signUploadAction(sfd);
      if (!signed.ok) throw new Error(signed.message);

      const putRes = await fetch(signed.putUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: { "Content-Type": signed.contentType },
        body: uploadFile,
      });
      if (!putRes.ok) {
        const detail = await putRes.text().catch(() => "");
        throw new Error(`No se pudo subir la imagen (HTTP ${putRes.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
      }

      const rfd = new FormData();
      rfd.set("seriesId", seriesId);
      rfd.set("articleColorId", articleColorId);
      rfd.set("fileKey", signed.fileKey);
      await setColorImageAction(rfd);
      setSnackbar({ type: "success", message: "Imagen del color actualizada" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la imagen";
      setSnackbar({ type: "error", message });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn-secondary mt-2 w-full text-xs sm:w-auto"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Subiendo imagen..." : "Subir / reemplazar imagen"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.avif,.heic,.heif"
        className="hidden"
        onChange={(e) => void handlePick(e.target.files?.[0] || null)}
      />
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </>
  );
}
