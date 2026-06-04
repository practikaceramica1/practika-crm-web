/**
 * Etiquetas de formato alineadas con la web pública (practika-web).
 */
export function canonicalFormatKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/×/g, 'x')
    .replace(/,/g, '.')
    .replace(/cm/g, '');
}

export function roundFormatCm(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function formatLabelFromCm(widthCm: number, heightCm: number): string {
  const part = (n: number) => String(roundFormatCm(n)).replace('.', ',');
  return `${part(widthCm)}x${part(heightCm)}`;
}
