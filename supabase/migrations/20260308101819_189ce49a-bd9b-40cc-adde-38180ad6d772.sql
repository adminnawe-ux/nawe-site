
-- Therapist weekly availability schedule
CREATE TABLE public.therapist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, day_of_week, start_time)
);

ALTER TABLE public.therapist_availability ENABLE ROW LEVEL SECURITY;

-- Therapists can manage own availability
CREATE POLICY "Therapists can manage own availability"
  ON public.therapist_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_availability.therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_availability.therapist_id AND t.user_id = auth.uid()));

-- Anyone can view availability (needed for booking page)
CREATE POLICY "Anyone can view availability"
  ON public.therapist_availability FOR SELECT TO authenticated
  USING (is_active = true);

-- Admins can manage all availability
CREATE POLICY "Admins can manage availability"
  ON public.therapist_availability FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add session_link column to sessions for online meeting URLs
ALTER TABLE public.sessions ADD COLUMN session_link text;
