import { v2 as cloudinary } from "cloudinary";

export async function uploadImageToCloudinary(buffer: Buffer, folder: string, publicId: string) {
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

  return new Promise<{ publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "image", overwrite: true },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Error Cloudinary"));
        resolve({ publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}
