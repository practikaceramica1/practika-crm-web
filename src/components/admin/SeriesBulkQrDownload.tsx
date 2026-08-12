"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import { downloadAllSeriesQrZipFromApi } from "@/lib/seriesQrClient";

type Props = {
  seriesCount: number;
};

export function SeriesBulkQrDownload({ seriesCount }: Props) {
  const { notify } = useAdminSnackbar();
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadAll() {
    if (!seriesCount) {
      notify({ type: "error", message: "No hay series para exportar." });
      return;
    }

    setDownloading(true);
    try {
      await downloadAllSeriesQrZipFromApi();
      notify({ type: "success", message: `ZIP con ${seriesCount} QR descargado.` });
    } catch {
      notify({ type: "error", message: "No se pudo generar el ZIP de QR." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownloadAll}
      disabled={downloading || !seriesCount}
      className="btn-secondary inline-flex items-center gap-1.5"
    >
      <Download className="h-4 w-4" />
      {downloading ? "Generando ZIP..." : "Descargar todos los QR"}
    </button>
  );
}
