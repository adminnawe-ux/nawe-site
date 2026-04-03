INSERT INTO storage.buckets (id, name, public) VALUES ('article-covers', 'article-covers', true);

CREATE POLICY "Admins can upload article covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'article-covers' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update article covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'article-covers' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete article covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'article-covers' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Anyone can view article covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-covers');