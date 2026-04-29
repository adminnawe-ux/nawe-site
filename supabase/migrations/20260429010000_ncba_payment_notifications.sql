-- Table for storing NCBA push notification payloads that arrive before a matching session exists
CREATE TABLE IF NOT EXISTS public.ncba_payment_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_id      text NOT NULL,
  trans_type    text,
  trans_amount  numeric NOT NULL,
  trans_time    text,
  bill_ref_number text,
  mobile        text,
  customer_name text,
  raw_payload   jsonb,
  matched       boolean NOT NULL DEFAULT false,
  session_id    uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ncba_payment_notifications_trans_id_idx
  ON public.ncba_payment_notifications (trans_id);

ALTER TABLE public.ncba_payment_notifications ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write this table
CREATE POLICY "Service role only"
  ON public.ncba_payment_notifications
  USING (false)
  WITH CHECK (false);
