-- Traducciones opcionales para textos de catálogo mostrados en la web (EN/FR/DE/PT).
-- El español sigue siendo `filter_options.label` y `materials.name`.

ALTER TABLE public.filter_options
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
