-- Promote approved staff emails to admin on signup and backfill existing accounts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_emails text[] := ARRAY[
    'sharonn@nawe.co.ke',
    'mwenda@nawe.co.ke',
    'ithalii@nawe.co.ke'
  ];
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'last_name'
  );

  IF lower(COALESCE(NEW.email, '')) = ANY (admin_emails) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client');
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE lower(email) IN (
  'sharonn@nawe.co.ke',
  'mwenda@nawe.co.ke',
  'ithalii@nawe.co.ke'
)
ON CONFLICT DO NOTHING;
