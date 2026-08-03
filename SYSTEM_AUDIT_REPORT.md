# SYSTEM AUDIT REPORT — Progruas ERP

**Fecha:** 2026-07-01 (actualizado en segunda pasada el mismo día)
**Alcance:** Auditoría técnica completa solicitada por el usuario, con foco central en el módulo de Informes/Reportes y, en la segunda pasada, verificación visual real + implementación completa del Informe Técnico.
**Estado del build:** `npm run build` pasa sin errores al final de cada fase.

---

## 1. Módulos revisados

| Módulo | Estado antes | Acción tomada |
|---|---|---|
| Informes (Reportes Gerenciales) | Roto — exportaba columnas internas, `[object Object]`, tabla del PDF ilegible, eliminar fallaba siempre | Rediseñado (whitelist de columnas + fix de renderizado) + implementada la ruta de eliminación que faltaba |
| Informe Técnico | Funcional pero genérico, sin firma real, campos incompletos | **Rediseñado por completo** con estilo profesional estándar (el PDF de referencia del usuario nunca llegó adjunto pese a 3 intentos, ver §4) |
| Documentos | Ya soporta PDF/DOCX/XLSX/JPG/PNG/WEBP/PPTX, ver/descargar | Verificado, sin cambios necesarios |
| Activos, Mantenimientos, Novedades, Proyectos | Formularios genéricos funcionales | Validaciones de relaciones y duplicados reforzadas |
| Auditoría | Ya restringida a SUPER_ADMIN (RLS + chequeo de rol) | Solo corrección de tildes |
| Migraciones SQL | Mayoría idempotente | 6 archivos corregidos (ver §3) |
| i18n / Validaciones | Mezcla de inglés/español y tildes faltantes | Traducido y corregido en componentes y server actions |
| Responsive | Ya usa `overflow-x-auto`, sidebar/bottom-nav adaptable | Sin cambios, sin problemas detectados |

---

## 2. Errores encontrados y corregidos — Módulo de Informes (el hallazgo principal)

### 2.1 Columnas técnicas expuestas (causa raíz del reclamo original)
- `lib/actions/reports.ts` hacía `select('*')` contra `assets`, `incidents`, `maintenance_records`, trayendo `metadata`, `created_by`, `updated_by`, `company_id`.
- `lib/reports/utils.ts` (`formatReportData`) solo filtraba 5 columnas (`id, created_at, updated_at, deleted_at, company_id`) — **no** filtraba `created_by`, `updated_by`, ni `metadata`.
- **Corrección:** se creó `lib/reports/column-templates.ts` con una plantilla whitelist por entidad (`ASSETS`, `MAINTENANCE`, `INCIDENTS`, `PROJECTS`, `DOCUMENTS`) que define exactamente qué columnas de negocio se exportan, con:
  - `select` de Supabase que solo trae esas columnas + joins a nombres legibles (ej. `asset:assets(name,code)` en vez del `asset_id` crudo).
  - Etiquetas en español y formateo (`fecha`, `moneda`, `porcentaje`, `bytes`, traducción de enums vía `getEnumLabel()`).
  - `formatReportData()` fue reescrito para usar esta plantilla en vez de la lista negra.
  - `lib/actions/reports.ts` y `lib/actions/exports.ts` ahora usan el `select` de la plantilla en vez de `select('*')`.
- **Verificado con datos reales** (empresa `57388095-...`, 11 activos / 12 mantenimientos / 11 novedades): las columnas exportadas ya no incluyen `metadata`, `company_id`, `created_by`, `updated_by`, `deleted_at` ni ids crudos.

### 2.2 `[object Object]` en el PDF
- Causa: `lib/reports/generators.ts` renderizaba `String(rawValue)` sin serializar objetos (Excel sí lo hacía, PDF no).
- **Corrección:** además de que la whitelist ya evita traer campos JSONB, se agregó una red de seguridad: si un valor llega como objeto, se serializa con `JSON.stringify()` igual que en Excel.
- **Verificado:** 0 ocurrencias de `[object Object]` en los PDF/Excel generados con datos reales tras el fix.

