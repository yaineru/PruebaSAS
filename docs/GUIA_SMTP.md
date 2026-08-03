# Guía de configuración de correo (SMTP)

## Resumen

EmpresaOS puede enviar correos (recordatorios de actividades, informes generados, documentos por vencer, mantenimientos próximos) usando el servidor SMTP propio de cada empresa cliente — no depende de ningún servicio de pago de terceros. Si una empresa no configura su SMTP, **la aplicación sigue funcionando exactamente igual**: las notificaciones dentro de la app no se ven afectadas, y los correos simplemente no se envían (quedan registrados como fallidos en el historial, sin bloquear ningún otro flujo — confirmado en las certificaciones anteriores: la generación de informes nunca espera a que el correo se envíe).

## Configurar el SMTP de una empresa

1. Como administrador, ve a **Correo (SMTP)** en el menú lateral.
2. Completa: host, puerto, usuario, contraseña, si usa TLS/SSL, correo y nombre del remitente, y opcionalmente una dirección de "responder a".
3. Guarda la configuración. La contraseña se cifra (AES-256-GCM) antes de guardarse — nunca se almacena en texto plano.
4. Usa el botón "Enviar correo de prueba" para confirmar que la conexión funciona de verdad antes de depender de ella.

### Requisito del servidor: variable de entorno

Para que el cifrado de la contraseña SMTP funcione, la aplicación necesita la variable de entorno `SMTP_CREDENTIALS_ENCRYPTION_KEY` configurada (cualquier frase larga y aleatoria — ver `.env.example`). Sin ella, el formulario de configuración de correo muestra un error claro al guardar la contraseña; no falla en silencio.

## Qué correos existen realmente hoy (verificado con entrega real, no solo leyendo el código)

| Evento | ¿Tiene disparador real? |
|---|---|
| Informe generado | Sí — verificado con un servidor SMTP de prueba real, entrega confirmada |
| Documento por vencer | Sí |
| Mantenimiento próximo | Sí |
| Informe técnico generado | Sí |
| Recordatorio de actividad de Agenda | Sí |
| Novedad reportada | **No** — aparece como opción en Preferencias de Email, se puede activar, pero no dispara ningún correo |
| Mantenimiento completado | **No** |
| Novedad resuelta | **No** |
| Hito de proyecto | **No** |
| Usuario invitado | **No** |

Los 5 "No" de la tabla fueron encontrados y documentados en una certificación anterior (Fase 19) — se dejan como están porque implementarlos sería una funcionalidad nueva, fuera del alcance de una auditoría de corrección/mantenibilidad.

## Cómo funciona la cola y los reintentos

Cada correo se guarda primero en una tabla de cola (`email_log`) y se envía en un segundo paso separado, nunca dentro de la misma solicitud que generó el informe o la notificación — esto es intencional: un servidor SMTP lento o caído nunca debe poder colgar la generación de un informe. El envío real ocurre cuando algo llama a `/api/cron/email-queue`:

- **En Vercel**: `vercel.json` ya lo programa automáticamente. **En el plan gratuito (Hobby) de Vercel, los Cron Jobs solo corren una vez al día**, no cada pocos minutos — esto significa que, en ese plan, un correo que falla en el primer intento puede tardar hasta 24 horas en reintentarse, sin importar que la tabla de reintentos internamente calcule backoffs de 1/5/20 minutos (esos backoffs son correctos en el código, pero inútiles si nada llama a la ruta con más frecuencia que una vez al día). Para reintentos verdaderamente rápidos se necesita el plan Pro de Vercel (permite crons más frecuentes) o un servicio externo (cron-job.org, un GitHub Action programado) golpeando esa misma ruta cada 5-15 minutos.
- **Fuera de Vercel (VPS/Docker)**: no hay nada automático — hay que configurar `crontab` para llamar a esa ruta periódicamente. Ver `docs/HOSTINGER_VPS_DEPLOYMENT.md`.

## Diagnóstico rápido si un cliente dice "no me llegan los correos"

1. Revisa **Correo (SMTP) → Historial de correos** — ahí se ve cada intento, con el mensaje de error exacto si falló.
2. Confirma que **Preferencias de Email** tenga esa notificación específica activada — el disparador no envía nada si el usuario nunca activó esa suscripción (comportamiento intencional: nadie recibe correos que no pidió).
3. Confirma que el evento sea uno de los que realmente tiene disparador (tabla de arriba).
4. Si todo lo anterior está bien y sigue sin llegar, revisa si el plan de Vercel es Hobby — el correo puede estar simplemente esperando su turno de una vez al día.
