-- =============================================================
-- Global catalog: format + material (+ characteristic) + packings
-- Series format_materials become assignments to the catalog.
-- =============================================================

-- 1) Materials order for packing-list grouping
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Best-effort: sync sort_order from filter_options (materials group)
UPDATE public.materials m
SET sort_order = fo.sort_order
FROM public.filter_options fo
JOIN public.filter_groups fg ON fg.id = fo.filter_group_id
WHERE fg.key IN ('materials', 'material')
  AND fo.slug = m.slug;

-- Fill remaining materials alphabetically after max
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY name) AS rn
  FROM public.materials
  WHERE sort_order = 0
),
base AS (
  SELECT COALESCE(MAX(sort_order), 0) AS mx FROM public.materials
)
UPDATE public.materials m
SET sort_order = base.mx + ranked.rn
FROM ranked, base
WHERE m.id = ranked.id;

-- 2) Global catalog rows
CREATE TABLE IF NOT EXISTS public.catalog_format_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     uuid NOT NULL REFERENCES public.materials(id),
  width_cm        numeric NOT NULL,
  height_cm       numeric NOT NULL,
  format_label    text NOT NULL,
  characteristic  text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'published',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, width_cm, height_cm, characteristic)
);

CREATE INDEX IF NOT EXISTS idx_catalog_fm_material ON public.catalog_format_materials(material_id);

-- 3) Packings per catalog row
CREATE TABLE IF NOT EXISTS public.format_packings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_format_material_id  uuid NOT NULL REFERENCES public.catalog_format_materials(id) ON DELETE CASCADE,
  supplier                    text,
  pieces_box                  numeric NOT NULL DEFAULT 0,
  m2_box                      numeric NOT NULL DEFAULT 0,
  kg_box                      numeric NOT NULL DEFAULT 0,
  boxes_pallet                numeric NOT NULL DEFAULT 0,
  m2_pallet                   numeric NOT NULL DEFAULT 0,
  kg_pallet                   numeric NOT NULL DEFAULT 0,
  is_published                boolean NOT NULL DEFAULT true,
  sort_order                  integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_format_packings_catalog ON public.format_packings(catalog_format_material_id);
CREATE INDEX IF NOT EXISTS idx_format_packings_published ON public.format_packings(is_published) WHERE is_published = true;

-- 4) Series assignment columns
ALTER TABLE public.format_materials
  ADD COLUMN IF NOT EXISTS catalog_format_material_id uuid REFERENCES public.catalog_format_materials(id),
  ADD COLUMN IF NOT EXISTS selected_packing_id uuid REFERENCES public.format_packings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_format_materials_catalog ON public.format_materials(catalog_format_material_id);

-- updated_at triggers
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['catalog_format_materials', 'format_packings']) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- 5) Deduplicate existing series formats into catalog (characteristic empty)
INSERT INTO public.catalog_format_materials (material_id, width_cm, height_cm, format_label, characteristic, status)
SELECT DISTINCT ON (fm.material_id, fm.width_cm, fm.height_cm)
  fm.material_id,
  fm.width_cm,
  fm.height_cm,
  fm.format_label,
  '',
  'published'
FROM public.format_materials fm
ORDER BY fm.material_id, fm.width_cm, fm.height_cm, fm.created_at
ON CONFLICT (material_id, width_cm, height_cm, characteristic) DO NOTHING;

-- Link series rows to catalog (base characteristic)
UPDATE public.format_materials fm
SET catalog_format_material_id = c.id
FROM public.catalog_format_materials c
WHERE fm.catalog_format_material_id IS NULL
  AND c.material_id = fm.material_id
  AND c.width_cm = fm.width_cm
  AND c.height_cm = fm.height_cm
  AND c.characteristic = '';

