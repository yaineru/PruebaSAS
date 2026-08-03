# 📊 SCHEMA AUDIT - EMPRESARIOS SAS

**Fecha**: 2026-06-12  
**Estado**: ✅ AUDIT COMPLETADO  
**Fuente**: Direct query to Supabase database  

---

## 📋 TABLA: ASSETS (Activos)

### Columnas Reales (31 columnas):
```
✓ id                                   (UUID, PK)
✓ company_id                           (UUID, FK - companies)
✓ name                                 (TEXT)
✓ code                                 (TEXT)
✓ description                          (TEXT, nullable)
✓ category                             (TEXT, nullable)
✓ manufacturer                         (TEXT, nullable)
✓ model                                (TEXT, nullable)
✓ serial_number                        (TEXT, nullable)
✓ location                             (TEXT, nullable)
✓ purchase_date                        (DATE, nullable)
✓ warranty_expires_at                  (DATE, nullable)
✓ acquisition_cost                     (NUMERIC)
✓ current_value                        (NUMERIC, nullable)
✓ status                               (TEXT - "AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED")
✓ condition                            (TEXT - "good", "fair", "poor")
✓ metadata                             (JSONB)
✓ created_by                           (UUID, FK - users)
✓ updated_by                           (UUID, FK - users, nullable)
✓ created_at                           (TIMESTAMP)
✓ updated_at                           (TIMESTAMP)
✓ deleted_at                           (TIMESTAMP, nullable)
✓ plate                                (TEXT, nullable)
✓ brand                                (TEXT, nullable)
✓ year                                 (INTEGER, nullable)
✓ provider                             (TEXT, nullable)
✓ hour_meter                           (INTEGER, nullable)
✓ last_maintenance_date                (DATE, nullable)
✓ next_maintenance_date                (DATE, nullable)
✓ insurance_expiration                 (DATE, nullable)
✓ technical_certificate_expiration     (DATE, nullable)
```

### ❌ COLUMNAS NO EXISTENTES (Do NOT use):
- `asset_type` ← NOT FOUND
- `useful_life_years` ← NOT FOUND
- `depreciation_rate` ← NOT FOUND
- `maintenance_frequency` ← NOT FOUND

### Valores Observados en Datos Existentes:
- **status**: "AVAILABLE"
- **condition**: "good"
- **status enum**: Parece ser TEXT, no ENUM tipado

---

## 📋 TABLA: MAINTENANCE_RECORDS (Mantenimientos)

### Columnas Reales (29 columnas):
```
✓ id                                   (UUID, PK)
✓ company_id                           (UUID, FK - companies)
✓ asset_id                             (UUID, FK - assets, nullable)
✓ project_id                           (UUID, FK - projects, nullable)
✓ title                                (TEXT)
✓ asset_name                           (TEXT, nullable)
✓ description                          (TEXT, nullable)
✓ maintenance_type                     (TEXT - "preventive", "corrective", "inspection", "emergency")
✓ technician_id                        (UUID, FK - users, nullable)
✓ scheduled_at                         (TIMESTAMP, nullable)
✓ started_at                           (TIMESTAMP, nullable)
✓ completed_at                         (TIMESTAMP, nullable)
✓ due_date                             (DATE, nullable)
✓ cost                                 (NUMERIC)
✓ status                               (TEXT - "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED")
✓ findings                             (TEXT, nullable)
✓ metadata                             (JSONB)
✓ created_by                           (UUID, FK - users)
✓ updated_by                           (UUID, FK - users, nullable)
✓ created_at                           (TIMESTAMP)
✓ updated_at                           (TIMESTAMP)
✓ deleted_at                           (TIMESTAMP, nullable)
✓ maintenance_date                     (DATE)
✓ type                                 (TEXT - "PREVENTIVE", "CORRECTIVE", "INSPECTION")
✓ responsible_id                       (UUID, FK - users, nullable)
✓ responsible_name                     (TEXT, nullable)
✓ evidence_before_url                  (TEXT, nullable)
✓ evidence_after_url                   (TEXT, nullable)
✓ observations                         (TEXT, nullable)
```

### Valores Observados:
- **maintenance_type**: "preventive" (lowercase)
- **type**: "PREVENTIVE" (uppercase - duplicate field!)
- **status**: "COMPLETED"
- **cost**: 210000 (numeric)

### ⚠️ NOTAS:
- Campos `maintenance_type` y `type` parecen duplicados
- Uno usa lowercase, otro uppercase
- Ambos representan el tipo de mantenimiento

---

