-- =============================================================
-- Fill packing data from official packing-list (fotos / catálogo)
-- Run in Supabase SQL Editor (bypasses RLS).
-- =============================================================

WITH seed(material_slug, width_cm, height_cm, format_label, characteristic, pieces_box, m2_box, kg_box, boxes_pallet, m2_pallet, kg_pallet) AS (
  VALUES
  ('gres-pasta-roja', 33.3, 33.3, '33,3x33,3', '9mm', 14, 1.55, 27.05, 46, 71.3, 1260),
  ('gres-pasta-roja', 33.3, 33.3, '33,3x33,3', 'ESP', 10, 1.11, 23, 54, 59.94, 1255),
  ('gres-pasta-roja', 19, 57, '19x57', '', 13, 1.41, 26.5, 48, 67.68, 1235),
  ('gres-pasta-roja', 20, 60, '20x60', '', 14, 1.68, 28.5, 40, 67.2, 1170),
  ('gres-pasta-roja', 45, 45, '45x45', '', 9, 1.82, 27, 52, 94.24, 1500),
  ('gres-antihielo', 33.3, 33.3, '33,3x33,3', '10,5mm', 11, 1.22, 27, 54, 65.88, 1473),
  ('azulejo-pasta-roja', 10, 10, '10x10', '', 50, 0.5, 28, 200, 100, 1400),
  ('azulejo-pasta-roja', 15, 15, '15x15', '', 44, 1, 30.55, 126, 126, 1345),
  ('azulejo-pasta-roja', 10, 20, '10x20', '', 50, 1, 12.92, 96, 96, 1256),
  ('azulejo-pasta-roja', 20, 20, '20x20', '', 25, 1, 17.65, 90, 126, 1589),
  ('azulejo-pasta-roja', 20, 50, '20x50', '', 15, 1.5, 21.86, 48, 72, 1065),
  ('azulejo-pasta-roja', 20, 60, '20x60', '', 12, 1.44, 21.45, 48, 69.12, 1045),
  ('azulejo-pasta-roja', 25, 40, '25x40', '', 15, 1.5, 21.54, 60, 90, 1310),
  ('azulejo-pasta-roja', 25, 50, '25x50', '', 12, 1.5, 21.9, 56, 84, 1226),
  ('azulejo-pasta-roja', 30, 60, '30x60', '', 9, 1.44, 21.2, 60, 86.4, 1290),
  ('azulejo-pasta-roja', 25, 80, '25x80', '', 9, 1.2, 23.02, 64, 76.8, 1475),
  ('azulejo-pasta-blanca', 30, 60, '30x60', 'XS PB', 9, 1.62, 20, 60, 97.2, 1200),
  ('azulejo-pasta-blanca', 30, 60, '30x60', 'RC PB', 9, 1.62, 24, 48, 77.76, 1170),
  ('azulejo-pasta-blanca', 30, 60, '30x60', 'RC PB Relieve', 9, 1.44, 24, 48, 69.12, 714),
  ('azulejo-pasta-blanca', 30, 60, '30x60', 'XS RC PB Relieve', 9, 1.62, 20, 60, 97.2, 1240),
  ('azulejo-pasta-blanca', 30, 90, '30x90', 'RC', 5, 1.35, 22, 63, 85.05, 1239),
  ('azulejo-pasta-blanca', 30, 90, '30x90', 'RC Relieve', 4, 1.08, 22, 63, 68.04, 1219),
  ('azulejo-pasta-blanca', 30, 90, '30x90', 'XS RC Fino', 6, 1.62, 19.5, 63, 102.06, 1240),
  ('azulejo-pasta-blanca', 30, 90, '30x90', 'XS RC Relieve', 6, 1.35, 19, 63, 85.05, 1210),
  ('azulejo-pasta-blanca', 40, 120, '40x120', 'XS RC Base', 5, 2.4, 30, 20, 48, 409),
  ('azulejo-pasta-blanca', 40, 120, '40x120', 'XS RC Base (4pz)', 4, 1.92, 28, 20, 38.4, 560),
  ('porcelanico', 30, 60, '30x60', 'SL', 8, 1.44, 30, 40, 57.6, 1080),
  ('porcelanico', 60, 60, '60x60', 'SL RC', 4, 1.44, 27, 40, 57.6, 1140),
  ('porcelanico', 60, 60, '60x60', 'SL', 4, 1.44, 30, 32, 46.08, 960),
  ('porcelanico', 60, 60, '60x60', 'RC 20MM', 2, 0.72, 32, 32, 23.04, 1024),
  ('porcelanico', 60, 60, '60x60', 'XS', 5, 1.8, 28, 32, 57.6, 911),
  ('porcelanico', 60, 60, '60x60', 'XS RC', 5, 1.8, 28, 32, 57.6, 911),
  ('porcelanico', 75, 75, '75x75', 'SL RC', 2, 1.125, 23.5, 48, 54, 1005),
  ('porcelanico', 80, 80, '80x80', 'RC 20MM', 2, 0.64, 27.5, 48, 30.72, 1320),
  ('porcelanico', 22.5, 90, '22,5x90', 'SL', 6, 1.215, 22.5, 60, 73.2, 1353),
  ('porcelanico', 90, 90, '90x90', 'SL RC', 2, 1.62, 32.5, 30, 46.6, 1035),
  ('porcelanico', 100, 100, '100x100', 'RC Pulido', 2, 2, 52.35, 28, 56, 1466),
  ('porcelanico', 20, 120, '20x120', 'SL RC SPZ', 5, 1.2, 23.5, 45, 54, 1075),
  ('porcelanico', 23, 120, '23x120', 'SL', 5, 1.38, 27, 45, 62.1, 1270),
  ('porcelanico', 60, 120, '60x120', 'SL RC', 2, 1.44, 28, 36, 51.84, 1062),
  ('porcelanico', 60, 120, '60x120', 'RC Pulido', 2, 1.44, 34, 32, 46.08, 960),
  ('porcelanico', 120, 120, '120x120', 'RC Pulido', 2, 1.44, 39, 36, 51.84, 1250),
  ('porcelanico', 120, 120, '120x120', 'SL RC', 2, 1.44, 30.13, 40, 57.6, 1265),
  ('lamina-ceramica', 120, 280, '120x280', 'RC Absolut Mate', 2, 3.12, 43.8, 24, 74.88, 1171),
  ('lamina-ceramica', 120, 280, '120x280', 'RC Absolut Pulido', 2, 3.12, 43.57, 20, 62.4, 972)
),
-- Alias CRM materials -> packing-list material slug
alias(crm_slug, seed_slug) AS (
  VALUES
    ('gres-pasta-roja', 'gres-pasta-roja'),
    ('gres', 'gres-pasta-roja'),
    ('gres-espesorado', 'gres-pasta-roja'),
    ('gres-antihielo', 'gres-antihielo'),
    ('azulejo-pasta-roja', 'azulejo-pasta-roja'),
    ('revestimiento-pasta-roja', 'azulejo-pasta-roja'),
    ('azulejo-pasta-blanca', 'azulejo-pasta-blanca'),
    ('revestimiento-pasta-blanca', 'azulejo-pasta-blanca'),
    ('porcelanico', 'porcelanico'),
    ('lamina-ceramica', 'lamina-ceramica')
),
-- 1) Ensure catalog rows exist for official seed (on canonical materials)
upsert_catalog AS (
  INSERT INTO public.catalog_format_materials (material_id, width_cm, height_cm, format_label, characteristic, status)
  SELECT m.id, s.width_cm, s.height_cm, s.format_label, COALESCE(s.characteristic, ''), 'published'
  FROM seed s
  JOIN public.materials m ON m.slug = s.material_slug
  ON CONFLICT (material_id, width_cm, height_cm, characteristic) DO UPDATE
  SET format_label = EXCLUDED.format_label,
      status = 'published'
  RETURNING id
),
-- 2) Upsert packings on those official catalog rows
matched_official AS (
  SELECT c.id AS catalog_id, s.*
  FROM seed s
  JOIN public.materials m ON m.slug = s.material_slug
  JOIN public.catalog_format_materials c
    ON c.material_id = m.id
   AND c.width_cm = s.width_cm
   AND c.height_cm = s.height_cm
   AND c.characteristic = COALESCE(s.characteristic, '')
),
upd_official AS (
  UPDATE public.format_packings p
  SET
    pieces_box = mo.pieces_box,
    m2_box = mo.m2_box,
    kg_box = mo.kg_box,
    boxes_pallet = mo.boxes_pallet,
    m2_pallet = mo.m2_pallet,
    kg_pallet = mo.kg_pallet,
    is_published = true,
    supplier = CASE WHEN p.supplier = 'migracion' THEN NULL ELSE p.supplier END
  FROM matched_official mo
  WHERE p.catalog_format_material_id = mo.catalog_id
  RETURNING p.id
),
ins_official AS (
  INSERT INTO public.format_packings (
    catalog_format_material_id, supplier,
    pieces_box, m2_box, kg_box,
    boxes_pallet, m2_pallet, kg_pallet,
    is_published, sort_order
  )
  SELECT
    mo.catalog_id, NULL,
    mo.pieces_box, mo.m2_box, mo.kg_box,
    mo.boxes_pallet, mo.m2_pallet, mo.kg_pallet,
    true, 0
  FROM matched_official mo
  WHERE NOT EXISTS (
    SELECT 1 FROM public.format_packings p WHERE p.catalog_format_material_id = mo.catalog_id
  )
  RETURNING id
),
-- 3) Fill packings on CRM catalog rows (any material alias) by size + characteristic
crm_targets AS (
  SELECT
    c.id AS catalog_id,
    s.pieces_box, s.m2_box, s.kg_box,
    s.boxes_pallet, s.m2_pallet, s.kg_pallet
  FROM public.catalog_format_materials c
  JOIN public.materials m ON m.id = c.material_id
  JOIN alias a ON a.crm_slug = m.slug
  JOIN seed s
    ON s.material_slug = a.seed_slug
   AND s.width_cm = c.width_cm
   AND s.height_cm = c.height_cm
   AND s.characteristic = COALESCE(c.characteristic, '')
),
upd_crm AS (
  UPDATE public.format_packings p
  SET
    pieces_box = t.pieces_box,
    m2_box = t.m2_box,
    kg_box = t.kg_box,
    boxes_pallet = t.boxes_pallet,
    m2_pallet = t.m2_pallet,
    kg_pallet = t.kg_pallet,
    is_published = true,
    supplier = CASE WHEN p.supplier = 'migracion' THEN NULL ELSE p.supplier END
  FROM crm_targets t
  WHERE p.catalog_format_material_id = t.catalog_id
  RETURNING p.id
),
ins_crm AS (
  INSERT INTO public.format_packings (
    catalog_format_material_id, supplier,
    pieces_box, m2_box, kg_box,
    boxes_pallet, m2_pallet, kg_pallet,
    is_published, sort_order
  )
  SELECT
    t.catalog_id, NULL,
    t.pieces_box, t.m2_box, t.kg_box,
    t.boxes_pallet, t.m2_pallet, t.kg_pallet,
    true, 0
  FROM crm_targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.format_packings p WHERE p.catalog_format_material_id = t.catalog_id
  )
  RETURNING id
),
-- 4) For catalog rows with empty characteristic still at 0: copy from same size+material seed (prefer empty char, else first)
cud_empty AS (
  SELECT
    c.id AS catalog_id,
    s.pieces_box, s.m2_box, s.kg_box,
    s.boxes_pallet, s.m2_pallet, s.kg_pallet
  FROM public.catalog_format_materials c
  JOIN public.materials m ON m.id = c.material_id
  JOIN alias a ON a.crm_slug = m.slug
  JOIN LATERAL (
    SELECT s.*
    FROM seed s
    WHERE s.material_slug = a.seed_slug
      AND s.width_cm = c.width_cm
      AND s.height_cm = c.height_cm
    ORDER BY CASE WHEN s.characteristic = '' THEN 0 ELSE 1 END, s.characteristic
    LIMIT 1
  ) s ON true
  WHERE COALESCE(c.characteristic, '') = ''
),
upd_empty AS (
  UPDATE public.format_packings p
  SET
    pieces_box = e.pieces_box,
    m2_box = e.m2_box,
    kg_box = e.kg_box,
    boxes_pallet = e.boxes_pallet,
    m2_pallet = e.m2_pallet,
    kg_pallet = e.kg_pallet,
    is_published = true,
    supplier = CASE WHEN p.supplier = 'migracion' THEN NULL ELSE p.supplier END
  FROM cud_empty e
  WHERE p.catalog_format_material_id = e.catalog_id
    AND (p.pieces_box = 0 OR p.supplier = 'migracion' OR p.m2_box = 0)
  RETURNING p.id
),
-- 5) Re-point series selected packing to first packing of its catalog
repoint AS (
  UPDATE public.format_materials fm
  SET selected_packing_id = (
    SELECT fp.id
    FROM public.format_packings fp
    WHERE fp.catalog_format_material_id = fm.catalog_format_material_id
    ORDER BY CASE WHEN fp.pieces_box > 0 THEN 0 ELSE 1 END, fp.sort_order, fp.created_at
    LIMIT 1
  )
  WHERE fm.catalog_format_material_id IS NOT NULL
  RETURNING fm.id
)
SELECT
  (SELECT count(*) FROM upsert_catalog) AS catalog_upserted,
  (SELECT count(*) FROM upd_official) AS official_packings_updated,
  (SELECT count(*) FROM ins_official) AS official_packings_inserted,
  (SELECT count(*) FROM upd_crm) AS crm_packings_updated,
  (SELECT count(*) FROM ins_crm) AS crm_packings_inserted,
  (SELECT count(*) FROM upd_empty) AS empty_char_filled,
  (SELECT count(*) FROM repoint) AS series_repointed;
