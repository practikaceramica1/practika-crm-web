-- =============================================================
-- RLS for global catalog formats + packings
-- Data already exists; without policies PostgREST returns [].
-- =============================================================

ALTER TABLE public.catalog_format_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.format_packings ENABLE ROW LEVEL SECURITY;

-- Authenticated (CRM admin session): full access
DROP POLICY IF EXISTS catalog_format_materials_authenticated_all ON public.catalog_format_materials;
CREATE POLICY catalog_format_materials_authenticated_all
  ON public.catalog_format_materials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS format_packings_authenticated_all ON public.format_packings;
CREATE POLICY format_packings_authenticated_all
  ON public.format_packings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public read: packing-list + catalog published rows
DROP POLICY IF EXISTS catalog_format_materials_public_read_published ON public.catalog_format_materials;
CREATE POLICY catalog_format_materials_public_read_published
  ON public.catalog_format_materials
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS format_packings_public_read_published ON public.format_packings;
CREATE POLICY format_packings_public_read_published
  ON public.format_packings
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_format_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.format_packings TO authenticated;
GRANT SELECT ON public.catalog_format_materials TO anon;
GRANT SELECT ON public.format_packings TO anon;
