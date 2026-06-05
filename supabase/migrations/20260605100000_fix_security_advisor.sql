-- Fix 1: RLS policy on user_roles used user_metadata which is user-editable.
-- Replace with raw_app_meta_data which is set server-side only and cannot be
-- modified by the user via supabase.auth.updateUser().
DROP POLICY IF EXISTS "Therapist applicants can self-assign therapist role" ON public.user_roles;

CREATE POLICY "Therapist applicants can self-assign therapist role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'therapist'::app_role
    AND (auth.jwt() -> 'app_metadata' ->> 'account_type') = 'therapist'
  );

-- Fix 2 & 3: Views were created without security_invoker, causing them to run
-- with the definer's privileges and bypass RLS on underlying tables.
-- Recreate both views with security_invoker = true.

DROP VIEW IF EXISTS public.therapist_public_profiles;
CREATE VIEW public.therapist_public_profiles
  WITH (security_invoker = true)
AS
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.avatar_url
FROM public.profiles p
JOIN public.therapists t ON t.user_id = p.user_id
WHERE t.verified = true;

GRANT SELECT ON public.therapist_public_profiles TO anon, authenticated;

DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public
  WITH (security_invoker = true)
AS
SELECT
  id,
  therapist_id,
  rating,
  verified,
  created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_public TO anon, authenticated;
