# AUDITORÍA MÓDULO DE REPORTES (FASE 2)
**Fecha:** 11 Junio 2026  
**Estado:** 🔴 **PARCIALMENTE IMPLEMENTADO**  
**Conclusión:** Fase 2 está 40% implementada, NO 100% como se indicaba.

---

## 1. VERIFICACIÓN DE RUTAS 

### ✅ Ruta /informes - EXISTE
- **Ubicación:** `app/(app)/informes/page.tsx`
- **Estado:** Implementado
- **Contenido:** Lista de reportes generados con componente ReportList
- **Acceso:** ADMIN, SUPERVISOR, OPERARIO

### ✅ Ruta /informes/generar - EXISTE
- **Ubicación:** `app/(app)/informes/generar/page.tsx`
- **Estado:** Implementado
- **Contenido:** Formulario para generar reportes con ReportGenerator
- **Acceso:** ADMIN, SUPERVISOR solamente

### ✅ Rutas /reports - EXISTEN (duplicadas/inconsistentes)
- **Ubicaciones:** 
  - `app/(app)/reports/new/page.tsx`
  - `app/(app)/reports/history/page.tsx`
- **Estado:** Implementadas pero tienen errores TypeScript
- **Problema:** Hay INCONSISTENCIA - dos rutas diferentes para lo mismo

---

## 2. VERIFICACIÓN DE MÓDULO EN CONFIGURACIÓN

### ❌ MÓDULO NO REGISTRADO EN lib/modules.ts
**Problema Crítico:** El módulo de Informes/Reportes NO está en la configuración central.

**Ubicación:** `lib/modules.ts`  
**Módulos Registrados (6 total):**
1. ✅ assets → `/activos`
2. ✅ maintenance_records → `/mantenimientos`
3. ✅ asset_documents → `/documentos`
4. ✅ projects → `/proyectos`
5. ✅ users → `/usuarios`
6. ✅ incidents → `/novedades`

**FALTA:** 
- ❌ informes/reports → `/informes` o `/reports`

**Consecuencia:** El módulo NO aparece en el sidebar de navegación.

---

## 3. VERIFICACIÓN DE APARICIÓN EN SIDEBAR

### ❌ NO APARECE EN SIDEBAR
**Archivo:** `components/app-shell.tsx`

**Cómo funciona:**
```typescript
const visibleModules = modules.map((module) => applyCompanySettings(module, settings));
```

El sidebar itera sobre `modules` de `lib/modules.ts`. Como Informes no está allí:
- ❌ NO aparece en navegación lateral (desktop)
- ❌ NO aparece en navegación móvil

**Ubicaciones sin registro:**
- `components/app-shell.tsx` línea 29 (sidebar desktop)
- `components/app-shell.tsx` línea 19-23 (navbar móvil)

---

## 4. VERIFICACIÓN DE PERMISOS POR ROL

### ✅ PERMISOS IMPLEMENTADOS CORRECTAMENTE

**En `/informes/page.tsx`:**
```typescript
if (!["ADMIN", "SUPERVISOR", "OPERARIO"].includes(tenant.role)) {
  redirect("/");
}
```
- ADMIN: ✅ Puede ver y generar reportes
- SUPERVISOR: ✅ Puede ver y generar reportes
- OPERARIO: ✅ Puede VER reportes (no generar)
- Otros: ❌ Redirigido a inicio

**En `/informes/generar/page.tsx`:**
```typescript
if (!["ADMIN", "SUPERVISOR"].includes(tenant.role)) {
  redirect("/");
}
```
- ADMIN: ✅ Puede generar
- SUPERVISOR: ✅ Puede generar
- Otros: ❌ Bloqueados

---

## 5. VERIFICACIÓN DE MENÚ RESPONSIVE

### ⚠️ PARCIALMENTE IMPLEMENTADO

**Ubicación:** `components/app-shell.tsx` líneas 19-27

```typescript
const mobileItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/activos", label: settings.assetLabel, icon: Archive },
  { href: "/mantenimientos", label: settings.maintenanceLabel.slice(0, 8), icon: CalendarCheck },
  { href: "/documentos", label: "Docs", icon: FileText },
  { href: "/novedades", label: settings.incidentLabel.slice(0, 8), icon: Bell }
];
```

**Problema:** El menú móvil tiene solo 5 items hardcodeados. NO INCLUYE informes.

**Solución necesaria:** Agregar entrada para `/informes` al menú móvil.

---

## 6. VERIFICACIÓN DE COMPONENTES

### ✅ Componentes Requeridos

