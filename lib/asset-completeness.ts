// Progrúas reportó un caso real: la persona que registra un equipo a veces
// no tiene todavía la marca, modelo, placa, etc. (el jefe se los da después),
// y el sistema no la dejaba avanzar. En realidad la base de datos y el
// formulario YA permiten guardar un equipo solo con "Máquina" y "Código"
// (los únicos NOT NULL sin default en `assets`, ver
// supabase/migrations/001_initial_multitenant_schema.sql:170-203) - el
// problema real era que nada distinguía visualmente "obligatorio" de
// "opcional", así que la usuaria asumía que debía completar todo.
//
// Este módulo no cambia ninguna obligatoriedad ni agrega una tabla nueva:
// solo calcula, a partir de los datos que ya existen, qué tan completa está
// la ficha de un equipo. "Estado de información" (Completo/Pendiente) es
// deliberadamente independiente del `status` operativo (Disponible/
// Mantenimiento/etc) - un equipo puede estar Disponible y, aparte, tener
// información pendiente de completar.

// hour_meter queda deliberadamente FUERA de esta lista. La columna es
// `numeric not null default 0` (ver 001_initial_multitenant_schema.sql) - no
// existe un estado NULL para representar "todavía no se sabe", y 0 es un
// valor de negocio real y frecuente (un equipo recién adquirido, o con el
// horómetro reiniciado, legítimamente tiene 0 horas). Marcarlo "pendiente"
// cada vez que valga 0 produciría falsos positivos exactamente en el caso
// más común de equipo nuevo, así que no se incluye en el cálculo de
// información pendiente. Completarlo sigue siendo tan opcional como hoy en
// el formulario; simplemente no se usa como señal de "falta información".
export const ASSET_COMPLETABLE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "location", label: "Ubicación" },
  { key: "plate", label: "Placa" },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "year", label: "Año" },
  { key: "provider", label: "Proveedor" },
  { key: "next_maintenance_date", label: "Próximo mantenimiento" },
  { key: "insurance_expiration", label: "Vence póliza" },
  { key: "technical_certificate_expiration", label: "Vence certificado" }
];

function isFieldPending(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

// Acepta tanto una fila completa de `assets` como el payload parcial que
// arma buildFieldsPayload() al crear/editar (mismos nombres de columna en
// ambos casos) - así el mismo cálculo sirve para el formulario recién
// guardado y para la ficha ya persistida.
export function getMissingAssetFields(fields: Record<string, unknown>): string[] {
  return ASSET_COMPLETABLE_FIELDS.filter((field) => isFieldPending(fields[field.key])).map((field) => field.label);
}

export function isAssetInfoComplete(fields: Record<string, unknown>): boolean {
  return getMissingAssetFields(fields).length === 0;
}
