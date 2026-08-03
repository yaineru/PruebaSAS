# AUDITORÍA COMPLETA: FLUJO DE GENERACIÓN DE INFORMES

**Fecha:** 11 Junio 2026  
**Estado:** 🔴 **CRÍTICO - INCOMPLETO**

---

## PROBLEMA IDENTIFICADO

El flujo de generación de informes está **50% implementado**:

✅ **QUÉ FUNCIONA:**
- Formulario de generación (ReportGenerator)
- Inserción en tabla `generated_reports`
- Tabla historial (ReportList)
- Lógica básica de validación

❌ **QUÉ FALTA:**
- Generación de PDF
- Generación de Excel
- Carga a storage
- Creación de signed URLs
- Actualización de `url` en tabla
- Descarga funcional
- Modal de visualización

---

## MAPA COMPLETO DEL FLUJO ESPERADO

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USUARIO: Genera informe desde /informes/generar              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GENERATEREPORT (Frontend)                                    │
│    - Extrae FormData                                            │
│    - Llama a generateReport() (Server Action)                   │
│    - Espera respuesta                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. GENERATEREPORT (Server Action) - lib/actions/reports.ts      │
│    ✅ IMPLEMENTADO:                                              │
│      - Valida FormData                                          │
│      - Busca datos en tabla (ASSETS/INCIDENTS/MAINTENANCE)      │
│      - Inserta fila en generated_reports (status: READY)        │
│      - Retorna: { success, reportId, fileName, recordCount }    │
│                                                                  │
│    ❌ FALTA IMPLEMENTAR:                                         │
│      - Llamar a generatePdf() o generateExcel()                 │
│      - Llamar a uploadReportFile()                              │
│      - Actualizar registro con file_url                         │
│      - Agregar logs: REPORT_CREATED, REPORT_FILE_CREATED, etc   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. GENERATEPDF / GENERATEEXCEL (NO EXISTE)                      │
│    Crear en: lib/reports/generators.ts                          │
│    ❌ FALTA:                                                     │
│      - Importar PDFKit o jsPDF                                   │
│      - Crear documento PDF/Excel                                │
│      - Insertar datos (header, tabla, gráficos)                 │
│      - Retornar Buffer                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. UPLOADREPORTFILE (NO EXISTE)                                 │
│    Crear en: lib/actions/reports.ts                             │
│    ❌ FALTA:                                                     │
│      - Subir Buffer a Supabase Storage ('documents' bucket)      │
│      - Guardar en path: reports/{companyId}/{timestamp}.pdf     │
│      - Retornar: { filePath, file_url }                         │
│      - Log: REPORT_FILE_CREATED                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. GETSIGNEDURL (PARCIAL)                                       │
│    Ubicación: lib/actions/reports.ts                            │
│    ✅ EXISTE:                                                    │
│      - Lógica en /api/reports/[id]/download                     │
│                                                                  │
│    ❌ PROBLEMA:                                                  │
│      - Busca file_path_pdf, file_path_excel (NO EXISTEN)        │
│      - Debería buscar: file_path                                │
│      - Debería guardar URL en tabla: file_url                   │
│      - Log: REPORT_DOWNLOAD_URL                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. UPDATEREPORTWITHURLFRONT                                     │
│    Ubicación: components/report-generator.tsx                   │
│    ❌ FALTA:                                                     │
│      - Mostrar modal "Descarga lista"                           │
│      - Botones: "Ver PDF" / "Descargar"                         │
│      - O: Descargar automáticamente                             │
│      - O: Redirigir a /informes con scroll a nuevo reporte      │
│      - Log: REPORT_COMPLETED                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. DESCARGAREPORT (USUARIO)                                     │
│    ✅ PARCIALMENTE:                                              │
│      - Tabla ReportList muestra botón "Descargar"               │
│                                                                  │
│    ❌ PROBLEMA:                                                  │
│      - report.url está NULL (nunca se asignó)                   │
│      - Botón no aparece                                         │
│      - Log: REPORT_DOWNLOAD                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ANÁLISIS DETALLADO DE ARCHIVOS

