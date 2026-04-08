function looksLikeR2Host(url: string) {
  const u = url.trim().toLowerCase();
  return u.includes(".r2.dev") || u.includes("r2.cloudflarestorage.com");
}

export function resolveR2PublicBaseUrl() {
  const normalize = (raw: string) => {
    const t = raw.trim().replace(/\/$/, "");
    if (!t || t === "cloudinary") return "";
    return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
  };
  for (const raw of [process.env.R2_PUBLIC_BASE_URL, process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL]) {
    const u = normalize(raw || "");
    if (u) return u;
  }
  const docs = process.env.NEXT_PUBLIC_DOCUMENTS_BASE_URL?.trim() || "";
  if (docs && docs !== "cloudinary" && looksLikeR2Host(docs)) return normalize(docs);
  return "";
}

export function inferAssetProvider(storageProvider: string, fileKey: string): "cloudinary" | "r2" {
  const p = storageProvider.toLowerCase();
  if (p === "cloudinary") return "cloudinary";
  if (p === "r2") return "r2";
  if (fileKey.startsWith("practika/")) return "cloudinary";
  if (fileKey.startsWith("series/")) return "r2";
  return "r2";
}

export function getAssetPublicUrl(storageProvider: string, fileKey: string) {
  if (!fileKey) return "";
  if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) return fileKey;

  const cleanKey = fileKey.replace(/^\/+/, "");
  const provider = inferAssetProvider(storageProvider, cleanKey);

  if (provider === "cloudinary") {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloud) return "";
    return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${cleanKey}`;
  }

  const base = resolveR2PublicBaseUrl();
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/${cleanKey}`;
}
