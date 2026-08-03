-- FASE 3: Phase 4 - Enhanced Export & Scheduling
-- Purpose: Store export configurations and history
-- Created: 2026-06-11

-- Table: export_configurations
-- Purpose: Store user-configured export templates
CREATE TABLE IF NOT EXISTS export_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Configuration info
  config_name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL, -- ASSETS, INCIDENTS, MAINTENANCE, etc
  
  -- Export settings
  export_format TEXT NOT NULL CHECK (export_format IN ('CSV', 'PDF', 'EXCEL', 'JSON')),
  include_columns TEXT[] DEFAULT '{}',
  column_order TEXT[] DEFAULT '{}',
  column_widths JSONB DEFAULT '{}',
  
  -- Filters
  applied_filters JSONB DEFAULT '{}',
  
  -- Advanced options
  include_custom_fields BOOLEAN DEFAULT true,
  include_attachments BOOLEAN DEFAULT false,
  compress_output BOOLEAN DEFAULT false,
  
  -- Scheduling
  is_scheduled BOOLEAN DEFAULT false,
  schedule_frequency TEXT, -- DAILY, WEEKLY, MONTHLY
  schedule_time TIME,
  scheduled_recipients TEXT[] DEFAULT '{}',
  
  -- Usage
  is_active BOOLEAN DEFAULT true,
  last_exported_at TIMESTAMP WITH TIME ZONE,
  export_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: export_history
-- Purpose: Track all exports performed
CREATE TABLE IF NOT EXISTS export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES export_configurations(id) ON DELETE SET NULL,
  exported_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Export details
  entity_type TEXT NOT NULL,
  export_format TEXT NOT NULL,
  filter_summary TEXT,
  row_count INTEGER DEFAULT 0,
  
  -- File info
  file_name TEXT,
  file_path TEXT, -- path in storage
  file_size_bytes INTEGER,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')) DEFAULT 'COMPLETED',
  error_message TEXT,
  
  -- Performance
  generation_time_ms INTEGER,
  
  -- Delivery
  email_sent_to TEXT[] DEFAULT '{}',
  email_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_export_configurations_company ON export_configurations(company_id);
CREATE INDEX IF NOT EXISTS idx_export_configurations_active ON export_configurations(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_export_configurations_scheduled ON export_configurations(company_id, is_scheduled);
CREATE INDEX IF NOT EXISTS idx_export_history_company ON export_history(company_id);
CREATE INDEX IF NOT EXISTS idx_export_history_config ON export_history(config_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created ON export_history(created_at);
CREATE INDEX IF NOT EXISTS idx_export_history_status ON export_history(status);

-- RLS Policies
ALTER TABLE export_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;

-- NOTE (RC1 audit, 2026-07-05): same auth.uid()-vs-public.users.id bug fixed
-- in 008/009/018-021/026, missed here because 021 only repointed the FKs, not
-- this RLS. Harmless in practice only because the frontend for export
-- configuration was removed as dead code in an earlier audit pass, but fixed
-- anyway so the schema has no broken policies.
-- export_configurations: Users can view own company, admins can manage
DROP POLICY IF EXISTS "Users can view export configs" ON export_configurations;
CREATE POLICY "Users can view export configs" ON export_configurations
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can create configs" ON export_configurations;
CREATE POLICY "Users can create configs" ON export_configurations
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can update own configs" ON export_configurations;
CREATE POLICY "Users can update own configs" ON export_configurations
  FOR UPDATE USING (created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- export_history: Users can view own company
DROP POLICY IF EXISTS "Users can view export history" ON export_history;
CREATE POLICY "Users can view export history" ON export_history
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert export history" ON export_history;
CREATE POLICY "Users can insert export history" ON export_history
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND exported_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Triggers
CREATE OR REPLACE FUNCTION update_export_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS export_configurations_updated_at ON export_configurations;
CREATE TRIGGER export_configurations_updated_at
BEFORE UPDATE ON export_configurations
FOR EACH ROW
EXECUTE FUNCTION update_export_configurations_updated_at();
