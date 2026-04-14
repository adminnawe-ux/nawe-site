-- Fetch public therapist display details for a single user_id.
-- Result:
--   display_name = First Name + Last Initial (or professional title fallback)
--   professional_title = therapist.title

WITH therapist_data AS (
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    t.professional_title
  FROM public.profiles p
  JOIN public.therapists t
    ON t.user_id = p.user_id
  WHERE p.user_id = 'd29aa5d1-02f9-4f64-99fa-9acf7b7543b8'
)
SELECT
  user_id,
  CASE
    WHEN first_name IS NOT NULL AND btrim(first_name) <> '' AND last_name IS NOT NULL AND btrim(last_name) <> '' THEN
      btrim(first_name) || ' ' || upper(left(btrim(last_name), 1)) || '.'
    WHEN first_name IS NOT NULL AND btrim(first_name) <> '' THEN
      btrim(first_name)
    WHEN last_name IS NOT NULL AND btrim(last_name) <> '' THEN
      btrim(last_name)
    ELSE
      COALESCE(professional_title, 'Therapist')
  END AS display_name,
  COALESCE(professional_title, 'Therapist') AS professional_title
FROM therapist_data;
