# Manual de usuario — EmpresaOS para Progrúas

Guía básica para el administrador de la empresa. Cubre las funciones principales del sistema tal como quedaron implementadas a la fecha de este documento (2026-07-15).

## 1. Acceso al sistema

- Ingresa con tu correo y contraseña en la pantalla de inicio de sesión.
- Cada usuario pertenece a una sola empresa (Progrúas). Todo lo que veas en el sistema está aislado de cualquier otra empresa que use la misma plataforma.
- Roles disponibles:
  - **Administrador**: acceso total a la configuración de la empresa, usuarios, plantillas de informes y programación de informes.
  - **Supervisor**: gestiona operación (equipos, mantenimientos, proyectos, novedades) pero no usuarios ni configuración.
  - **Operario**: registra mantenimientos y novedades desde el campo.
  - **Super administrador**: uso interno/soporte, no es un rol operativo de Progrúas.

## 2. Panel general

Pantalla de inicio con indicadores en tiempo real: equipos totales, disponibles, novedades abiertas, proyectos activos, mantenimientos próximos y documentos por vencer. Se actualiza automáticamente sin recargar la página.

## 3. Equipos (antes "Activos")

- Inventario de maquinaria: código interno, placa, marca, modelo, año, proveedor, horómetro, estado (Disponible / Asignado / En mantenimiento / Fuera de servicio / Perdido) y fechas de vencimiento de póliza y certificado.
- Cada equipo tiene una ficha propia con:
  - **Historial de mantenimientos** realizados.
  - **Fotografías**: arrastra o selecciona fotos (JPEG, PNG o WebP, hasta 10 MB). Puedes reemplazar o eliminar cualquier foto.
  - **Comparador Antes/Después**: con al menos dos fotos cargadas, elige cuál es "antes" y cuál "después" y el sistema genera una comparación con control deslizante.
  - **Documentos asociados**: certificados, pólizas, manuales.
- Usa el buscador y el filtro por estado para encontrar equipos en listados grandes (no solo se muestran los más recientes).

## 4. Mantenimientos, Novedades, Proyectos, Documentos, Usuarios

Mismo patrón en los cinco módulos: crear, editar, buscar/filtrar y eliminar registros. Los campos marcados como obligatorios deben completarse antes de guardar; el sistema no permite enviar el formulario si falta alguno.

> Nota sobre "Usuarios": crear una persona aquí solo guarda un registro de referencia (nombre, correo, rol) — **no** le da acceso a la plataforma. El acceso real se otorga por invitación formal (proceso que administra el equipo de soporte/instalación).

## 5. Agenda

- Calendario mensual/semanal/diario de actividades de la empresa (visitas, mantenimientos programados, entregas, etc.).
- Crea una actividad con título, fecha/hora de inicio y fin, tipo (con color), responsable, ubicación y descripción.
- **Arrastra una actividad** directamente sobre el calendario para cambiar su fecha u hora sin abrir el formulario.
- Los "Tipos" de actividad (con su color) se administran desde el botón "Tipos" en la parte superior del calendario.

## 6. Recordatorios

- Al crear una actividad, puedes marcar uno o varios recordatorios: 15 minutos antes, 30 minutos antes, 1 hora antes o 1 día antes.
- El sistema revisa cada minuto si algún recordatorio debe dispararse y crea una notificación dentro de la plataforma (y, si el administrador configuró el envío de correos, también un email).
- Los recordatorios son por actividad — no hay hoy una pantalla para ver el historial de recordatorios ya enviados; solo se ve el resultado como notificación.

## 7. Integración con Google Calendar

- En **Integraciones**, cada usuario puede conectar su propia cuenta de Google para que sus actividades de la Agenda se reflejen automáticamente en su Google Calendar personal.
- La sincronización es **de un solo sentido**: lo que creas en la Agenda de EmpresaOS se copia a Google Calendar. Lo que agregues directamente en Google Calendar **no** se refleja de vuelta en EmpresaOS.
- Esta integración requiere que el administrador técnico haya configurado previamente las credenciales de Google (ver documento técnico). Si no está configurada, el botón de conexión permanece oculto y se muestra un mensaje explicativo — el resto del sistema sigue funcionando con normalidad.

## 8. Informes

- Desde **Informes → Generar Informe**, elige el tipo (Equipos, Mantenimientos, Novedades, Proyectos, Documentos), el formato (PDF o Excel), filtros avanzados opcionales (estado, rango de fechas, etc.) y la plantilla de diseño.
- El PDF generado respeta la plantilla elegida: colores, logo de la empresa, tipo de diseño (Estándar/Ejecutivo/Detallado/Comparativo), tamaño de página, orientación y márgenes.
- Los informes quedan disponibles para descargar durante 30 días desde el historial.
- **Informes técnicos**: informe extendido por equipo con evidencia fotográfica y firmas digitales (técnico y cliente).

## 9. Plantillas de informes (solo Administrador)

- Crea plantillas reutilizables: nombre, identificador, tipo de diseño, esquema de color (predefinido o un color personalizado en hexadecimal), qué incluir (logo, gráficos, tabla de datos, resumen), tamaño de página, orientación y márgenes.
- Al generar un informe, cualquier plantilla creada aparece como opción junto a la plantilla "Estándar" del sistema.

## 10. Programación de informes (solo Administrador)

Permite programar el envío periódico de un informe (por ejemplo, mensual) a una lista de correos, sin tener que generarlo manualmente cada vez.

## 11. Notificaciones

Centro de notificaciones de la empresa: vencimientos de documentos, recordatorios de actividades, eventos del sistema. Se pueden archivar. Puedes configurar tus preferencias de correo desde **Preferencias de email**.

## 12. Analytics

Panel de métricas agregadas de la operación (equipos por estado, mantenimientos por mes, novedades por prioridad, entre otros).

## 13. Auditoría (uso interno)

Registro de todas las acciones relevantes (creación, edición, eliminación) con usuario y fecha. Solo visible para el rol Super administrador — normalmente no forma parte del uso diario de Progrúas.

## Preguntas frecuentes

**¿Puedo recuperar un registro eliminado?** No desde la interfaz. La eliminación es permanente. Consulta el documento técnico sobre respaldos.

**¿Qué pasa si pierdo la conexión a internet a la mitad de un formulario?** El sistema muestra un aviso de error y un botón "Reintentar"; el registro no se guarda a medias — o se guarda completo, o no se guarda nada.

**¿Por qué no veo el botón para conectar Google Calendar?** Falta configuración técnica de las credenciales de Google (ver documento técnico, sección de variables de entorno). No afecta al resto del sistema.
