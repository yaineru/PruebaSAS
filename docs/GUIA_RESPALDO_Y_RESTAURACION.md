# Guía de respaldo y restauración

## Qué respalda Supabase automáticamente

Todo proyecto de Supabase en un plan pago incluye copias de seguridad físicas diarias de la base de datos completa, con capacidad de "Point in Time Recovery" (PITR) en los planes Pro y superiores (restaurar a cualquier segundo de los últimos días, no solo al último respaldo diario). Esto se administra desde el panel de Supabase → Project Settings → Database → Backups, y **no requiere ninguna acción del lado de la aplicación** — funciona igual sin importar qué tan grande sea la base de datos de EmpresaOS.

**Importante:** el plan gratuito de Supabase no incluye respaldos automáticos administrados. Si el proyecto de producción de un cliente corre en el plan gratuito, el primer paso antes de considerar el sistema "listo para producción" es subir al menos al plan Pro, específicamente por esta razón.

## Qué NO cubre el respaldo de Supabase

El respaldo de base de datos de Supabase **no incluye los archivos de Storage** (documentos, fotos de equipos, PDFs de informes). Storage tiene su propia durabilidad (Supabase la respalda con redundancia de S3 por debajo), pero un "restaurar la base de datos a ayer" no revierte también los archivos — si un archivo se borró por error, restaurar la base de datos no lo trae de vuelta. Verificado en esta auditoría: **20 documentos y 17 informes de la base de datos ya apuntan hoy a un archivo que no existe en Storage** (probablemente registros de prueba o de una limpieza de storage sin la fila correspondiente eliminada) — un buen recordatorio de que ambas piezas (fila de base de datos + archivo en Storage) se pueden desincronizar, y de que ninguna herramienta automática las mantiene sincronizadas.

## Prueba real ejecutada en esta certificación

Como no fue posible activar/probar el sistema de PITR de Supabase directamente (requiere acceso al panel de facturación del proyecto, fuera del alcance de un agente automatizado), se ejecutó una prueba de respaldo/restauración **a nivel de aplicación**, para verificar que el mecanismo lógico de recuperación funciona:

1. Se creó un registro de prueba identificable (`BACKUP_RESTORE_TEST_PROJECT`).
2. Se exportaron a un archivo JSON local todas las filas de la empresa de prueba en 8 tablas clave (equipos, proyectos, mantenimientos, novedades, documentos, actividades, usuarios, empresa).
3. Se eliminó el registro de prueba (simulando pérdida de datos).
4. Se confirmó que ya no existía.
5. Se restauró desde el archivo JSON.
6. Se verificó que el registro restaurado coincide exactamente, campo por campo, con el original.

**Resultado: la restauración funcionó correctamente y de forma exacta.** El primer intento falló por agotamiento del pool de conexiones (ver el hallazgo de escalabilidad en el informe final) — no por un problema del mecanismo de respaldo en sí; al reintentar sin carga concurrente, funcionó sin errores.

## Cómo hacer un respaldo manual completo (recomendado antes de cualquier migración grande)

Desde una máquina con acceso a internet y las credenciales del proyecto:

```bash
# Respaldo completo de la base de datos (requiere la contraseña de la base de datos, no la SUPABASE_SECRET_KEY)
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f respaldo_$(date +%Y%m%d).sql
```

Para los archivos de Storage, usa la consola de Supabase (Storage → cada bucket → Descargar) o un script con el SDK de `@supabase/supabase-js` que liste y descargue todos los objetos de `company-files` y `reports`.

## Cómo restaurar

1. **Base de datos**: en un proyecto nuevo o el mismo proyecto vaciado, aplica primero todas las migraciones de `supabase/migrations/` en orden, y luego restaura el volcado de datos (`psql ... < respaldo_20260802.sql`) — o usa directamente el PITR del panel de Supabase si el respaldo es reciente.
2. **Storage**: vuelve a subir los archivos descargados a los mismos buckets, respetando la misma ruta (`{company_id}/documents/...`, etc.) — las rutas están guardadas en las columnas `file_path` de `asset_documents` y `generated_reports`, así que deben coincidir exactamente o los enlaces de "Ver"/"Descargar" quedarán rotos (el mismo problema encontrado en el punto anterior).

## Recomendación

Antes de certificar esta aplicación como lista para un cliente real, se recomienda ejecutar **una prueba de restauración completa real** usando el PITR del panel de Supabase (no solo la simulación a nivel de aplicación de este documento) al menos una vez, para confirmar tiempos reales de recuperación ante un incidente — esa prueba requiere acceso humano al panel de facturación/administración de Supabase y no pudo ejecutarse como parte de esta auditoría automatizada.
