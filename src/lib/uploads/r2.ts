import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Faltan variables de R2");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function getR2Client() {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Cliente solo para URLs firmadas: evita que el middleware de checksums añada
 * `x-amz-checksum-*` a la firma (el navegador no los envía en `fetch`) → 403 en R2/S3.
 */
function getR2ClientForPresignedPut() {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  const { bucket } = getR2Config();
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function copyObjectInR2(sourceKey: string, targetKey: string) {
  const { bucket } = getR2Config();
  const client = getR2Client();
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      CopySource: `${bucket}/${sourceKey}`,
    })
  );
}

export async function deleteObjectFromR2(key: string) {
  const { bucket } = getR2Config();
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * URL firmada para subir el binario desde el navegador (PUT), sin pasar por el body del Server Action.
 * El cliente debe enviar el mismo `Content-Type` en la petición PUT que el usado al firmar.
 *
 * CORS en R2 (Cloudflare → bucket → CORS): `AllowedOrigins` debe coincidir exactamente con el origen
 * del CRM (esquema + host, sin path). En R2 solo son válidos en `AllowedMethods`: GET, PUT, HEAD, DELETE
 * (no incluyas OPTIONS: el panel lo rechaza y no hace falta; el preflight lo resuelve R2).
 * `AllowedHeaders`: p. ej. ["Content-Type"] o ["*"]. `ExposeHeaders`: opcional ["ETag"].
 * https://developers.cloudflare.com/r2/buckets/cors/
 */
export async function signR2PutObjectUrl(key: string, contentType: string, expiresInSeconds = 900) {
  const { bucket } = getR2Config();
  const client = getR2ClientForPresignedPut();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
