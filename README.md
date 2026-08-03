# EmpresaOS

**Versión actual: v1.0.0**

Aplicación SaaS multiempresa construida con Next.js 15, TypeScript, Tailwind CSS, componentes estilo Shadcn UI y Supabase.

## Tecnologías

- [Next.js 15](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + componentes estilo Shadcn UI + [Radix UI](https://www.radix-ui.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Realtime, RLS)
- [Nodemailer](https://nodemailer.com/) (SMTP) y [Resend](https://resend.com/) como respaldo de correo
- [jsPDF](https://github.com/parallax/jsPDF) y [ExcelJS](https://github.com/exceljs/exceljs) para generación de informes
- [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs) para la integración con Google Calendar
- Desplegado en [Vercel](https://vercel.com/) (Vercel Cron para tareas programadas)

## Módulos

- Dashboard ejecutivo Realtime
- Maquinaria y activos
- Ficha completa de maquinaria
- Historial de mantenimientos
- Novedades e incidentes móviles
- Documentos, certificados, licencias y manuales
- Proyectos y obras
- Usuarios y roles
- Notificaciones Realtime
- Auditoría empresarial

## Arquitectura

- `app/(auth)`: autenticación con Supabase Auth.
- `app/(app)`: área protegida y responsive.
- `components`: shell, dashboard, notificaciones y componentes UI reutilizables.
- `lib/supabase`: clientes para browser, server components y middleware.
- `lib/tenant.ts`: resolución de empresa activa, usuario y rol.
- `lib/security.ts`: sanitización, rate limiting y protección de origen.
- `supabase/migrations`: esquema SQL completo con llaves foráneas, índices, auditoría, RLS, Storage y Realtime.

## Estructura del proyecto

```
app/
  (auth)/          Login, registro
  (app)/            Área protegida: activos, mantenimientos, agenda, informes, usuarios, settings...
  api/              Rutas API: Google OAuth, feeds de calendario, cron jobs, informes
  calendar/public/  Página pública de disponibilidad (sin autenticación)
components/         Componentes React reutilizables (shell, calendario, informes, UI base)
lib/
  actions/          Server Actions (mutaciones)
  email/            Plantillas, envío SMTP/Resend, cola de correo
  google/           OAuth y sincronización con Google Calendar
  reports/          Generadores de PDF/Excel
  supabase/         Clientes Supabase (browser/server/admin)
supabase/
  migrations/       Migraciones SQL numeradas (idempotentes)
  seed/             Datos de prueba (solo para desarrollo/QA)
docs/               Documentación técnica y de producción
```

## Licencia

Software propietario desarrollado para Progrúas S.A.S. Todos los derechos reservados — no distribuir sin autorización.

## Configuración

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Variables de entorno

Ver [.env.example](.env.example) para la lista completa comentada. Resumen:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública (anon) de Supabase |
| `SUPABASE_SECRET_KEY` | Sí | Clave de servicio (server-only, nunca exponer al cliente) |
| `APP_URL` | Sí | URL base del despliegue (sin `/` final), usada para OAuth de Google |
| `SMTP_CREDENTIALS_ENCRYPTION_KEY` | Sí para SMTP | Frase usada para cifrar las contraseñas SMTP guardadas por cada empresa |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | No | Respaldo de envío de correo si una empresa no configuró su propio SMTP |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Habilitan la sincronización con Google Calendar |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | No (requerida si se usa Google) | Frase usada para cifrar los tokens OAuth de Google |
| `CRON_SECRET` | Recomendada en producción | Protege los endpoints `app/api/cron/*` llamados por Vercel Cron |

Ninguna variable con secretos reales debe commitearse — `.gitignore` excluye todos los `.env*` salvo `.env.example`.

## Despliegue

El proyecto está pensado para desplegarse en [Vercel](https://vercel.com/):

1. Importa el repositorio en Vercel.
2. Configura las variables de entorno de la tabla anterior en el proyecto de Vercel.
3. Aplica las migraciones de `supabase/migrations/` sobre el proyecto Supabase de producción (ver sección siguiente).
4. Vercel Cron ejecuta automáticamente `app/api/cron/reminders`, `app/api/cron/email-queue` y `app/api/cron/expirations` según `vercel.json`.

Para despliegue alternativo en un VPS propio, ver [Despliegue en Hostinger VPS](docs/HOSTINGER_VPS_DEPLOYMENT.md).

### Base de datos (instalación nueva / cliente)

En el editor SQL de Supabase, aplica **todos** los archivos de `supabase/migrations/`
en orden numérico (`001` → el número más alto disponible). Todas las migraciones son
idempotentes, así que volver a correrlas no causa daño. No apliques nada de
`supabase/seed/` en una instalación de producción real — esos archivos insertan datos
de prueba y solo sirven para un entorno de QA/desarrollo desechable.

`supabase/repairs/` y `supabase/diagnostics/` son notas históricas de sesiones de
depuración anteriores, ya incorporadas a las migraciones numeradas; no hace falta
correrlas.

## Seguridad multi-tenant

Cada tabla operativa incluye `company_id`. La aplicación consulta e inserta usando la empresa activa del usuario, y Supabase RLS bloquea cualquier acceso fuera de la empresa.

Roles soportados:

- `SUPER_ADMIN`
- `ADMIN`
- `SUPERVISOR`
- `OPERARIO`

## Dashboard Realtime

El panel principal recalcula:

- Activos totales
- Activos en mantenimiento
- Activos disponibles
- Proyectos activos
- Incidentes abiertos
- Mantenimientos próximos
- Documentos próximos a vencer

## Documentación de producción

- [Manual de usuario (administrador)](docs/MANUAL_USUARIO_PROGRUAS.md)
- [Documentación técnica](docs/TECHNICAL_DOCUMENTATION.md)
- [Guía de migraciones](docs/GUIA_MIGRACIONES.md)
- [Guía de SMTP](docs/GUIA_SMTP.md)
- [Guía de Google Calendar](docs/GUIA_GOOGLE_CALENDAR.md)
- [Respaldo y restauración](docs/GUIA_RESPALDO_Y_RESTAURACION.md)
- [Portabilidad de PostgreSQL (Supabase / local / Docker)](docs/POSTGRESQL_PORTABILITY.md)
- [Despliegue y actualización en Hostinger VPS](docs/HOSTINGER_VPS_DEPLOYMENT.md)
- [Checklist de producción](docs/PRODUCTION_CHECKLIST.md)
- [Checklist de seguridad](docs/SECURITY_CHECKLIST.md)
- [Informe de auditoría](docs/AUDIT_REPORT.md)
- [Informe de mejoras](docs/IMPROVEMENTS_REPORT.md)
