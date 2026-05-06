-- Orientación visual de la foto del color en web (CSS rotate). Por defecto 0 (tal cual el archivo).

ALTER TABLE public.article_colors
  ADD COLUMN IF NOT EXISTS image_rotation_degrees smallint NOT NULL DEFAULT 0;

ALTER TABLE public.article_colors
  DROP CONSTRAINT IF EXISTS article_colors_image_rotation_degrees_check;

ALTER TABLE public.article_colors
  ADD CONSTRAINT article_colors_image_rotation_degrees_check
  CHECK (image_rotation_degrees IN (0, 90, 180, 270));
