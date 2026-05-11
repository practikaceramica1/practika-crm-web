-- Catálogos descargables gestionados desde el CRM (orden drag-and-drop, PDF en R2).

CREATE TABLE IF NOT EXISTS public.download_catalog_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  subtitle           text,
  year               text,
  cover_style        text NOT NULL DEFAULT 'light'
    CHECK (cover_style IN ('dark-blue', 'dark-stone', 'light', 'amber', 'regulatory-dop')),
  storage_provider   text NOT NULL DEFAULT 'r2',
  file_key           text NOT NULL,
  mime_type          text,
  file_size_hint     text,
  sort_order         integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS download_catalog_items_status_sort_idx
  ON public.download_catalog_items (status, sort_order);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_at ON public.download_catalog_items;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.download_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
