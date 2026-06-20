-- Denormalize author name so public blog reads don't need to join profiles
-- (profiles table is not readable by anon, which broke the blog query)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS author_name text;

-- Backfill from profiles for existing rows
UPDATE public.articles a
SET author_name = TRIM(CONCAT(p.first_name, ' ', p.last_name))
FROM public.profiles p
WHERE p.user_id = a.author_id
  AND a.author_name IS NULL;
