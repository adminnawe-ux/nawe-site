-- Track the CC addresses (if any) used on a broadcast send, for the audit log.

ALTER TABLE public.broadcast_sends
  ADD COLUMN IF NOT EXISTS cc_addresses text[] NOT NULL DEFAULT '{}';
