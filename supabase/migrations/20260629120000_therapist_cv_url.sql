-- Add cv_url column to therapists; nullable so existing rows are unaffected
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS cv_url text;
