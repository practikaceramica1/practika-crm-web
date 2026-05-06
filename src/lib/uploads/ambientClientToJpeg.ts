"use client";

// @ts-expect-error — `utif` es CommonJS y no trae typings fiables
import UTIF from "utif";

const DEFAULT_MAX_EDGE = 3840;
const DEFAULT_JPEG_QUALITY = 0.82;
const DEFAULT_PREP_MIN_BYTES = 1_800_000;

function readNumericEnv(key: string, fallback: number, min?: number, max?: number): number {
  try {
    const raw = typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
    if (!raw || !/^\d+(\.\d+)?$/.test(raw)) return fallback;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  } catch {
    return fallback;
  }
}

function maxEdgePx(): number {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_AMBIENT_CLIENT_JPEG_MAX_EDGE?.trim() : undefined;
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return Math.min(8192, Math.max(720, Number.isFinite(n) ? n : DEFAULT_MAX_EDGE));
  }
  return DEFAULT_MAX_EDGE;
}

function jpegQuality(): number {
  const pct = Math.round(readNumericEnv("NEXT_PUBLIC_AMBIENT_CLIENT_JPEG_QUALITY", DEFAULT_JPEG_QUALITY * 100, 40, 100));
  return Math.min(1, Math.max(0.4, pct / 100));
}

function prepMinBytes(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_AMBIENT_CLIENT_PREP_MIN_BYTES?.trim()
      : undefined;
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PREP_MIN_BYTES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 250_000 ? Math.min(n, 50 * 1024 * 1024) : DEFAULT_PREP_MIN_BYTES;
}

const MAX_DECODE_PIXELS = 48_000_000;

function baseNameSansExt(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || filename;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

export function shouldPreprocessAmbientFile(file: File): boolean {
  const n = file.name.toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (n.endsWith(".tif") || n.endsWith(".tiff") || t.includes("tiff")) return true;
  if (n.endsWith(".heic") || n.endsWith(".heif") || t.includes("heif") || t.includes("heic")) return true;
  return file.size >= prepMinBytes();
}

async function tiffBufferToBitmap(buf: ArrayBuffer): Promise<ImageBitmap | null> {
  try {
    const ifds = UTIF.decode(buf) as Array<{ width?: number; height?: number }>;
    if (!ifds?.length) return null;
    const page = ifds[0];
    UTIF.decodeImage(buf, page);
    const rgba = UTIF.toRGBA8(page) as Uint8Array;
    const w = Number(page.width);
    const h = Number(page.height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
    if (w * h > MAX_DECODE_PIXELS) return null;

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return null;
    cx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
    return await createImageBitmap(c);
  } catch {
    return null;
  }
}

async function fileToBitmap(file: File): Promise<ImageBitmap | null> {
  const lower = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (lower.endsWith(".tif") || lower.endsWith(".tiff") || mime.includes("tiff")) {
    const buf = await file.arrayBuffer();
    const b = await tiffBufferToBitmap(buf);
    if (b) return b;
  }
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

async function bitmapToJpegFile(bitmap: ImageBitmap, baseFilename: string, maxEdge: number, quality: number): Promise<File> {
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Sin contexto canvas");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(bitmap, 0, 0, tw, th);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("toBlob devolvió null"));
      },
      "image/jpeg",
      quality
    );
  });

  return new File([blob], `${baseFilename}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Convierte (cuando tiene sentido) la imagen a JPEG en el navegador y la reescala.
 * TIFF → canvas vía UTIF; otros tipos si el navegador puede decodificarlos.
 * Si algo falla, devuelve el archivo original para que siga la ruta de servidor/R2 existente.
 */
export async function preprocessAmbientUploadFile(file: File): Promise<File> {
  if (!shouldPreprocessAmbientFile(file)) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await fileToBitmap(file);
    if (!bitmap) return file;

    const out = await bitmapToJpegFile(bitmap, baseNameSansExt(file.name), maxEdgePx(), jpegQuality());
    bitmap = null;
    return out;
  } catch {
    bitmap?.close?.();
    return file;
  }
}
