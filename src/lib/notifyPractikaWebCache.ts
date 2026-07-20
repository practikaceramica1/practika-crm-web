/**
 * Avisa a practika-web para invalidar caché tras cambios que afectan al catálogo público.
 * Nunca lanza: el guardado del CRM no debe fallar si la web no responde.
 */
export async function notifyPractikaWebCache(options?: {
  slug?: string;
  allProducts?: boolean;
}): Promise<void> {
  const raw = process.env.PRACTIKA_WEB_URL?.trim() || process.env.NEXT_PUBLIC_PRACTIKA_WEB_URL?.trim();
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!raw || !secret) return;

  const base = raw.replace(/\/$/, "");
  const slug = options?.slug?.trim().toLowerCase() || undefined;
  const allProducts = options?.allProducts === true || !slug;

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slug ? { slug, allProducts: false } : { allProducts }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[notifyPractikaWebCache] HTTP", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[notifyPractikaWebCache]", e instanceof Error ? e.message : e);
  }
}
