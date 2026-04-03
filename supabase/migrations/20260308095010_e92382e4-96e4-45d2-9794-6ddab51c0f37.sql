CREATE POLICY "Clients can update own sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);