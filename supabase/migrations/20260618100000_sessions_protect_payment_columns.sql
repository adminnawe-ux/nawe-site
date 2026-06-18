-- H-4: Clients can directly UPDATE payment_status and other sensitive session columns
-- via the browser Supabase client, bypassing the payment flow entirely.
--
-- Fix:
-- 1. Drop the unrestricted client UPDATE policy — no client portal code updates sessions
--    directly; all payment writes go through edge functions using the service role key.
-- 2. Add a trigger as defence-in-depth that raises an exception if any user-context
--    request (auth.uid() IS NOT NULL) attempts to modify the protected columns.
--    Service role requests (used by all edge functions) have auth.uid() = null and
--    are unaffected.

-- 1. Drop the over-permissive client UPDATE policy
DROP POLICY IF EXISTS "Clients can update own sessions" ON public.sessions;

-- 2. Trigger function — blocks writes to payment-sensitive columns from user sessions
CREATE OR REPLACE FUNCTION sessions_protect_payment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.uid() is non-null only for authenticated/anon user requests.
  -- Service role (used by all edge functions) has auth.uid() = null → skips this block.
  IF auth.uid() IS NOT NULL THEN
    IF NEW.payment_status  IS DISTINCT FROM OLD.payment_status  OR
       NEW.price           IS DISTINCT FROM OLD.price           OR
       NEW.currency        IS DISTINCT FROM OLD.currency        OR
       NEW.therapist_id    IS DISTINCT FROM OLD.therapist_id    OR
       NEW.client_id       IS DISTINCT FROM OLD.client_id       OR
       NEW.payment_reference IS DISTINCT FROM OLD.payment_reference THEN
      RAISE EXCEPTION
        'Direct updates to payment_status, price, currency, therapist_id, client_id, '
        'or payment_reference are not permitted. Use the authorised payment flow.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessions_protect_payment_columns_trigger
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION sessions_protect_payment_columns();
