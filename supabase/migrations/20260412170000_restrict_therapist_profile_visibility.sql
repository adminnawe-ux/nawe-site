-- Prevent therapist accounts from viewing other therapists' public profiles.
-- Clients and anonymous visitors can still browse verified therapist profiles.

DROP POLICY IF EXISTS "Anyone can view therapist profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public and clients can view verified therapist profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view verified therapists" ON public.therapists;
DROP POLICY IF EXISTS "Public and clients can view verified therapists" ON public.therapists;

CREATE POLICY "Public and clients can view verified therapist profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    EXISTS (
      SELECT 1
      FROM public.therapists t
      WHERE t.user_id = profiles.user_id
        AND t.verified = true
    )
    AND (
      NOT public.has_role(auth.uid(), 'therapist'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
);

CREATE POLICY "Public and clients can view verified therapists"
ON public.therapists
FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    verified = true
    AND (
      NOT public.has_role(auth.uid(), 'therapist'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
);
