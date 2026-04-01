export function isSchemaNotReadyError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes('relation "public.')
  );
}
