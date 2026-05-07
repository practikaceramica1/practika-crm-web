-- Ofertas publicables en la web (orden de assets = sort_order).

CREATE TABLE IF NOT EXISTS public.offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  title       text NOT NULL DEFAULT 'Ofertas',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offer_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id           uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  asset_type         text NOT NULL CHECK (asset_type IN ('image', 'pdf')),
  storage_provider   text NOT NULL DEFAULT 'r2',
  file_key           text NOT NULL,
  mime_type          text,
  title              text,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_assets_offer_id_sort_idx
  ON public.offer_assets (offer_id, sort_order);

INSERT INTO public.offers (slug, title, status)
SELECT 'principal', 'Ofertas en la web', 'draft'
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE slug = 'principal');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_at ON public.offers;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at ON public.offer_assets;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.offer_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