### 2.3 Límite arbitrario de 24 filas + encabezados no repetidos
- El PDF cortaba el detalle a las primeras 24 filas (`reportData.slice(0, 24)`) sin importar cuántos registros hubiera, y aunque existía lógica de salto de página, nunca se usaba porque los datos ya venían recortados. Además, al saltar de página los encabezados de columna no se repetían.
- **Corrección:** se quitó el `.slice(0, 24)` y se refactorizó `drawTableHeader()` para repetirse en cada página nueva.

### 2.4 🔴 Bug crítico no reportado por el usuario: tabla del PDF se pintaba de un bloque negro sólido
Este fue el hallazgo más grave de la auditoría, y **preexistía** a cualquier cambio de esta sesión (se confirmó abriendo un PDF ya generado por la aplicación en producción, `public/reports/.../ASSETS_2026-06-25_....pdf`, generado el 25/06/2026, antes de tocar nada).

- **Causa raíz:** en `generatePdf()`, dentro del loop de columnas de la tabla, se llamaba `doc.rect(..., 'F')` (relleno) intercalado con `doc.text(valor, x, y, { maxWidth })` en cada iteración. Esta combinación específica (rect + text con la opción `maxWidth` de jsPDF, repetida muchas veces en un loop) corrompe el estado interno de color de relleno de jsPDF: todo lo que se dibuja después de la primera columna termina cubierto por un bloque sólido oscuro que tapa el resto de la tabla.
- Se aisló y confirmó el bug con un script mínimo reproducible (fuera del código del proyecto, usando jsPDF directo) antes de tocar el código real, para no arreglar algo mal diagnosticado.
- **Corrección:** se separaron las dos pasadas — primero se dibujan **todos** los rectángulos de una fila/encabezado, y **después** todo el texto de esa fila, usando `doc.splitTextToSize()` en vez de la opción `maxWidth` de `text()`. Aplicado tanto al encabezado (`drawTableHeader`) como a las filas de datos.
- **Verificado:** se regeneraron los PDF de ASSETS (19 columnas), MAINTENANCE (11 columnas) e INCIDENTS (10 columnas) con datos reales — la tabla se ve completa y correcta, sin bloques negros, en los tres casos.

### 2.5 Módulos de informe rotos silenciosamente: Proyectos y Documentos
- `report-schema.ts` ya declaraba `PROJECTS` y `DOCUMENTS` como entidades válidas, y la UI (`report-generator.tsx`) ya las ofrecía como opción, pero el `switch` en `lib/actions/reports.ts` solo manejaba `ASSETS`, `INCIDENTS`, `MAINTENANCE` — seleccionar Proyectos o Documentos devolvía error `Invalid report entity`.
- **Corrección:** se unificó el flujo para usar la plantilla de columnas de cualquier entidad definida, agregando `PROJECTS` (tabla `projects`) y `DOCUMENTS` (tabla `asset_documents`).
- Se aplicó el mismo criterio en `lib/actions/exports.ts` (exportación CSV/JSON), que tenía el mismo hueco.

---

## 3. Migraciones SQL — errores de idempotencia encontrados y corregidos

Se revisó archivo por archivo. La mayoría (`001`, `002`, `003`, `004`, `005`, `011`, `012`) ya seguía el patrón correcto (`IF NOT EXISTS`, `DROP ... IF EXISTS` antes de `CREATE TRIGGER`/`CREATE POLICY`, `ON CONFLICT`). Se encontraron y corrigieron **6 archivos** con problemas reales de re-ejecución:

