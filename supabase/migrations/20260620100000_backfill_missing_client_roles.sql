-- Backfill: users who have a profile but no role entry are invisible in the
-- admin client list. This assigns the 'client' role to any such user.
-- Skips users who already have any role (admin, therapist, client).
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'client'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id
)
ON CONFLICT DO NOTHING;
