import { NextResponse } from "next/server";
import { uploadSeriesDocumentsAction } from "@/app/admin/series/actions";

/**
 * Misma ventana que `admin/series/[id]/page.tsx` (Server Actions).
 * Sin esto, en Vercel la función suele cortar al valor por defecto (~10s) y fallan TIFF/PDF grandes a mitad de Sharp/Cloudinary.
 * El tope efectivo depende del plan (p. ej. Hobby vs Pro).
 */
export const maxDuration = 300;

export const runtime = "nodejs";

/**
 * Subida multipart estándar (no formato de Server Action).
 * El cliente no debe llamar a la acción con FormData manual + archivos: Next serializa args como vuelo RSC y falla con 400.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await uploadSeriesDocumentsAction(formData);
  return NextResponse.json(result);
}
