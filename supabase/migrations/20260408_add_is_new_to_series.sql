ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;