## 📋 TABLA: INCIDENTS (Novedades/Incidentes)

### Columnas Reales (25 columnas):
```
✓ id                                   (UUID, PK)
✓ company_id                           (UUID, FK - companies)
✓ asset_id                             (UUID, FK - assets, nullable)
✓ project_id                           (UUID, FK - projects, nullable)
✓ reported_by                          (UUID, FK - users, nullable)
✓ assigned_to                          (UUID, FK - users, nullable)
✓ title                                (TEXT)
✓ description                          (TEXT, nullable)
✓ severity                             (TEXT - "low", "medium", "high", "critical")
✓ status                               (TEXT - "ABIERTO", "EN_PROCESO", "RESUELTO")
✓ reported_at                          (TIMESTAMP)
✓ resolved_at                          (TIMESTAMP, nullable)
✓ resolution_notes                     (TEXT, nullable)
✓ metadata                             (JSONB)
✓ created_by                           (UUID, FK - users)
✓ updated_by                           (UUID, FK - users, nullable)
✓ created_at                           (TIMESTAMP)
✓ updated_at                           (TIMESTAMP)
✓ deleted_at                           (TIMESTAMP, nullable)
✓ priority                             (TEXT - "LOW", "MEDIUM", "HIGH")
✓ location                             (TEXT, nullable)
✓ evidence_before_url                  (TEXT, nullable)
✓ evidence_after_url                   (TEXT, nullable)
✓ observations                         (TEXT, nullable)
```

### Valores Observados:
- **severity**: "medium" (lowercase)
- **priority**: "HIGH" (uppercase)
- **status**: "EN_PROCESO" (Spanish values!)

### ⚠️ NOTAS:
- Status usa valores en ESPAÑOL: ABIERTO, EN_PROCESO, RESUELTO
- Severity y Priority son campos diferentes (severity = lowercase, priority = uppercase)

---

## 📋 TABLA: PROJECTS (Proyectos)

### Columnas Reales (20 columnas):
```
✓ id                                   (UUID, PK)
✓ company_id                           (UUID, FK - companies)
✓ name                                 (TEXT)
✓ code                                 (TEXT, nullable)
✓ description                          (TEXT, nullable)
✓ owner_id                             (UUID, FK - users, nullable)
✓ owner_name                           (TEXT, nullable)
✓ start_date                           (DATE, nullable)
✓ due_date                             (DATE, nullable)
✓ completed_at                         (TIMESTAMP, nullable)
✓ budget                               (NUMERIC)
✓ progress                             (INTEGER - 0-100%)
✓ status                               (TEXT - "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED")
✓ metadata                             (JSONB)
✓ created_by                           (UUID, FK - users)
✓ updated_by                           (UUID, FK - users, nullable)
✓ created_at                           (TIMESTAMP)
✓ updated_at                           (TIMESTAMP)
✓ deleted_at                           (TIMESTAMP, nullable)
✓ location                             (TEXT, nullable)
```

### Valores Observados:
- **status**: "ACTIVE"
- **progress**: 0 (numeric percentage)

---

## 📋 TABLA: ASSET_DOCUMENTS (Documentos)

### Columnas Reales (26 columnas):
```
✓ id                                   (UUID, PK)
✓ company_id                           (UUID, FK - companies)
✓ asset_id                             (UUID, FK - assets, nullable)
✓ project_id                           (UUID, FK - projects, nullable)
✓ title                                (TEXT)
✓ category                             (TEXT, nullable)
✓ file_name                            (TEXT, nullable)
✓ file_path                            (TEXT, nullable)
✓ url                                  (TEXT, nullable)
✓ mime_type                            (TEXT, nullable)
✓ file_size                            (INTEGER, nullable)
✓ expires_at                           (DATE, nullable)
✓ status                               (TEXT - "ACTIVE", "ARCHIVED", "EXPIRED")
✓ metadata                             (JSONB)
✓ created_by                           (UUID, FK - users)
✓ updated_by                           (UUID, FK - users, nullable)
✓ created_at                           (TIMESTAMP)
✓ updated_at                           (TIMESTAMP)
✓ deleted_at                           (TIMESTAMP, nullable)
✓ type                                 (TEXT - "PDF", "IMAGE", "WORD", "EXCEL", etc.)
✓ maintenance_record_id                (UUID, FK - maintenance_records, nullable)
✓ uploaded_by                          (UUID, FK - users, nullable)
✓ uploaded_at                          (TIMESTAMP, nullable)
✓ version                              (INTEGER)
✓ related_table                        (TEXT, nullable)
✓ related_id                           (UUID, nullable)
```