### 1. `lib/actions/reports.ts` - generateReport()

**Líneas:** 14-177  
**Estado:** ❌ **50% IMPLEMENTADO**

**Lo que hace:**
```typescript
✅ Valida FormData
✅ Busca datos en tablas
✅ Inserta en generated_reports con status: 'READY'
✅ Retorna { success: true, reportId, fileName, recordCount }

❌ NO GENERA ARCHIVO
❌ NO SUBE A STORAGE
❌ NO CREA SIGNED URL
❌ NO ACTUALIZA file_url
❌ FALTA LOGGING DETALLADO
```

**Lo que debería hacer:**
```typescript
1. Generar PDF o Excel según reportFormat
2. Subir archivo a Supabase Storage
3. Crear signed URL (1 hora de validez)
4. Actualizar registro generated_reports con file_url
5. Agregar logs en cada paso:
   - REPORT_CREATED (después INSERT)
   - REPORT_FILE_CREATED (después subir a storage)
   - REPORT_FILE_URL (después crear signed URL)
   - REPORT_COMPLETE (final)
```

**Problema adicional:**
- Guarda `status: 'READY'` pero debería guardar `status: 'GENERATING'` primero
- Luego actualizar a `status: 'READY'` después de generar el archivo
- Si hay error, poner `status: 'FAILED'` con `error_message`

---

### 2. `components/report-generator.tsx`

**Líneas:** 1-150+  
**Estado:** ✅ **DISEÑADO CORRECTO, PERO INCOMPLETO EN LÓGICA**

**Lo que hace:**
```typescript
✅ Renderiza formulario
✅ Extrae FormData
✅ Llama generateReport()
✅ Guarda resultado en state

❌ NO MUESTRA RESULTADO AL USUARIO
❌ NO DESCARGA ARCHIVO
❌ NO MUESTRA MODAL
```

**Lo que falta:**
```typescript
if (state.success && state.reportId) {
  // Opción A: Mostrar modal
  return <DownloadModal 
    reportId={state.reportId}
    fileName={state.fileName}
    onClose={() => setState({ success: false })}
  />
  
  // Opción B: Descargar automáticamente
  // window.location.href = `/api/reports/${state.reportId}/download`
  
  // Opción C: Redirigir a historial
  // router.push('/informes')
}
```

---

### 3. `components/report-list.tsx`

**Líneas:** 1-260  
**Estado:** ⚠️ **DISEÑO CORRECTO, PERO DATOS FALTANTES**

**Lo que hace:**
```typescript
✅ Carga reports desde generated_reports
✅ Muestra tabla con historial
✅ Botón "Descargar" si status === 'READY' Y report.url existe

❌ report.url SIEMPRE ES NULL
❌ Botón "Descargar" nunca aparece
```

**Línea 196-200:**
```typescript
{report.status === "READY" && report.url && (
  <Button size="sm" variant="outline" asChild>
    <a href={report.url} download>
      <Download className="h-4 w-4" />
    </a>
  </Button>
)}
```

**Problema:** `report.url` nunca tiene valor porque generateReport() no lo asigna.

---

### 4. `app/api/reports/[id]/download/route.ts`

**Líneas:** 1-60  
**Estado:** 🔴 **ERRORES CRÍTICOS**

**Problemas identificados:**

**Línea 32:**
```typescript
let filePath = report.file_path_pdf || report.file_path_excel;
```
❌ Estas columnas NO EXISTEN en tabla `generated_reports`

**Solución:**
```typescript
let filePath = report.file_path;  // Columna real en tabla
```

**Línea 40:**
```typescript
const isPDF = report.file_path_pdf === filePath;
```
❌ No puede determinar tipo si ambas columnas no existen

**Solución:**
```typescript
const isPDF = report.file_format === 'PDF';
const isExcel = report.file_format === 'EXCEL';
```

