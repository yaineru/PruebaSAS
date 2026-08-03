ALTER TABLE public.generated_reports
ADD COLUMN IF NOT EXISTS report_metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS evidence_items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS signatures jsonb DEFAULT '[]'::jsonb;
