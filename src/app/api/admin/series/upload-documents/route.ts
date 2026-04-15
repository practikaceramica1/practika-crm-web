import { NextResponse } from "next/server";
import { uploadSeriesDocumentsAction } from "@/app/admin/series/actions";

/**
 * Subida multipart estándar (no formato de Server Action).
 * El cliente no debe llamar a la acción con FormData manual + archivos: Next serializa args como vuelo RSC y falla con 400.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await uploadSeriesDocumentsAction(formData);
  return NextResponse.json(result);
}
