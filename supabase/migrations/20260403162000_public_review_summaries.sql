-- Move public review reads off the reviews table so review text stays private.
CREATE OR REPLACE VIEW public.reviews_public AS
SELECT
  id,
  therapist_id,
  rating,
  verified,
  created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Clients can view own reviews" ON public.reviews;

CREATE POLICY "Clients can view own reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
