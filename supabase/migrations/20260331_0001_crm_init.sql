-- =============================================================
-- Practika CRM v3 – initial schema
-- =============================================================

-- 1. materials
CREATE TABLE IF NOT EXISTS public.materials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  default_technical_properties jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. series
CREATE TABLE IF NOT EXISTS public.series (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  collection  text,
  featured    boolean NOT NULL DEFAULT false,
  is_new      boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'published',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. format_materials
CREATE TABLE IF NOT EXISTS public.format_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id     uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  material_id   uuid NOT NULL REFERENCES public.materials(id),
  format_label  text NOT NULL,
  width_cm      numeric NOT NULL,
  height_cm     numeric NOT NULL,
  status        text NOT NULL DEFAULT 'published',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 4. article_colors
CREATE TABLE IF NOT EXISTS public.article_colors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format_material_id   uuid NOT NULL REFERENCES public.format_materials(id) ON DELETE CASCADE,
  color_name           text NOT NULL,
  color_slug           text NOT NULL,
  variant_type         text NOT NULL DEFAULT 'regular',
  sku                  text,
  status               text NOT NULL DEFAULT 'published',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (format_material_id, color_slug, variant_type)
);

-- 5. series_assets
CREATE TABLE IF NOT EXISTS public.series_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id         uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  asset_type        text NOT NULL,
  storage_provider  text NOT NULL,
  file_key          text NOT NULL,
  mime_type         text,
  language_code     text NOT NULL DEFAULT 'es',
  title             text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 6. filter_groups
CREATE TABLE IF NOT EXISTS public.filter_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 7. filter_options
CREATE TABLE IF NOT EXISTS public.filter_options (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_group_id uuid NOT NULL REFERENCES public.filter_groups(id) ON DELETE CASCADE,
  label           text NOT NULL,
  slug            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filter_group_id, slug)
);

-- 8. series_filter_options (junction)
CREATE TABLE IF NOT EXISTS public.series_filter_options (
  series_id        uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  filter_option_id uuid NOT NULL REFERENCES public.filter_options(id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, filter_option_id)
);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'materials','series','format_materials','article_colors',
    'series_assets','filter_groups','filter_options'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;