| Archivo | Problema encontrado | Corrección |
|---|---|---|
| `006_email_webhooks_analytics.sql` | `CREATE INDEX` sin `IF NOT EXISTS` (12 índices), `CREATE TRIGGER`/`CREATE POLICY` sin `DROP ... IF EXISTS` previo, `ALTER PUBLICATION ADD TABLE` sin manejo de excepción | Agregado `IF NOT EXISTS` a los índices, `DROP TRIGGER/POLICY IF EXISTS` antes de cada `CREATE`, publicaciones envueltas en `do $$ ... exception when duplicate_object then null; end $$;` |
| `007_reports_enhancement.sql` | Los 3 `CREATE TRIGGER` de `updated_at` no tenían `DROP TRIGGER IF EXISTS` previo (las políticas sí lo tenían) | Agregado `DROP TRIGGER IF EXISTS` a los 3 |
| `008_image_management.sql` | 9 `CREATE POLICY` y 3 `CREATE TRIGGER` sin `DROP ... IF EXISTS` previo | Agregado a los 12 |
| `009_custom_fields.sql` | 9 `CREATE POLICY` y 3 `CREATE TRIGGER` sin `DROP ... IF EXISTS` previo | Agregado a los 12 |
| `010_export_configuration.sql` | 5 `CREATE POLICY` y 1 `CREATE TRIGGER` sin `DROP ... IF EXISTS` previo | Agregado a los 6 |
| `014_test_data_correct_schema.sql` | Migración de datos semilla (45 registros fijos) que fallaría con violación de constraint único si se re-ejecuta | Se agregó un guard al inicio del bloque `DO $$` que verifica si el primer registro (`ASSET-TEST-001`) ya existe para esa empresa y sale temprano con `RAISE NOTICE` si es así |

Todas estas correcciones son **guardas de idempotencia únicamente** — no cambian ningún efecto de esquema ya aplicado, solo hacen seguro volver a ejecutar el archivo.

`999_validation_test_data.sql` es un script de solo lectura (`SELECT`/`RAISE NOTICE`), no requiere cambios de idempotencia.

---

## 4. Informe Técnico — implementado completo con diseño profesional estándar

El usuario mencionó en tres ocasiones un PDF de referencia para el estilo visual, pero **nunca llegó adjunto** a la conversación (se buscó repetidamente en Descargas, Escritorio y la carpeta temporal de la sesión). Ante el tercer pedido explícito de implementar el módulo ("una de las funcionalidades principales del sistema"), se avanzó con un diseño profesional estándar que cubre **todos** los campos solicitados, dejando el ajuste de estilo visual exacto pendiente para cuando el archivo llegue correctamente.

### Cambios implementados
- **`components/signature-pad.tsx` (nuevo):** captura de firma a mano mediante `<canvas>` con eventos de puntero (mouse y táctil), sin ninguna dependencia externa nueva. Exporta la firma como PNG en base64 vía inputs ocultos.
- **`lib/reports/generators.ts`:**
  - Nuevo helper `resolveImageAsBase64()` que convierte una URL remota, una ruta local de `/public` o un data-URI en base64 embebible por `addImage()` de jsPDF. **Esto corrige un bug adicional preexistente:** jsPDF corriendo en Node.js no puede descargar una URL por sí mismo (eso solo funciona en un `<img>` de navegador), así que el logo de la empresa nunca se estaba mostrando en ningún PDF (ni en los informes gerenciales ni en el técnico) — siempre caía al placeholder de iniciales. Ya corregido en ambos generadores.
  - `generateTechnicalPdf()` reescrito por completo: estructura en el orden pedido — Logo/encabezado → Información del cliente (Cliente, Contacto, Fecha) → Información del proyecto y equipo intervenido (Proyecto/Obra, Equipo, Responsable técnico, Tipo de mantenimiento) → Descripción del trabajo → Actividades realizadas → Materiales utilizados (nuevo) → Repuestos utilizados → Mediciones técnicas → Observaciones → Recomendaciones (nuevo) → Evidencias fotográficas (imágenes antes/después reales, no solo texto) → Firmas (imagen dibujada + nombre) → Pie de página corporativo. Con paginación automática y encabezado/pie repetidos en cada página nueva.
