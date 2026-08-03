-- Migration 014: Test Data Seed - CORRECT SCHEMA
-- Purpose: Create 45 test records using ONLY verified columns
-- Date: 2026-06-12
-- Based on: SCHEMA_AUDIT.md

DO $$
DECLARE
  test_company_id UUID := 'ebed759d-53af-401b-b924-a4f72ceccd38'::UUID;
  test_user_id UUID := 'e359ad67-5605-4f78-b9b8-5cb8a70805ab'::UUID;
  asset_id_1 UUID;
  asset_id_2 UUID;
  asset_id_3 UUID;
  asset_id_4 UUID;
  asset_id_5 UUID;
  asset_id_6 UUID;
  asset_id_7 UUID;
  asset_id_8 UUID;
  asset_id_9 UUID;
  asset_id_10 UUID;
  project_id_1 UUID;
  project_id_2 UUID;
  project_id_3 UUID;
  project_id_4 UUID;
  project_id_5 UUID;
BEGIN

  -- Idempotency guard: this migration seeds fixed test records (ASSET-TEST-001..010)
  -- for a fixed demo company/user. Re-running it after the data already exists would
  -- violate the (company_id, code) unique constraint on assets, so we skip early.
  IF EXISTS (
    SELECT 1 FROM public.assets WHERE company_id = test_company_id AND code = 'ASSET-TEST-001'
  ) THEN
    RAISE NOTICE 'Migration 014 test data already present for company %; skipping.', test_company_id;
    RETURN;
  END IF;

  -- ===================================
  -- 1. INSERT 10 ASSETS (Activos)
  -- ===================================
  RAISE NOTICE '📦 Inserting 10 Assets...';
  
  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer, 
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition, 
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Laptop HP Pavilion', 'ASSET-TEST-001', 'Portable work computer', 'EQUIPMENT', 'HP', 
     '15-inch', 'HP-2024-001', 'Oficina A', NOW()::DATE - INTERVAL '180 days', NOW()::DATE + INTERVAL '180 days',
     1500000, 1200000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 1"}'::jsonb, test_user_id, 'LAPTOP-001', 'HP', 2024, 'Distributor ABC', 0,
     NOW()::DATE - INTERVAL '30 days', NOW()::DATE + INTERVAL '30 days', NOW()::DATE + INTERVAL '365 days',
     NOW()::DATE + INTERVAL '365 days')
  RETURNING id INTO asset_id_1;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Desktop Dell OptiPlex', 'ASSET-TEST-002', 'Desktop workstation for office', 'EQUIPMENT', 'Dell',
     '7090', 'DELL-2024-002', 'Oficina B', NOW()::DATE - INTERVAL '365 days', NOW()::DATE + INTERVAL '365 days',
     2000000, 1600000, 'IN_USE', 'good',
     '{"notes": "Test asset 2"}'::jsonb, test_user_id, 'DESKTOP-002', 'Dell', 2023, 'Tech Supplier', 500,
     NOW()::DATE - INTERVAL '15 days', NOW()::DATE + INTERVAL '60 days', NOW()::DATE + INTERVAL '180 days',
     NOW()::DATE + INTERVAL '180 days')
  RETURNING id INTO asset_id_2;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Network Server Cisco', 'ASSET-TEST-003', 'Main network server', 'SERVER', 'Cisco',
     'Catalyst 9300', 'CISCO-2024-003', 'Server Room', NOW()::DATE - INTERVAL '730 days', NOW()::DATE + INTERVAL '365 days',
     5000000, 3500000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 3"}'::jsonb, test_user_id, 'SERVER-003', 'Cisco', 2022, 'Network Corp', 8000,
     NOW()::DATE - INTERVAL '7 days', NOW()::DATE + INTERVAL '90 days', NOW()::DATE + INTERVAL '270 days',
     NOW()::DATE + INTERVAL '270 days')
  RETURNING id INTO asset_id_3;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Printer Canon ImageRunner', 'ASSET-TEST-004', 'Multifunction printer', 'EQUIPMENT', 'Canon',
     '2520', 'CANON-2024-004', 'Print Room', NOW()::DATE - INTERVAL '90 days', NOW()::DATE + INTERVAL '365 days',
     800000, 650000, 'IN_USE', 'good',
     '{"notes": "Test asset 4"}'::jsonb, test_user_id, 'PRINTER-004', 'Canon', 2024, 'Office Solutions', 120000,
     NOW()::DATE - INTERVAL '30 days', NOW()::DATE + INTERVAL '30 days', NOW()::DATE + INTERVAL '365 days',
     NOW()::DATE + INTERVAL '365 days')
  RETURNING id INTO asset_id_4;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Air Conditioning Unit Fujitsu', 'ASSET-TEST-005', 'Central AC system', 'EQUIPMENT', 'Fujitsu',
     'RLF100D', 'FUJITSU-2024-005', 'Main Hall', NOW()::DATE - INTERVAL '1095 days', NOW()::DATE - INTERVAL '30 days',
     3000000, 1500000, 'MAINTENANCE', 'fair',
     '{"notes": "Test asset 5"}'::jsonb, test_user_id, 'AC-005', 'Fujitsu', 2021, 'Climate Control Co', 6000,
     NOW()::DATE - INTERVAL '2 days', NOW()::DATE + INTERVAL '60 days', NOW()::DATE + INTERVAL '30 days',
     NOW()::DATE + INTERVAL '30 days')
  RETURNING id INTO asset_id_5;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Security Camera Hikvision', 'ASSET-TEST-006', 'IP surveillance camera', 'SECURITY', 'Hikvision',
     'DS-2CD2023G2', 'HIKI-2024-006', 'Entrance', NOW()::DATE - INTERVAL '180 days', NOW()::DATE + INTERVAL '540 days',
     400000, 350000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 6"}'::jsonb, test_user_id, 'CAM-006', 'Hikvision', 2024, 'Security Systems', 0,
     NOW()::DATE - INTERVAL '30 days', NOW()::DATE + INTERVAL '180 days', NOW()::DATE + INTERVAL '365 days',
     NOW()::DATE + INTERVAL '365 days')
  RETURNING id INTO asset_id_6;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Office Desk Steelcase', 'ASSET-TEST-007', 'Executive desk', 'FURNITURE', 'Steelcase',
     'Series 9000', 'STEEL-2024-007', 'Oficina A', NOW()::DATE - INTERVAL '365 days', NULL,
     300000, 250000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 7"}'::jsonb, test_user_id, 'DESK-007', 'Steelcase', 2023, 'Office Furniture', 0,
     NULL, NULL, NULL, NULL)
  RETURNING id INTO asset_id_7;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Meeting Room Chair Herman Miller', 'ASSET-TEST-008', 'Ergonomic chair set', 'FURNITURE', 'Herman Miller',
     'Eames', 'HM-2024-008', 'Conference Room', NOW()::DATE - INTERVAL '365 days', NULL,
     150000, 120000, 'IN_USE', 'good',
     '{"notes": "Test asset 8"}'::jsonb, test_user_id, 'CHAIR-008', 'Herman Miller', 2023, 'Furniture Plus', 0,
     NULL, NULL, NULL, NULL)
  RETURNING id INTO asset_id_8;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Fire Extinguisher System Tyco', 'ASSET-TEST-009', 'Building fire safety system', 'SECURITY', 'Tyco',
     'TycoSafety', 'TYCO-2024-009', 'All Floors', NOW()::DATE - INTERVAL '365 days', NOW()::DATE + INTERVAL '365 days',
     200000, 180000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 9"}'::jsonb, test_user_id, 'FIRE-009', 'Tyco', 2023, 'Safety Equipment', 0,
     NOW()::DATE - INTERVAL '60 days', NOW()::DATE + INTERVAL '300 days', NOW()::DATE + INTERVAL '365 days',
     NOW()::DATE + INTERVAL '365 days')
  RETURNING id INTO asset_id_9;

  INSERT INTO public.assets (
    company_id, name, code, description, category, manufacturer,
    model, serial_number, location, purchase_date, warranty_expires_at,
    acquisition_cost, current_value, status, condition,
    metadata, created_by, plate, brand, year, provider, hour_meter,
    last_maintenance_date, next_maintenance_date, insurance_expiration,
    technical_certificate_expiration
  ) VALUES
    (test_company_id, 'Network Switch Arista', 'ASSET-TEST-010', 'Data center switch', 'NETWORK', 'Arista',
     'DCS-7150S64', 'ARISTA-2024-010', 'Server Room', NOW()::DATE - INTERVAL '450 days', NOW()::DATE + INTERVAL '180 days',
     4000000, 2800000, 'AVAILABLE', 'good',
     '{"notes": "Test asset 10"}'::jsonb, test_user_id, 'SWITCH-010', 'Arista', 2023, 'Network Solutions', 2500,
     NOW()::DATE - INTERVAL '10 days', NOW()::DATE + INTERVAL '80 days', NOW()::DATE + INTERVAL '270 days',
     NOW()::DATE + INTERVAL '270 days')
  RETURNING id INTO asset_id_10;

  RAISE NOTICE '✓ 10 Assets created';

  -- ===================================
  -- 2. INSERT 10 MAINTENANCE RECORDS
  -- ===================================
  RAISE NOTICE '🔧 Inserting 10 Maintenance Records...';

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description, 
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url, 
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_1, NULL, 'Battery Replacement', 'Replace laptop battery due to degradation', 
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE, 150000, 'COMPLETED', 'Battery voltage: 11.1V → 11.8V', '{"notes": "Maint 1"}'::jsonb, test_user_id,
     NOW()::DATE, 'Tech Support Team', NULL, NULL, 'Battery working properly');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_2, NULL, 'Hard Drive Check', 'Run diagnostics and defrag',
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE, 100000, 'COMPLETED', 'Disk health: 95%', '{"notes": "Maint 2"}'::jsonb, test_user_id,
     NOW()::DATE, 'IT Department', NULL, NULL, 'All systems nominal');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_3, NULL, 'Server Firmware Update', 'Update network OS and security patches',
     'corrective', 'CORRECTIVE', NOW(), NOW(), NOW() + INTERVAL '2 hours',
     NOW()::DATE + INTERVAL '3 days', 500000, 'IN_PROGRESS', NULL, '{"notes": "Maint 3"}'::jsonb, test_user_id,
     NOW()::DATE, 'Network Team', NULL, NULL, 'Update in progress');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_4, NULL, 'Printer Toner Replacement', 'Replace all toner cartridges',
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE - INTERVAL '5 days', 250000, 'COMPLETED', 'Toner levels: Low → Full', '{"notes": "Maint 4"}'::jsonb, test_user_id,
     NOW()::DATE - INTERVAL '5 days', 'Maintenance Crew', NULL, NULL, 'Ready for operation');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_5, NULL, 'AC Unit Inspection', 'Full system inspection and cleaning',
     'inspection', 'INSPECTION', NOW(), NOW(), NULL,
     NOW()::DATE, 750000, 'SCHEDULED', NULL, '{"notes": "Maint 5"}'::jsonb, test_user_id,
     NOW()::DATE, 'Climate Specialists', NULL, NULL, 'Needs urgent repair');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_6, NULL, 'Camera Lens Cleaning', 'Clean and calibrate camera lens',
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE - INTERVAL '10 days', 50000, 'COMPLETED', 'Lens clarity: 98%', '{"notes": "Maint 6"}'::jsonb, test_user_id,
     NOW()::DATE - INTERVAL '10 days', 'Security Team', NULL, NULL, 'Video quality restored');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_7, NULL, 'Desk Surface Restoration', 'Refinish and seal desk surface',
     'corrective', 'CORRECTIVE', NOW(), NULL, NULL,
     NOW()::DATE + INTERVAL '7 days', 200000, 'SCHEDULED', NULL, '{"notes": "Maint 7"}'::jsonb, test_user_id,
     NOW()::DATE, 'Furniture Repair', NULL, NULL, 'Surface has wear marks');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_8, NULL, 'Chair Hydraulic Pump Check', 'Test and adjust height mechanism',
     'inspection', 'INSPECTION', NULL, NULL, NOW(),
     NOW()::DATE - INTERVAL '15 days', 80000, 'COMPLETED', 'Pump pressure: Normal', '{"notes": "Maint 8"}'::jsonb, test_user_id,
     NOW()::DATE - INTERVAL '15 days', 'Technician', NULL, NULL, 'Operating normally');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_9, NULL, 'Fire Safety Annual Inspection', 'Annual certification and testing',
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE - INTERVAL '30 days', 500000, 'COMPLETED', 'All systems operational', '{"notes": "Maint 9"}'::jsonb, test_user_id,
     NOW()::DATE - INTERVAL '30 days', 'Safety Inspector', NULL, NULL, 'Certified until next year');

  INSERT INTO public.maintenance_records (
    company_id, asset_id, project_id, title, description,
    maintenance_type, type, scheduled_at, started_at, completed_at,
    due_date, cost, status, findings, metadata, created_by,
    maintenance_date, responsible_name, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_10, NULL, 'Network Switch Port Test', 'Test all 64 ports and update firmware',
     'preventive', 'PREVENTIVE', NULL, NULL, NOW(),
     NOW()::DATE - INTERVAL '7 days', 350000, 'COMPLETED', '62/64 ports active', '{"notes": "Maint 10"}'::jsonb, test_user_id,
     NOW()::DATE - INTERVAL '7 days', 'Network Admin', NULL, NULL, 'Ready for production');

  RAISE NOTICE '✓ 10 Maintenance Records created';

  -- ===================================
  -- 3. INSERT 5 PROJECTS
  -- ===================================
  RAISE NOTICE '📊 Inserting 5 Projects...';

  INSERT INTO public.projects (
    company_id, name, code, description, owner_id, owner_name,
    start_date, due_date, completed_at, budget, progress, status,
    metadata, created_by, location
  ) VALUES
    (test_company_id, 'Network Infrastructure Upgrade', 'PROJ-001', 'Upgrade entire network to 10Gb backbone',
     test_user_id, 'Project Manager', NOW()::DATE - INTERVAL '30 days', NOW()::DATE + INTERVAL '60 days', NULL,
     5000000, 35, 'ACTIVE', '{"notes": "Proj 1"}'::jsonb, test_user_id, 'Medellin')
  RETURNING id INTO project_id_1;

  INSERT INTO public.projects (
    company_id, name, code, description, owner_id, owner_name,
    start_date, due_date, completed_at, budget, progress, status,
    metadata, created_by, location
  ) VALUES
    (test_company_id, 'Office Renovation Phase 1', 'PROJ-002', 'Renovate office floors 1-3',
     test_user_id, 'Operations Manager', NOW()::DATE - INTERVAL '15 days', NOW()::DATE + INTERVAL '120 days', NULL,
     8000000, 25, 'ACTIVE', '{"notes": "Proj 2"}'::jsonb, test_user_id, 'Bogota')
  RETURNING id INTO project_id_2;

  INSERT INTO public.projects (
    company_id, name, code, description, owner_id, owner_name,
    start_date, due_date, completed_at, budget, progress, status,
    metadata, created_by, location
  ) VALUES
    (test_company_id, 'Data Center Expansion', 'PROJ-003', 'Build new data center facility',
     test_user_id, 'Infrastructure Lead', NOW()::DATE - INTERVAL '90 days', NOW()::DATE + INTERVAL '90 days', NULL,
     15000000, 60, 'ACTIVE', '{"notes": "Proj 3"}'::jsonb, test_user_id, 'Cali')
  RETURNING id INTO project_id_3;

  INSERT INTO public.projects (
    company_id, name, code, description, owner_id, owner_name,
    start_date, due_date, completed_at, budget, progress, status,
    metadata, created_by, location
  ) VALUES
    (test_company_id, 'Security System Implementation', 'PROJ-004', 'Deploy new surveillance system',
     test_user_id, 'Security Chief', NOW()::DATE - INTERVAL '45 days', NOW()::DATE + INTERVAL '45 days', NULL,
     3000000, 75, 'COMPLETED', '{"notes": "Proj 4"}'::jsonb, test_user_id, 'Medellin')
  RETURNING id INTO project_id_4;

  INSERT INTO public.projects (
    company_id, name, code, description, owner_id, owner_name,
    start_date, due_date, completed_at, budget, progress, status,
    metadata, created_by, location
  ) VALUES
    (test_company_id, 'Disaster Recovery Plan', 'PROJ-005', 'Create and test disaster recovery procedures',
     test_user_id, 'Risk Manager', NOW()::DATE - INTERVAL '120 days', NOW()::DATE - INTERVAL '30 days', NOW()::DATE - INTERVAL '30 days',
     2000000, 100, 'COMPLETED', '{"notes": "Proj 5"}'::jsonb, test_user_id, 'Remote')
  RETURNING id INTO project_id_5;

  RAISE NOTICE '✓ 5 Projects created';

  -- ===================================
  -- 4. INSERT 10 DOCUMENTS
  -- ===================================
  RAISE NOTICE '📄 Inserting 10 Documents...';

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_1, NULL, 'Laptop Warranty Certificate', 'Warranty', 'PDF',
     'ACTIVE', NOW()::DATE + INTERVAL '180 days', '{"notes": "Doc 1"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_2, NULL, 'Desktop User Manual', 'Manual', 'PDF',
     'ACTIVE', NOW()::DATE + INTERVAL '365 days', '{"notes": "Doc 2"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_3, NULL, 'Server Configuration Guide', 'Technical', 'PDF',
     'ACTIVE', NOW()::DATE + INTERVAL '730 days', '{"notes": "Doc 3"}'::jsonb, test_user_id, 2, NULL);

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_4, NULL, 'Printer Maintenance Log', 'Maintenance', 'EXCEL',
     'ACTIVE', NOW()::DATE + INTERVAL '365 days', '{"notes": "Doc 4"}'::jsonb, test_user_id, 3, NULL);

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_5, NULL, 'AC System Schematic', 'Technical', 'PDF',
     'ACTIVE', NOW()::DATE + INTERVAL '1095 days', '{"notes": "Doc 5"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, asset_id, project_id, title, category, type,
    status, expires_at, metadata, created_by, version, maintenance_record_id
  ) VALUES
    (test_company_id, asset_id_6, NULL, 'Camera Inspection Photos', 'Images', 'IMAGE',
     'ACTIVE', NOW()::DATE + INTERVAL '90 days', '{"notes": "Doc 6"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, NULL, project_id_1, 'Network Upgrade Proposal', 'Planning', 'WORD',
     'ACTIVE', NOW()::DATE + INTERVAL '180 days', '{"notes": "Doc 7"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, NULL, project_id_2, 'Renovation Budget Spreadsheet', 'Financial', 'EXCEL',
     'ACTIVE', NOW()::DATE + INTERVAL '365 days', '{"notes": "Doc 8"}'::jsonb, test_user_id, 2, NULL);

  INSERT INTO public.asset_documents (
    company_id, NULL, project_id_3, 'Data Center Floor Plans', 'Planning', 'PDF',
     'ACTIVE', NOW()::DATE + INTERVAL '730 days', '{"notes": "Doc 9"}'::jsonb, test_user_id, 1, NULL);

  INSERT INTO public.asset_documents (
    company_id, NULL, project_id_4, 'Security System Installation Photos', 'Evidence', 'IMAGE',
     'ARCHIVED', NOW()::DATE - INTERVAL '30 days', '{"notes": "Doc 10"}'::jsonb, test_user_id, 1, NULL);

  RAISE NOTICE '✓ 10 Documents created';

  -- ===================================
  -- 5. INSERT 10 INCIDENTS
  -- ===================================
  RAISE NOTICE '⚠️ Inserting 10 Incidents...';

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_1, NULL, test_user_id, NULL,
     'Laptop Screen Not Responding', 'Monitor stays black after boot', 'high', 'ABIERTO', 'HIGH',
     NOW(), NULL, NULL,
     '{"notes": "Inc 1"}'::jsonb, test_user_id, 'Oficina A', NULL, NULL, 'Power indicator shows normal');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_2, NULL, test_user_id, NULL,
     'Desktop Making Noise', 'Loud fan noise from CPU', 'medium', 'ABIERTO', 'MEDIUM',
     NOW() - INTERVAL '2 days', NULL, NULL,
     '{"notes": "Inc 2"}'::jsonb, test_user_id, 'Oficina B', NULL, NULL, 'Likely overheating');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_3, NULL, test_user_id, test_user_id,
     'Server Connection Lost', 'Network connection dropped multiple times', 'critical', 'EN_PROCESO', 'HIGH',
     NOW() - INTERVAL '1 day', NULL, NULL,
     '{"notes": "Inc 3"}'::jsonb, test_user_id, 'Server Room', NULL, NULL, 'Under investigation');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_4, NULL, test_user_id, NULL,
     'Printer Paper Jam', 'Unable to clear jam from tray 3', 'low', 'ABIERTO', 'LOW',
     NOW() - INTERVAL '3 days', NULL, NULL,
     '{"notes": "Inc 4"}'::jsonb, test_user_id, 'Print Room', NULL, NULL, 'Waiting for service');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_5, NULL, test_user_id, test_user_id,
    'AC Temperature Fluctuation', 'Room temperature drops 5 degrees hourly', 'high', 'EN_PROCESO', 'HIGH',
     NOW() - INTERVAL '4 days', NULL, NULL,
     '{"notes": "Inc 5"}'::jsonb, test_user_id, 'Main Hall', NULL, NULL, 'Thermostat malfunction suspected');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_6, NULL, test_user_id, test_user_id,
     'Camera Image Degradation', 'Pixelated video feed from entrance cam', 'medium', 'RESUELTO', 'MEDIUM',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 'Lens cleaned, now working properly',
     '{"notes": "Inc 6"}'::jsonb, test_user_id, 'Entrance', NULL, NULL, 'Resolution confirmed');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_7, NULL, test_user_id, NULL,
     'Desk Surface Damage', 'Water damage and staining on top surface', 'low', 'ABIERTO', 'LOW',
     NOW() - INTERVAL '10 days', NULL, NULL,
     '{"notes": "Inc 7"}'::jsonb, test_user_id, 'Oficina A', NULL, NULL, 'Cosmetic damage only');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_8, NULL, test_user_id, test_user_id,
     'Chair Gas Cylinder Leak', 'Chair loses height after sitting', 'medium', 'RESUELTO', 'MEDIUM',
     NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days', 'Replaced gas cylinder',
     '{"notes": "Inc 8"}'::jsonb, test_user_id, 'Conference Room', NULL, NULL, 'Working normally');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_9, NULL, test_user_id, test_user_id,
     'Fire Extinguisher Pressure Low', 'Pressure gauge in yellow zone', 'high', 'RESUELTO', 'HIGH',
     NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', 'Refilled to full capacity',
     '{"notes": "Inc 9"}'::jsonb, test_user_id, 'All Floors', NULL, NULL, 'Certified safe');

  INSERT INTO public.incidents (
    company_id, asset_id, project_id, reported_by, assigned_to,
    title, description, severity, status, priority,
    reported_at, resolved_at, resolution_notes,
    metadata, created_by, location, evidence_before_url,
    evidence_after_url, observations
  ) VALUES
    (test_company_id, asset_id_10, NULL, test_user_id, test_user_id,
     'Network Switch Port Failure', 'Port 15 not responding to connections', 'high', 'RESUELTO', 'HIGH',
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day', 'Port remapped to backup hardware',
     '{"notes": "Inc 10"}'::jsonb, test_user_id, 'Server Room', NULL, NULL, 'Traffic rerouted successfully');

  RAISE NOTICE '✓ 10 Incidents created';

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 014 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created: 10 Assets + 10 Maintenance Records + 5 Projects + 10 Documents + 10 Incidents = 45 records';
  RAISE NOTICE 'Company ID: %', test_company_id;
  RAISE NOTICE 'User ID: %', test_user_id;

END $$;
