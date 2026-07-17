-- Unifica materiales duplicados (tabla `materials` vs grupo Material en `filter_options`).
-- Ejecutar en Supabase SQL Editor. Revisar el SELECT de verificación al final antes de COMMIT.
--
-- CRITERIO (canónico = lo que ya está en Admin → Filtros → Material):
--
--   MANTENER / RESULTADO FINAL          ACCIÓN
--   ─────────────────────────────────   ─────────────────────────────────────────────
--   Gres                                Mantener (solo en materials; se crea filter_option)
--   Gres Antihielo                      Renombrar fila existente (mismo slug gres-antihielo)
--   Gres Espesorado                     Crear fila en materials (ya existe en filter_options)
--   Gres Pasta Roja                     Migrar 32 formatos desde «Pasta Roja»; borrar viejo
--   Porcelánico                         Mantener (nombre ya alineado)
--   Revestimiento Pasta Blanca          Migrar 8 formatos desde «Pasta Blanca»; borrar viejo
--   Revestimiento Pasta Roja            Mantener
--
--   BORRAR (tras migrar format_materials):
--   • materials slug pasta-roja     → sustituido por gres-pasta-roja
--   • materials slug pasta-blanca   → sustituido por revestimiento-pasta-blanca
--
--   NO SE BORRA ningún filter_option ni ningún formato/color.

BEGIN;

-- 1) Renombrar capitalización alineada con Filtros
UPDATE public.materials
SET name = 'Gres Antihielo'
WHERE slug = 'gres-antihielo' AND name IS DISTINCT FROM 'Gres Antihielo';

-- 2) Asegurar filas destino que solo existían en filter_options
INSERT INTO public.materials (slug, name, default_technical_properties, is_active)
SELECT v.slug, v.name, '{}'::jsonb, true
FROM (VALUES
  ('gres-pasta-roja', 'Gres Pasta Roja'),
  ('revestimiento-pasta-blanca', 'Revestimiento Pasta Blanca'),
  ('gres-espesorado', 'Gres Espesorado')
) AS v(slug, name)
WHERE NOT EXISTS (SELECT 1 FROM public.materials m WHERE m.slug = v.slug);

-- 3) Migrar formatos de nombres viejos → canónicos
UPDATE public.format_materials fm
SET material_id = dst.id
FROM public.materials src
JOIN public.materials dst ON dst.slug = 'gres-pasta-roja'
WHERE fm.material_id = src.id AND src.slug = 'pasta-roja';

UPDATE public.format_materials fm
SET material_id = dst.id
FROM public.materials src
JOIN public.materials dst ON dst.slug = 'revestimiento-pasta-blanca'
WHERE fm.material_id = src.id AND src.slug = 'pasta-blanca';

-- 4) Borrar filas materials huérfanas (solo si ya no las referencia ningún formato)
DELETE FROM public.materials m
WHERE m.slug IN ('pasta-roja', 'pasta-blanca')
  AND NOT EXISTS (SELECT 1 FROM public.format_materials fm WHERE fm.material_id = m.id);

-- 5) filter_option para «Gres» (existía en materials pero no en filtros web)
INSERT INTO public.filter_options (filter_group_id, label, slug, sort_order, is_active)
SELECT fg.id, 'Gres', 'gres', 0, true
FROM public.filter_groups fg
WHERE fg.key = 'materials'
  AND NOT EXISTS (
    SELECT 1 FROM public.filter_options fo
    WHERE fo.filter_group_id = fg.id AND fo.slug = 'gres'
  );

-- 6) Quitar traducciones erróneas copiadas de «Silky» (acabado, no material)
UPDATE public.filter_options fo
SET translations = NULL
FROM public.filter_groups fg
WHERE fo.filter_group_id = fg.id
  AND fg.key = 'materials'
  AND fo.translations IS NOT NULL
  AND (
    fo.translations::text ILIKE '%silky%'
    OR fo.translations::text ILIKE '%soie%'
  );

COMMIT;

-- Verificación (debe listar 7 materiales y 0 formatos en slugs viejos)
SELECT slug, name,
  (SELECT count(*) FROM public.format_materials fm WHERE fm.material_id = m.id) AS formatos
FROM public.materials m
ORDER BY name;

SELECT fm.id, fm.format_label, m.name AS material, m.slug
FROM public.format_materials fm
JOIN public.materials m ON m.id = fm.material_id
WHERE m.slug IN ('pasta-roja', 'pasta-blanca');
