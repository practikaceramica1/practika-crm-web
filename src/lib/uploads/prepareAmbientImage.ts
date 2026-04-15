import sharp from "sharp";
import { errorToUserMessage } from "@/lib/errorMessage";

/** Por debajo del límite típico del plan gratuito de Cloudinary (~10 MiB). Sobrescribible con CRM_CLOUDINARY_MAX_IMAGE_BYTES. */
function maxBytesForCloudinary(): number {
  const raw = process.env.CRM_CLOUDINARY_MAX_IMAGE_BYTES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return Math.max(512 * 1024, Math.min(n, 100 * 1024 * 1024));
  }
  return 9_400_000;
}

/**
 * TIFF/HEIC suelen ir en CMYK, 16 bits o compresiones raras; Cloudinary puede responder 400
 * si se suben tal cual. Siempre los pasamos por Sharp → JPEG web-safe.
 */
function needsRasterWebNormalize(ext: string, mime: string | null): boolean {
  const e = ext.toLowerCase();
  if (["tif", "tiff", "heic", "heif", "psb"].includes(e)) return true;
  const m = (mime || "").toLowerCase();
  return (
    m.includes("tiff") ||
    m.includes("heif") ||
    m.includes("heic") ||
    m.includes("photoshop") ||
    m.includes("x-adobe")
  );
}

export type PreparedAmbientImage = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
  /** true si se ha convertido a JPEG para caber en el límite */
  reencoded: boolean;
};

/**
 * Si el buffer supera el tope (plan Cloudinary), o es TIFF/HEIC/PSB, reescala y convierte a JPEG
 * hasta que quepa en el límite. Así evitamos 400 de Cloudinary y archivos demasiado grandes.
 */
export async function prepareAmbientImageForUpload(
  input: Buffer,
  passThroughExt: string,
  passThroughMime: string | null
): Promise<PreparedAmbientImage> {
  const limit = maxBytesForCloudinary();
  const normalize = needsRasterWebNormalize(passThroughExt, passThroughMime);
  if (!normalize && input.length <= limit) {
    return {
      buffer: input,
      extension: passThroughExt,
      mimeType: passThroughMime?.trim() || "application/octet-stream",
      reencoded: false,
    };
  }

  try {
    const meta = await sharp(input).metadata();
    const w = meta.width || 4000;
    const h = meta.height || 4000;
    let maxEdge = Math.min(Math.max(w, h), 8192);
    let quality = normalize ? 90 : 88;

    for (let round = 0; round < 28; round += 1) {
      const buf = await sharp(input)
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true, progressive: true })
        .toBuffer();

      if (buf.length <= limit) {
        return {
          buffer: buf,
          extension: "jpg",
          mimeType: "image/jpeg",
          reencoded: true,
        };
      }

      if (quality > 42) quality -= 5;
      else maxEdge = Math.max(480, Math.floor(maxEdge * 0.82));
    }

    throw new Error(
      "No se ha podido reducir la imagen por debajo del límite de subida (~10 MB en Cloudinary gratuito). Reduce resolución o amplía el límite en Cloudinary."
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("No se ha podido reducir")) throw e;
    throw new Error(`Error al preparar la imagen: ${errorToUserMessage(e)}`);
  }
}
