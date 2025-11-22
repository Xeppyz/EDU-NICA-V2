-- Create library_materials table for uploaded PDFs/videos and external links
-- Run this in Supabase SQL editor or psql against your database

CREATE TABLE IF NOT EXISTS public.library_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text, -- public URL (e.g., from Supabase Storage or external link)
  storage_path text, -- path inside Supabase Storage bucket if uploaded
  file_type text, -- e.g. 'pdf', 'video', 'youtube', 'link'
  created_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Optional: index to quickly query by uploaded_by
CREATE INDEX IF NOT EXISTS idx_library_materials_uploaded_by ON public.library_materials(uploaded_by);

-- NOTE: adjust RLS policies as needed. A minimal policy example:
-- ENABLE ROW LEVEL SECURITY ON public.library_materials;
-- CREATE POLICY "Public read" ON public.library_materials FOR SELECT USING (true);
-- CREATE POLICY "Authenticated insert" ON public.library_materials FOR INSERT USING (auth.role() IS NOT NULL) WITH CHECK (auth.uid() = uploaded_by OR auth.role() IN ('teacher','admin'));

-- Recommended RLS policies for `library_materials`:
-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.library_materials ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including unauthenticated) to read the list of materials.
-- Change USING to restrict reads if you prefer only authenticated users.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_select_all_library_materials') THEN
    CREATE POLICY "allow_select_all_library_materials" ON public.library_materials FOR SELECT USING (true);
  END IF;
END$$;

-- Allow inserts only when the requester is a teacher or admin, or when the uploaded_by equals the authenticated user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_insert_library_materials') THEN
    CREATE POLICY "allow_insert_library_materials" ON public.library_materials FOR INSERT
      USING (auth.role() IN ('teacher','admin'))
      WITH CHECK (auth.role() IN ('teacher','admin') OR auth.uid() = uploaded_by);
  END IF;
END$$;

-- Allow updates by the owner or by teachers/admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_update_library_materials') THEN
    CREATE POLICY "allow_update_library_materials" ON public.library_materials FOR UPDATE
      USING (auth.role() IN ('teacher','admin') OR auth.uid() = uploaded_by)
      WITH CHECK (auth.role() IN ('teacher','admin') OR auth.uid() = uploaded_by);
  END IF;
END$$;

-- Allow deletes by the owner or by teachers/admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_delete_library_materials') THEN
    CREATE POLICY "allow_delete_library_materials" ON public.library_materials FOR DELETE
      USING (auth.role() IN ('teacher','admin') OR auth.uid() = uploaded_by);
  END IF;
END$$;

