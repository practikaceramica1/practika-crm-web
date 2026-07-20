"use server";

import { requireAdminUser } from "@/lib/auth";

export type RefreshWebCacheResult = {
  ok: boolean;
  message: string;
  details?: {
    revalidateOk?: boolean;
    deployHookTriggered?: boolean;
    revalidatedCount?: number;
  };
};

function webBaseUrl(): string | null {
  const raw = process.env.PRACTIKA_WEB_URL?.trim() || process.env.NEXT_PUBLIC_PRACTIKA_WEB_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Invalida la caché de la web pública (y opcionalmente dispara un Deploy Hook de Vercel).
 * Requiere en el CRM: PRACTIKA_WEB_URL + REVALIDATE_SECRET (mismo secret que en la web).
 * Opcional: PRACTIKA_WEB_DEPLOY_HOOK_URL para forzar rebuild completo en Vercel.
 */
export async function refreshWebCacheAction(formData?: FormData): Promise<RefreshWebCacheResult> {
  await requireAdminUser();

  const slug = String(formData?.get("slug") || "").trim().toLowerCase() || undefined;
  const base = webBaseUrl();
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const deployHook = process.env.PRACTIKA_WEB_DEPLOY_HOOK_URL?.trim();

  if (!base && !deployHook) {
    return {
      ok: false,
      message:
        "Falta configurar PRACTIKA_WEB_URL (y REVALIDATE_SECRET) o PRACTIKA_WEB_DEPLOY_HOOK_URL en el CRM.",
    };
  }

  let revalidateOk = false;
  let revalidatedCount = 0;
  let revalidateError = "";

  if (base && secret) {
    try {
      const res = await fetch(`${base}/api/revalidate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slug ? { slug, allProducts: false } : { allProducts: true }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        revalidated?: string[];
      };
      if (!res.ok || !data.ok) {
        revalidateError = data.error || `HTTP ${res.status}`;
      } else {
        revalidateOk = true;
        revalidatedCount = data.revalidated?.length || 0;
      }
    } catch (e) {
      revalidateError = e instanceof Error ? e.message : "Error de red al revalidar";
    }
  } else if (base && !secret) {
    revalidateError = "Falta REVALIDATE_SECRET en el CRM (debe coincidir con la web).";
  }

  let deployHookTriggered = false;
  let deployHookError = "";
  if (deployHook) {
    try {
      const res = await fetch(deployHook, { method: "POST", cache: "no-store" });
      if (!res.ok) {
        deployHookError = `Deploy hook HTTP ${res.status}`;
      } else {
        deployHookTriggered = true;
      }
    } catch (e) {
      deployHookError = e instanceof Error ? e.message : "Error al llamar Deploy Hook";
    }
  }

  if (!revalidateOk && !deployHookTriggered) {
    return {
      ok: false,
      message: [revalidateError, deployHookError].filter(Boolean).join(" · ") || "No se pudo actualizar la web.",
      details: { revalidateOk, deployHookTriggered, revalidatedCount },
    };
  }

  const parts: string[] = [];
  if (revalidateOk) {
    parts.push(
      slug
        ? `Caché invalidada para /productos/${slug} y listados.`
        : `Caché invalidada (${revalidatedCount} rutas).`
    );
  } else if (revalidateError) {
    parts.push(`Revalidación: ${revalidateError}`);
  }
  if (deployHookTriggered) {
    parts.push("Redeploy de Vercel lanzado (tarda 1–3 min).");
  } else if (deployHookError) {
    parts.push(deployHookError);
  }

  return {
    ok: true,
    message: parts.join(" "),
    details: { revalidateOk, deployHookTriggered, revalidatedCount },
  };
}
