-- Encaje de la imagen de color en la web (marco con aspect ratio del formato).
-- contain = pieza completa (por defecto); cover = ampliar/recortar para llenar el marco.

ALTER TABLE public.article_colors
  ADD COLUMN IF NOT EXISTS image_web_object_fit text NOT NULL DEFAULT 'contain';

ALTER TABLE public.article_colors
  DROP CONSTRAINT IF EXISTS article_colors_image_web_object_fit_check;

ALTER TABLE public.article_colors
  ADD CONSTRAINT article_colors_image_web_object_fit_check
  CHECK (image_web_object_fit IN ('contain', 'cover'));

COMMENT ON COLUMN public.article_colors.image_web_object_fit IS
  'CSS object-fit en preview web: contain (pieza entera) o cover (rellenar marco, puede recortar).';
