CREATE POLICY "Anyone can view therapist profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.user_id = profiles.user_id AND t.verified = true
  )
);