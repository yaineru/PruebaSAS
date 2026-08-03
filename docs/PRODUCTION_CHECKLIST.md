# Checklist para producción

- [ ] Migración SQL aplicada en Supabase.
- [ ] RLS activo en todas las tablas multiempresa.
- [ ] Realtime habilitado solo en tablas necesarias.
- [ ] Bucket `company-files` privado.
- [ ] Variables `.env.local` configuradas en servidor.
- [ ] `SUPABASE_SECRET_KEY` no expuesta al cliente.
- [ ] Dominio con HTTPS.
- [ ] PM2 configurado con reinicio automático.
- [ ] Backups Supabase habilitados.
- [ ] Logs y monitoreo configurados.
- [ ] Cron diario para vencimientos documentales.
- [ ] Pruebas de roles ejecutadas.
- [ ] Pruebas mobile en Android, iPhone y tablet.
- [ ] PWA instalada y validada.
