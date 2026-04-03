CREATE OR REPLACE FUNCTION public.validate_therapist_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(NEW.user_id, 'therapist') THEN
    RAISE EXCEPTION 'User must have the therapist role to create a therapist profile';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_therapist_role
  BEFORE INSERT ON public.therapists
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_therapist_role();