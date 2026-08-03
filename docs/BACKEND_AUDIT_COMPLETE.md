# AUDITORÍA COMPLETA DEL BACKEND - MÓDULO DE REPORTES

**Fecha:** 11 Junio 2026  
**Estado:** 🔴 **MÚLTIPLES FALLOS IDENTIFICADOS**

---

## RESUMEN EJECUTIVO

El módulo de reportes tiene **5 problemas críticos** que causan el error `"Failed to create report"`:

1. **Conflicto de Migraciones:** Dos migraciones crean la misma tabla con esquemas diferentes
2. **Mismatch de Columnas:** El código intenta insertar campos que no existen
3. **Campos NOT NULL faltantes:** No se proporciona `report_type` en el insert
4. **Migraciones No Idempotentes:** Muchas migraciones SQL pueden fallar al re-ejecutarse
5. **Falta de Logging Detallado:** El error no muestra `reportError.message`

---

## PROBLEMA 1: CONFLICTO DE MIGRACIONES

### Descripción
Dos migraciones diferentes crean la tabla `generated_reports` con esquemas conflictivos:

**Migración 004_reports_evidence.sql** (se ejecuta PRIMERO):
```sql
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  template_id UUID REFERENCES public.report_templates(id),
  report_type TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  url TEXT,
  filters_applied JSONB,
  row_count INTEGER NOT NULL DEFAULT 0,  -- ← NOMBRE COLUMNA
  generated_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'READY',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

**Migración 007_reports_enhancement.sql** (se ejecuta DESPUÉS):
```sql
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  generated_by UUID NOT NULL,
  schedule_id UUID REFERENCES report_schedules(id),
  report_type TEXT NOT NULL,
  report_entity TEXT NOT NULL,      -- ← NUEVA COLUMNA
  report_format TEXT NOT NULL,      -- ← CAMBIO NOMBRE
  template_name TEXT,               -- ← CAMBIO NOMBRE
  filters JSONB DEFAULT '{}',
  record_count INTEGER DEFAULT 0,   -- ← CAMBIO NOMBRE
  file_size_bytes INTEGER,          -- ← CAMBIO NOMBRE
  file_path TEXT,
  file_url TEXT,                    -- ← NUEVA COLUMNA
  status TEXT NOT NULL DEFAULT 'GENERATED',
  error_message TEXT,
  generation_time_ms INTEGER,       -- ← NUEVA COLUMNA
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Resultado
- ✅ Tabla se crea con esquema de 004
- ❌ 007 intenta crear pero ya existe (CREATE TABLE IF NOT EXISTS)
- ❌ Las nuevas columnas de 007 nunca se crean

### El Código Intenta Usar Campos de 007
```typescript
// lib/actions/reports.ts - generateReport()
const { data: report, error: reportError } = await supabase
  .from('generated_reports')
  .insert({
    company_id: companyId,
    report_entity: validated.reportEntity,        // ✅ EXISTE (de 004)
    report_format: validated.reportFormat,        // ✅ EXISTE (de 004 como file_format)
    template_name: validated.templateName,        // ❌ NO EXISTE (004 tiene template_id)
    row_count: recordCount,                       // ✅ EXISTE (de 004)
    file_name: fileName,                          // ❌ NO EXISTE
    generated_by: userId,                         // ✅ EXISTE
  })
```

---

## PROBLEMA 2: MISMATCH DE COLUMNAS

### Campo: `template_name` vs `template_id`

| Componente | Campo | Tipo | Existe | Error |
|-----------|-------|------|--------|-------|
| Código | `template_name: "standard"` | TEXT | ❌ NO | `column "template_name" does not exist` |
| Tabla 004 | `template_id: UUID` | UUID | ✅ SÍ | - |
| Tabla 007 | `template_name: TEXT` | TEXT | ❌ (nunca se ejecutó) | - |

**Resultado:** Insert falla porque intenta insertar en columna inexistente

---

### Campo: `file_name` Inexistente

| Componente | Campo | Tipo | Existe | Error |
|-----------|-------|------|--------|-------|
| Código | `file_name: "ASSETS_2026-06-11"` | TEXT | ❌ NO | `column "file_name" does not exist` |
| Tabla 004 | `file_path: TEXT` | - | ✅ SÍ | - |
| Tabla 007 | `file_path: TEXT` | - | ❌ (nunca se ejecutó) | - |

**Resultado:** Insert falla porque intenta insertar en columna inexistente

---

### Campo: `report_type` NOT NULL Faltante

