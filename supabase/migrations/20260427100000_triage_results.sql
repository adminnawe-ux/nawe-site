CREATE TABLE IF NOT EXISTS triage_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  presenting_issue text,
  urgency text CHECK (urgency IN ('low', 'moderate', 'high', 'crisis')),
  language_preference text,
  therapist_type text,
  gender_preference text,
  prior_therapy boolean,
  summary text,
  raw_output jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE triage_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own triage results"
  ON triage_results FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own triage results"
  ON triage_results FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on triage_results"
  ON triage_results FOR ALL USING (true);
