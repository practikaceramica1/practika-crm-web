import { Download } from "lucide-react";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { listDownloadCatalogItemsAdmin } from "./actions";
import DownloadCatalogAdminClient from "./DownloadCatalogAdminClient";

export default async function AdminDescargasCatalogosPage() {
  let items: Awaited<ReturnType<typeof listDownloadCatalogItemsAdmin>> = [];
  try {
    items = await listDownloadCatalogItemsAdmin();
  } catch (e: unknown) {
    if (isSchemaNotReadyError(e as { code?: string; message?: string })) {
      return (
        <SetupRequired
          missing="public.download_catalog_items"
          migration="supabase/migrations/20260509_download_catalog_items.sql"
        />
      );
    }
    throw e;
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#1a1f3d]">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Descargas · Catálogos</h1>
          <p className="text-sm text-slate-600">
            PDFs de la pestaña «Catálogos» en la web. Ordena arrastrando cada tarjeta; el orden se refleja en la cuadrícula
            de descargas.
          </p>
        </div>
      </div>

      <DownloadCatalogAdminClient initialItems={items} />
    </main>
  );
}
