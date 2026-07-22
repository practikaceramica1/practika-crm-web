-- =============================================================
-- Bulk offers (massive offer creator in practika-pdf-creator)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.bulk_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bulk_offer_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id                uuid NOT NULL REFERENCES public.bulk_offers(id) ON DELETE CASCADE,
  sort_order              integer NOT NULL DEFAULT 0,
  series_name             text NOT NULL,
  material                text,
  format_label            text,
  color_name              text,
  square_meters           numeric,
  price_per_m2            numeric,
  comments                text,
  image_url               text,
  custom_image_data       text,
  is_manual               boolean NOT NULL DEFAULT false,
  crm_series_id           uuid,
  crm_format_material_id  uuid,
  crm_color_id            uuid,
  series_status           text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_offer_lines_offer_id_idx ON public.bulk_offer_lines (offer_id, sort_order);

ALTER TABLE public.bulk_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_offer_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_offers_authenticated_all ON public.bulk_offers;
CREATE POLICY bulk_offers_authenticated_all
  ON public.bulk_offers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS bulk_offer_lines_authenticated_all ON public.bulk_offer_lines;
CREATE POLICY bulk_offer_lines_authenticated_all
  ON public.bulk_offer_lines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_offer_lines TO authenticated;
