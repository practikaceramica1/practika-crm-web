/** URL pública de una serie en practika-web: /productos/{slug} */
export function getSeriesPublicUrl(slug: string): string {
  const raw =
    process.env.NEXT_PUBLIC_PRACTIKA_WEB_URL?.trim() ||
    process.env.PRACTIKA_WEB_URL?.trim() ||
    "https://www.practikaceramica.com";
  const base = raw.replace(/\/$/, "");
  return `${base}/productos/${slug.trim().toLowerCase()}`;
}