| Componente | Archivo | Estado | Notas |
|-----------|---------|--------|-------|
| ReportList | `components/report-list.tsx` | ✅ Existe | Muestra lista con realtime updates |
| ReportGenerator | `components/report-generator.tsx` | ✅ Existe | Formulario para generar reportes |
| ReportTemplateBuilder | `components/report-template-builder.tsx` | ✅ Existe | Admin UI para templates |
| ReportScheduleManager | `components/report-schedule-manager.tsx` | ✅ Existe | Admin UI para schedules |
| PDFReportGenerator | `lib/reports/pdf-generator.ts` | ✅ Existe | Clase para generar PDFs |
| ExcelReportGenerator | `lib/reports/excel-generator.ts` | ✅ Existe | Clase para generar Excel |

---

## 7. VERIFICACIÓN DE SERVIDOR ACTIONS

### ✅ Server Actions Implementadas

**Archivo:** `lib/actions/reports.ts`

| Función | Responsabilidad | Estado |
|---------|-----------------|--------|
| `generateReport()` | Genera PDF/Excel | ✅ Existe (con errores TS) |
| `createReportTemplate()` | Crear templates admin | ✅ Existe (con errores TS) |
| `createReportSchedule()` | Crear schedules admin | ✅ Existe (con errores TS) |
| `updateReportPreferences()` | Guardar preferencias user | ✅ Existe (con errores TS) |
| `downloadGeneratedReport()` | Generar signed URLs | ✅ Existe (con errores TS) |

**Nota:** Todas existen pero tienen errores de TypeScript por:
1. Imports incorrectos (`getTenantContext` de security, no de tenant)
2. Dependencias no instaladas (date-fns, pdfkit, exceljs, json2csv)

---

## 8. VERIFICACIÓN DE BASE DE DATOS

### ✅ Migraciones SQL Creadas

**Archivo:** `supabase/migrations/007_reports_enhancement.sql`

**Tablas Creadas:**
1. ✅ `report_schedules` - Config de reportes recurrentes
2. ✅ `report_templates` - Templates personalizados
3. ✅ `generated_reports` - Historial de reportes generados
4. ✅ `report_preferences` - Preferencias de usuario

**Status Verificación:**
- ⚠️ Migraciones NO verificadas si fueron aplicadas a Supabase
- ⚠️ RLS policies NO verificadas
- ⚠️ Tablas NO verificadas si existen en BD

---

## 9. VERIFICACIÓN DE API ROUTES

### ✅ Rutas API Implementadas

| Ruta | Método | Propósito | Estado |
|------|--------|----------|--------|
| `/api/reports` | GET | Listar reportes | ✅ Existe (errores TS) |
| `/api/reports` | POST | Info (dirigir a action) | ✅ Existe (errores TS) |
| `/api/reports/[id]/download` | GET | Generar signed URLs | ✅ Existe (errores TS) |
| `/api/report-templates` | GET | Listar templates | ✅ Existe (errores TS) |
| `/api/report-templates` | POST | Info (dirigir a action) | ✅ Existe (errores TS) |
| `/api/report-templates` | DELETE | Eliminar template | ✅ Existe (errores TS) |

**Nota:** Todos tienen el mismo error: `getTenantContext` importado de `lib/security` en lugar de `lib/tenant`.

---

## 10. FLUJO COMPLETO: CREAR → GENERAR → DESCARGAR

### ⚠️ FLUJO PARCIALMENTE FUNCIONAL

**Paso 1: Crear Reporte**
1. ✅ Usuario accede a `/informes/generar` (si tiene rol ADMIN/SUPERVISOR)
2. ✅ Formulario ReportGenerator se muestra
3. ⚠️ Selecciona entidad (ASSETS, INCIDENTS, MAINTENANCE, PROJECTS)
4. ⚠️ Selecciona formato (PDF, EXCEL, BOTH)
5. ⚠️ Selecciona template
6. ⚠️ Aplica filtros opcionales
7. ⚠️ Envía formulario → llama a `generateReport()` server action

**Paso 2: Generar PDF/Excel**
- ❌ `generateReport()` tiene errores TypeScript - NO COMPILA
- ⚠️ Incluso si compilara, necesita pdfkit + exceljs instalados
- ⚠️ Las clases `PDFReportGenerator` y `ExcelReportGenerator` existen pero no compiladas

**Paso 3: Descargar**
- ⚠️ Ruta `/api/reports/[id]/download` existe pero tiene errores TS
- ⚠️ Debería generar signed URLs para descargar archivos
- ❌ NO FUNCIONA porque el código no compila

---

## 11. PROBLEMAS DETECTADOS

### 🔴 CRÍTICOS (Bloquean compilación)

