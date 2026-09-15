-- Therapists previously had NO way to see who their client is — not even a
-- name — because no RLS policy granted read access to a client's profile
-- row. Scope visibility strictly to clients they actually have a paid
-- session with (name + phone only; email lives in auth.users and is served
-- separately by the get-client-contact edge function, scoped the same way).
CREATE POLICY "Therapists can view profiles of their paid-session clients"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.therapists t ON t.id = s.therapist_id
      WHERE s.client_id = profiles.user_id
        AND t.user_id = auth.uid()
        AND s.payment_status = 'paid'
    )
  );
