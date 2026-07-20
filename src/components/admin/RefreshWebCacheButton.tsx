"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Snackbar } from "@/components/admin/Snackbar";
import {
  refreshWebCacheAction,
  type RefreshWebCacheResult,
} from "@/app/admin/web-cache/actions";

export function RefreshWebCacheButton() {
  const [pending, startTransition] = useTransition();
  const [snackbar, setSnackbar] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  function onClick() {
    const ok = window.confirm(
      "¿Actualizar la web ahora?\n\nInvalidará la caché del catálogo, packing-list y fichas de producto.\nSi hay Deploy Hook configurado, también lanzará un redeploy en Vercel."
    );
    if (!ok) return;

    startTransition(async () => {
      const result: RefreshWebCacheResult = await refreshWebCacheAction();
      setSnackbar({
        type: result.ok ? "success" : "error",
        message: result.message,
      });
    });
  }

  return (
    <>
      <button
        type="button"
        className="mt-4 flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-slate-700 hover:border-[#d8dff5] hover:bg-[#eef2ff] disabled:opacity-60"
        onClick={onClick}
        disabled={pending}
        title="Invalidar caché de la web pública"
      >
        <RefreshCw className={`mt-0.5 h-4 w-4 shrink-0 ${pending ? "animate-spin" : ""}`} />
        <span>
          <span className="block text-sm font-semibold">
            {pending ? "Actualizando web…" : "Actualizar web"}
          </span>
          <span className="block text-xs text-slate-500">Invalidar caché / publicar</span>
        </span>
      </button>
      <Snackbar value={snackbar} onClose={() => setSnackbar(null)} />
    </>
  );
}
