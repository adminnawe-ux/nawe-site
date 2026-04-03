-- Move therapist-only notes out of the public sessions row.
CREATE TABLE public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists can manage own session notes" ON public.session_notes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.id = session_notes.therapist_id
      AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.id = session_notes.therapist_id
      AND t.user_id = auth.uid()
  ));

CREATE TRIGGER update_session_notes_updated_at
  BEFORE UPDATE ON public.session_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Preserve existing therapist notes before removing the leaked column.
INSERT INTO public.session_notes (session_id, therapist_id, content)
SELECT id, therapist_id, notes_therapist
FROM public.sessions
WHERE notes_therapist IS NOT NULL
  AND notes_therapist <> '';

ALTER TABLE public.sessions DROP COLUMN IF EXISTS notes_therapist;
