# Portabilidad: Supabase vs. PostgreSQL propio (local / Docker / VPS)

Este documento responde una pregunta concreta: **¿qué se rompe si EmpresaOS deja de correr sobre el Supabase gestionado (la nube de supabase.com) y pasa a un PostgreSQL propio?** No se modificó ningún código para escribir esto — es un mapa honesto de dependencias, basado en leer las 37 migraciones de `supabase/migrations/` y el código que las usa.

## Resumen ejecutivo

EmpresaOS **no depende de ningún servicio pago de Supabase** más allá de tener corriendo, en algún lugar, el software open-source de Supabase (Postgres + GoTrue/Auth + Storage API + Realtime), que es exactamente lo que instala `supabase start` (self-hosted, gratis, Docker) o el propio "Supabase self-hosting" oficial. La app **nunca** llama a un endpoint propietario de supabase.com que no exista en la versión self-hosted.

Dicho de otra forma: **"PostgreSQL puro" (solo el motor de base de datos, sin Auth/Storage/Realtime) no es suficiente** para correr EmpresaOS sin tocar código — la app usa tres piezas del stack de Supabase, no solo la base de datos. Si el objetivo es un PostgreSQL genuinamente independiente (por ejemplo, en Windows/macOS local sin Docker), hay que sustituir esas tres piezas por algo equivalente, y eso sí requeriría cambios de código (fuera del alcance de esta auditoría, que tenía instrucción explícita de "no modificar código").

## Las tres dependencias reales (no solo la base de datos)

### 1. Supabase Auth (GoTrue) — autenticación

- Todo el login/registro pasa por `supabase.auth.signInWithPassword()`, `.signUp()`, `.getUser()` (`lib/actions/auth.ts`, `lib/tenant.ts`).
- Las filas de `public.users` se vinculan a `auth.users` mediante un trigger (`handle_new_auth_user()`, migración 001) y una columna `auth_user_id` — la tabla `auth.users` es del *schema* `auth`, que **no existe en un PostgreSQL genérico**: la crea y la mantiene el servicio GoTrue.
- **Qué hace falta para reemplazarlo**: correr el contenedor de GoTrue (parte del self-hosting oficial de Supabase) apuntando a tu Postgres, o reescribir toda la capa de autenticación con otra librería (NextAuth, Lucia, etc.) — esto sí es un cambio de código real, no solo de configuración.

### 2. Supabase Storage — archivos (documentos, fotos, informes)

- Todos los documentos, fotos de equipos, evidencias e informes generados se guardan vía la API de Storage (`supabase.storage.from(bucket).upload/download/createSignedUrl`), no como archivos en disco ni en una tabla `bytea`.
- Los buckets (`company-files`, `reports`) y sus políticas de acceso están definidos como filas en `storage.buckets`/`storage.objects` (migraciones 001, 003, 004, 034, 037) — ese *schema* `storage` tampoco existe en un Postgres genérico.
- **Qué hace falta**: correr el contenedor de Storage-API del self-hosting oficial (usa el mismo Postgres como backend de metadatos, y S3 o disco local como backend de archivos). Con eso, cero cambios de código.

### 3. Supabase Realtime — actualizaciones en vivo

- 4 componentes (`components/admin-realtime-dashboard.tsx`, `report-list.tsx`, `notification-center.tsx`, `notification-bell.tsx`) se suscriben a cambios de tablas en vivo con `supabase.channel(...).on("postgres_changes", ...)`. Esto depende del servicio Realtime, que escucha la replicación lógica de Postgres.
- **Qué pasa si no está disponible**: la app **no se cae** — cada uno de esos 4 componentes ya recibe los datos iniciales por una consulta normal; si el canal de Realtime nunca conecta, simplemente el panel/las notificaciones no se actualizan solas y hay que refrescar la página manualmente. Es una degradación aceptable, no un fallo crítico.
- **Qué hace falta para tenerlo completo**: correr el contenedor de Realtime del self-hosting oficial.

## Lo que SÍ es Postgres puro y portable sin ningún cambio

- Las 37 migraciones SQL (`supabase/migrations/001` a `037`) son SQL estándar de PostgreSQL — tipos enum, funciones `PL/pgSQL`, triggers, índices, RLS (Row Level Security es una función nativa de Postgres desde la versión 9.5, no una invención de Supabase). Se aplican igual en Supabase, en un Postgres local, en Docker, o en un RDS de AWS.
- La única extensión de Postgres que se usa es `pgcrypto` (para `gen_random_uuid()`), que viene incluida en cualquier distribución estándar de PostgreSQL 13+.
- **No se usa `pg_cron` ni `pg_net`** (extensiones propietarias/opcionales de Supabase para programar tareas dentro de la base de datos) — las tareas programadas de EmpresaOS (recordatorios, cola de correo, vencimientos) se implementaron deliberadamente como rutas HTTP normales de Next.js llamadas desde afuera (Vercel Cron, o `crontab` en un VPS — ver `docs/HOSTINGER_VPS_DEPLOYMENT.md`), precisamente para no atarse a esa extensión. Este es un buen diseño de portabilidad ya existente en el proyecto.

## Windows / macOS / Docker — qué cambia en la práctica

| Entorno | Cómo correr las 3 piezas | Cambios de código necesarios |
|---|---|---|
| **Supabase (nube)** | Ya vienen las tres | Ninguno — es el entorno para el que se escribió la app |
| **Docker (cualquier SO)** | `supabase start` (CLI oficial) levanta Postgres + Auth + Storage + Realtime + Studio en contenedores locales | Ninguno — solo cambiar `NEXT_PUBLIC_SUPABASE_URL`/claves en `.env.local` al endpoint local |
| **VPS Linux (self-hosted "de verdad")** | Seguir la guía oficial "Self-Hosting Supabase with Docker Compose" (docker-compose.yml que Supabase publica) | Ninguno — mismo razonamiento que Docker |
| **Windows/macOS nativo, sin Docker, "solo PostgreSQL"** | No hay forma oficial de correr Auth/Storage/Realtime sin contenedores | **Sí requeriría reescribir** la capa de autenticación y de almacenamiento de archivos — no es una tarea de configuración, es desarrollo nuevo |

## Recomendación

Para el objetivo de "que siga funcionando dentro de 3 años, en cualquier infraestructura": la app ya está bien preparada para moverse a un self-hosting de Supabase completo (Docker Compose), que es la ruta de portabilidad real y sin fricción. La idea de "PostgreSQL puro sin ningún otro servicio" no es una meta alcanzable sin desarrollo nuevo, dado que Auth y Storage son parte activa e irremplazable de cómo funciona hoy el producto — y eso es normal y esperable para cualquier aplicación construida sobre Supabase, Firebase, o cualquier BaaS similar.
