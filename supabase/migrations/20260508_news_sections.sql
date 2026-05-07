-- Noticias en web: secciones flexibles (Novedades, Ofertas, Proyectos…) con assets ordenados y destacados.

CREATE TABLE IF NOT EXISTS public.news_sections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.news_section_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id         uuid NOT NULL REFERENCES public.news_sections(id) ON DELETE CASCADE,
  asset_type         text NOT NULL CHECK (asset_type IN ('image', 'pdf')),
  is_favorite        boolean NOT NULL DEFAULT false,
  ordinal            integer NOT NULL DEFAULT 0,
  storage_provider   text NOT NULL DEFAULT 'r2',
  file_key           text NOT NULL,
  mime_type          text,
  title              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_section_assets_section_bucket_ord_idx
  ON public.news_section_assets (section_id, is_favorite, ordinal);

-- Migración desde esquema legacy offers / offer_assets (si existían)
DO $$
DECLARE
  oid uuid;
  nid uuid;
BEGIN
  IF to_regclass('public.offers') IS NOT NULL
     AND to_regclass('public.offer_assets') IS NOT NULL THEN
    SELECT o.id INTO oid FROM public.offers o WHERE o.slug = 'principal' LIMIT 1;
    IF oid IS NOT NULL THEN
      INSERT INTO public.news_sections (slug, title, description, status, sort_order)
      SELECT 'ofertas', o.title, NULL::text, o.status, 0
      FROM public.offers o WHERE o.id = oid
      ON CONFLICT (slug) DO NOTHING;
      SELECT ns.id INTO nid FROM public.news_sections ns WHERE ns.slug = 'ofertas' LIMIT 1;
      IF nid IS NOT NULL THEN
        INSERT INTO public.news_section_assets (
          section_id, asset_type, is_favorite, ordinal, storage_provider, file_key, mime_type, title
        )
        SELECT
          nid,
          oa.asset_type,
          false,
          COALESCE(oa.sort_order, 0),
          oa.storage_provider,
          oa.file_key,
          oa.mime_type,
          oa.title
        FROM public.offer_assets oa
        WHERE oa.offer_id = oid;
      END IF;
      DROP TABLE IF EXISTS public.offer_assets;
      DROP TABLE IF EXISTS public.offers;
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_updated_at ON public.news_sections;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.news_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at ON public.news_section_assets;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.news_section_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
