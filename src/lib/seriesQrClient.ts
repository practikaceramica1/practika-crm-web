export function getSeriesQrApiUrl(slug: string): string {
  return `/api/admin/series/qr?slug=${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export async function fetchSeriesQrBlob(slug: string): Promise<Blob> {
  const res = await fetch(getSeriesQrApiUrl(slug));
  if (!res.ok) throw new Error("qr_fetch_failed");
  return res.blob();
}

export async function copySeriesQrFromApi(slug: string): Promise<void> {
  const blob = await fetchSeriesQrBlob(slug);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

export async function downloadSeriesQrFromApi(slug: string): Promise<void> {
  const blob = await fetchSeriesQrBlob(slug);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${slug}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadAllSeriesQrZipFromApi(): Promise<void> {
  const res = await fetch("/api/admin/series/qr-export");
  if (!res.ok) throw new Error("qr_export_failed");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `qr-series-practika-${new Date().toISOString().slice(0, 10)}.zip`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
