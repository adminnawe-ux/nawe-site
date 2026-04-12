-- Allow authenticated users to self-assign the therapist role during onboarding.
DROP POLICY IF EXISTS "Users can add therapist role" ON public.user_roles;

CREATE POLICY "Users can add therapist role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'therapist'::app_role
  );
