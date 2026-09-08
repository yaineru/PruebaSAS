import "server-only";
import type { ModuleKey } from "@/lib/modules";
import type { CompanySettings } from "@/lib/company-settings";

// Punto único de resolución "nicho -> módulos visibles". Las labels
// ("nombres mostrados") siguen viviendo donde ya vivían - en las columnas de
// company_settings, aplicadas por applyCompanySettings() - así que este
// archivo NO duplica esa data; solo decide qué subconjunto de los 8 módulos
// existentes se muestra. `labels` es un override opcional por si algún día
// un nicho necesita forzar una etiqueta sin depender de company_settings,
// pero ningún nicho lo usa hoy.

export type NicheSlug =
  | "machinery"
  | "veterinary"
  | "workshop"
  | "healthcare"
  | "dental"
  | "construction"
  | "services"
  | "general";

export type NicheConfig = {
  slug: NicheSlug;
  visibleModules: ModuleKey[];
  labels?: Partial<Pick<CompanySettings, "assetLabel" | "maintenanceLabel" | "projectLabel" | "incidentLabel">>;
};

const ALL_MODULE_KEYS: ModuleKey[] = [
  "assets",
  "maintenance_records",
  "asset_documents",
  "projects",
  "users",
  "incidents",
  "informes",
  "technical_reports"
];

export const NICHE_CONFIGS: Record<NicheSlug, NicheConfig> = {
  // Fallback para cualquier business_type vacío o no reconocido - debe
  // comportarse EXACTAMENTE igual que hoy (todos los módulos) para no romper
  // ninguna empresa existente que no tenga un nicho configurado.
  general: {
    slug: "general",
    visibleModules: ALL_MODULE_KEYS
  },

  // Progrúas S.A.S. (el único tenant real) cae aquí. Debe conservar sus 8
  // módulos actuales sin ningún cambio.
  machinery: {
    slug: "machinery",
    visibleModules: ALL_MODULE_KEYS
  },

  // Veterinaria: única configuración reducida definida en esta fase.
  // "Equipo clínico" son ecógrafos, autoclaves, rayos X - equipo real que una
  // clínica mantiene - no un disfraz de "Pacientes". Se ocultan Obras
  // (no existe el concepto en una clínica) e Informes técnicos (sus campos
  // - "Equipo intervenido", "Marca/Modelo" - son de mantenimiento de
  // maquinaria y no se pueden reetiquetar sin tocar ese módulo, fuera de
  // alcance de esta fase).
  veterinary: {
    slug: "veterinary",
    visibleModules: ["assets", "maintenance_records", "asset_documents", "users", "incidents", "informes"]
  },

  // El resto de nichos no tiene todavía un cliente real ni un pedido
  // explícito de qué ocultar. Ocultar módulos sin ese contexto sería
  // inventar reglas de negocio, así que quedan conservadoramente iguales a
  // "general"/"machinery" (todos los módulos) hasta que un cliente real de
  // ese nicho aporte el criterio - en ese momento, ajustar su fila aquí es
  // el único cambio necesario.
  construction: { slug: "construction", visibleModules: ALL_MODULE_KEYS },
  workshop: { slug: "workshop", visibleModules: ALL_MODULE_KEYS },
  healthcare: { slug: "healthcare", visibleModules: ALL_MODULE_KEYS },
  dental: { slug: "dental", visibleModules: ALL_MODULE_KEYS },
  services: { slug: "services", visibleModules: ALL_MODULE_KEYS }
};

export function getNicheConfig(businessType: string | null | undefined): NicheConfig {
  if (businessType && Object.prototype.hasOwnProperty.call(NICHE_CONFIGS, businessType)) {
    return NICHE_CONFIGS[businessType as NicheSlug];
  }
  return NICHE_CONFIGS.general;
}

export function isModuleVisible(businessType: string | null | undefined, key: ModuleKey): boolean {
  return getNicheConfig(businessType).visibleModules.includes(key);
}