| Componente | Campo | Tipo | Requerido | Valor |
|-----------|-------|------|-----------|-------|
| Tabla 004 | `report_type: TEXT NOT NULL` | TEXT | ✅ SÍ | ❌ NO PROPORCIONADO |
| Código | (no proporciona) | - | ✅ REQUIRED | ❌ NULO |

**Resultado:** Insert falla porque campo NOT NULL sin valor

```typescript
// Lo que debería enviar:
report_type: validated.reportEntity,  // "ASSETS", "MAINTENANCE", etc
```

---

## PROBLEMA 3: TABLA OBSOLETA EN 004

**Archivo:** `supabase/migrations/004_reports_evidence.sql`  
**Línea:** ~40  
**Estado:** ❌ NO IDEMPOTENTE - Crea tabla que conflicta con 007

**Problema:** Esta tabla se vuelve a crear en 007 con diferente esquema, causando conflicto.

**Solución:** Consolidar en una sola migración o hacer que 007 actualice la tabla correctamente.

---

## PROBLEMA 4: MIGRACIONES NO IDEMPOTENTES

### MIGRACIÓN 002: CREATE OR REPLACE (OK ✅)
```sql
create or replace function public.notify_new_project()  -- ✅ Idempotente
```
**Estado:** ✅ Segura para re-ejecución

### MIGRACIÓN 003: Uso correcto de IF NOT EXISTS (OK ✅)
```sql
create table if not exists public.company_settings     -- ✅ Idempotente
alter table public.asset_documents add column if not exists uploaded_by   -- ✅ Idempotente
drop constraint if exists ...                          -- ✅ Idempotente
```
**Estado:** ✅ Segura para re-ejecución

### MIGRACIÓN 004: Falta IF NOT EXISTS (⚠️ PROBLEMA)
```sql
create or replace function public.notify_maintenance_due()   -- ✅ OK
create or replace function public.notify_asset_inspection_due()   -- ✅ OK
-- PERO LAS POLÍTICAS NO USAN DROP IF EXISTS:
CREATE POLICY "Users can view own company reports" ON generated_reports
  FOR SELECT USING (...)
-- ❌ Si se ejecuta de nuevo, falla: policy already exists
```
**Estado:** ❌ **NO SEGURA** - Las políticas RLS fallarán en re-ejecución

### MIGRACIÓN 005: INSERT sin ON CONFLICT (⚠️ PROBLEMA)
```sql
insert into industry_templates (name, slug, ...) values (...)
-- ❌ Si se ejecuta de nuevo, intenta insertar duplicados
```
**Estado:** ❌ **NO SEGURA** - Insertaría filas duplicadas

### MIGRACIÓN 006: CREATE TABLE IF NOT EXISTS (OK ✅)
```sql
create table if not exists email_subscriptions  -- ✅ Idempotente
```
**Estado:** ✅ Segura para re-ejecución

### MIGRACIÓN 007: Políticas sin DROP (⚠️ PROBLEMA)
```sql
CREATE POLICY "Users can view own company schedules" ON report_schedules
  FOR SELECT USING (...)
-- ❌ Falta DROP POLICY IF EXISTS
```
**Estado:** ❌ **NO SEGURA** - Las políticas duplicarán si se re-ejecuta

### MIGRACIÓN 008, 009, 010: CREATE TABLE IF NOT EXISTS (OK ✅)
```sql
CREATE TABLE IF NOT EXISTS asset_images          -- ✅ Idempotente
CREATE TABLE IF NOT EXISTS custom_fields         -- ✅ Idempotente
CREATE TABLE IF NOT EXISTS export_configurations -- ✅ Idempotente
```
**Estado:** ✅ Seguras para re-ejecución

---

## RESUMEN DE MIGRACIONES NO IDEMPOTENTES

| Migración | Problema | Línea | Tipo | Severidad |
|-----------|----------|-------|------|-----------|
| 002 | Genera excepciones pero sin control | ~múltiples | Trigger | ⚠️ |
| 004 | Políticas RLS sin DROP IF EXISTS | ~200+ | RLS | 🔴 CRÍTICO |
| 005 | INSERT sin ON CONFLICT | ~50+ | Data | 🔴 CRÍTICO |
| 007 | Políticas RLS sin DROP IF EXISTS | ~130+ | RLS | 🔴 CRÍTICO |

---

## FLUJO DE ERROR

