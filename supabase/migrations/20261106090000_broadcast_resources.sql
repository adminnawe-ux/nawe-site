-- Downloadable files attached to admin broadcasts, served at /resource/<slug>.
-- Limits and types must match src/lib/resources.ts.

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- Public so files can be fetched by URL, but with NO public SELECT policy on
-- storage.objects: public buckets serve objects by URL without one, and
-- omitting it means anon can't list the bucket to discover the random slugs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources', 'resources', true, 26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can upload resources" ON storage.objects;
CREATE POLICY "Admins can upload resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update resources" ON storage.objects;
CREATE POLICY "Admins can update resources"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete resources" ON storage.objects;
CREATE POLICY "Admins can delete resources"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins (only) may list/read objects through the API, e.g. for a future library page
DROP POLICY IF EXISTS "Admins can read resources" ON storage.objects;
CREATE POLICY "Admins can read resources"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Resource records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE
                    CHECK (slug ~ '^[a-z0-9]{8}-[a-z0-9-]{1,60}\.(pdf|ppt|pptx|doc|docx|xls|xlsx|png|jpg|jpeg)$'),
  original_filename text NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  mime_type         text NOT NULL,
  size_bytes        bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  uploaded_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage resources" ON public.resources;
CREATE POLICY "Admins manage resources"
ON public.resources FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public lookup for the /resource/<slug> page: exact slug only, so the table
-- can't be enumerated. Returns no rows for an unknown slug.
CREATE OR REPLACE FUNCTION public.get_resource(p_slug text)
RETURNS TABLE (original_filename text, mime_type text, size_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.original_filename, r.mime_type, r.size_bytes
  FROM public.resources r
  WHERE r.slug = p_slug;
$$;

REVOKE ALL ON FUNCTION public.get_resource(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resource(text) TO anon, authenticated;

-- ── Broadcast audit log ──────────────────────────────────────────────────────
ALTER TABLE public.broadcast_sends
  ADD COLUMN IF NOT EXISTS resource_ids uuid[] NOT NULL DEFAULT '{}';