**Línea 46:**
```typescript
.from('documents')
.createSignedUrl(filePath, 3600);
```
✅ Bucket 'documents' es correcto
❌ Pero filePath puede no existir en storage

---

### 5. `supabase/migrations/007_reports_enhancement.sql`

**Líneas:** 95-130  
**Estado:** ✅ **ESQUEMA CORRECTO**

**Tabla `generated_reports` tiene columnas:**
```sql
✅ id (UUID PK)
✅ company_id (FK)
✅ generated_by (FK)
✅ report_type (TEXT)
✅ report_entity (TEXT)
✅ report_format (TEXT: PDF/EXCEL/BOTH)
✅ template_name (TEXT)
✅ filters (JSONB)
✅ record_count (INTEGER)
✅ file_size_bytes (INTEGER)
✅ file_path (TEXT) ← Ruta en storage
✅ file_url (TEXT) ← SIGNED URL (vacío actualmente)
✅ status (TEXT: GENERATING/GENERATED/FAILED)
✅ error_message (TEXT)
✅ generation_time_ms (INTEGER)
✅ created_at
```

**Campos que se usan:**
- `file_path`: Almacenar ruta en Supabase Storage
- `file_url`: Almacenar signed URL generada
- `status`: Mostrar estado (GENERATING, GENERATED, FAILED)
- `error_message`: Almacenar error si falla
- `file_size_bytes`: Mostrar tamaño en historial

---

## PROBLEMAS Y SOLUCIONES

### PROBLEMA 1: Generación de archivo nunca ocurre

**Ubicación:** lib/actions/reports.ts, línea ~115  
**Severidad:** 🔴 CRÍTICO

**Estado actual:**
```typescript
const { data: report, error: reportError } = await supabase
  .from('generated_reports')
  .insert(insertPayload)  // Solo inserta metadata
  .select()
  .single();

return {
  success: true,
  reportId: report.id,
  fileName: filePath,  // Esto NO se generó realmente
  recordCount,
  message: 'Report generated successfully',  // Falsa promesa
};
```

**Problema:**
- `filePath` es solo una ruta imaginaria: `reports/{companyId}/ASSETS_2026-06-11.tmp`
- No existe archivo en storage
- `file_url` nunca se asigna

**Solución necesaria:**
1. Cambiar status inicial a 'GENERATING'
2. Generar PDF/Excel usando generadores
3. Subir a storage
4. Crear signed URL
5. Actualizar registro con file_url
6. Cambiar status a 'GENERATED'

---

### PROBLEMA 2: Campos de ruta inconsistentes

**Ubicación:** Múltiples archivos  
**Severidad:** 🟡 ALTO

**Inconsistencias encontradas:**

| Archivo | Lo que busca | Lo que existe |
|---------|--------------|---------------|
| lib/actions/reports.ts | `file_path` | ✅ |
| app/api/reports/[id]/download | `file_path_pdf` `file_path_excel` | ❌ |
| components/report-list.tsx | `url` | ❌ |

**Solución:**
- Usar siempre `file_path` para guardar ruta
- Usar siempre `file_url` para signed URL
- Crear signed URL en el backend, no en frontend

---

### PROBLEMA 3: No hay UI para resultado de generación

**Ubicación:** components/report-generator.tsx  
**Severidad:** 🟡 ALTO

**Estado actual:**
```typescript
const [state, setState] = useState<FormState>({ success: false });

// Si generación es exitosa, no hay UI que lo indique
if (state.success) {
  // ❌ Sin mostrar nada
}
```

**Solución necesaria:**
- Modal con botones: "Ver" / "Descargar"
- O: Descarga automática
- O: Redirect a /informes con toast "Informe listo"

---

### PROBLEMA 4: Logging inexistente

**Ubicación:** Todos los archivos  
**Severidad:** 🟡 ALTO

**Logs requeridos:**

