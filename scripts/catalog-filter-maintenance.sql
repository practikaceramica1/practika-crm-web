-- Mantenimiento de filtros de catálogo (Supabase SQL Editor).
-- 1) Acabado superficial: borrar «Pulido brillo», renombrar «Pulido mate» → «Silky»
-- 2) Espesor: dejar solo 9mm en series, formatos y colores publicados
--
-- Revisar con SELECT antes de COMMIT si usas transacción manual.

BEGIN;

-- --- Acabado superficial (finishSurface) ---
DO $$
DECLARE
  grp_id uuid;
BEGIN
  SELECT id INTO grp_id FROM public.filter_groups WHERE key = 'finishSurface' LIMIT 1;
  IF grp_id IS NULL THEN
    RAISE EXCEPTION 'No existe filter_groups.key = finishSurface';
  END IF;

  DELETE FROM public.filter_options
  WHERE filter_group_id = grp_id AND label = 'Pulido brillo';

  UPDATE public.filter_options
  SET
    label = 'Silky',
    slug = 'silky',
    translations = COALESCE(translations, '{}'::jsonb) || '{"en":"Silky","fr":"Silky","de":"Silky","pt":"Silky"}'::jsonb
  WHERE filter_group_id = grp_id AND label = 'Pulido mate';
END $$;

-- --- Espesor: solo 9mm en todos los vínculos existentes ---
DO $$
DECLARE
  grp_id uuid;
  opt_9mm uuid;
BEGIN
  SELECT id INTO grp_id FROM public.filter_groups WHERE key = 'thickness' LIMIT 1;
  IF grp_id IS NULL THEN
    RAISE EXCEPTION 'No existe filter_groups.key = thickness';
  END IF;

  SELECT id INTO opt_9mm
  FROM public.filter_options
  WHERE filter_group_id = grp_id AND label = '9mm'
  LIMIT 1;

  IF opt_9mm IS NULL THEN
    RAISE EXCEPTION 'No existe opción de espesor «9mm»; créala en Admin → Filtros antes de ejecutar.';
  END IF;

  DELETE FROM public.series_filter_options sfo
  USING public.filter_options fo
  WHERE sfo.filter_option_id = fo.id
    AND fo.filter_group_id = grp_id
    AND sfo.filter_option_id <> opt_9mm;

  DELETE FROM public.format_material_filter_options fmfo
  USING public.filter_options fo
  WHERE fmfo.filter_option_id = fo.id
    AND fo.filter_group_id = grp_id
    AND fmfo.filter_option_id <> opt_9mm;

  DELETE FROM public.article_color_filter_options acfo
  USING public.filter_options fo
  WHERE acfo.filter_option_id = fo.id
    AND fo.filter_group_id = grp_id
    AND acfo.filter_option_id <> opt_9mm;

  INSERT INTO public.series_filter_options (series_id, filter_option_id)
  SELECT s.id, opt_9mm
  FROM public.series s
  WHERE s.status = 'published'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.format_material_filter_options (format_material_id, filter_option_id)
  SELECT fm.id, opt_9mm
  FROM public.format_materials fm
  JOIN public.series s ON s.id = fm.series_id
  WHERE s.status = 'published'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.article_color_filter_options (article_color_id, filter_option_id)
  SELECT ac.id, opt_9mm
  FROM public.article_colors ac
  JOIN public.format_materials fm ON fm.id = ac.format_material_id
  JOIN public.series s ON s.id = fm.series_id
  WHERE s.status = 'published'
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
