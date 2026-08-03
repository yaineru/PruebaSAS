# Despliegue en Hostinger VPS (o cualquier VPS/Docker con Node.js)

## Requisitos

- VPS Ubuntu 22.04 o superior.
- Node.js 20 LTS o superior.
- Nginx.
- PM2.
- Proyecto Supabase configurado (o PostgreSQL propio — ver `docs/POSTGRESQL_PORTABILITY.md` para qué cambia).

## Pasos

1. Instalar dependencias del servidor:

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

2. Clonar el proyecto:

```bash
git clone <repo> empresaos
cd empresaos
npm ci
```

3. Crear `.env.local` (ver `.env.example` para la lista completa y comentada). Como mínimo:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SECRET_KEY=...
APP_URL=https://tu-dominio.com
SMTP_CREDENTIALS_ENCRYPTION_KEY=...   # cualquier frase larga y aleatoria
CRON_SECRET=...                        # cualquier cadena aleatoria — ver sección "Tareas programadas" abajo
```

4. Compilar:

```bash
npm run build
```

5. Levantar con PM2:

```bash
pm2 start npm --name empresaos -- start
pm2 save
pm2 startup
```

6. Configurar Nginx:

```nginx
server {
  listen 80;
  server_name tu-dominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

7. Activar HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## Tareas programadas (cron) — IMPORTANTE, distinto de Vercel

En Vercel, `vercel.json` registra tres tareas programadas (recordatorios, cola de reintento de correo, vencimientos) que Vercel ejecuta automáticamente. **Ese archivo no hace nada fuera de Vercel.** En un VPS, EmpresaOS resuelve esto de dos formas distintas según la tarea, y es importante no asumir que "ya viene resuelto":

- **Recordatorios de actividades**: sí tiene un mecanismo de respaldo automático. `instrumentation.ts` arranca un proceso interno (`lib/scheduler/reminder-scheduler.ts`) que revisa cada minuto si hay recordatorios pendientes, **siempre que la variable de entorno `VERCEL` no esté presente** (es decir: se activa solo fuera de Vercel, exactamente el caso de un VPS con PM2, que mantiene el proceso de Node corriendo indefinidamente). No requiere configuración adicional.
- **Cola de reintento de correo (`/api/cron/email-queue`) y vencimientos (`/api/cron/expirations`): NO tienen ningún mecanismo de respaldo interno.** Solo se disparan cuando algo externo llama a esas rutas HTTP. En Vercel eso lo hace `vercel.json`; en un VPS **nadie las llama a menos que tú lo configures**, y sin ellas los correos que fallan en el primer intento nunca se reintentan, y las notificaciones de pólizas/certificados/documentos por vencer nunca se generan.

Por eso, en cualquier despliegue que no sea Vercel, agrega esto al `crontab` del usuario que corre la aplicación (`crontab -e`):

```cron
# Cola de reintento de correo, cada 15 minutos
*/15 * * * * curl -s -X GET -H "Authorization: Bearer TU_CRON_SECRET" https://tu-dominio.com/api/cron/email-queue >> /var/log/empresaos-cron.log 2>&1

# Vencimientos (pólizas, certificados, documentos, mantenimientos), una vez al día
0 6 * * * curl -s -X GET -H "Authorization: Bearer TU_CRON_SECRET" https://tu-dominio.com/api/cron/expirations >> /var/log/empresaos-cron.log 2>&1
```

Reemplaza `TU_CRON_SECRET` por el mismo valor que pusiste en `CRON_SECRET` en el paso 3 — sin ese encabezado, ambas rutas responden `401` (esto es intencional: sin `CRON_SECRET` configurado, quedarían abiertas a que cualquiera en internet las dispare).

## Operación

```bash
pm2 logs empresaos
pm2 restart empresaos
pm2 monit
```

## Actualizar a una versión nueva

```bash
cd empresaos
git pull
npm ci
npm run build
pm2 restart empresaos
```

Si la actualización incluye migraciones SQL nuevas (archivos nuevos en `supabase/migrations/`), aplícalas en el editor SQL de tu base de datos **antes** de reiniciar la aplicación — ver `docs/GUIA_MIGRACIONES.md`.
