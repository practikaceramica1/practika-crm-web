-- Políticas RLS para news_sections / news_section_assets.
-- Ya existía SELECT público solo published (catalog_public_read_*), pero el admin CRM
-- (rol authenticated) no podía ver borradores ni escribir. Mailing usa service role
-- y sí veía todo → desincronización aparente entre apps.

ALTER TABLE public.news_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_section_assets ENABLE ROW LEVEL SECURITY;

-- --- news_sections ---

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_sections'
      AND policyname = 'catalog_public_read_news_sections'
  ) THEN
    CREATE POLICY catalog_public_read_news_sections
      ON public.news_sections
      FOR SELECT
      TO anon, authenticated
      USING (status = 'published');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_sections'
      AND policyname = 'news_sections_authenticated_read_all'
  ) THEN
    CREATE POLICY news_sections_authenticated_read_all
      ON public.news_sections
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_sections'
      AND policyname = 'news_sections_authenticated_insert'
  ) THEN
    CREATE POLICY news_sections_authenticated_insert
      ON public.news_sections
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_sections'
      AND policyname = 'news_sections_authenticated_update'
  ) THEN
    CREATE POLICY news_sections_authenticated_update
      ON public.news_sections
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_sections'
      AND policyname = 'news_sections_authenticated_delete'
  ) THEN
    CREATE POLICY news_sections_authenticated_delete
      ON public.news_sections
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- --- news_section_assets ---

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_section_assets'
      AND policyname = 'catalog_public_read_news_section_assets'
  ) THEN
    CREATE POLICY catalog_public_read_news_section_assets
      ON public.news_section_assets
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.news_sections ns
          WHERE ns.id = news_section_assets.section_id
            AND ns.status = 'published'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_section_assets'
      AND policyname = 'news_section_assets_authenticated_read_all'
  ) THEN
    CREATE POLICY news_section_assets_authenticated_read_all
      ON public.news_section_assets
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_section_assets'
      AND policyname = 'news_section_assets_authenticated_insert'
  ) THEN
    CREATE POLICY news_section_assets_authenticated_insert
      ON public.news_section_assets
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_section_assets'
      AND policyname = 'news_section_assets_authenticated_update'
  ) THEN
    CREATE POLICY news_section_assets_authenticated_update
      ON public.news_section_assets
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'news_section_assets'
      AND policyname = 'news_section_assets_authenticated_delete'
  ) THEN
    CREATE POLICY news_section_assets_authenticated_delete
      ON public.news_section_assets
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