-- Packing seed + catalog/packings (single statement: no staging table; safe in Supabase SQL editor)
WITH packing_seed AS (
  SELECT * FROM (VALUES
    ('gres-pasta-roja'::text, 33.3::numeric, 33.3::numeric, '33,3x33,3'::text, '9mm'::text, 14::numeric, 1.55::numeric, 27.05::numeric, 46::numeric, 71.3::numeric, 1260::numeric),
    ('gres-pasta-roja'::text, 33.3::numeric, 33.3::numeric, '33,3x33,3'::text, 'ESP'::text, 10::numeric, 1.11::numeric, 23::numeric, 54::numeric, 59.94::numeric, 1255::numeric),
    ('gres-pasta-roja'::text, 19::numeric, 57::numeric, '19x57'::text, ''::text, 13::numeric, 1.41::numeric, 26.5::numeric, 48::numeric, 67.68::numeric, 1235::numeric),
    ('gres-pasta-roja'::text, 20::numeric, 60::numeric, '20x60'::text, ''::text, 14::numeric, 1.68::numeric, 28.5::numeric, 40::numeric, 67.2::numeric, 1170::numeric),
    ('gres-pasta-roja'::text, 45::numeric, 45::numeric, '45x45'::text, ''::text, 9::numeric, 1.82::numeric, 27::numeric, 52::numeric, 94.24::numeric, 1500::numeric),
    ('gres-antihielo'::text, 33.3::numeric, 33.3::numeric, '33,3x33,3'::text, '10,5mm'::text, 11::numeric, 1.22::numeric, 27::numeric, 54::numeric, 65.88::numeric, 1473::numeric),
    ('azulejo-pasta-roja'::text, 10::numeric, 10::numeric, '10x10'::text, ''::text, 50::numeric, 0.5::numeric, 28::numeric, 200::numeric, 100::numeric, 1400::numeric),
    ('azulejo-pasta-roja'::text, 15::numeric, 15::numeric, '15x15'::text, ''::text, 44::numeric, 1::numeric, 30.55::numeric, 126::numeric, 126::numeric, 1345::numeric),
    ('azulejo-pasta-roja'::text, 10::numeric, 20::numeric, '10x20'::text, ''::text, 50::numeric, 1::numeric, 12.92::numeric, 96::numeric, 96::numeric, 1256::numeric),
    ('azulejo-pasta-roja'::text, 20::numeric, 20::numeric, '20x20'::text, ''::text, 25::numeric, 1::numeric, 17.65::numeric, 90::numeric, 126::numeric, 1589::numeric),
    ('azulejo-pasta-roja'::text, 20::numeric, 50::numeric, '20x50'::text, ''::text, 15::numeric, 1.5::numeric, 21.86::numeric, 48::numeric, 72::numeric, 1065::numeric),
    ('azulejo-pasta-roja'::text, 20::numeric, 60::numeric, '20x60'::text, ''::text, 12::numeric, 1.44::numeric, 21.45::numeric, 48::numeric, 69.12::numeric, 1045::numeric),
    ('azulejo-pasta-roja'::text, 25::numeric, 40::numeric, '25x40'::text, ''::text, 15::numeric, 1.5::numeric, 21.54::numeric, 60::numeric, 90::numeric, 1310::numeric),
    ('azulejo-pasta-roja'::text, 25::numeric, 50::numeric, '25x50'::text, ''::text, 12::numeric, 1.5::numeric, 21.9::numeric, 56::numeric, 84::numeric, 1226::numeric),
    ('azulejo-pasta-roja'::text, 30::numeric, 60::numeric, '30x60'::text, ''::text, 9::numeric, 1.44::numeric, 21.2::numeric, 60::numeric, 86.4::numeric, 1290::numeric),
    ('azulejo-pasta-roja'::text, 25::numeric, 80::numeric, '25x80'::text, ''::text, 9::numeric, 1.2::numeric, 23.02::numeric, 64::numeric, 76.8::numeric, 1475::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 60::numeric, '30x60'::text, 'XS PB'::text, 9::numeric, 1.62::numeric, 20::numeric, 60::numeric, 97.2::numeric, 1200::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 60::numeric, '30x60'::text, 'RC PB'::text, 9::numeric, 1.62::numeric, 24::numeric, 48::numeric, 77.76::numeric, 1170::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 60::numeric, '30x60'::text, 'RC PB Relieve'::text, 9::numeric, 1.44::numeric, 24::numeric, 48::numeric, 69.12::numeric, 714::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 60::numeric, '30x60'::text, 'XS RC PB Relieve'::text, 9::numeric, 1.62::numeric, 20::numeric, 60::numeric, 97.2::numeric, 1240::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 90::numeric, '30x90'::text, 'RC'::text, 5::numeric, 1.35::numeric, 22::numeric, 63::numeric, 85.05::numeric, 1239::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 90::numeric, '30x90'::text, 'RC Relieve'::text, 4::numeric, 1.08::numeric, 22::numeric, 63::numeric, 68.04::numeric, 1219::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 90::numeric, '30x90'::text, 'XS RC Fino'::text, 6::numeric, 1.62::numeric, 19.5::numeric, 63::numeric, 102.06::numeric, 1240::numeric),
    ('azulejo-pasta-blanca'::text, 30::numeric, 90::numeric, '30x90'::text, 'XS RC Relieve'::text, 6::numeric, 1.35::numeric, 19::numeric, 63::numeric, 85.05::numeric, 1210::numeric),
    ('azulejo-pasta-blanca'::text, 40::numeric, 120::numeric, '40x120'::text, 'XS RC Base'::text, 5::numeric, 2.4::numeric, 30::numeric, 20::numeric, 48::numeric, 409::numeric),
    ('azulejo-pasta-blanca'::text, 40::numeric, 120::numeric, '40x120'::text, 'XS RC Base (4pz)'::text, 4::numeric, 1.92::numeric, 28::numeric, 20::numeric, 38.4::numeric, 560::numeric),
    ('porcelanico'::text, 30::numeric, 60::numeric, '30x60'::text, 'SL'::text, 8::numeric, 1.44::numeric, 30::numeric, 40::numeric, 57.6::numeric, 1080::numeric),
    ('porcelanico'::text, 60::numeric, 60::numeric, '60x60'::text, 'SL RC'::text, 4::numeric, 1.44::numeric, 27::numeric, 40::numeric, 57.6::numeric, 1140::numeric),
    ('porcelanico'::text, 60::numeric, 60::numeric, '60x60'::text, 'SL'::text, 4::numeric, 1.44::numeric, 30::numeric, 32::numeric, 46.08::numeric, 960::numeric),
    ('porcelanico'::text, 60::numeric, 60::numeric, '60x60'::text, 'RC 20MM'::text, 2::numeric, 0.72::numeric, 32::numeric, 32::numeric, 23.04::numeric, 1024::numeric),
    ('porcelanico'::text, 60::numeric, 60::numeric, '60x60'::text, 'XS'::text, 5::numeric, 1.8::numeric, 28::numeric, 32::numeric, 57.6::numeric, 911::numeric),
    ('porcelanico'::text, 60::numeric, 60::numeric, '60x60'::text, 'XS RC'::text, 5::numeric, 1.8::numeric, 28::numeric, 32::numeric, 57.6::numeric, 911::numeric),
    ('porcelanico'::text, 75::numeric, 75::numeric, '75x75'::text, 'SL RC'::text, 2::numeric, 1.125::numeric, 23.5::numeric, 48::numeric, 54::numeric, 1005::numeric),
    ('porcelanico'::text, 80::numeric, 80::numeric, '80x80'::text, 'RC 20MM'::text, 2::numeric, 0.64::numeric, 27.5::numeric, 48::numeric, 30.72::numeric, 1320::numeric),
    ('porcelanico'::text, 22.5::numeric, 90::numeric, '22,5x90'::text, 'SL'::text, 6::numeric, 1.215::numeric, 22.5::numeric, 60::numeric, 73.2::numeric, 1353::numeric),
    ('porcelanico'::text, 90::numeric, 90::numeric, '90x90'::text, 'SL RC'::text, 2::numeric, 1.62::numeric, 32.5::numeric, 30::numeric, 46.6::numeric, 1035::numeric),
    ('porcelanico'::text, 100::numeric, 100::numeric, '100x100'::text, 'RC Pulido'::text, 2::numeric, 2::numeric, 52.35::numeric, 28::numeric, 56::numeric, 1466::numeric),
    ('porcelanico'::text, 20::numeric, 120::numeric, '20x120'::text, 'SL RC SPZ'::text, 5::numeric, 1.2::numeric, 23.5::numeric, 45::numeric, 54::numeric, 1075::numeric),
    ('porcelanico'::text, 23::numeric, 120::numeric, '23x120'::text, 'SL'::text, 5::numeric, 1.38::numeric, 27::numeric, 45::numeric, 62.1::numeric, 1270::numeric),
    ('porcelanico'::text, 60::numeric, 120::numeric, '60x120'::text, 'SL RC'::text, 2::numeric, 1.44::numeric, 28::numeric, 36::numeric, 51.84::numeric, 1062::numeric),
    ('porcelanico'::text, 60::numeric, 120::numeric, '60x120'::text, 'RC Pulido'::text, 2::numeric, 1.44::numeric, 34::numeric, 32::numeric, 46.08::numeric, 960::numeric),
    ('porcelanico'::text, 120::numeric, 120::numeric, '120x120'::text, 'RC Pulido'::text, 2::numeric, 1.44::numeric, 39::numeric, 36::numeric, 51.84::numeric, 1250::numeric),
    ('porcelanico'::text, 120::numeric, 120::numeric, '120x120'::text, 'SL RC'::text, 2::numeric, 1.44::numeric, 30.13::numeric, 40::numeric, 57.6::numeric, 1265::numeric),
    ('lamina-ceramica'::text, 120::numeric, 280::numeric, '120x280'::text, 'RC Absolut Mate'::text, 2::numeric, 3.12::numeric, 43.8::numeric, 24::numeric, 74.88::numeric, 1171::numeric),
    ('lamina-ceramica'::text, 120::numeric, 280::numeric, '120x280'::text, 'RC Absolut Pulido'::text, 2::numeric, 3.12::numeric, 43.57::numeric, 20::numeric, 62.4::numeric, 972::numeric)
  ) AS t(
    material_slug, width_cm, height_cm, format_label, characteristic,
    pieces_box, m2_box, kg_box, boxes_pallet, m2_pallet, kg_pallet
  )
),
ins_materials AS (
  INSERT INTO public.materials (slug, name, default_technical_properties, is_active, sort_order)
  SELECT s.material_slug,
         COALESCE(names.display_name, s.material_slug),
         '{}'::jsonb,
         true,
         COALESCE((SELECT MAX(sort_order) FROM public.materials), 0) + row_number() OVER (ORDER BY s.material_slug)
  FROM (SELECT DISTINCT material_slug FROM packing_seed) s
  LEFT JOIN (
    VALUES
      ('gres-pasta-roja', 'Gres Pasta Roja'),
      ('gres-antihielo', 'Gres Antihielo'),
      ('azulejo-pasta-roja', 'Azulejo Pasta Roja'),
      ('azulejo-pasta-blanca', 'Azulejo Pasta Blanca'),
      ('porcelanico', 'Porcelánico'),
      ('lamina-ceramica', 'Lámina Cerámica')
  ) AS names(slug, display_name) ON names.slug = s.material_slug
  WHERE NOT EXISTS (SELECT 1 FROM public.materials m WHERE m.slug = s.material_slug)
  RETURNING id
),
ins_catalog AS (
  INSERT INTO public.catalog_format_materials (material_id, width_cm, height_cm, format_label, characteristic, status)
  SELECT m.id, s.width_cm, s.height_cm, s.format_label, COALESCE(s.characteristic, ''), 'published'
  FROM packing_seed s
  JOIN public.materials m ON m.slug = s.material_slug
  ON CONFLICT (material_id, width_cm, height_cm, characteristic) DO UPDATE
  SET format_label = EXCLUDED.format_label,
      status = 'published'
  RETURNING id
),
ins_packings AS (
  INSERT INTO public.format_packings (
    catalog_format_material_id,
    supplier,
    pieces_box, m2_box, kg_box,
    boxes_pallet, m2_pallet, kg_pallet,
    is_published, sort_order
  )
  SELECT
    c.id,
    NULL,
    s.pieces_box, s.m2_box, s.kg_box,
    s.boxes_pallet, s.m2_pallet, s.kg_pallet,
    true,
    0
  FROM packing_seed s
  JOIN public.materials m ON m.slug = s.material_slug
  JOIN public.catalog_format_materials c
    ON c.material_id = m.id
   AND c.width_cm = s.width_cm
   AND c.height_cm = s.height_cm
   AND c.characteristic = COALESCE(s.characteristic, '')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.format_packings p
    WHERE p.catalog_format_material_id = c.id
      AND p.pieces_box = s.pieces_box
      AND p.m2_box = s.m2_box
      AND p.kg_box = s.kg_box
      AND p.boxes_pallet = s.boxes_pallet
  )
  RETURNING id
)
SELECT
  (SELECT count(*) FROM packing_seed) AS seed_rows,
  (SELECT count(*) FROM ins_materials) AS materials_created,
  (SELECT count(*) FROM ins_catalog) AS catalog_upserted,
  (SELECT count(*) FROM ins_packings) AS packings_created;

