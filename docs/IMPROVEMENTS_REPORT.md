# Informe de mejoras realizadas

## Plataforma

- Se mantuvo Next.js 15, TypeScript, Tailwind CSS y Supabase.
- Se reforzó arquitectura multiempresa con `company_id` en tablas operativas.
- Se añadió PWA instalable con `manifest`, icono y metadata móvil.
- Se añadieron headers de seguridad: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.

## Base de datos

- Esquema PostgreSQL rediseñado para SaaS multi-tenant.
- Roles: `SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `OPERARIO`.
- RLS por capacidad: administración, operación y registro.
- Tablas de maquinaria, mantenimientos, novedades, documentos, proyectos, asignaciones, notificaciones y auditoría.
- Índices compuestos por `company_id`, estado, fechas de vencimiento y fechas operativas.
- Storage privado `company-files` con MIME y tamaño máximo.

## Seguridad

- Validación y sanitización server-side.
- Rate limiting básico para login, registro y creación.
- Verificación CSRF por `Origin`.
- Restricción de tipos MIME y tamaño de archivos en DB/Storage.
- Pantalla administrativa de auditoría.

## Producto

- Dashboard ejecutivo Realtime con KPIs, tablas y gráficos.
- Campana de notificaciones en tiempo real.
- Módulo de novedades móvil.
- Ficha completa de maquinaria con timeline de mantenimiento y documentos.
