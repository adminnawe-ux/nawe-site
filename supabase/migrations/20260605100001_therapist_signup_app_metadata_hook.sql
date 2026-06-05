-- Auth hook: when a new user signs up with account_type='therapist' in user_metadata,
-- promote that value into app_metadata (server-controlled) so the RLS policy
-- on user_roles can safely check app_metadata instead of user_metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data ->> 'account_type') = 'therapist' THEN
    NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('account_type', 'therapist');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_set_app_metadata ON auth.users;
CREATE TRIGGER on_auth_user_created_set_app_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_app_metadata();
