/**
 * Misma lógica que la API pública `/api/public/series` y la web (`productsFromSupabase`):
 * convierte `filter_groups` del CRM en claves de catálogo (`effect`, `style`, …).
 */
function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapFilterKey(key: string):
  | "finishCut"
  | "finishSurface"
  | "thickness"
  | "style"
  | "surfaceType"
  | "effect"
  | "materials"
  | "formats"
  | "colors"
  | null {
  const k = normalizeKey(key);
  if (k === "finishcut" || k === "acabadocorte") return "finishCut";
  if (k === "finishsurface" || k === "acabadosuperficial") return "finishSurface";
  if (k === "thickness" || k === "espesor") return "thickness";
  if (k === "style" || k === "estilo" || k === "estilos") return "style";
  if (k === "surfacetype" || k === "tipo") return "surfaceType";
  if (k === "effect" || k === "efecto" || k === "efectos") return "effect";
  if (k === "materials" || k === "material") return "materials";
  if (k === "formats" || k === "format") return "formats";
  if (k === "colors" || k === "color") return "colors";
  return null;
}

function mapFilterGroupFromNameLabel(name: string):
  | "finishCut"
  | "finishSurface"
  | "thickness"
  | "style"
  | "surfaceType"
  | "effect"
  | null {
  const raw = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = raw.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t === "estilo" || t === "estilos")) return "style";
  if (tokens.some((t) => t === "efecto" || t === "efectos")) return "effect";
  if (tokens.some((t) => t === "espesor")) return "thickness";
  if (tokens.some((t) => t === "corte") && tokens.includes("acabado")) return "finishCut";
  if (tokens.some((t) => t === "superficie") && tokens.includes("acabado")) return "finishSurface";
  if (tokens.some((t) => t === "pavimento" || t === "revestimiento")) return "surfaceType";
  return null;
}

export function mapFilterGroup(group: { key?: string | null; name?: string | null } | null | undefined):
  | "finishCut"
  | "finishSurface"
  | "thickness"
  | "style"
  | "surfaceType"
  | "effect"
  | "materials"
  | "formats"
  | "colors"
  | null {
  const key = (group?.key || "").trim();
  const name = (group?.name || "").trim();
  return mapFilterKey(key) || mapFilterKey(name) || (name ? mapFilterGroupFromNameLabel(name) : null);
}
