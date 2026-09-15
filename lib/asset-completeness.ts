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

export const ASSET_COMPLETABLE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "location", label: "Ubicación" },
  { key: "plate", label: "Placa" },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "year", label: "Año" },
  { key: "provider", label: "Proveedor" },
  { key: "hour_meter", label: "Horómetro" },
  { key: "next_maintenance_date", label: "Próximo mantenimiento" },
  { key: "insurance_expiration", label: "Vence póliza" },
  { key: "technical_certificate_expiration", label: "Vence certificado" }
];

function isFieldPending(key: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  // hour_meter es NOT NULL DEFAULT 0 en la base de datos - no se puede
  // distinguir "nunca se diligenció" de "es cero" a nivel de columna, así
  // que se trata 0 como pendiente. Costo de esto: un equipo genuinamente
  // nuevo con 0 horas reales queda marcado "pendiente" hasta que alguien
  // confirme el dato - aceptable, es solo un indicador informativo, nunca
  // bloquea nada.
  if (key === "hour_meter" && Number(value) === 0) return true;
  return false;
}

// Acepta tanto una fila completa de `assets` como el payload parcial que
// arma buildFieldsPayload() al crear/editar (mismos nombres de columna en
// ambos casos) - así el mismo cálculo sirve para el formulario recién
// guardado y para la ficha ya persistida.
export function getMissingAssetFields(fields: Record<string, unknown>): string[] {
  return ASSET_COMPLETABLE_FIELDS.filter((field) => isFieldPending(field.key, fields[field.key])).map(
    (field) => field.label
  );
}

export function isAssetInfoComplete(fields: Record<string, unknown>): boolean {
  return getMissingAssetFields(fields).length === 0;
}
