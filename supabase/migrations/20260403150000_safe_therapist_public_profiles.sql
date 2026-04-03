-- Narrow public therapist exposure to names and avatars only.
DROP POLICY IF EXISTS "Anyone can view therapist profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.therapist_public_profiles AS
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.avatar_url
FROM public.profiles p
JOIN public.therapists t ON t.user_id = p.user_id
WHERE t.verified = true;

GRANT SELECT ON public.therapist_public_profiles TO anon, authenticated;