-- For catalog rows that still have no packing (CRM-only formats): copy best match
-- from same material+dimensions (any characteristic), else placeholder unpublished
INSERT INTO public.format_packings (
  catalog_format_material_id,
  supplier,
  pieces_box, m2_box, kg_box,
  boxes_pallet, m2_pallet, kg_pallet,
  is_published, sort_order
)
SELECT
  c.id,
  'migracion',
  COALESCE(src.pieces_box, 0),
  COALESCE(src.m2_box, 0),
  COALESCE(src.kg_box, 0),
  COALESCE(src.boxes_pallet, 0),
  COALESCE(src.m2_pallet, 0),
  COALESCE(src.kg_pallet, 0),
  CASE WHEN src.id IS NULL THEN false ELSE true END,
  0
FROM public.catalog_format_materials c
LEFT JOIN LATERAL (
  SELECT p.*
  FROM public.format_packings p
  JOIN public.catalog_format_materials c2 ON c2.id = p.catalog_format_material_id
  WHERE c2.material_id = c.material_id
    AND c2.width_cm = c.width_cm
    AND c2.height_cm = c.height_cm
  ORDER BY CASE WHEN c2.characteristic = '' THEN 0 ELSE 1 END, p.created_at
  LIMIT 1
) src ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.format_packings p WHERE p.catalog_format_material_id = c.id
);

-- Assign selected packing on each series format_material
UPDATE public.format_materials fm
SET selected_packing_id = (
  SELECT fp.id
  FROM public.format_packings fp
  WHERE fp.catalog_format_material_id = fm.catalog_format_material_id
  ORDER BY fp.sort_order, fp.created_at
  LIMIT 1
)
WHERE fm.selected_packing_id IS NULL
  AND fm.catalog_format_material_id IS NOT NULL;

-- Set material packing-list order from seed category order where still 0-ish defaults
WITH seed_order AS (
  SELECT * FROM (VALUES
    ('gres-pasta-roja', 1),
    ('gres-antihielo', 2),
    ('azulejo-pasta-roja', 3),
    ('azulejo-pasta-blanca', 4),
    ('porcelanico', 5),
    ('lamina-ceramica', 6)
  ) AS t(slug, ord)
)
UPDATE public.materials m
SET sort_order = s.ord
FROM seed_order s
WHERE m.slug = s.slug;

-- Keep filter_options.sort_order aligned for materials group
UPDATE public.filter_options fo
SET sort_order = m.sort_order
FROM public.materials m, public.filter_groups fg
WHERE fo.filter_group_id = fg.id
  AND fg.key IN ('materials', 'material')
  AND fo.slug = m.slug;


