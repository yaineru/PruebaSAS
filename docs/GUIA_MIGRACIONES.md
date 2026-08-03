# Guía de migraciones de base de datos

## Qué es una migración aquí

Cada archivo en `supabase/migrations/` (numerados `001` a `037` al momento de escribir esto) es un script SQL que se aplica una sola vez, en orden, y deja el esquema de la base de datos un paso más cerca del estado actual del código. **Todas son idempotentes** (usan `if not exists`, `on conflict do update`, `drop ... if exists` antes de recrear, etc.), así que volver a correr una que ya se aplicó no causa error ni duplica nada — esto está confirmado leyendo el patrón usado en las 37 migraciones, no es una promesa sin verificar.

## Instalación nueva (cliente nuevo, base de datos vacía)

1. Crea un proyecto de Supabase (o levanta el self-hosting, ver `docs/POSTGRESQL_PORTABILITY.md`).
2. En el editor SQL, pega y ejecuta cada archivo de `supabase/migrations/` **en orden numérico**, del `001` al más alto disponible. No hay atajos ni un "estado inicial" distinto — hasta un cliente nuevo hoy corre los 37 archivos completos.
3. No ejecutes nada de `supabase/seed/` en una base de datos de producción real — esos archivos insertan datos de ejemplo (empresas y equipos de prueba) para desarrollo, no para un cliente real.

## Actualizar una instalación existente

1. Revisa cuál fue la última migración que se aplicó (no hay una tabla de control de versiones de migraciones en este proyecto — actualmente se rastrea manualmente por convención de nombres de archivo; ver "Riesgo conocido" abajo).
2. Aplica únicamente los archivos **nuevos** desde ese número en adelante, en orden.
3. Reinicia la aplicación después (`pm2 restart empresaos` en VPS, o simplemente espera a que Vercel termine el despliegue si el cambio de código llegó junto con la migración).

## Riesgo conocido, encontrado en esta auditoría: no existe una tabla de control de migraciones aplicadas

A diferencia de herramientas como Prisma Migrate, Rails, o Django, este proyecto **no tiene una tabla `schema_migrations` (o equivalente) que registre qué archivos ya se ejecutaron**. Confirmado revisando las 37 migraciones: ninguna crea ni escribe en una tabla de control de versiones. Esto significa:

- No hay una forma automática de saber, con certeza, "cuáles de los 37 archivos ya corrieron en esta base de datos en particular" — se depende de la memoria/documentación del equipo.
- Si alguien aplica una migración fuera de orden, o se salta una, no hay ninguna alerta automática — el primer síntoma sería un error de SQL al aplicar una migración posterior que depende de algo que la saltada debía haber creado.
- Esta misma auditoría encontró evidencia de que la base de datos de producción **ya se desincronizó del historial de migraciones al menos una vez**: el tipo `project_status` tiene hoy una etiqueta `'active'` en minúscula que ningún archivo de migración agrega explícitamente (alguien la añadió manualmente, probablemente vía el editor SQL de Supabase, sin dejar rastro en `supabase/migrations/`). El propio historial de migraciones (022 a 028) documenta al menos otro incidente similar con una función `is_company_admin()` que existía en producción sin haber sido creada por ningún archivo rastreado.

**Recomendación concreta:** antes de que este proyecto crezca a más clientes/entornos, agregar una tabla simple de control:

```sql
create table if not exists public._migrations_applied (
  filename text primary key,
  applied_at timestamptz not null default now()
);
```

Y agregar al final de cada archivo de migración nuevo una línea `insert into public._migrations_applied (filename) values ('038_ejemplo.sql') on conflict do nothing;`. Esto no rompe nada de lo existente (es aditivo) y desde ese punto en adelante da una fuente de verdad real y consultable de qué se aplicó y cuándo. No se implementó en esta auditoría porque el mandato de Fase 21 fue explícitamente "no nuevas funcionalidades" — se documenta como la mejora de mantenibilidad de base de datos de mayor prioridad para la próxima sesión de trabajo.

## Antes de aplicar cualquier migración en producción

1. Haz un respaldo (ver `docs/GUIA_RESPALDO_Y_RESTAURACION.md`).
2. Lee el archivo completo antes de pegarlo — varias migraciones de este proyecto incluyen comentarios extensos explicando *por qué* existen (bugs reales que corrigen), útiles para entender el impacto antes de aplicar.
3. Aplícala primero contra una copia/proyecto de prueba si el cambio toca datos existentes (varias migraciones de este proyecto, como la 036 y la 037, además de cambiar el esquema, también reparan filas ya existentes con `UPDATE` — vale la pena confirmar cuántas filas se verán afectadas antes de correrlo en la base de un cliente real).
