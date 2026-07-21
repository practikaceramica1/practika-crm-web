export type SeriesPendingGap =
  | "formats"
  | "technical_panel"
  | "ambient_image"
  | "catalog_pdf"
  | "colors"
  | "color_images"
  | "packing";

export const SERIES_PENDING_GAP_LABELS: Record<SeriesPendingGap, string> = {
  formats: "Sin formatos",
  technical_panel: "Sin panel técnico",
  ambient_image: "Sin ambiente",
  catalog_pdf: "Sin PDF de serie",
  colors: "Sin colores",
  color_images: "Colores sin imagen",
  packing: "Formatos sin packing",
};

export type SeriesPendingRow = {
  id: string;
  name: string;
  slug: string;
  is_new: boolean;
  gaps: SeriesPendingGap[];
  formatCount: number;
  colorCount: number;
  colorsWithoutImage: number;
  formatsWithoutPacking: number;
};

export type SeriesPendingSummary = {
  rows: SeriesPendingRow[];
  incompleteCount: number;
};
