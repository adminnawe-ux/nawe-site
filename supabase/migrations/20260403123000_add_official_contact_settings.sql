-- Seed official contact details for the public site and callbacks.
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('official_callback_phone', '"+254716231112"', 'Primary phone number for official callbacks'),
  ('support_email', '"support@nawewellness.com"', 'Primary support email for the public site'),
  ('privacy_email', '"privacy@nawewellness.com"', 'Primary privacy contact email')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
