-- Políticas RLS para download_catalog_items.
-- En producción el SELECT público (solo published) ya existía, pero faltaba INSERT para usuarios autenticados del CRM.

ALTER TABLE public.download_catalog_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'download_catalog_items'
      AND policyname = 'download_catalog_items_public_read_published'
  ) THEN
    CREATE POLICY download_catalog_items_public_read_published
      ON public.download_catalog_items
      FOR SELECT
      TO anon, authenticated
      USING (status = 'published');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'download_catalog_items'
      AND policyname = 'download_catalog_items_authenticated_read_all'
  ) THEN
    CREATE POLICY download_catalog_items_authenticated_read_all
      ON public.download_catalog_items
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'download_catalog_items'
      AND policyname = 'download_catalog_items_authenticated_insert'
  ) THEN
    CREATE POLICY download_catalog_items_authenticated_insert
      ON public.download_catalog_items
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'download_catalog_items'
      AND policyname = 'download_catalog_items_authenticated_update'
  ) THEN
    CREATE POLICY download_catalog_items_authenticated_update
      ON public.download_catalog_items
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'download_catalog_items'
      AND policyname = 'download_catalog_items_authenticated_delete'
  ) THEN
    CREATE POLICY download_catalog_items_authenticated_delete
      ON public.download_catalog_items
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
