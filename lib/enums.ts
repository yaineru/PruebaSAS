import { z } from "zod";

export type EnumOption = {
  value: string;
  label: string;
  aliases?: readonly string[];
};

export const ENUM_OPTIONS = {
  assetStatus: [
    { value: "AVAILABLE", label: "Disponible", aliases: ["apto", "available", "disponible"] },
    { value: "IN_OPERATION", label: "Asignado", aliases: ["asignado", "en operacion", "in_operation"] },
    { value: "MAINTENANCE", label: "En mantenimiento", aliases: ["mantenimiento", "en mantenimiento", "maintenance"] },
    { value: "RETIRED", label: "Fuera de servicio", aliases: ["fuera de servicio", "retired", "inactivo"] },
    { value: "LOST", label: "Perdido", aliases: ["perdido", "lost"] }
  ],
  assetCondition: [
    { value: "EXCELLENT", label: "Excelente", aliases: ["excelente", "excellent"] },
    { value: "GOOD", label: "Buena", aliases: ["buena", "good"] },
    { value: "FAIR", label: "Regular", aliases: ["regular", "fair"] },
    { value: "POOR", label: "Mala", aliases: ["mala", "poor"] },
    { value: "CRITICAL", label: "Crítica", aliases: ["critica", "critical"] }
  ],
  maintenanceType: [
    { value: "PREVENTIVE", label: "Preventivo", aliases: ["preventivo", "preventive"] },
    { value: "CORRECTIVE", label: "Correctivo", aliases: ["correctivo", "corrective"] },
    { value: "INSPECTION", label: "Inspección", aliases: ["inspeccion", "inspection"] },
    { value: "EMERGENCY", label: "Emergencia", aliases: ["emergencia", "emergency"] }
  ],
  // Catálogo propio del informe técnico (components/technical-report-form.tsx,
  // campo "Tipo de actividad") - a propósito NO es el mismo array que
  // `maintenanceType`. Ese otro catálogo está atado 1:1 al enum nativo de
  // Postgres `maintenance_type` (ver maintenance_records.type en
  // supabase/migrations/001_initial_multitenant_schema.sql): agregarle
  // "Montaje de torre grúa" también lo habilitaría en el módulo de
  // Mantenimientos y Postgres rechazaría el insert porque ese valor no
  // existiría en el enum de la base de datos. El campo "Tipo de actividad"
  // del informe técnico, en cambio, es texto libre guardado en
  // report_metadata (jsonb) - nunca pasa por ese enum - así que puede tener
  // su propio catálogo. Repite los 4 valores de mantenimiento (mismos
  // códigos) para que el autocompletado desde un mantenimiento asociado
  // (handleMaintenanceChange) siga resolviendo la etiqueta correcta, y
  // agrega las 3 actividades de montaje/realce que Progrúas pidió.
  technicalReportActivityType: [
    { value: "PREVENTIVE", label: "Preventivo", aliases: ["preventivo", "preventive"] },
    { value: "CORRECTIVE", label: "Correctivo", aliases: ["correctivo", "corrective"] },
    { value: "INSPECTION", label: "Inspección", aliases: ["inspeccion", "inspection"] },
    { value: "EMERGENCY", label: "Emergencia", aliases: ["emergencia", "emergency"] },
    { value: "TOWER_CRANE_RAISE", label: "Realce de torre grúa", aliases: ["realce de torre grua", "realce torre grua"] },
    { value: "WINCH_ASSEMBLY", label: "Montaje de malacate", aliases: ["montaje de malacate", "montaje malacate"] },
    { value: "TOWER_CRANE_ASSEMBLY", label: "Montaje de torre grúa", aliases: ["montaje de torre grua", "montaje torre grua"] }
  ],
  maintenanceStatus: [
    { value: "PENDING", label: "Pendiente", aliases: ["pendiente", "pending"] },
    { value: "SCHEDULED", label: "Programado", aliases: ["programado", "scheduled"] },
    { value: "IN_PROGRESS", label: "En proceso", aliases: ["en proceso", "in_progress"] },
    { value: "COMPLETED", label: "Completado", aliases: ["completado", "completed"] },
    { value: "CANCELLED", label: "Cancelado", aliases: ["cancelado", "cancelled"] },
    { value: "OVERDUE", label: "Vencido", aliases: ["vencido", "overdue"] }
  ],
  documentType: [
    { value: "PDF", label: "PDF", aliases: ["pdf"] },
    { value: "IMAGE", label: "Imagen", aliases: ["imagen", "image"] },
    { value: "CERTIFICATE", label: "Certificado", aliases: ["certificado", "certificate"] },
    { value: "LICENSE", label: "Licencia", aliases: ["licencia", "license"] },
    { value: "MANUAL", label: "Manual", aliases: ["manual"] },
    { value: "OTHER", label: "Otro", aliases: ["otro", "other"] }
  ],
  projectStatus: [
    { value: "PLANNED", label: "Planeado", aliases: ["planeado", "planned"] },
    { value: "ACTIVE", label: "Activo", aliases: ["activo", "active"] },
    { value: "PAUSED", label: "Pausado", aliases: ["pausado", "paused"] },
    { value: "COMPLETED", label: "Completado", aliases: ["completado", "completed"] },
    { value: "CANCELLED", label: "Cancelado", aliases: ["cancelado", "cancelled"] }
  ],
  incidentPriority: [
    { value: "LOW", label: "Baja", aliases: ["baja", "low"] },
    { value: "MEDIUM", label: "Media", aliases: ["media", "medium"] },
    { value: "HIGH", label: "Alta", aliases: ["alta", "high"] },
    { value: "CRITICAL", label: "Crítica", aliases: ["critica", "critical"] }
  ],
  incidentStatus: [
    { value: "ABIERTO", label: "Abierto", aliases: ["abierto"] },
    { value: "EN_PROCESO", label: "En proceso", aliases: ["en proceso", "en_proceso"] },
    { value: "RESUELTO", label: "Resuelto", aliases: ["resuelto"] },
    { value: "CERRADO", label: "Cerrado", aliases: ["cerrado"] }
  ],
  appRole: [
    { value: "ADMIN", label: "Administrador", aliases: ["admin", "administrador"] },
    { value: "SUPERVISOR", label: "Supervisor", aliases: ["supervisor"] },
    { value: "OPERARIO", label: "Operario", aliases: ["operario"] },
    { value: "SUPER_ADMIN", label: "Super administrador", aliases: ["super_admin", "super administrador"] }
  ],
  recordStatus: [
    { value: "ACTIVE", label: "Activo", aliases: ["activo", "active"] },
    { value: "INACTIVE", label: "Inactivo", aliases: ["inactivo", "inactive"] },
    { value: "ARCHIVED", label: "Archivado", aliases: ["archivado", "archived"] }
  ]
} as const;

export type EnumKey = keyof typeof ENUM_OPTIONS;

export const enumSchemas = Object.fromEntries(
  Object.entries(ENUM_OPTIONS).map(([key, options]) => [
    key,
    z.enum(options.map((option) => option.value) as [string, ...string[]])
  ])
) as Record<EnumKey, z.ZodEnum<[string, ...string[]]>>;

function normalizeEnumInput(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function coerceEnumValue(enumKey: EnumKey, rawValue: unknown) {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;

  const options = ENUM_OPTIONS[enumKey];
  const direct = options.find((option) => option.value === value);
  if (direct) return direct.value;

  const normalized = normalizeEnumInput(value);
  const match = options.find((option) =>
    [option.label, ...(option.aliases ?? [])].some((candidate) => normalizeEnumInput(candidate) === normalized)
  );

  if (!match) {
    throw new Error(`Selecciona un valor valido para ${enumKey}.`);
  }

  return match.value;
}

export function getEnumLabel(enumKey: EnumKey, rawValue: unknown) {
  const value = String(rawValue ?? "").trim();
  const option = ENUM_OPTIONS[enumKey].find((item) => item.value === value);
  return option?.label ?? value;
}