- **`lib/actions/technical-reports.ts`:** nuevos campos (`clientName`, `clientContact`, `projectName`, `technicianName`, `materialsUsed`, `recommendations`, firmas en base64), carga real de archivos de evidencia (antes/después) validada por tipo y tamaño, traducción del tipo de mantenimiento vía `getEnumLabel()`.
- **`components/technical-report-form.tsx`:** formulario reorganizado en secciones (Cliente / Proyecto y equipo / Servicio realizado / Evidencias / Firmas), con selector de imágenes con vista previa en vez de campos de texto para URL, y los dos componentes `SignaturePad`.

### Verificado con datos reales (no solo código)
Se generó un PDF de prueba completo (`generateTechnicalPdf` invocado directamente con datos realistas y archivos PNG reales, no simulados) y se inspeccionó visualmente byte a byte: cliente, contacto, proyecto, equipo, responsable, tipo de mantenimiento, las 7 secciones de texto, evidencias fotográficas **con imágenes reales incrustadas** (antes/después) y firmas **con el trazo dibujado realmente incrustado como imagen**, paginación correcta a una segunda página con encabezado/pie repetidos. Sin bloque negro, sin `[object Object]`, sin columnas técnicas.

### Pendiente
Cuando el usuario logre adjuntar el PDF de referencia correctamente, ajustar solo la parte visual (colores, tipografía, posición exacta de logo/franjas) de `generateTechnicalPdf()` para igualar el modelo — la estructura de datos y campos ya no cambiaría.

---

## 5. Validaciones y traducción — errores corregidos

### Componentes/acciones que estaban en inglés (ahora en español)
`components/image-uploader.tsx`, `components/export-configurator.tsx`, `components/custom-field-builder.tsx`, y los mensajes de error/éxito devueltos por `lib/actions/reports.ts`, `lib/actions/exports.ts`, `lib/actions/custom-fields.ts`, `lib/actions/images.ts` (~60 strings traducidos). También se eliminó el patrón de reenviar el `error.message` crudo de Postgres al usuario (que a veces salía en inglés) en `lib/actions/tenant-records.ts`, reemplazándolo por mensajes en español, salvo el caso de duplicados que ahora se detecta específicamente.

### Tildes/ortografía corregidas
`lib/modules.ts` (etiquetas de campos mostradas en **todos** los formularios de creación: "Ubicacion"→"Ubicación", "Codigo"→"Código", "Horometro"→"Horómetro", "Ano"→"Año", "Aun no hay"→"Aún no hay", etc.), `components/tenant-record-form.tsx`, `lib/audit.ts`, `app/(app)/super-admin/auditoria/page.tsx`.

### Validaciones reforzadas en `lib/actions/tenant-records.ts`
- **Relaciones (nuevo):** los campos `asset_id`, `project_id`, `maintenance_record_id` ahora se verifican contra la base de datos para confirmar que existen **y pertenecen a la misma empresa** del usuario antes de insertar — antes solo se validaba el formato UUID, permitiendo referenciar (si se conocía el ID) un activo/proyecto de otra empresa. Verificado con datos reales: un ID de activo de otra empresa es correctamente rechazado; uno de la misma empresa se acepta.
- **Duplicados:** las violaciones de constraint único (`assets_company_id_code_key`, `projects_company_id_code_key`) ahora devuelven un mensaje claro en español en vez del error crudo de Postgres. Verificado contra la base de datos real (código `23505`).
- **Fechas:** ya existía validación de que `expires_at` de documentos no sea anterior a hoy.
- **Obligatorios y estados:** ya estaban cubiertos (campos requeridos, enums validados contra `ENUM_OPTIONS`).

---

## 6. Documentos — verificado, sin cambios necesarios

