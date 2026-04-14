import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Las subidas (PDF, imágenes) van por Server Action; el límite por defecto es 1 MB.
  experimental: {
    serverActions: {
      // Ambientes en TIFF / alta resolución pueden superar 50 MB. En servidor propio este valor aplica tal cual.
      // En Vercel, el payload máximo del plan sigue imponiendo un tope distinto (consultar límites del proveedor).
      bodySizeLimit: "150mb",
    },
  },
};

export default nextConfig;
