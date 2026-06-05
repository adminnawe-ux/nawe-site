-- Public storage bucket for event poster images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read posters (public event images)
CREATE POLICY "Public read event posters"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-posters');

-- Only admins can upload/delete posters
CREATE POLICY "Admins manage event posters"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'event-posters'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