Ya soporta subir PDF, DOCX, XLSX, JPG, PNG, WEBP y PPTX (validado en cliente y en la constraint SQL `asset_documents_mime_allowed`), con límite de 20 MB, y ya tiene botones funcionales de Ver (signed URL) / Descargar / Eliminar en `components/document-actions.tsx`. No se encontraron brechas frente a lo solicitado.

---

## 7. Auditoría — verificado, solo texto corregido

Ya estaba correctamente restringida a `SUPER_ADMIN` en dos capas:
- RLS: policy `audit_select` en `001_initial_multitenant_schema.sql` (`is_super_admin() or can_manage_company(company_id)`).
- UI: `if (tenant.role !== "SUPER_ADMIN") notFound();` en `app/(app)/super-admin/auditoria/page.tsx` y en el redirect legacy `app/(app)/auditoria/page.tsx`.

Verificado además que un usuario **sin sesión** que intenta entrar a `/super-admin/auditoria` es redirigido a `/login` por el middleware (HTTP 307), antes incluso de llegar al chequeo de rol.

---

## 8. Responsive — verificado, sin problemas críticos

Tablas ya usan wrapper `overflow-x-auto` (`components/ui/table.tsx`), layout con sidebar `hidden lg:block` + navegación inferior `lg:hidden` en móvil (`components/app-shell.tsx`). No se detectaron desbordamientos horizontales ni layouts rotos.

---

## 9. Evidencia de pruebas realizadas

### Primera pasada (verificación de lógica contra datos reales)
No había herramienta de navegador disponible; se ejecutó la lógica real (las mismas funciones que usan las Server Actions) contra la base de datos real de Supabase e se inspeccionó el contenido byte a byte de los archivos generados:
1. Generación real de PDF + Excel para ASSETS, MAINTENANCE e INCIDENTS con datos reales (11, 12 y 11 registros): sin columnas técnicas, sin `[object Object]`.
2. Comparación con un PDF ya generado en producción (`public/reports/.../ASSETS_2026-06-25_...pdf`) para confirmar que el bug del bloque negro y las columnas técnicas eran reales y preexistentes.
3. Validación de FK cross-tenant: un `asset_id` de otra empresa es rechazado; uno de la misma empresa es aceptado.
4. Violación de duplicado (`code` repetido): confirma código `23505` y nombre de constraint.
5. Acceso sin sesión a `/super-admin/auditoria`: redirect 307 a `/login`.

### Segunda pasada — verificación visual real con navegador (a pedido explícito del usuario)
Se instaló Playwright temporalmente (`npm install --no-save playwright`, desinstalado al finalizar — no quedó como dependencia del proyecto) y se controló un Chromium real contra `npm run dev`. Se inició sesión con una cuenta real que el usuario compartió explícitamente para esta prueba (no se reseteó ninguna contraseña ni se creó un usuario por API sin autorización — se pidió permiso primero y el usuario optó por dar credenciales existentes).

Se verificaron con capturas de pantalla reales los 6 puntos pedidos:
1. **Generación de PDF** — formulario completado, clic en "Generar Informe", modal de éxito "✓ Informe Generado" con nombre de archivo, 21 registros, 98.0 KB.
2. **Generación de Excel** — mismo flujo, formato Excel, modal de éxito con 9.6 KB.
3. **Descarga** — clic en "Descargar" capturado por Playwright como descarga real del navegador; archivo `.xlsx` verificado en disco.
4. **Visualización** — clic en "Ver" abre una pestaña nueva con el archivo (confirmado su apertura).
5. **Eliminación** — 🔴 **se encontró un bug crítico**: el frontend (`components/report-list.tsx`) llama a `fetch("/api/reports/delete", ...)`, pero **esa ruta no existía en el proyecto** — toda eliminación fallaba silenciosamente con 404 y mostraba "Error al eliminar informe". **Corregido:** se creó `app/api/reports/delete/route.ts` (verifica pertenencia a la empresa, borra el archivo en Storage y el registro en `generated_reports`, registra auditoría). Verificado de nuevo con navegador real: la eliminación ahora funciona sin errores.
6. **Historial** — tabla real capturada mostrando los informes generados, con sus estados, tamaños y acciones.