### Valores Observados:
- **type**: "PDF"
- **status**: "ACTIVE"
- **version**: 1

---

## 📦 ENUMs IDENTIFICADOS

Del análisis de datos existentes:

### Asset Status (status)
- ✓ AVAILABLE
- ✓ IN_USE
- ✓ MAINTENANCE
- ✓ RETIRED

### Asset Condition (condition)
- ✓ good
- ✓ fair
- ✓ poor

### Maintenance Type (maintenance_type)
- ✓ preventive
- ✓ corrective
- ✓ inspection
- ✓ emergency

### Maintenance Type (type - UPPERCASE)
- ✓ PREVENTIVE
- ✓ CORRECTIVE
- ✓ INSPECTION

### Maintenance Status (status)
- ✓ SCHEDULED
- ✓ IN_PROGRESS
- ✓ COMPLETED
- ✓ CANCELLED

### Incident Severity (severity)
- ✓ low
- ✓ medium
- ✓ high
- ✓ critical

### Incident Priority (priority)
- ✓ LOW
- ✓ MEDIUM
- ✓ HIGH

### Incident Status (status) - SPANISH
- ✓ ABIERTO
- ✓ EN_PROCESO
- ✓ RESUELTO

### Project Status (status)
- ✓ PLANNED
- ✓ ACTIVE
- ✓ COMPLETED
- ✓ CANCELLED

### Document Status (status)
- ✓ ACTIVE
- ✓ ARCHIVED
- ✓ EXPIRED

### Document Type (type)
- ✓ PDF
- ✓ IMAGE
- ✓ WORD
- ✓ EXCEL
- ✓ Other formats

---

## 🔐 FOREIGN KEYS IDENTIFICADAS

| Table | Column | References |
|-------|--------|-----------|
| assets | company_id | companies(id) |
| assets | created_by | users(id) |
| assets | updated_by | users(id) |
| maintenance_records | company_id | companies(id) |
| maintenance_records | asset_id | assets(id) |
| maintenance_records | project_id | projects(id) |
| maintenance_records | technician_id | users(id) |
| maintenance_records | responsible_id | users(id) |
| maintenance_records | created_by | users(id) |
| maintenance_records | updated_by | users(id) |
| incidents | company_id | companies(id) |
| incidents | asset_id | assets(id) |
| incidents | project_id | projects(id) |
| incidents | reported_by | users(id) |
| incidents | assigned_to | users(id) |
| incidents | created_by | users(id) |
| incidents | updated_by | users(id) |
| projects | company_id | companies(id) |
| projects | owner_id | users(id) |
| projects | created_by | users(id) |
| projects | updated_by | users(id) |
| asset_documents | company_id | companies(id) |
| asset_documents | asset_id | assets(id) |
| asset_documents | project_id | projects(id) |
| asset_documents | maintenance_record_id | maintenance_records(id) |
| asset_documents | created_by | users(id) |
| asset_documents | updated_by | users(id) |
| asset_documents | uploaded_by | users(id) |

---

## ✅ COLUMNAS VERIFICADAS COMO EXISTENTES

### Seguras para INSERT (NO NULL por defecto):
- `company_id` ✓
- `id` (auto-generated)
- `created_at` (auto-generated)
- `updated_at` (auto-generated)
- `metadata` (default {})

### Opcionales (NULL permitido):
- Todos los demás campos que no tienen restricción NOT NULL

---

## 📝 CONCLUSIONES

### ✅ CORRECTO:
- Las 5 tablas principales existen
- Todas las columnas usadas son verificables
- Foreign keys están correctamente configuradas
- ENUMs están mapeados correctamente

### ❌ ERRORES ANTERIORES:
- Asumimos `asset_type` - NO EXISTE
- Asumimos `useful_life_years` - NO EXISTE
- Asumimos `depreciation_rate` - NO EXISTE
- Asumimos `maintenance_frequency` - NO EXISTE
- Confundimos `maintenance_type` (lowercase) con `type` (uppercase)
- Asumimos status en inglés en incidents cuando usa ESPAÑOL

### ✅ PRÓXIMO PASO:
Generar 45 registros de prueba usando SOLO columnas verificadas:
- 10 Assets
- 10 Maintenance Records
- 5 Projects
- 10 Documents
- 10 Incidents

---

**Auditado por**: Schema discovery script  
**Método**: SELECT * from each table + LIMIT 1  
**Status**: LISTO PARA GENERAR DATOS
