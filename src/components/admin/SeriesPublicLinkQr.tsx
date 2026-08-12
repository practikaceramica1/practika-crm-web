"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import {
  copySeriesQrFromApi,
  downloadSeriesQrFromApi,
  getSeriesQrApiUrl,
} from "@/lib/seriesQrClient";

type Props = {
  publicUrl: string;
  slug: string;
  name: string;
};

export function SeriesPublicLinkQr({ publicUrl, slug, name }: Props) {
  const { notify } = useAdminSnackbar();
  const qrImageUrl = getSeriesQrApiUrl(slug);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copyingQr, setCopyingQr] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      notify({ type: "success", message: "Enlace copiado al portapapeles." });
    } catch {
      notify({ type: "error", message: "No se pudo copiar el enlace." });
    }
  }

  async function handleCopyQr() {
    setCopyingQr(true);
    try {
      await copySeriesQrFromApi(slug);
      notify({ type: "success", message: "Imagen del QR copiada al portapapeles." });
    } catch {
      notify({ type: "error", message: "No se pudo copiar el QR. Prueba a descargarlo como PNG." });
    } finally {
      setCopyingQr(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadSeriesQrFromApi(slug);
      notify({ type: "success", message: "QR descargado." });
    } catch {
      notify({ type: "error", message: "No se pudo descargar el QR." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
            {loading && !loadError ? (
              <QrCode className="h-10 w-10 animate-pulse text-slate-300" />
            ) : null}
            {!loadError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrImageUrl}
                alt={`QR ${name}`}
                className={`h-full w-full object-contain ${loading ? "hidden" : ""}`}
                onLoad={() => {
                  setLoading(false);
                  setLoadError(false);
                }}
                onError={() => {
                  setLoading(false);
                  setLoadError(true);
                  notify({ type: "error", message: "No se pudo generar el código QR." });
                }}
              />
            ) : (
              <span className="text-xs text-slate-400">Sin QR</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCopyQr}
              disabled={loading || loadError || copyingQr}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyingQr ? "Copiando..." : "Copiar QR"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || loadError || downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Descargando..." : "Descargar PNG"}
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace web pública</p>
            <p className="mt-1 text-xs text-slate-500">
              Escaneando el QR se abre la ficha de <strong>{name}</strong> en la web.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
              <span className="break-all">{publicUrl}</span>
            </div>
            <button type="button" onClick={handleCopyLink} className="btn-secondary shrink-0">
              <Copy className="h-4 w-4" />
              Copiar enlace
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en web
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
