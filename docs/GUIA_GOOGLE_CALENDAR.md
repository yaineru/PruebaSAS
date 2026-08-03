# Guía de integración con Google Calendar

## Resumen

La integración con Google Calendar es **completamente opcional**. Sin configurarla, el módulo de Agenda funciona al 100% (crear, mover, cancelar actividades, compartir calendario por enlace .ics o página pública de disponibilidad) — el único efecto de no configurarla es que el botón "Conectar Google Calendar" permanece oculto para los usuarios. Esto fue una decisión de diseño explícita (Fase 18 de esta certificación) precisamente para que ningún cliente dependa de una cuenta de Google para usar el sistema.

## Qué se necesita para activarla

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto (o usa uno existente) y habilita la API de Google Calendar.
2. Crea credenciales de tipo **OAuth Client ID**, tipo de aplicación "Web application".
3. Agrega como "Authorized redirect URI" exactamente: `https://tu-dominio.com/api/google/callback` (reemplaza por el valor real de `APP_URL` de tu `.env.local`, sin barra final).
4. Copia el **Client ID** y **Client Secret** generados.
5. En `.env.local` (o las variables de entorno de Vercel), configura:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_TOKEN_ENCRYPTION_KEY=cualquier-frase-larga-y-aleatoria
   ```
6. Reinicia/redespliega la aplicación. El botón "Conectar Google Calendar" aparecerá automáticamente en Agenda — no requiere ningún otro cambio de configuración.

`GOOGLE_TOKEN_ENCRYPTION_KEY` cifra (AES-256-GCM) los tokens de acceso/actualización de cada usuario antes de guardarlos en `google_calendar_connections` — igual que la contraseña SMTP, nunca se guardan en texto plano.

## Cómo se conecta un usuario

Cada usuario conecta **su propia cuenta de Google** de forma individual (no es una configuración a nivel de empresa) — un administrador no puede conectar Google Calendar en nombre de otro usuario. Esto es intencional: las políticas de RLS de `google_calendar_connections` impiden que incluso un ADMIN de la empresa lea los tokens de otro usuario, ni siquiera el suyo propio desde otra sesión sin re-autenticar.

## Qué se sincroniza y qué no

- Las actividades creadas en EmpresaOS con Google conectado se reflejan en el Google Calendar del usuario.
- Es una sincronización por usuario, no una sincronización de todo el calendario compartido de la empresa.
- Si Google Calendar se desconecta (revocando el acceso desde la cuenta de Google, o si el token expira y no se puede refrescar), las actividades siguen existiendo normalmente en EmpresaOS — solo se pierde la copia en Google, no el dato original.

## Alternativa sin Google: enlaces de calendario estándar (.ics)

Para clientes que no quieren o no pueden usar Google Calendar, Agenda ofrece dos mecanismos que no dependen de ningún servicio externo:

- **Feed de calendario (.ics)**: un enlace privado que se agrega en Google Calendar, Apple Calendar, Outlook, o cualquier app de calendario como "calendario por URL" — se actualiza solo.
- **Página pública de disponibilidad**: un enlace que se puede compartir con un cliente externo para mostrar disponibilidad, con tres niveles de privacidad (solo ocupado/libre, título, o información completa).

Ambos se generan desde el mismo módulo de Agenda, sin configuración de servidor adicional.

## Diagnóstico si un cliente reporta que Google Calendar no sincroniza

1. Confirma que las tres variables de entorno (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`) estén configuradas en el entorno donde corre la aplicación — verificado en esta auditoría que en el despliegue de producción actual **estas tres variables NO están configuradas** (la integración existe en el código pero no está activa en este entorno de certificación), lo cual es correcto y esperado dado que es opcional y no se ha activado a propósito.
2. Confirma que el usuario haya hecho clic en "Conectar Google Calendar" y completado el flujo de autorización — la conexión es por usuario, no automática.
3. Revisa si el token expiró y Google rechazó el refresco (esto puede pasar si el usuario revocó el acceso manualmente desde su cuenta de Google) — en ese caso, hay que reconectar desde cero.
