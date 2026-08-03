-- FASE 3: Image Management
-- Purpose: Support image uploads, gallery, and before/after comparisons
-- Created: 2026-06-11

-- Table: asset_images
-- Purpose: Store image metadata and relationships
CREATE TABLE IF NOT EXISTS asset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  maintenance_record_id UUID REFERENCES maintenance_records(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  
  -- Image metadata
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase storage
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- Image info
  title TEXT,
  description TEXT,
  image_type TEXT NOT NULL CHECK (image_type IN ('BEFORE', 'AFTER', 'REFERENCE', 'DOCUMENTATION')),
  
  -- Thumbnail
  thumbnail_path TEXT,
  
  -- Metadata
  captured_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: image_comparisons
-- Purpose: Store before/after image pair relationships
CREATE TABLE IF NOT EXISTS image_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  before_image_id UUID NOT NULL REFERENCES asset_images(id) ON DELETE CASCADE,
  after_image_id UUID NOT NULL REFERENCES asset_images(id) ON DELETE CASCADE,
  
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  maintenance_record_id UUID REFERENCES maintenance_records(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  
  -- Comparison info
  comparison_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  findings TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: image_gallery_settings
-- Purpose: Store user preferences for image galleries
CREATE TABLE IF NOT EXISTS image_gallery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  default_view TEXT DEFAULT 'grid', -- grid, list, carousel
  items_per_page INTEGER DEFAULT 12,
  auto_thumbnail BOOLEAN DEFAULT true,
  max_image_size_mb NUMERIC DEFAULT 10,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asset_images_company ON asset_images(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_images_asset ON asset_images(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_images_type ON asset_images(image_type);
CREATE INDEX IF NOT EXISTS idx_asset_images_created ON asset_images(created_at);
CREATE INDEX IF NOT EXISTS idx_image_comparisons_company ON image_comparisons(company_id);
CREATE INDEX IF NOT EXISTS idx_image_comparisons_before ON image_comparisons(before_image_id);
CREATE INDEX IF NOT EXISTS idx_image_comparisons_after ON image_comparisons(after_image_id);
CREATE INDEX IF NOT EXISTS idx_image_comparisons_asset ON image_comparisons(asset_id);

-- RLS Policies
ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_gallery_settings ENABLE ROW LEVEL SECURITY;

-- NOTE (RC1 audit, 2026-07-05): these policies originally compared
-- id/uploaded_by/user_id (all public.users.id values) directly to auth.uid()
-- (the Supabase Auth UID) - same bug class fixed elsewhere via 018-021/026,
-- missed here because 021 only repointed the FKs, not the RLS. Harmless in
-- practice only because no page currently uses asset_images/image_comparisons/
-- image_gallery_settings (the frontend for this feature was removed as dead
-- code in an earlier audit pass), but fixed anyway so the schema itself has
-- no broken policies.
-- asset_images: Users can view own company images
DROP POLICY IF EXISTS "Users can view own company images" ON asset_images;
CREATE POLICY "Users can view own company images" ON asset_images
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can upload images" ON asset_images;
CREATE POLICY "Users can upload images" ON asset_images
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can delete own images" ON asset_images;
CREATE POLICY "Users can delete own images" ON asset_images
  FOR DELETE USING (uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- image_comparisons: Users can view own company comparisons
DROP POLICY IF EXISTS "Users can view comparisons" ON image_comparisons;
CREATE POLICY "Users can view comparisons" ON image_comparisons
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can create comparisons" ON image_comparisons;
CREATE POLICY "Users can create comparisons" ON image_comparisons
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- image_gallery_settings: Users manage own settings
DROP POLICY IF EXISTS "Users can view own settings" ON image_gallery_settings;
CREATE POLICY "Users can view own settings" ON image_gallery_settings
  FOR SELECT USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can update own settings" ON image_gallery_settings;
CREATE POLICY "Users can update own settings" ON image_gallery_settings
  FOR UPDATE USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can insert own settings" ON image_gallery_settings;
CREATE POLICY "Users can insert own settings" ON image_gallery_settings
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- Triggers
CREATE OR REPLACE FUNCTION update_asset_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asset_images_updated_at ON asset_images;
CREATE TRIGGER asset_images_updated_at
BEFORE UPDATE ON asset_images
FOR EACH ROW
EXECUTE FUNCTION update_asset_images_updated_at();

CREATE OR REPLACE FUNCTION update_image_comparisons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS image_comparisons_updated_at ON image_comparisons;
CREATE TRIGGER image_comparisons_updated_at
BEFORE UPDATE ON image_comparisons
FOR EACH ROW
EXECUTE FUNCTION update_image_comparisons_updated_at();

CREATE OR REPLACE FUNCTION update_image_gallery_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS image_gallery_settings_updated_at ON image_gallery_settings;
CREATE TRIGGER image_gallery_settings_updated_at
BEFORE UPDATE ON image_gallery_settings
FOR EACH ROW
EXECUTE FUNCTION update_image_gallery_settings_updated_at();