| Problema | Ubicación | Impacto | Solución |
|----------|-----------|--------|----------|
| `getTenantContext` importado de lib/security | app/(app)/admin/*, app/api/reports/* | 10+ errores TS | Cambiar a lib/tenant |
| `date-fns` no instalado | app/(app)/reports/history/page.tsx:10 | TS2307 | npm install date-fns |
| `pdfkit` no instalado | lib/reports/pdf-generator.ts | Import falla | npm install pdfkit |
| `exceljs` no instalado | lib/reports/excel-generator.ts | Import falla | npm install exceljs |
| `json2csv` no instalado | lib/actions/exports.ts | Import falla | npm install json2csv |

### 🟡 IMPORTANTES (No funcionan desde UI)

| Problema | Ubicación | Impacto | Solución |
|----------|-----------|--------|----------|
| Módulo no registrado | lib/modules.ts | NO aparece en sidebar | Agregar entrada a modules array |
| Button variantes inválidas | varios componentes | Errores TS TS2322 | Usar variantes válidas: default, secondary, warning, destructive |
| useActionState signature errónea | components/*.tsx | Errores TS TS2769 | Corregir uso de useActionState con state/payload |
| createClient() devuelve Promise | app/api/reports/* | Errores TS TS2339 | Hacer await en server components |

### 🔵 MENORES (Mejoras)

| Problema | Ubicación | Impacto | Solución |
|----------|-----------|--------|----------|
| Dos rutas inconsistentes | /informes vs /reports | Confusión | Mantener /informes, eliminar /reports |
| Menú móvil hardcodeado | components/app-shell.tsx | No escalable | Iterar sobre modules dinámicamente |

---

## 12. TABLA RESUMIDA DE IMPLEMENTACIÓN

| Componente | Implementado | Compilable | Visible | Funcional |
|-----------|----------------|-----------|---------|-----------|
| **Rutas** | ✅ | ❌ | ❌ | ❌ |
| **Módulo (config)** | ❌ | N/A | N/A | N/A |
| **Sidebar** | ⚠️ | ❌ | ❌ | ❌ |
| **Permisos** | ✅ | ❌ | ❌ | ❌ |
| **Componentes UI** | ✅ | ❌ | N/A | ❌ |
| **Server Actions** | ✅ | ❌ | N/A | ❌ |
| **API Routes** | ✅ | ❌ | N/A | ❌ |
| **Database Schema** | ✅ | N/A | N/A | ⚠️ |
| **Generadores (PDF/Excel)** | ✅ | ❌ | N/A | ❌ |

---

## 13. PORCENTAJE DE COMPLETITUD REAL

```
Código escrito:        80% (archivos existen)
Compilable:            0% (errores TS bloquean)
Visible en UI:         0% (no registrado en módulos)
Funcional:             0% (no compila ni es accesible)

ESTADO REAL DE FASE 2: 20% completa, no 100%
```

---

## 14. RECOMENDACIONES PARA HACER FUNCIONAL

### Orden de Prioridad:

**FASE 1: ARREGLAR ERRORES TypeScript (30 min)**
1. [ ] Cambiar `getTenantContext` imports: `lib/security` → `lib/tenant` en 10+ archivos
2. [ ] Cambiar `createClient()` a `await createClient()` en API routes
3. [ ] Instalar dependencias: date-fns, pdfkit, exceljs, json2csv
4. [ ] Reemplazar variantes de Button inválidas (outline → default, xs → sm, lg → default)
5. [ ] Arreglar useActionState signature en componentes

**FASE 2: REGISTRAR MÓDULO (5 min)**
1. [ ] Agregar entrada "informes" a lib/modules.ts
2. [ ] Agregar icono (FileText o BarChart3)
3. [ ] Agregar a menú móvil en app-shell.tsx

**FASE 3: VERIFICAR BD (10 min)**
1. [ ] Verificar que migrations 007-010 se aplicaron a Supabase
2. [ ] Verificar que todas las tablas existen
3. [ ] Verificar que RLS policies están activas

**FASE 4: PRUEBAS (20 min)**
1. [ ] npm run typecheck → 0 errores
2. [ ] npm run build → success
3. [ ] Verificar /informes carga
4. [ ] Verificar /informes/generar carga
5. [ ] Generar un reporte de prueba
6. [ ] Descargar reporte
7. [ ] Verificar PDF/Excel se generan correctamente

---

## 15. CONCLUSIÓN

**Estado Actual:**
- ✅ 80% del código existe
- ❌ 0% compila
- ❌ 0% es visible en UI
- ❌ 0% es funcional desde interfaz

**Próximo Paso:**
No continuar con Fase 3, 4, 5, 6 hasta que:
1. Fase 2 compile sin errores
2. Módulo de Informes sea visible en sidebar
3. Flujo completo (crear → generar → descargar) funcione

**Tiempo Estimado para Funcional:** 1-1.5 horas

---

**Generado:** 11 Junio 2026  
**Por:** Auditoría Automática  
**Próxima Revisión:** Después de implementar recomendaciones
