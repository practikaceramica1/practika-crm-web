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

export type PreparedAmbientImage = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
  /** true si se ha convertido a JPEG para caber en el límite */
  reencoded: boolean;
};

/**
 * Si el buffer supera el tope (plan Cloudinary), reescala y convierte a JPEG
 * hasta que quepa. Si ya es pequeño, devuelve el mismo buffer.
 */
export async function prepareAmbientImageForUpload(
  input: Buffer,
  passThroughExt: string,
  passThroughMime: string | null
): Promise<PreparedAmbientImage> {
  const limit = maxBytesForCloudinary();
  if (input.length <= limit) {
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
    let quality = 88;

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
