# Manual de Usuario
## Progrúas S.A.S.

Guía de uso de la plataforma EmpresaOS para el personal de Progrúas. Documenta únicamente funciones que existen hoy en el sistema, verificadas contra el código fuente. Donde una función esperable todavía no existe, se indica explícitamente como **"Limitación actual de la plataforma"**.

Última verificación de contenido: 2026-09-08.

---

## Índice

1. [Introducción](#1-introducción)
2. [Acceso a la plataforma](#2-acceso-a-la-plataforma)
3. [Panel principal](#3-panel-principal)
4. [Equipos](#4-equipos)
5. [Mantenimientos](#5-mantenimientos)
6. [Documentos](#6-documentos)
7. [Obras / Proyectos](#7-obras--proyectos)
8. [Novedades](#8-novedades)
9. [Usuarios y roles](#9-usuarios-y-roles)
10. [Informes](#10-informes)
11. [Informes técnicos](#11-informes-técnicos)
12. [Configuración](#12-configuración)
13. [Casos prácticos](#13-casos-prácticos)
14. [Problemas frecuentes](#14-problemas-frecuentes)
15. [Buenas prácticas](#15-buenas-prácticas)
16. [Glosario](#16-glosario)

---

## 1. Introducción

EmpresaOS es la plataforma de gestión empresarial privada de Progrúas S.A.S. Toda la información que se registra (equipos, mantenimientos, documentos, obras, novedades) queda aislada del resto de empresas que puedan usar la misma plataforma: ninguna otra empresa puede ver información de Progrúas, ni Progrúas puede ver información de otra empresa.

Permite administrar:
- El inventario de maquinaria/equipos y su estado operativo.
- La planificación y el historial de mantenimientos preventivos y correctivos.
- Los documentos asociados a cada equipo (pólizas, certificados, manuales).
- Las obras o frentes de trabajo en curso.
- Las novedades reportadas en campo (fallas, incidentes).
- La agenda de actividades de la empresa, con recordatorios y sincronización opcional a Google Calendar.
- La generación de informes en PDF o Excel.
- La generación de informes técnicos de visita de servicio, con firma digital y evidencia fotográfica.

Se accede desde cualquier navegador, con la URL que la empresa tenga asignada.

## 2. Acceso a la plataforma

**Iniciar sesión**: en la pantalla de ingreso, escriba su correo y contraseña y presione **Entrar**.

**Si olvida su contraseña**: **Limitación actual de la plataforma** — no existe un flujo de autoservicio ("¿Olvidó su contraseña?") ni recuperación automática por correo. Un administrador de Progrúas debe gestionar el restablecimiento a través del soporte técnico de la plataforma.

**Qué hacer después de iniciar sesión**: la plataforma lo dirige directamente al Panel principal.

**Cómo cerrar sesión**: botón **Cerrar sesión** en la parte inferior del menú lateral (computador) o el ícono de salida en la barra superior (celular).

**Si fue invitado por un administrador**: recibirá un correo con un enlace de invitación. Al abrirlo, se le pedirá crear su contraseña. Si el enlace no es válido o expiró, la pantalla ofrece la opción **"¿Tienes un código en su lugar?"**, donde puede ingresar su correo y un código numérico de respaldo.

## 3. Panel principal

Muestra en tiempo real (se actualiza solo, sin recargar la página):

- **Equipos totales** y **Disponibles**.
- **En seguimiento**: equipos actualmente en mantenimiento.
- **Novedades abiertas**: reportes pendientes de resolución.
- **Proyectos activos**: obras en curso.
- **Mantenimientos próximos**: mantenimientos programados que se acercan.
- **Documentos por vencer**: pólizas o certificados próximos a caducar — conviene revisarlo periódicamente.
- **Usuarios activos**.

Debajo, tres gráficos (estado de equipos, mantenimientos por mes, novedades por prioridad) y dos tablas: **Mantenimientos próximos** (por fecha) y **Actividad reciente** (quién hizo qué y cuándo, calculado automáticamente). Más abajo: **Novedades recientes** y **Alertas importantes** (mantenimientos y vencimientos que requieren seguimiento).

## 4. Equipos

**Consultar**: el módulo "Equipos" muestra los registros más recientes (hasta 50). Use el buscador (por nombre) y el filtro por Estado para encontrar un equipo específico.

**Crear un equipo nuevo**:
1. Complete **Máquina** (nombre) y **Código interno** — ambos obligatorios; el código no puede repetirse dentro de la empresa.
2. Complete si aplica: Ubicación, Placa, Marca, Modelo, Año, Proveedor, Horómetro, Próximo mantenimiento, Vence póliza, Vence certificado.
3. Seleccione el **Estado**: Disponible, Asignado, En mantenimiento, Fuera de servicio o Perdido.
4. Presione **Guardar**.

**Qué significa cada campo**:
- *Horómetro*: horas de uso acumuladas, útil para planear mantenimientos por horas de operación.
- *Vence póliza / Vence certificado*: alimentan el indicador "Documentos por vencer" del Panel principal cuando la fecha se acerca.

**Editar**: botón "Editar" sobre el registro, mismo formulario precargado. Disponible para ADMIN y SUPERVISOR.

**Eliminar**: sí es posible, con confirmación ("Esta acción no se puede deshacer"). Disponible solo para ADMIN — SUPERVISOR puede editar equipos (ver arriba) pero no eliminarlos; OPERARIO no puede ni editar ni eliminar equipos.

**Ficha detallada de un equipo** (clic sobre el nombre del equipo):
- Ficha técnica completa.
- **Historial de mantenimientos**: últimos 20 mantenimientos de ese equipo.
- **Fotografías**: arrastre o seleccione fotos (JPEG, PNG o WebP, hasta 10 MB por imagen). Cada foto se puede eliminar individualmente.
- **Comparación antes/después**: con al menos dos fotos cargadas, elija cuál es "antes" y cuál "después"; el sistema genera una comparación con control deslizante.
- **Documentos asociados**: documentos ya cargados que están relacionados con ese equipo.

**Recomendaciones**: use un código interno consistente (ej. "EQ-001"), mantenga actualizadas las fechas de vencimiento, y actualice el Estado cada vez que cambie la situación real del equipo.

## 5. Mantenimientos

**Registrar un mantenimiento**:
1. Complete **Actividad** (obligatorio, ej. "Cambio de filtros") y seleccione el **Activo relacionado** (obligatorio).
2. Opcionalmente relacione una Obra, elija el **Tipo** (Preventivo, Correctivo, Inspección, Emergencia), agregue Descripción, Costo, Responsable y Fecha programada.
3. Seleccione el **Estado**: Pendiente, Programado, En proceso, Completado, Cancelado o Vencido.
4. Guarde.

**Historial**: el historial completo por equipo se consulta desde la ficha del equipo (Equipos → clic en el nombre).

**Modificar**: el botón "Editar" está disponible para ADMIN, SUPERVISOR **y OPERARIO** — este es uno de los módulos donde el personal de campo también puede editar sus propios registros.

**Identificar pendientes/completados**: use el filtro de Estado en la lista del módulo.

## 6. Documentos

**Cargar un documento**:
1. Seleccione el **Archivo** (obligatorio), escriba el **Documento** (título, obligatorio) y elija el **Activo relacionado** (obligatorio).
2. Opcionalmente relacione una Obra o un Mantenimiento.
3. Elija el **Tipo**: PDF, Imagen, Certificado, Licencia, Manual u Otro.
4. Indique la **Fecha de vencimiento** si aplica (no puede ser una fecha pasada).
5. Estado: Activo, Inactivo o Archivado.
6. Guarde.

**Tipos de archivo permitidos**: PDF, imágenes (PNG/JPG/WEBP), Word (.docx) y Excel (.xlsx). **Tamaño máximo: 20 MB por archivo.**

**Consultar/Descargar**: cada documento tiene botones **Ver** (lo abre en pestaña nueva) y **Descargar**.

**Actualizar**: puede editar título, relaciones, tipo, fecha de vencimiento y estado. **Limitación actual de la plataforma**: no existe una opción para reemplazar el archivo de un documento ya cargado — para cambiarlo hay que eliminarlo y volver a cargarlo.

**Eliminar**: disponible desde el botón propio de cada documento, con confirmación. Solo ADMIN ve este botón — SUPERVISOR y OPERARIO pueden consultar y descargar, pero no eliminar. Cargar un documento nuevo requiere ADMIN o SUPERVISOR; OPERARIO no ve el formulario de carga.

**Recomendaciones**: nombres claros y consistentes (ej. "Póliza 2026 — Excavadora EQ-001"), relación siempre con el equipo correspondiente, y revisión periódica del indicador "Documentos por vencer".

## 7. Obras / Proyectos

**Crear**: complete **Obra** (nombre, obligatorio), Ubicación, Fecha final, y **Estado**: Planeado, Activo, Pausado, Completado o Cancelado.

**Consultar/Editar**: lista de registros recientes, búsqueda por nombre, filtro por estado. Edición disponible para ADMIN y SUPERVISOR.

**Relacionar información**: mantenimientos, documentos y novedades pueden vincularse opcionalmente a una obra específica.

**Eliminar**: disponible solo para ADMIN.

**Uso recomendado**: cree la obra antes de registrar mantenimientos o novedades relacionados, para poder filtrar la información por obra en los informes.

## 8. Novedades

**Para qué sirve**: registrar fallas, incidentes o situaciones de campo que requieran seguimiento, asociadas a un equipo.

**Registrar una novedad**:
1. Complete **Novedad** (título, obligatorio) y seleccione el **Activo relacionado** (obligatorio).
2. Opcionalmente relacione una Obra, agregue Descripción y Ubicación.
3. Seleccione **Prioridad**: Baja, Media, Alta o Crítica.
4. Seleccione **Estado**: Abierto, En proceso, Resuelto o Cerrado.
5. Guarde.

**Consultar historial**: use el filtro de Estado para ver, por ejemplo, solo las novedades "Abierto".

**Actualizar**: ADMIN, SUPERVISOR **y OPERARIO** pueden editar — pensado para que el personal de campo dé seguimiento a lo que reportó.

## 9. Usuarios y roles

**Consultar**: el módulo "Usuarios" muestra el listado de personas registradas, con nombre, correo y rol.

**Roles que utiliza el personal de Progrúas**: **Administrador**, **Supervisor** y **Operario**.

> El sistema tiene además un rol técnico llamado "Super administrador", reservado exclusivamente al equipo que opera la plataforma (soporte/mantenimiento del proveedor). No es un rol que deba asignarse a personal de Progrúas, y de hecho solo otro Super administrador puede otorgarlo.

| Puede hacer | Administrador | Supervisor | Operario |
|---|---|---|---|
| Crear/editar equipos y obras | Sí | Sí | No |
| Eliminar equipos, obras, mantenimientos o novedades | Sí | No | No |
| Crear/editar mantenimientos y novedades | Sí | Sí | Sí |
| Cargar documentos | Sí | Sí | No |
| Eliminar documentos | Sí | No | No |
| Crear/editar usuarios | Sí | No | No |
| Generar informes y enviarlos por correo (Informes → Generar) | Sí | Sí | No (solo puede ver el historial) |
| Crear informes técnicos | Sí | Sí | Sí |
| Configurar correo SMTP / Webhooks / Plantillas de informes / Programación de informes | Sí | No | No |
| Agenda, Notificaciones, Analytics, Integraciones | Sí | Sí | Sí |

**Importante sobre "crear un usuario"**: registrar a alguien en el módulo Usuarios **solo crea una ficha de referencia** (nombre, correo, rol) — no le da acceso para iniciar sesión. El acceso real se otorga por invitación formal, gestionada por soporte técnico.

**Eliminar usuarios**: **Limitación actual de la plataforma** — no existe botón para eliminar una ficha de usuario. Si alguien deja la empresa, gestione el cambio de acceso con soporte técnico.

## 10. Informes

**Tipos de informe disponibles**:

| Tipo | Para qué sirve |
|---|---|
| Equipos | Inventario y estado de los equipos |
| Mantenimientos | Registro de mantenimientos realizados |
| Novedades | Incidentes y problemas reportados |
| Proyectos | Estado y avance de las obras |
| Documentos | Documentos vencidos o próximos a vencer |

**Cómo generar un informe** (ADMIN y SUPERVISOR):
1. "Informes" → **"Generar Informe"**.
2. Elija el tipo de informe.
3. Elija el formato: **PDF** o **Excel**.
4. Opcionalmente elija una plantilla personalizada (ver sección 12) o deje la Estándar.
5. Complete los filtros disponibles para ese tipo (rango de fechas, estado, etc.).
6. Presione **"Generar Informe"**.

**Qué pasa después**: se abre una ventana con el resultado (cantidad de registros, tamaño del archivo) y las opciones **Descargar**, **Enviar** (por correo) e **Historial**.

**Enviar por correo**: indique el correo destino (obligatorio), copia opcional, asunto (prellenado) y mensaje opcional; el informe se envía como adjunto.

**Historial**: en "Informes" se listan los últimos 50 generados, con estado (Listo, Generando, Error), registros, tamaño y fecha. Desde ahí puede volver a ver, descargar, reenviar por correo o **eliminar** cualquier informe generado.

**Si un informe no se genera correctamente**: queda marcado "Error" en el historial con un mensaje explicativo (por ejemplo, "No hay datos para exportar" si los filtros no arrojaron resultados). Revise los filtros e intente de nuevo; si persiste, contacte a soporte.

**Limitación actual de la plataforma**: la "Programación de informes" (envíos automáticos recurrentes) permite guardar la configuración, pero **el sistema todavía no la ejecuta automáticamente** — la propia pantalla lo advierte. Hoy, todo informe debe generarse manualmente.

## 11. Informes técnicos

**Para qué sirven**: generar un informe formal de una visita de mantenimiento a un cliente, con firma digital del técnico y del cliente, y evidencia fotográfica. Disponible para ADMIN, SUPERVISOR y OPERARIO.

**Cómo crear uno**:
1. "Informes técnicos".
2. Opcionalmente seleccione un **Mantenimiento asociado** ya registrado — autocompleta varios campos.
3. Complete cliente (obligatorio), contacto, proyecto/equipo intervenido, responsable, técnico, tipo de mantenimiento, y describa el problema (obligatorio), diagnóstico, actividades realizadas, materiales/repuestos utilizados, observaciones y recomendaciones.
4. Si aplica, agregue hasta 12 fotos de evidencia. Las fotografías de los informes técnicos pueden registrarse como **Antes**, **Después** o **Evidencia** — no es obligatorio usar pares Antes/Después: puede cargar solo fotos de Evidencia (del trabajo, de una pieza, del sitio), solo Antes, solo Después, o cualquier combinación. Cada foto trae "Evidencia" seleccionado por defecto y usted puede cambiarlo antes de generar el informe.
5. Registre la firma del técnico y la firma del cliente (nombre, cargo, fecha y firma dibujada en pantalla).
6. Presione **"Generar informe técnico"**.

**Cómo se descarga**: se genera en PDF y aparece automáticamente en el historial de "Informes" (marcado "Informe técnico"), desde donde se ve, descarga o envía por correo igual que cualquier otro informe.

## 12. Configuración

Opciones disponibles para Progrúas:

- **Correo (SMTP)** — solo Administrador: configurar el servidor de correo propio de la empresa para envío de informes y notificaciones (opcional; sin configurarlo, la plataforma sigue funcionando normalmente).
- **Preferencias de correo** — cualquier usuario: elegir qué notificaciones recibir por correo y con qué frecuencia.
- **Integraciones** — cualquier usuario: conectar/pausar/desconectar Google Calendar para sincronizar la Agenda personal. La sincronización es de un solo sentido: lo creado en la Agenda se copia a Google Calendar; lo agregado directamente en Google Calendar no se refleja de vuelta.
- **Webhooks** — solo Administrador: envío automático de eventos del sistema hacia otra herramienta externa (uso técnico/avanzado).
- **Plantillas de informes** — solo Administrador: nombre, esquema de color, si incluir el logo de la empresa, tamaño de página, orientación y márgenes. Nota: al generar el PDF solo se aplican efectivamente el color y el logo elegidos; el resto de opciones se guardan pero el diseño final del documento no varía según ellas.
- **Programación de informes** — solo Administrador (ver limitación en sección 10).
- **Agenda**: calendario mensual/semanal/diario. Cree actividades con título, fecha/hora, tipo (con color), responsable, ubicación, descripción y recordatorios (15 min, 30 min, 1 hora o 1 día antes). Puede arrastrar una actividad sobre el calendario para reprogramarla. Puede compartir su disponibilidad mediante un enlace público o un feed `.ics` importable en otros calendarios.

## 13. Casos prácticos

**Caso 1 — Registrar un nuevo equipo**
1. Entrar a "Equipos".
2. Diligenciar Máquina, Código interno (obligatorios) y los demás campos disponibles.
3. Seleccionar Estado.
4. Guardar.
5. Verificar que el equipo aparece en la lista, con su código correcto.

**Caso 2 — Registrar un mantenimiento**
1. Entrar a "Mantenimientos".
2. Diligenciar Actividad y elegir el Activo relacionado.
3. Elegir Tipo y Estado.
4. Guardar.
5. Verificar desde la ficha del equipo ("Historial de mantenimientos").

**Caso 3 — Consultar el historial de mantenimiento de un equipo**
1. Entrar a "Equipos".
2. Clic en el nombre del equipo.
3. Revisar "Historial de mantenimientos" en la ficha.

**Caso 4 — Cargar un documento de un equipo**
1. Entrar a "Documentos".
2. Seleccionar el archivo, escribir el título, elegir el Activo relacionado y el Tipo.
3. Guardar.
4. Confirmar que aparece en la lista y probar "Ver".

**Caso 5 — Generar un informe**
1. "Informes" → "Generar Informe".
2. Elegir tipo (ej. Mantenimientos) y formato (PDF o Excel).
3. Completar filtros si aplica.
4. Generar y descargar desde la ventana emergente.

**Caso 6 — Generar un informe técnico**
1. "Informes técnicos".
2. Opcionalmente elegir un mantenimiento asociado.
3. Completar cliente, equipo, diagnóstico y actividades realizadas.
4. Agregar fotos de evidencia y firmas.
5. Generar; aparece en "Informes" como "Informe técnico".

## 14. Problemas frecuentes

**¿Qué hago si...?**

- **No puedo iniciar sesión**: verifique correo y contraseña. Si persiste, contacte a un administrador o a soporte.
- **Olvidé mi contraseña**: hoy no hay recuperación automática (ver sección 2); contacte a un administrador o a soporte técnico.
- **No encuentro un equipo**: la lista muestra solo los 50 registros más recientes; use el buscador por nombre.
- **No puedo cargar un documento**: revise que el archivo sea de un tipo permitido y pese menos de 20 MB.
- **No aparece información en el panel/módulo**: confirme que el registro se guardó (revise si hubo mensaje de error) y que no haya un filtro activo ocultándolo.
- **Un informe no se genera**: revise el mensaje de error en el historial de Informes; suele deberse a filtros sin datos.
- **Un archivo no descarga**: intente de nuevo desde "Ver"/"Descargar"; los enlaces de descarga expiran por seguridad, recargue la página si pasó mucho tiempo.
- **Aparece un mensaje de error al guardar**: revise que los campos obligatorios estén completos y que no repita un código de equipo ya existente.
- **¿Puedo recuperar un registro eliminado?**: no desde la interfaz. La eliminación es permanente.
- **No veo el botón para conectar Google Calendar**: falta configuración técnica de credenciales de Google por parte del proveedor; no afecta al resto del sistema.

## 15. Buenas prácticas

- Use un código interno único y consistente para cada equipo (ej. "EQ-001", "EQ-002").
- Actualice el estado del equipo cada vez que cambie su situación real.
- Registre cada mantenimiento el mismo día que se realiza, con responsable y costo.
- Cargue documentos con nombres claros y relaciónelos siempre con el equipo correspondiente.
- Revise semanalmente el indicador "Documentos por vencer".
- Evite crear equipos u obras duplicadas — use la búsqueda antes de registrar uno nuevo.
- Use siempre los mismos filtros/formato al generar informes recurrentes, para mantener consistencia.
- Configure sus preferencias de correo para no perderse alertas de vencimientos o novedades.

## 16. Glosario

- **Activo relacionado**: el equipo al que pertenece un mantenimiento, documento o novedad.
- **Horómetro**: horas acumuladas de uso de un equipo.
- **Aislamiento por empresa**: mecanismo interno que garantiza que ninguna otra empresa que use la plataforma pueda ver los datos de Progrúas, ni viceversa.
- **SMTP**: protocolo de correo saliente; configurarlo permite que informes y notificaciones salgan desde el propio correo de la empresa.
- **Webhook**: notificación automática hacia un sistema externo cuando ocurre un evento en la plataforma.
- **Super administrador**: rol técnico reservado al equipo que opera la plataforma; no se asigna a personal de Progrúas.
