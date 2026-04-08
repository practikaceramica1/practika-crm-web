-- =============================================================
-- Filter hierarchy: format-material and article-color filter junctions
-- =============================================================

-- 1. format_material_filter_options
CREATE TABLE IF NOT EXISTS public.format_material_filter_options (
  format_material_id uuid NOT NULL REFERENCES public.format_materials(id) ON DELETE CASCADE,
  filter_option_id   uuid NOT NULL REFERENCES public.filter_options(id) ON DELETE CASCADE,
  PRIMARY KEY (format_material_id, filter_option_id)
);

-- 2. article_color_filter_options
CREATE TABLE IF NOT EXISTS public.article_color_filter_options (
  article_color_id uuid NOT NULL REFERENCES public.article_colors(id) ON DELETE CASCADE,
  filter_option_id uuid NOT NULL REFERENCES public.filter_options(id) ON DELETE CASCADE,
  PRIMARY KEY (article_color_id, filter_option_id)
);
