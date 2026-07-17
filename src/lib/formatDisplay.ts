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

export function buildPackingOptionLabel(p: {
  pieces_box?: number;
  m2_box?: number;
  kg_box?: number;
  supplier?: string | null;
  piecesBox?: number;
  m2Box?: number;
  kgBox?: number;
}) {
  const pieces = p.piecesBox ?? p.pieces_box ?? 0;
  const m2 = p.m2Box ?? p.m2_box ?? 0;
  const kg = p.kgBox ?? p.kg_box ?? 0;
  const supplier = p.supplier ? ` · ${p.supplier}` : "";
  return `${pieces} pzs · ${m2} m² · ${kg} kg${supplier}`;
}
