-- Validation Script for Test Data and Informes
-- Purpose: Verify all test data was created correctly and export functionality works
-- Created: 2026-06-12

-- ====================
-- 1. DATA VALIDATION
-- ====================

RAISE NOTICE '===== DATA VALIDATION REPORT =====';

-- Check companies
SELECT COUNT(*) as total_companies FROM public.companies \gset
RAISE NOTICE 'Total Companies: %', :total_companies;

-- Check users
SELECT COUNT(*) as total_users FROM public.users \gset
RAISE NOTICE 'Total Users: %', :total_users;

-- Check company members
SELECT COUNT(*) as total_members FROM public.company_members \gset
RAISE NOTICE 'Total Company Members: %', :total_members;

-- Check assets
SELECT COUNT(*) as total_assets FROM public.assets \gset
RAISE NOTICE 'Total Assets: %', :total_assets;

SELECT COUNT(*) as available_assets FROM public.assets WHERE status = 'AVAILABLE'::public.asset_status \gset
RAISE NOTICE 'Available Assets: %', :available_assets;

-- Check maintenance records
SELECT COUNT(*) as total_maintenance FROM public.maintenance_records \gset
RAISE NOTICE 'Total Maintenance Records: %', :total_maintenance;

-- Check projects
SELECT COUNT(*) as total_projects FROM public.projects \gset
RAISE NOTICE 'Total Projects: %', :total_projects;

-- Check documents
SELECT COUNT(*) as total_documents FROM public.asset_documents \gset
RAISE NOTICE 'Total Documents: %', :total_documents;

-- Check incidents
SELECT COUNT(*) as total_incidents FROM public.incidents \gset
RAISE NOTICE 'Total Incidents: %', :total_incidents;

-- ====================
-- 2. SCHEMA VALIDATION
-- ====================

RAISE NOTICE '===== SCHEMA VALIDATION =====';

-- Check enums exist
SELECT COUNT(*) as enum_count FROM pg_type 
WHERE typname IN ('asset_status', 'maintenance_type', 'maintenance_status', 'incident_priority', 'incident_status', 'project_status', 'document_type') \gset
RAISE NOTICE 'PostgreSQL Enums Found: %', :enum_count;

-- ====================
-- 3. RLS VALIDATION
-- ====================

RAISE NOTICE '===== RLS POLICY VALIDATION =====';

-- Check if RLS policies are enabled
SELECT COUNT(*) as policy_count FROM pg_policies 
WHERE tablename IN ('assets', 'maintenance_records', 'incidents', 'projects', 'asset_documents') \gset
RAISE NOTICE 'RLS Policies on Core Tables: %', :policy_count;

-- ====================
-- 4. SAMPLE DATA DETAILS
-- ====================

RAISE NOTICE '===== SAMPLE DATA DETAILS =====';

-- Assets detail
RAISE NOTICE 'Assets by Category:';
SELECT category, COUNT(*) as count FROM public.assets GROUP BY category;

-- Maintenance by type
RAISE NOTICE 'Maintenance Records by Type:';
SELECT type, COUNT(*) as count FROM public.maintenance_records GROUP BY type;

-- Incidents by status
RAISE NOTICE 'Incidents by Status:';
SELECT status, COUNT(*) as count FROM public.incidents GROUP BY status;

-- Projects by status
RAISE NOTICE 'Projects by Status:';
SELECT status, COUNT(*) as count FROM public.projects GROUP BY status;

-- ====================
-- 5. EXPORT REQUIREMENTS CHECK
-- ====================

RAISE NOTICE '===== EXPORT/REPORT REQUIREMENTS =====';

-- Check if there's enough data for reports
SELECT 
  COALESCE((SELECT COUNT(*) FROM public.assets), 0) >= 5 as has_assets,
  COALESCE((SELECT COUNT(*) FROM public.maintenance_records), 0) >= 5 as has_maintenance,
  COALESCE((SELECT COUNT(*) FROM public.incidents), 0) >= 5 as has_incidents,
  COALESCE((SELECT COUNT(*) FROM public.projects), 0) >= 2 as has_projects;

RAISE NOTICE '✓ Validation complete. Check results above.';
