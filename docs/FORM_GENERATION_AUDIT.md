# AUDITORÍA DEL FORMULARIO DE GENERACIÓN DE INFORMES

**Fecha:** 11 Junio 2026  
**Estado:** ❌ **MISMATCH DE CAMPOS - IDENTIFICADO Y CORREGIDO**

---

## PROBLEMA ENCONTRADO

**Error:** `Invalid input: String must contain at least 1 character(s)`

### Root Cause

El formulario está enviando campos con nombres diferentes a los que espera el servidor:

#### ❌ MISMATCH - CAMPO 1: reportEntity vs reportType

| Componente | Campo Enviado | Tipo | Requerido |
|------------|---------------|------|-----------|
| **formulario** | `reportType` | radio input | ✅ Sí |
| **servidor** | `reportEntity` | se extrae con `formData.get('reportEntity')` | ✅ Sí |

```typescript
// FORMULARIO (components/report-generator.tsx)
<input
  type="radio"
  name="reportType"          // ❌ Nombre incorrecto
  value={type.value}
  required
/>

// SERVIDOR (lib/actions/reports.ts)
const reportEntity = sanitizeText(formData.get('reportEntity') as string);  // ❌ Espera 'reportEntity'
```

**Resultado:** `formData.get('reportEntity')` retorna `null` o `undefined` → se convierte a string vacío → validación Zod falla con "String must contain at least 1 character(s)"

---

#### ❌ MISMATCH - CAMPO 2: reportFormat vs fileFormat

| Componente | Campo Enviado | Tipo | Requerido |
|------------|---------------|------|-----------|
| **formulario** | `fileFormat` | radio input | ✅ Sí |
| **servidor** | `reportFormat` | se extrae con `formData.get('reportFormat')` | ✅ Sí |

```typescript
// FORMULARIO
<input
  type="radio"
  name="fileFormat"           // ❌ Nombre incorrecto
  value="PDF"
  required
/>

// SERVIDOR
const reportFormat = formData.get('reportFormat') as string;  // ❌ Espera 'reportFormat'
```

**Resultado:** `formData.get('reportFormat')` retorna `null` → pasa a validación con valor nulo

---

#### ⚠️ FALTA - CAMPO 3: templateName

| Componente | Campo Enviado | Tipo | Requerido |
|------------|---------------|------|-----------|
| **formulario** | `(no enviado)` | N/A | ❌ No |
| **servidor** | `templateName` | se extrae con `formData.get('templateName')` | ❌ No (tiene default) |

```typescript
// FORMULARIO
// ❌ No hay ningún campo que envíe templateName

// SERVIDOR
const templateName = sanitizeText(formData.get('templateName') as string || 'standard');
```

**Resultado:** OK - tiene valor por defecto 'standard', pero debería estar explícito

---

## SCHEMA ZOD ESPERADO vs ENVIADO

### Definición en `lib/reports/report-schema.ts`:

```typescript
export const generateReportSchema = z.object({
  reportEntity: z.string().min(1),        // ✅ Requerido, min 1 carácter
  reportFormat: z.enum(['PDF', 'EXCEL', 'BOTH']),  // ✅ Requerido
  templateName: z.string().optional(),    // ❌ Opcional
  filters: z.record(z.any()).optional(),  // ❌ Opcional
  includeCharts: z.boolean().optional(),  // ❌ Opcional
  includeSummary: z.boolean().optional(), // ❌ Opcional
});
```

### Lo que el formulario ENVÍA:

```javascript
{
  reportType: "ASSETS",           // ❌ Nombre incorrecto
  fileFormat: "PDF",              // ❌ Nombre incorrecto
  filter_dateStart: "",           // ❌ Filtro con nombre incorrecto
  // ... otros filtros
}
```

### Lo que el servidor ESPERA:

```javascript
{
  reportEntity: "ASSETS",         // ✅ Correcto
  reportFormat: "PDF",            // ✅ Correcto
  templateName: "standard",       // ✅ Valor por defecto
  filters: {                      // ✅ Objeto consolidado
    dateStart: "",
    // ... otros filtros
  }
}
```

---

## ANÁLISIS DE CAMPOS DEL FORMULARIO

### 1. Campos de Selección (Radio)

| Campo | Nombre Actual | Nombre Esperado | Valores | Requerido | Estado |
|-------|---------------|-----------------|--------|-----------|--------|
| Tipo Informe | `reportType` | `reportEntity` | ASSETS, MAINTENANCE, INCIDENTS, PROJECTS, DOCUMENTS | ✅ | ❌ INCORRECTO |
| Formato | `fileFormat` | `reportFormat` | PDF, EXCEL, BOTH | ✅ | ❌ INCORRECTO |

### 2. Campos Hidden (Filtros)

```typescript
// Generados automáticamente por AdvancedFilters
{Object.entries(advancedFilters).map(([key, value]) => (
  value && (
    <input
      type="hidden"
      name={`filter_${key}`}      // ❌ Nombre: filter_dateStart
      value={value}
    />
  )
))}
```

**Problema:** Los filtros se envían como `filter_dateStart`, `filter_status`, etc., pero el servidor los consolida en un objeto `filters` bajo la clave sin el prefijo `filter_`.

---

## SERVIDOR - EXTRACCIÓN DE DATOS

### Código Actual (lib/actions/reports.ts)