Todos los informes de prueba generados durante esta verificación fueron eliminados al finalizar (identificados únicamente por su fecha de creación de hoy), sin tocar ningún dato histórico preexistente de la empresa del usuario.

### Hallazgo adicional en datos reales de producción (no corregido, ver §11)
Al revisar el historial real se encontraron **filas preexistentes** atascadas en estado "Generando..." indefinidamente, y varias con estado "Error" mostrando mensajes de Postgres sin traducir (`Upload failed: Bucket not found`, `invalid input syntax for type uuid: "reports"`) — bugs de generación de informes de sesiones anteriores a esta auditoría, ya presentes en la base de datos real del usuario.

---

## 10. Funcionalidades pendientes

- Ajuste del estilo visual exacto del Informe Técnico cuando el usuario logre adjuntar el PDF de referencia (la estructura y campos ya están completos, ver §4).
- Crear/editar/subir archivo por clic real en el navegador no se volvieron a probar visualmente en esta pasada (se priorizaron los 6 puntos explícitamente pedidos del módulo de informes); se recomienda que el usuario los pruebe directamente ahora que el servidor de desarrollo sigue corriendo en `http://localhost:3001`.
- Revisión UX/consistencia del resto de módulos (Usuarios, Proyectos, Novedades, Documentos) más allá de los textos en español corregidos — no se completó una pasada exhaustiva módulo por módulo dado el tiempo de la sesión; ver hallazgos parciales en §11.

## 11. Mejoras sugeridas y hallazgos adicionales

### Corregidos en esta sesión (i18n adicional encontrado en la segunda pasada)
Tildes y textos faltantes en: página de login (`Iniciar sesion`→`Iniciar sesión`, `Contrasena`→`Contraseña`, etc.), `lib/company-settings.ts` (descripciones y mensajes vacíos de cada módulo cuando la empresa personaliza terminología por industria), `app/manifest.ts`, `components/module-page.tsx`, `components/notification-bell.tsx`, `components/admin-realtime-dashboard.tsx`, ficha de detalle de activo (`app/(app)/activos/[id]/page.tsx`).

### No corregidos — requieren decisión del usuario
- **Página huérfana en inglés:** `app/(app)/reports/history/page.tsx` y `app/(app)/reports/new/` son rutas activas (compilan y responden) pero **no están enlazadas desde el menú de navegación** (`components/app-shell.tsx`) — parecen una versión anterior y duplicada del módulo de Informes, completamente en inglés ("Report History", "Loading reports...", etc.), con su propia lógica de descarga/eliminación (más simple, sin registrar auditoría). No se eliminó porque podría haber una razón para conservarla que no conozco — recomiendo confirmar si se puede borrar.
- El reporte de **Activos** tiene 19 columnas, lo que produce una tabla muy apretada en una página A4 vertical. Considerar orientación horizontal (landscape) para reportes con muchas columnas, o permitir al usuario elegir un subconjunto de columnas antes de exportar.
- Filas atascadas en "Generando..." y errores de Storage sin traducir en el historial real de informes (ver §9) — bugs de sesiones anteriores, no de esta auditoría; requieren investigar por qué algunas subidas a Storage fallan con "Bucket not found".
- Limpiar los scripts de depuración sueltos en la raíz del proyecto (`tmp-check-reports.js`, `tmp-reports-schema-fix.js`, `audit-schema.mjs`, `check-storage.mjs`, `insert-*.mjs`, `tmp_reports_action.cjs`) — son artefactos de sesiones de desarrollo anteriores, no se eliminaron en esta sesión al no ser parte del pedido explícito.
- Hay dos triggers de `updated_at` independientes sobre `report_templates` y `generated_reports` (uno de `004_reports_evidence.sql`, otro de `007_reports_enhancement.sql`) — funcionalmente inofensivo pero redundante.
