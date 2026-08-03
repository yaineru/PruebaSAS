# Changelog

Todas las fechas usan zona horaria de Colombia. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-08-03

Primera versión estable de EmpresaOS, certificada como Release Candidate y aprobada para entrega comercial a Progrúas S.A.S.

### Añadido
- Gestión completa de Equipos/Maquinaria: inventario, fichas técnicas, fotografías, comparación antes/después, documentos y vencimientos asociados.
- Mantenimientos preventivos y correctivos con costos, responsables y seguimiento.
- Documentos con control de vencimiento (pólizas, certificados, licencias, manuales).
- Proyectos/Obras y Novedades/Incidentes con prioridad y seguimiento.
- Agenda con vista mensual/semanal/diaria, actividades privadas, recordatorios, feed de calendario (.ics) y página pública de disponibilidad.
- Informes en PDF y Excel con plantillas personalizables (colores, logo, diseño, márgenes) y programación automática.
- Informes técnicos con firma digital (técnico y cliente) y evidencia fotográfica antes/después.
- Dashboard ejecutivo en tiempo real (Supabase Realtime) con KPIs e indicadores gráficos.
- Notificaciones internas en tiempo real y webhooks salientes para integraciones externas.
- SMTP propio por empresa (o remitente de respaldo compartido) para notificaciones y envío de informes por correo.
- Integración opcional con Google Calendar (OAuth por usuario).
- Multi-tenant con aislamiento total por empresa vía Row Level Security de Postgres/Supabase.
- Roles: Super Administrador, Administrador, Supervisor, Operario.
- Registro de auditoría de acciones sensibles.

### Corregido (certificación final, agosto 2026)
- **Crítico:** las fechas de vencimiento (pólizas, certificados, documentos, mantenimientos, proyectos) se mostraban un día antes de la fecha real en cualquier servidor fuera de UTC — corregido en `lib/utils.ts`.
- **Alto:** crear una plantilla de informe sin llenar el identificador (URL) fallaba sin ningún mensaje de error, perdiendo la configuración — ahora se autogenera desde el nombre de la plantilla.
- **Alto:** valores de enum corrompidos en la base de datos viva (`assets.status`, `assets.condition`) mostraban texto crudo sin traducir ("active", "good") en vez de las etiquetas correctas — corregido el DEFAULT de ambas columnas y reparadas todas las filas afectadas (migración `038`).
- Error de hidratación de React en el módulo de Agenda, causado por depender de la hora del servidor para calcular "hoy" en un despliegue fuera de la zona horaria del cliente.
- Ruta huérfana: la página de gestión de Webhooks existía y funcionaba pero no tenía ningún enlace de navegación — ahora es accesible desde el menú (solo Administradores).
- Panel de tiempo real del dashboard recargaba sus consultas por cada evento individual de una ráfaga de cambios — ahora se agrupan con un breve debounce.
- URLs firmadas de fotografías de equipos se pedían una por una (hasta ~100 solicitudes en fichas con muchas fotos) — ahora se piden todas en un solo lote.
- Fotos de evidencia de informes técnicos se subían sin comprimir — ahora se comprimen en el navegador antes de subir, igual que las fotos de equipos.
- Contexto de empresa y configuración de marca se consultaban dos veces por cada página — deduplicado con `cache()` de React.
- Falso error de ESLint sobre un archivo autogenerado por Next.js (`next-env.d.ts`).

### Seguridad
- Confirmado: RLS activo y probado en todas las tablas operativas y en Storage; aislamiento entre empresas verificado con intentos directos de acceso cruzado (IDOR).
- Confirmado: rutas de `cron` protegidas con `CRON_SECRET`; rechazan solicitudes sin autenticar (401).
- Confirmado: cabeceras HTTP de seguridad presentes en producción (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Confirmado: sesiones inválidas, tokens corruptos y cookies vencidas redirigen a inicio de sesión sin exponer datos ni causar errores del servidor.

### Documentación
- Añadidos enlaces faltantes en el índice de `README.md` hacia las guías de migraciones, SMTP, Google Calendar, respaldo/restauración y portabilidad de PostgreSQL (ya existían como archivos, no estaban indexadas).

## Migraciones aplicadas hasta esta versión

`001` a `038`. Las migraciones `036` y `038` corrigen datos de enum corrompidos en la base de datos viva y ya fueron confirmadas como aplicadas correctamente contra la base de datos de producción.
