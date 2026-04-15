import { v2 as cloudinary } from "cloudinary";
import { errorToUserMessage } from "@/lib/errorMessage";

function configureCloudinary() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Faltan variables de Cloudinary");

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export type AmbientImageSignedUploadPayload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
};

/** Firma para subida directa desde el navegador a Cloudinary (evita límite de body en Vercel). */
export function signAmbientImageUpload(folder: string, publicId: string): AmbientImageSignedUploadPayload {
  configureCloudinary();
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000);
  const signed = cloudinary.utils.sign_request(
    {
      timestamp,
      folder,
      public_id: publicId,
      overwrite: true,
    },
    { api_key: apiKey, api_secret: apiSecret }
  );
  return {
    cloudName,
    apiKey: String(signed.api_key),
    timestamp: Number(signed.timestamp),
    signature: String(signed.signature),
    folder: String(signed.folder),
    publicId: String(signed.public_id),
  };
}

export async function uploadImageToCloudinary(buffer: Buffer, folder: string, publicId: string) {
  configureCloudinary();

  return new Promise<{ publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        /** "auto" tolera mejor formatos raros; el buffer ya viene preparado (JPEG) para TIFF/HEIC. */
        resource_type: "auto",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          const msg = error ? errorToUserMessage(error) : "Respuesta vacía de Cloudinary";
          return reject(new Error(msg));
        }
        resolve({ publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function renameCloudinaryImage(oldPublicId: string, newPublicId: string) {
  configureCloudinary();
  await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true, invalidate: true, resource_type: "image" });
}

export async function deleteCloudinaryImage(publicId: string) {
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}
