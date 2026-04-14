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

export async function uploadImageToCloudinary(buffer: Buffer, folder: string, publicId: string) {
  configureCloudinary();

  return new Promise<{ publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "image", overwrite: true },
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