```
Usuario intenta generar reporte
↓
FormData llega a generateReport()
↓
Extrae: reportEntity, reportFormat, templateName
↓
Valida schema (paso OK)
↓
Intenta INSERT en tabla generated_reports:
  - Envía: template_name, file_name, report_entity, report_format
  - Tabla espera: template_id (no template_name), file_path (no file_name), report_type (NOT NULL, no proporcionado)
↓
❌ INSERT FALLA
  - Error 1: column "template_name" does not exist
  - Error 2: column "file_name" does not exist
  - Error 3: null value in column "report_type" violates not-null constraint
↓
Code: reportError = true
↓
return { success: false, error: 'Failed to create report' }  ← SIN MOSTRAR DETALLES
```

---

## SOLUCIONES REQUERIDAS

### SOLUCIÓN 1: Consolidar Migraciones de Reportes

**Opción A - Correcta:** Eliminar tabla de 004, crear completa en 007
**Opción B - Rápida:** Actualizar tabla en 004 para que coincida con 007

**Recomendación:** Opción A (más limpio)

### SOLUCIÓN 2: Corregir INSERT en generateReport()

```typescript
// Cambiar DE:
await supabase
  .from('generated_reports')
  .insert({
    company_id: companyId,
    report_entity: validated.reportEntity,
    report_format: validated.reportFormat,
    template_name: validated.templateName,    // ❌
    row_count: recordCount,
    file_name: fileName,                      // ❌
    generated_by: userId,
  })

// Cambiar A:
await supabase
  .from('generated_reports')
  .insert({
    company_id: companyId,
    report_type: validated.reportEntity,      // ✅ Nombre correcto
    file_format: validated.reportFormat,      // ✅ Nombre correcto
    template_id: null,                        // O buscar template_id si existe
    row_count: recordCount,                   // ✅ Nombre correcto
    file_path: fileName,                      // ✅ Nombre correcto
    generated_by: userId,
    status: 'READY',                          // ✅ Explícito
    filters_applied: filters,                 // ✅ De 004
  })
```

### SOLUCIÓN 3: Agregar Logging Detallado

```typescript
if (reportError || !report) {
  console.error('REPORT_INSERT_ERROR', {
    query: 'generated_reports.insert',
    payload: {
      company_id: companyId,
      report_entity: validated.reportEntity,
      // ... todos los campos
    },
    error: reportError?.message,
    details: reportError?.details,
    hint: reportError?.hint,
    code: reportError?.code,
  });
  return { success: false, error: reportError?.message || 'Failed to create report' };
}
```

### SOLUCIÓN 4: Hacer Idempotentes Todas Las Migraciones

**Reglas obligatorias:**

```sql
-- ✅ CORRECTO
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
DROP POLICY IF EXISTS ... ON ...
DROP TRIGGER IF EXISTS ...
DROP FUNCTION IF EXISTS ...
INSERT ... ON CONFLICT(...) DO NOTHING

-- ❌ INCORRECTO
CREATE TABLE ...                    -- Sin IF NOT EXISTS
CREATE POLICY ...                   -- Sin DROP IF EXISTS primero
INSERT ... VALUES (...)             -- Sin ON CONFLICT
```

---

## CHECKLIST DE CORRECCIONES

- [ ] **Eliminar tabla `generated_reports` de migración 004**
  - Archivo: `supabase/migrations/004_reports_evidence.sql`
  - Acción: Comentar o eliminar CREATE TABLE generated_reports

- [ ] **Actualizar migración 007 para ser segura**
  - Agregar: `DROP TABLE IF EXISTS generated_reports;` ANTES de CREATE TABLE

- [ ] **Corregir generateReport() en lib/actions/reports.ts**
  - Cambiar nombres de campos a los de migración 004
  - Agregar `report_type: validated.reportEntity`
  - Cambiar `file_name` → `file_path`
  - Cambiar `template_name` → `template_id`

- [ ] **Agregar logging detallado**
  - Log antes de insert
  - Log después de insert (éxito o error)
  - Mostrar error.message completo

- [ ] **Auditar y fijar todas las migraciones**
  - 004: Agregar DROP POLICY IF EXISTS
  - 005: Agregar ON CONFLICT para inserts
  - 007: Agregar DROP POLICY IF EXISTS

---

## IMPACTO

**Antes:** Usuario ve "Failed to create report" (sin detalles)  
**Después:** Sistema inserta reporte correctamente, usuario ve mensaje de éxito

**Riesgo de no corregir:** 
- Reportes nunca se generan
- Re-ejecutar migraciones falla
- Imposible escalar a producción

---

**Clasificación:** 🔴 **CRÍTICO** - Sistema no funciona actualmente
