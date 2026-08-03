# Documentación técnica — EmpresaOS

Actualizado 2026-07-15 tras la auditoría final de calidad pre-entrega (incluye Agenda, Recordatorios, Google Calendar, Equipos/Fotografías/Comparador y Plantillas de informes).

## 1. Arquitectura

- **Framework**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, componentes estilo Shadcn UI.
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime). No hay backend separado: la app llama a Supabase directamente desde Server Components / Server Actions (`lib/supabase/server.ts`) y desde el cliente para Realtime (`lib/supabase/browser.ts`). `lib/supabase/middleware.ts` refresca la sesión en cada request.
- **Multi-tenant**: toda tabla operativa tiene `company_id`. La app filtra por la empresa activa del usuario (`lib/tenant.ts`) y Postgres RLS bloquea cualquier fila fuera de esa empresa, incluso si la URL se manipula.
- **Roles**: `SUPER_ADMIN` (soporte, global) · `ADMIN` (administra su empresa, único con acceso a Plantillas/Programación de informes) · `SUPERVISOR` (operación, no usuarios) · `OPERARIO` (registro de campo).
- **Reminder scheduler**: proceso `node-cron` embebido en el propio servidor Next.js (arrancado una vez desde `instrumentation.ts`, guardado en `globalThis` para sobrevivir a Fast Refresh en desarrollo). Corre cada minuto, llama a la función SQL `get_due_reminders()` (solo `service_role`) y usa un insert único en `reminder_dispatch_log` como candado de idempotencia — si se despliega en varias instancias/réplicas, cada una ejecuta su propio scheduler pero el candado evita que un recordatorio se envíe dos veces.
- **Google Calendar**: OAuth por usuario (no por empresa). Tokens cifrados en aplicación (AES-256-GCM, `lib/google/token-crypto.ts`) antes de guardarse — nunca en texto plano ni vía `pgcrypto` (para que el secreto no quede expuesto en logs de Postgres). Sincronización de un solo sentido: Progrúas → Google (no hay pull-back de eventos creados directamente en Google).

## 2. Estructura de la base de datos

Esquema completo en `supabase/migrations/001` a `032`, todas idempotentes (usan `if not exists` / `drop ... if exists` antes de recrear). Agrupación funcional de las ~40 tablas:

| Grupo | Tablas |
|---|---|
| Núcleo multiempresa | `companies`, `company_settings`, `users`, `memberships`, `audit_logs` |
| Equipos (activos) | `assets`, `asset_assignments`, `asset_documents`, `asset_images`, `image_comparisons` |
| Operación | `maintenance_records`, `maintenance_alerts`, `incidents`, `incident_comments`, `incident_media`, `projects`, `project_history` |
| Agenda / Recordatorios | `activities`, `activity_types`, `activity_reminders`, `reminder_dispatch_log` |
| Integraciones | `google_calendar_connections` |
| Informes | `report_templates`, `report_schedules`, `report_preferences`, `generated_reports`, `industry_templates` |
| Notificaciones / comunicación | `notifications`, `email_subscriptions`, `email_logs`, `webhooks`, `webhook_deliveries`, `analytics_events`, `analytics_metrics` |
| **En el esquema pero sin UI activa** (ver §7, riesgos) | `image_gallery_settings`, `custom_fields`, `custom_field_values`, `custom_field_templates`, `export_configurations`, `export_history` |

Notas:
- `company_settings.asset_label` controla el nombre visible del módulo "Equipos" por empresa (por defecto `"Equipos"` desde la migración 032; una empresa puede personalizarlo a otro texto).
- Recordatorios: `get_due_reminders()` es `security definer`, revocada para `anon`/`authenticated`, solo ejecutable por `service_role` — expone `owner_email` que ninguna política RLS expondría directamente.
- Buckets de Storage: `company-files` (documentos, fotos de equipos) y `reports` (PDF/Excel generados).
- Tablas publicadas en Realtime: `activities`, `activity_types`, `maintenance_records`, `maintenance_alerts`, `projects`, `asset_assignments`, `asset_documents`, `incidents`, `incident_comments`, `incident_media`, `notifications`, `project_history`.

## 3. Variables de entorno

Ver `.env.example` (fuente de verdad). Resumen:

