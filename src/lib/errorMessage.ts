/** Texto seguro para mostrar al usuario (Cloudinary/Supabase a veces rechazan con objetos, no `Error`). */
export function errorToUserMessage(e: unknown, maxLen = 900): string {
  if (e == null) return "Error desconocido.";
  if (typeof e === "string") return truncate(e, maxLen);
  if (e instanceof Error && e.message) return truncate(e.message, maxLen);

  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return truncate(o.message.trim(), maxLen);
    if (typeof o.error === "string" && o.error.trim()) return truncate(o.error.trim(), maxLen);
    if (o.error && typeof o.error === "object") {
      const inner = (o.error as Record<string, unknown>).message;
      if (typeof inner === "string" && inner.trim()) return truncate(inner.trim(), maxLen);
    }
    try {
      const s = JSON.stringify(o);
      if (s && s !== "{}") return truncate(s, maxLen);
    } catch {
      /* ignore */
    }
  }

  const fallback = String(e);
  return fallback === "[object Object]" ? "Error al subir la imagen (revisa credenciales Cloudinary y el formato del archivo)." : truncate(fallback, maxLen);
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
