-- Traducciones (en, fr, de, pt) para los catálogos gestionados desde el CRM.
-- El español se sigue almacenando en las columnas title/subtitle.
-- El resto de idiomas van en JSONB: { "en": {"title":"...", "subtitle":"..."}, ... }
ALTER TABLE public.download_catalog_items
  ADD COLUMN IF NOT EXISTS translations jsonb;