```typescript
export async function generateReport(formData: FormData) {
  try {
    // ❌ CAMPOS CON NOMBRES INCORRECTOS
    const reportEntity = sanitizeText(formData.get('reportEntity') as string);
    const reportFormat = formData.get('reportFormat') as string;
    const templateName = sanitizeText(formData.get('templateName') as string || 'standard');

    // ✅ FILTROS - CONSOLIDADOS CORRECTAMENTE
    const filters: Record<string, any> = {};
    const formEntries = Array.from(formData.entries());
    for (const [key, value] of formEntries) {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '');
        filters[filterKey] = value;
      }
    }

    // VALIDACIÓN ZOD
    const validated = generateReportSchema.parse({
      reportEntity,              // ❌ Null o undefined → ""
      reportFormat,              // ❌ Null o undefined
      templateName,
      filters,
    });
    // ...
  }
}
```

---

## CORRECCIONES REQUERIDAS

### CORRECCIÓN 1: Campo reportEntity

**Archivo:** `components/report-generator.tsx`  
**Ubicación:** Línea ~93  
**Cambio:**
```diff
  <input
-   name="reportType"
+   name="reportEntity"
    value={type.value}
    required
  />
```

---

### CORRECCIÓN 2: Campo reportFormat

**Archivo:** `components/report-generator.tsx`  
**Ubicación:** Línea ~127  
**Cambio:**
```diff
  <input
    type="radio"
-   name="fileFormat"
+   name="reportFormat"
    value="PDF"
    required
    defaultChecked
  />
  <input
    type="radio"
-   name="fileFormat"
+   name="reportFormat"
    value="EXCEL"
    required
  />
```

---

### CORRECCIÓN 3: Agregar Campo templateName

**Archivo:** `components/report-generator.tsx`  
**Ubicación:** Después de fileFormat (antes de Advanced Filters)  
**Cambio:**
```diff
+ <input
+   type="hidden"
+   name="templateName"
+   value="standard"
+ />
```

---

### CORRECCIÓN 4: Mejorar Logging en Servidor

**Archivo:** `lib/actions/reports.ts`  
**Ubicación:** Antes de parseSchema (línea ~42)  
**Cambio:**
```diff
+ // DEBUG: Log payload antes de validación
+ const payload = {
+   reportEntity,
+   reportFormat,
+   templateName,
+   filters,
+ };
+ console.log("REPORT_PAYLOAD", JSON.stringify(payload, null, 2));

  const validated = generateReportSchema.parse({
    reportEntity,
    reportFormat,
    templateName,
    filters,
  });
```

---

### CORRECCIÓN 5: Mostrar Errores Específicos en UI

**Archivo:** `lib/actions/reports.ts`  
**Ubicación:** En catch ZodError (línea ~120)  
**Cambio:**
```diff
  } catch (error) {
    if (error instanceof ZodError) {
+     // Formatear errores específicos
+     const fieldErrors = error.flatten().fieldErrors;
+     const errorMessages = Object.entries(fieldErrors)
+       .map(([field, errors]) => `❌ ${field}: ${errors?.[0] || 'Error desconocido'}`)
+       .join('\n');
-     return { success: false, error: 'Invalid input: ' + error.errors[0].message };
+     return { success: false, error: errorMessages || 'Error de validación' };
    }
```

---

## FLUJO CORRECTO DESPUÉS DE CORRECCIONES

### Formulario → FormData

```javascript
// Lo que se envía
{
  reportEntity: "ASSETS",
  reportFormat: "PDF",
  templateName: "standard",
  filter_dateStart: "2026-01-01",
  filter_status: "active",
  // ... otros filtros
}
```

### Servidor → Extrae

```typescript
reportEntity = "ASSETS"
reportFormat = "PDF"
templateName = "standard"
filters = {
  dateStart: "2026-01-01",
  status: "active",
}
```

### Validación → Zod

```typescript
generateReportSchema.parse({
  reportEntity: "ASSETS",      // ✅ String min 1
  reportFormat: "PDF",          // ✅ En enum
  templateName: "standard",     // ✅ Opcional
  filters: { ... }              // ✅ Record
})
// ✅ VÁLIDO
```

---

## TABLA COMPARATIVA - ANTES vs DESPUÉS

| Aspecto | ANTES | DESPUÉS |
|--------|-------|---------|
| Campo: Tipo Informe | `reportType` | `reportEntity` |
| Campo: Formato | `fileFormat` | `reportFormat` |
| Campo: Plantilla | (no enviado) | `templateName="standard"` |
| Logging | No | `console.log("REPORT_PAYLOAD", ...)` |
| Errores UI | "Invalid input: String must..." | "❌ reportEntity: String must contain..." |
| Validación Visual | ❌ Genérico | ✅ Campo específico |

---

## RESUMEN DE ARCHIVOS A MODIFICAR

| # | Archivo | Línea | Cambio |
|---|---------|-------|--------|
| 1 | `components/report-generator.tsx` | ~93 | `name="reportType"` → `name="reportEntity"` |
| 2 | `components/report-generator.tsx` | ~127, 135 | `name="fileFormat"` → `name="reportFormat"` (ambos) |
| 3 | `components/report-generator.tsx` | ~157 | Agregar hidden input `templateName="standard"` |
| 4 | `lib/actions/reports.ts` | ~42 | Agregar logging: `console.log("REPORT_PAYLOAD", ...)` |
| 5 | `lib/actions/reports.ts` | ~120 | Mejorar error handling para mostrar campo específico |

---

## BENEFICIOS DE LAS CORRECCIONES

✅ **Eliminará el error:** "Invalid input: String must contain at least 1 character(s)"  
✅ **Nombres consistentes:** reportEntity, reportFormat  
✅ **Debugging claro:** Console log del payload antes de validación  
✅ **UX mejorada:** Mensajes de error específicos por campo  
✅ **Mantenibilidad:** Código auto-descriptivo con nombres consistentes

---

**Clasificación:** 🔴 **CRÍTICO** - El formulario no funciona debido a mismatch de nombres de campos
