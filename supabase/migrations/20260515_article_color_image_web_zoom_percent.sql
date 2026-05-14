-- Zoom adicional de la imagen de color en la web (marco con aspect ratio del formato).
-- 100 = tamaño por defecto (solo object-fit); >100 acerca; <100 aleja. Se combina con rotate y object-fit.

ALTER TABLE public.article_colors
  ADD COLUMN IF NOT EXISTS image_web_zoom_percent integer NOT NULL DEFAULT 100;

ALTER TABLE public.article_colors
  DROP CONSTRAINT IF EXISTS article_colors_image_web_zoom_percent_check;

ALTER TABLE public.article_colors
  ADD CONSTRAINT article_colors_image_web_zoom_percent_check
  CHECK (image_web_zoom_percent >= 25 AND image_web_zoom_percent <= 300);

COMMENT ON COLUMN public.article_colors.image_web_zoom_percent IS
  'Escala visual en la web respecto al encaje base (100 = 100%). 25–300. No modifica el archivo.';
