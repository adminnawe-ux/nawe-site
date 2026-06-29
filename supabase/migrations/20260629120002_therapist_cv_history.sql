-- Tracks all CV versions uploaded by a therapist; current version lives on therapists.cv_url
CREATE TABLE therapist_cv_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  cv_url      text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE therapist_cv_history ENABLE ROW LEVEL SECURITY;

-- Admins can read history
CREATE POLICY "Admins read CV history"
  ON therapist_cv_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
