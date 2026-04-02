import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Las subidas (PDF, imágenes) van por Server Action; el límite por defecto es 1 MB.
  experimental: {
    serverActions: {
      // Catálogos / paneles suelen ser varios MB. En Vercel Hobby el tope de payload sigue siendo ~4,5 MB.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