| Variable | Obligatoria | Efecto si falta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | La app no arranca. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | La app no arranca. |
| `SUPABASE_SECRET_KEY` | Sí | Server Actions/Storage fallan. |
| `APP_URL` | Solo si se usa Google Calendar | El `redirect_uri` de OAuth no coincide con Google Cloud Console. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | No | Los recordatorios y notificaciones siguen funcionando dentro de la app; el envío por correo se omite y queda registrado en logs. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_TOKEN_ENCRYPTION_KEY` | No | El módulo Agenda funciona por completo; el botón "Conectar Google Calendar" permanece oculto con un mensaje explicativo. |

**Estado verificado en este ambiente de auditoría**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SECRET_KEY` están configuradas. `APP_URL`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID/SECRET/ENCRYPTION_KEY` **no** están configuradas — es decir, en la instalación auditada, Google Calendar y el envío de recordatorios por correo están inactivos por falta de configuración, no por un defecto de código (comportamiento de repliegue confirmado en vivo).

## 4. Dependencias principales

De `package.json` (Next.js 15.5, React 19):

- **UI**: `@radix-ui/*` (avatar, label, select, slot, tabs), `@dnd-kit/core` (arrastrar-soltar en Agenda), `lucide-react`, `tailwindcss` + `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- **Datos/backend**: `@supabase/supabase-js`, `@supabase/ssr`, `zod` (validación), `date-fns`.
- **Informes**: `jspdf` (PDF), `exceljs` (Excel), `sharp` (redimensionado de imágenes antes de incrustarlas en PDF — reduce ~75x el peso de un informe con evidencia fotográfica).
- **Integraciones**: `google-auth-library` (OAuth Google), `resend` (envío de correo), `node-cron` (scheduler de recordatorios).
- **Utilidades**: `json2csv`, `server-only`.

Hallazgo de la auditoría (no bloqueante, limpieza recomendada antes o después de la entrega): `@dnd-kit/utilities`, `@radix-ui/react-avatar`, `@radix-ui/react-select` y `json2csv` no tienen ningún `import` real en el código — candidatos a eliminar de `package.json`.

## 5. Procedimiento de instalación (cliente nuevo)

1. Crear un proyecto en Supabase.
2. En el editor SQL de Supabase, ejecutar **todos** los archivos de `supabase/migrations/` en orden numérico (`001` → `032`). Son idempotentes: repetir la ejecución no causa daño.
   - No ejecutar nada de `supabase/seed/` en producción (datos de prueba de QA).
   - `supabase/repairs/` y `supabase/diagnostics/` son notas históricas ya incorporadas a las migraciones numeradas; no hace falta correrlas.
3. Crear los buckets de Storage `company-files` y `reports` si no existen ya (las migraciones asumen que existen; revisar la consola de Supabase → Storage).
4. Clonar el repositorio y copiar `.env.example` a `.env.local`, completando como mínimo las 3 variables de Supabase.
5. `npm install`
6. `npm run build && npm run start` (o `npm run dev` para desarrollo).
7. Verificar que el log de arranque muestre `Reminder scheduler started (checking every minute).` — confirma que `instrumentation.ts` inicializó el scheduler correctamente.
8. Registrar la primera empresa desde `/register` (crea automáticamente la empresa y el primer usuario `ADMIN`).
9. Opcional — Google Calendar: crear credenciales OAuth "Web application" en Google Cloud Console con redirect URI `${APP_URL}/api/google/callback`, y completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` (cualquier frase no vacía) y `APP_URL`.
10. Opcional — correo: completar `RESEND_API_KEY`/`RESEND_FROM_EMAIL` con una cuenta de Resend verificada.

Despliegue de referencia en VPS (Hostinger/Ubuntu + PM2 + Nginx): ver `docs/HOSTINGER_VPS_DEPLOYMENT.md`.

## 6. Procedimiento de actualización

1. `git pull` (o desplegar la nueva versión del código).
2. Revisar `supabase/migrations/` por archivos nuevos desde la última actualización (numeración creciente) y ejecutarlos en el editor SQL de Supabase, en orden. Son idempotentes — no hay riesgo de correr de más un archivo ya aplicado antes.
3. `npm install` (por si hay dependencias nuevas).
4. `npm run build`.
5. Reiniciar el proceso (`pm2 restart empresaos` en el despliegue de referencia). El reinicio relanza también el reminder scheduler.
6. Verificar en el log el mensaje de arranque del scheduler y probar un login.

No se requiere tiempo de inactividad prolongado: las migraciones son aditivas (`add column if not exists`, `create table if not exists`), no eliminan datos existentes.

## 7. Respaldo y restauración

EmpresaOS no gestiona sus propios respaldos — toda la persistencia vive en Supabase (Postgres + Storage), así que el respaldo es responsabilidad de la capa de Supabase:

- **Base de datos**: Supabase (plan Pro o superior) hace *Point-in-Time Recovery* automático. Para un respaldo manual exportable: `pg_dump` contra la cadena de conexión de Postgres del proyecto (Supabase Dashboard → Project Settings → Database → Connection string), o el botón "Backups" del dashboard.
- **Storage** (`company-files`, `reports`): no tiene backup incremental nativo separado del respaldo de base de datos en los planes estándar; para un respaldo completo, descargar los objetos vía la API de Storage (`supabase.storage.from(bucket).list()` + `download()`) y guardarlos fuera de Supabase periódicamente.
- **Restauración**: desde el dashboard de Supabase (Point-in-Time Recovery) o restaurando un `pg_dump` a un proyecto nuevo/limpio. Tras restaurar la base de datos, los objetos de Storage deben restaurarse por separado si se respaldaron aparte.
- **Recomendación mínima antes de entregar a producción**: confirmar con el cliente el plan de Supabase contratado (los planes gratuitos no incluyen PITR) y documentar la frecuencia de respaldo manual de Storage si el plan no lo cubre.

## 8. Seguridad — ver también `docs/SECURITY_CHECKLIST.md`

Puntos ya verificados en esta auditoría (julio 2026): aislamiento entre empresas por RLS, bloqueo de rutas manipuladas hacia registros de otra empresa (equipo inexistente → 404), rutas admin-only devuelven 404 (no 403) para no confirmar su existencia a un usuario sin permiso, tokens de Google cifrados en aplicación antes de persistir.
