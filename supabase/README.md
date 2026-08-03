# Supabase

1. Crea o abre tu proyecto Supabase.
2. Configura `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SECRET_KEY`.
3. Ejecuta `supabase/migrations/001_initial_multitenant_schema.sql` desde SQL Editor o Supabase CLI.
4. Activa Realtime para las tablas publicadas si tu proyecto lo requiere desde Database > Replication.
5. Activa confirmación de correo según tu flujo.

El esquema incluye:

- `companies`
- `users`
- `assets`
- `maintenance_records`
- `maintenance_alerts`
- `projects`
- `asset_assignments`
- `asset_documents`
- `notifications`
- `audit_logs`
- `incidents`

Todas las tablas operativas tienen `company_id`, índices por tenant, campos de auditoría y Row Level Security. El trigger `handle_new_auth_user` crea empresa y usuario owner cuando Supabase Auth registra una cuenta nueva.
