-- Fix privilege escalation: restrict therapist role self-assignment to users who
-- signed up via the therapist signup flow (account_type = 'therapist' in JWT metadata).
-- A regular client cannot self-assign the therapist role; only users whose
-- account_type was set to 'therapist' at signup time can do so.

DROP POLICY IF EXISTS "Users can add therapist role" ON public.user_roles;

CREATE POLICY "Therapist applicants can self-assign therapist role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'therapist'::app_role
    AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'therapist'
  );
