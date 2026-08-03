# Informe de auditoría técnica

Fecha: 2026-06-09

## Alcance

Se auditó la aplicación Next.js 15, las acciones server-side, middleware, consultas Supabase, esquema PostgreSQL, políticas RLS, navegación protegida, dashboard Realtime y flujo de autenticación.

## Hallazgos críticos iniciales

- Roles insuficientes: el modelo anterior usaba roles genéricos y no representaba `SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `OPERARIO`.
- RLS demasiado amplia: miembros activos podían escribir en tablas operativas sin distinguir permisos de administración, supervisión u operación.
- Falta de controles server-side por rol antes de insertar registros.
- Formularios sin validación por módulo ni sanitización explícita.
- Sin rate limiting en login, registro o creación de registros.
- Sin verificación explícita de `Origin` en acciones sensibles.
- Sin políticas de Storage para aislar archivos por empresa.
- Sin restricción formal de MIME/tamaño para evidencias, documentos, fotos o videos.
- Auditoría incompleta: no existía pantalla administrativa ni eventos de permiso denegado.
- Dashboard incompleto: faltaban activos disponibles y documentos próximos a vencer.
- Sin PWA instalable para uso móvil.

## Riesgos de fuga multiempresa detectados

- La app filtraba por `company_id`, pero la autorización dependía demasiado de políticas amplias de membresía.
- Las rutas dinámicas no existían todavía; al agregarlas se protegieron con doble filtro `id` + `company_id`.
- Realtime estaba filtrado por `company_id`, pero faltaban políticas más finas para quién puede generar eventos.

## Riesgos de rendimiento detectados

- Consultas de dashboard duplicadas entre servidor y cliente.
- Conteos frecuentes sin vistas agregadas. Es aceptable para MVP, pero para miles de empresas conviene materializar métricas o usar RPC agregadas.
- Índices iniciales cubrían `company_id`, pero faltaban compuestos para vencimientos, estados e historial.

## Estado después de las mejoras

- RLS centralizada por funciones de capacidad.
- Roles y permisos implementados en PostgreSQL.
- Índices compuestos por tenant, estado, vencimientos y fechas operativas.
- Storage privado con políticas por carpeta `company_id`.
- Triggers de auditoría y notificaciones.
- Verificación de origen, rate limiting en memoria, sanitización y validación básica en acciones server-side.

## Riesgos residuales

- El rate limiting en memoria debe reemplazarse por Redis/Upstash en producción horizontal.
- Las alertas recurrentes de vencimiento documental requieren programar `generate_document_expiration_notifications()` con cron.
- La auditoría de IP/user-agent desde triggers SQL no puede capturar cabeceras HTTP; para eventos críticos debe complementarse con RPC desde la app.
- `npm audit --audit-level=moderate` reporta 2 vulnerabilidades moderadas asociadas a `postcss` dentro de `next`. No se aplicó `npm audit fix --force` porque propone un cambio rompedor. Revisar actualización oficial compatible con Next 15 antes de producción.