```typescript
// 1. Cuando se inicia generación
console.log('REPORT_CREATED', { 
  reportId: report.id,
  type: validated.reportEntity,
  format: validated.reportFormat,
  recordCount,
});

// 2. Cuando se genera archivo
console.log('REPORT_FILE_CREATED', {
  reportId,
  filePath,
  fileSizeBytes,
  generationTimeMs,
});

// 3. Cuando se crea URL
console.log('REPORT_FILE_URL', {
  reportId,
  signedUrl: urlData.signedUrl,
  expiresIn: 3600,
});

// 4. Cuando se descarga
console.log('REPORT_DOWNLOAD', {
  reportId,
  format: report.file_format,
  userId: getTenantContext().userId,
});

// 5. Si algo falla
console.error('REPORT_ERROR', {
  reportId,
  stage: 'PDF_GENERATION' | 'UPLOAD' | 'URL_GENERATION',
  error: error.message,
});
```

---

## SECUENCIA DE IMPLEMENTACIÓN

### Fase 1: Generar PDF/Excel (NO EXISTE)
- [ ] Crear `lib/reports/generators.ts`
- [ ] Función `generatePdf(data, template)`
- [ ] Función `generateExcel(data, template)`
- [ ] Retornar Buffer

### Fase 2: Subir a Storage (NO EXISTE)
- [ ] Crear `uploadReportFile(buffer, reportId, format)`
- [ ] Subir a bucket 'documents'
- [ ] Guardar en path: `reports/{companyId}/{reportId}.{ext}`
- [ ] Retornar `{ filePath, fileSizeBytes }`

### Fase 3: Crear Signed URL (PARCIAL)
- [ ] Crear `getSignedUrl(filePath)`
- [ ] Crear en backend, no frontend
- [ ] Validez: 1 hora (3600 segundos)
- [ ] Guardar en tabla `file_url`

### Fase 4: Actualizar generateReport()
- [ ] Cambiar status a 'GENERATING'
- [ ] Llamar generatePdf() o generateExcel()
- [ ] Llamar uploadReportFile()
- [ ] Llamar getSignedUrl()
- [ ] Actualizar registro con file_url, file_size_bytes, generation_time_ms
- [ ] Cambiar status a 'GENERATED'
- [ ] Agregar logs REPORT_*

### Fase 5: Frontend - Mostrar resultado
- [ ] Modal de descarga después de generar
- [ ] O: Descargar automáticamente
- [ ] O: Redirigir a /informes

### Fase 6: Corregir Download Route
- [ ] Cambiar búsqueda: file_path_pdf → file_path
- [ ] Determinar formato desde report.file_format

---

## ARCHIVOS A CREAR/MODIFICAR

| # | Archivo | Acción | Prioridad |
|---|---------|--------|-----------|
| 1 | `lib/reports/generators.ts` | CREAR | 🔴 CRÍTICA |
| 2 | `lib/actions/reports.ts` | MODIFICAR | 🔴 CRÍTICA |
| 3 | `app/api/reports/[id]/download/route.ts` | CORREGIR | 🔴 CRÍTICA |
| 4 | `components/report-generator.tsx` | MEJORAR | 🟡 ALTA |
| 5 | `components/report-download-modal.tsx` | CREAR | 🟡 ALTA |

---

## VERIFICACIÓN REQUERIDA

Después de implementación, verificar:

```
✅ Formulario genera informe
✅ Archivo PDF se crea en storage
✅ Archivo Excel se crea en storage
✅ file_url se guarda en tabla
✅ file_size_bytes se guarda
✅ generation_time_ms se guarda
✅ Status cambia: GENERATING → GENERATED
✅ Modal muestra "Informe listo"
✅ Botón "Descargar" descarga archivo
✅ Logs aparecen en servidor (npm run dev)
✅ Tabla /informes muestra botón "Descargar"
```

---

**Conclusión:** El flujo está **50% implementado**. Falta la generación real de archivos, carga a storage y creación de signed URLs. Sin estas funciones, los usuarios no pueden descargar ningún archivo.
