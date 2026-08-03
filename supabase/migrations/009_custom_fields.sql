-- FASE 3: Phase 5 - Custom Fields (Multi-Industry)
-- Purpose: Enable companies to create custom fields for any industry
-- Created: 2026-06-11

-- Table: custom_fields
-- Purpose: Define custom fields that companies can create
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Field definition
  field_name TEXT NOT NULL,
  field_slug TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'email', 'phone', 'url',
    'number', 'currency', 'percentage',
    'date', 'time', 'datetime',
    'select', 'multi_select', 'radio', 'checkbox',
    'file', 'color', 'location', 'rating', 'formula'
  )),
  
  -- Module assignment
  module TEXT NOT NULL CHECK (module IN ('ASSETS', 'MAINTENANCE', 'INCIDENTS', 'PROJECTS', 'DOCUMENTS')),
  
  -- Configuration
  is_required BOOLEAN DEFAULT false,
  is_visible_in_list BOOLEAN DEFAULT true,
  is_filterable BOOLEAN DEFAULT true,
  is_searchable BOOLEAN DEFAULT false,
  
  -- Validation rules (stored as JSONB)
  validation_rules JSONB DEFAULT '{}', -- min, max, pattern, required, etc
  
  -- Options (for select, radio, checkbox)
  field_options JSONB DEFAULT '[]',
  
  -- Defaults
  default_value TEXT,
  help_text TEXT,
  placeholder TEXT,
  
  -- Display settings
  display_order INTEGER DEFAULT 0,
  column_width INTEGER DEFAULT 150,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, module, field_slug)
);

-- Table: custom_field_values
-- Purpose: Store actual values for custom fields per record
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  
  -- Record reference (generic)
  record_type TEXT NOT NULL, -- 'ASSET', 'MAINTENANCE', 'INCIDENT', etc
  record_id UUID NOT NULL,
  
  -- Value (stored as text, parsed by field_type)
  field_value TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(custom_field_id, record_id)
);

-- Table: custom_field_templates
-- Purpose: Store reusable field templates per industry
CREATE TABLE IF NOT EXISTS custom_field_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Template info
  template_name TEXT NOT NULL,
  description TEXT,
  industry_template_id UUID REFERENCES industry_templates(id) ON DELETE SET NULL,
  
  -- Fields in template (array of field IDs)
  field_ids UUID[] DEFAULT '{}',
  
  -- Usage
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_company ON custom_fields(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_module ON custom_fields(module);
CREATE INDEX IF NOT EXISTS idx_custom_fields_slug ON custom_fields(company_id, field_slug);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_company ON custom_field_values(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_record ON custom_field_values(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_templates_company ON custom_field_templates(company_id);

-- RLS Policies
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_templates ENABLE ROW LEVEL SECURITY;

-- NOTE (RC1 audit, 2026-07-05): same auth.uid()-vs-public.users.id bug fixed
-- in 008/018-021/026, missed here because 021 only repointed the FK on
-- custom_fields.created_by, not this RLS. Harmless in practice only because
-- the frontend for custom fields was removed as dead code in an earlier audit
-- pass, but fixed anyway so the schema has no broken policies.
-- custom_fields: Users can view, admins can manage
DROP POLICY IF EXISTS "Users can view custom fields" ON custom_fields;
CREATE POLICY "Users can view custom fields" ON custom_fields
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can manage fields" ON custom_fields;
CREATE POLICY "Admins can manage fields" ON custom_fields
  FOR INSERT WITH CHECK (public.can_manage_company(company_id));

DROP POLICY IF EXISTS "Admins can update fields" ON custom_fields;
CREATE POLICY "Admins can update fields" ON custom_fields
  FOR UPDATE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS "Admins can delete fields" ON custom_fields;
CREATE POLICY "Admins can delete fields" ON custom_fields
  FOR DELETE USING (public.can_manage_company(company_id));

-- custom_field_values: Users can view and manage own company
DROP POLICY IF EXISTS "Users can view field values" ON custom_field_values;
CREATE POLICY "Users can view field values" ON custom_field_values
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert field values" ON custom_field_values;
CREATE POLICY "Users can insert field values" ON custom_field_values
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can update field values" ON custom_field_values;
CREATE POLICY "Users can update field values" ON custom_field_values
  FOR UPDATE USING (public.is_company_member(company_id));

-- custom_field_templates: Users can view, admins can manage
DROP POLICY IF EXISTS "Users can view templates" ON custom_field_templates;
CREATE POLICY "Users can view templates" ON custom_field_templates
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can manage templates" ON custom_field_templates;
CREATE POLICY "Admins can manage templates" ON custom_field_templates
  FOR INSERT WITH CHECK (public.can_manage_company(company_id));

-- Triggers
CREATE OR REPLACE FUNCTION update_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_fields_updated_at ON custom_fields;
CREATE TRIGGER custom_fields_updated_at
BEFORE UPDATE ON custom_fields
FOR EACH ROW
EXECUTE FUNCTION update_custom_fields_updated_at();

CREATE OR REPLACE FUNCTION update_custom_field_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_field_values_updated_at ON custom_field_values;
CREATE TRIGGER custom_field_values_updated_at
BEFORE UPDATE ON custom_field_values
FOR EACH ROW
EXECUTE FUNCTION update_custom_field_values_updated_at();

CREATE OR REPLACE FUNCTION update_custom_field_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_field_templates_updated_at ON custom_field_templates;
CREATE TRIGGER custom_field_templates_updated_at
BEFORE UPDATE ON custom_field_templates
FOR EACH ROW
EXECUTE FUNCTION update_custom_field_templates_updated_at();
