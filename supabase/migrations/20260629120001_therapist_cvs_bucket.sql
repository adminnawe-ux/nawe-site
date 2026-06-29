-- Private bucket for therapist CV documents; old files are kept for reference
INSERT INTO storage.buckets (id, name, public)
VALUES ('therapist-cvs', 'therapist-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Therapist can upload their own CVs (path must start with their user_id)
CREATE POLICY "Therapist can upload own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'therapist-cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Only admins can read CVs
CREATE POLICY "Admins can read CVs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'therapist-cvs'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
