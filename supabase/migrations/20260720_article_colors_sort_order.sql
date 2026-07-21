-- Orden de colores por formato (CRM → web)
ALTER TABLE public.article_colors
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY format_material_id
      ORDER BY created_at ASC NULLS LAST, color_name ASC
    ) AS rn
  FROM public.article_colors
)
UPDATE public.article_colors ac
SET sort_order = ordered.rn
FROM ordered
WHERE ac.id = ordered.id;

CREATE INDEX IF NOT EXISTS article_colors_format_sort_idx
  ON public.article_colors (format_material_id, sort_order);
