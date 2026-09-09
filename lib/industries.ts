import { z } from "zod";

export type IndustryTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  assetLabel: string;
  maintenanceLabel: string;
  projectLabel: string;
  incidentLabel: string;
  suggestedColorPrimary: string;
  suggestedColorSecondary: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // No confundir con `isActive` (estado del template en BD, siempre true
  // aquí). Esto marca si el nicho ya tiene una experiencia terminada y
  // verificada hoy - hoy solo "machinery" (el único cliente real, Progrúas)
  // y "general" (fallback genérico, todos los módulos con etiquetas
  // neutrales) lo son. Los demás quedan visibles como "Próximamente" en el
  // selector de registro: la auditoría de nichos encontró que, por ejemplo,
  // "veterinary" todavía muestra etiquetas de maquinaria ("Horómetro",
  // "Placa") en el formulario de Equipos - vender eso hoy como terminado
  // sería prometer algo que no funciona bien todavía.
  isAvailable: boolean;
};

export type IndustrySlug =
  | "machinery"
  | "general"
  | "construction"
  | "veterinary"
  | "healthcare"
  | "dental"
  | "workshop"
  | "services";

export const INDUSTRY_SLUGS: Record<IndustrySlug, IndustryTemplate> = {
  machinery: {
    id: "", // Will be filled from DB
    name: "Maquinaria & Equipos",
    slug: "machinery",
    description: "Gestión de maquinaria industrial, herramientas y equipos pesados",
    icon: "⚙️",
    // Alineado a la terminología real del único tenant machinery (Progrúas
    // S.A.S.): "Equipos"/"Novedades", no los placeholders "Máquinas"/"Alertas"
    // que nunca se usaron (ver 040_link_industry_template_to_signup.sql).
    assetLabel: "Equipos",
    maintenanceLabel: "Mantenimientos",
    projectLabel: "Proyectos",
    incidentLabel: "Novedades",
    suggestedColorPrimary: "#1e40af",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  general: {
    id: "",
    name: "Otro tipo de negocio",
    slug: "general",
    description: "Gestión general de activos, mantenimientos, proyectos y novedades para cualquier operación",
    icon: "🏢",
    assetLabel: "Activos",
    maintenanceLabel: "Mantenimientos",
    projectLabel: "Proyectos",
    incidentLabel: "Novedades",
    suggestedColorPrimary: "#0f766e",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  construction: {
    id: "",
    name: "Construcción & Obras",
    slug: "construction",
    description: "Seguimiento de proyectos de construcción y obras civiles",
    icon: "🏗️",
    assetLabel: "Equipos",
    maintenanceLabel: "Mantenimientos",
    projectLabel: "Obras",
    incidentLabel: "Incidentes",
    suggestedColorPrimary: "#b91c1c",
    suggestedColorSecondary: "#fbbf24",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  veterinary: {
    id: "",
    name: "Veterinaria & Mascotas",
    slug: "veterinary",
    description: "Gestión de clínica veterinaria, pacientes y procedimientos",
    icon: "🐾",
    // No "Equipos" (eso sería confundir equipo clínico con mascotas/pacientes,
    // que todavía no existen como entidad propia). "Equipo clínico" se refiere
    // a ecógrafos, autoclaves, rayos X: equipo real que una clínica mantiene.
    assetLabel: "Equipo clínico",
    maintenanceLabel: "Mantenimiento",
    projectLabel: "Campañas",
    incidentLabel: "Consultas",
    suggestedColorPrimary: "#7c2d12",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  healthcare: {
    id: "",
    name: "Salud & Clínicas",
    slug: "healthcare",
    description: "Gestión de consultorios, hospitales y centros de salud",
    icon: "🏥",
    assetLabel: "Equipos Médicos",
    maintenanceLabel: "Mantenimiento",
    projectLabel: "Campañas",
    incidentLabel: "Incidentes",
    suggestedColorPrimary: "#1e3a8a",
    suggestedColorSecondary: "#06b6d4",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  dental: {
    id: "",
    name: "Odontología",
    slug: "dental",
    description: "Gestión de consultorio odontológico y equipos dentales",
    icon: "😁",
    assetLabel: "Equipos Dentales",
    maintenanceLabel: "Mantenimiento",
    projectLabel: "Tratamientos",
    incidentLabel: "Citaciones",
    suggestedColorPrimary: "#4f46e5",
    suggestedColorSecondary: "#60a5fa",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  workshop: {
    id: "",
    name: "Talleres & Mecánica",
    slug: "workshop",
    description: "Gestión de talleres, reparaciones y servicios técnicos",
    icon: "🔧",
    assetLabel: "Herramientas",
    maintenanceLabel: "Mantenimiento",
    projectLabel: "Reparaciones",
    incidentLabel: "Órdenes",
    suggestedColorPrimary: "#7c2d12",
    suggestedColorSecondary: "#ea580c",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  services: {
    id: "",
    name: "Servicios Generales",
    slug: "services",
    description: "Empresas de servicios, consultoría y outsourcing",
    icon: "📋",
    assetLabel: "Recursos",
    maintenanceLabel: "Capacitaciones",
    projectLabel: "Proyectos",
    incidentLabel: "Solicitudes",
    suggestedColorPrimary: "#0f766e",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
    isAvailable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

export const industryTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100),
  slug: z.enum([
    "machinery",
    "general",
    "construction",
    "veterinary",
    "healthcare",
    "dental",
    "workshop",
    "services"
  ]),
  description: z.string().max(500).nullable(),
  icon: z.string().max(10).nullable(),
  assetLabel: z.string().min(3).max(50),
  maintenanceLabel: z.string().min(3).max(50),
  projectLabel: z.string().min(3).max(50),
  incidentLabel: z.string().min(3).max(50),
  suggestedColorPrimary: z.string().regex(/^#[0-9a-f]{6}$/i),
  suggestedColorSecondary: z.string().regex(/^#[0-9a-f]{6}$/i),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const selectIndustrySchema = z.object({
  industryTemplateId: z.string().uuid("Selecciona una industria válida"),
  companyName: z.string().min(3).max(160),
  fullName: z.string().min(3).max(120)
});

export type SelectIndustryInput = z.infer<typeof selectIndustrySchema>;

export function getIndustryTemplate(slug: IndustrySlug): IndustryTemplate {
  return INDUSTRY_SLUGS[slug];
}

export function getAllIndustries(): IndustryTemplate[] {
  return Object.values(INDUSTRY_SLUGS);
}

// Usado por registerAccount (lib/actions/auth.ts) para no reenviar valores
// arbitrarios a Supabase Auth metadata. La validación real y definitiva vive
// en el trigger de la BD (handle_new_auth_user, ver
// 040_link_industry_template_to_signup.sql), que solo aplica un template si
// el slug coincide con una fila activa de industry_templates - esto es
// defensa en profundidad en la capa de aplicación, no la fuente de verdad.
export function isValidIndustrySlug(value: string): value is IndustrySlug {
  return Object.prototype.hasOwnProperty.call(INDUSTRY_SLUGS, value);
}

// Un slug puede ser válido (existe en INDUSTRY_SLUGS) pero todavía no estar
// listo para venderse (isAvailable: false, ver el comentario en
// IndustryTemplate). registerAccount usa esto, no solo isValidIndustrySlug,
// para que alguien no pueda saltarse la tarjeta deshabilitada del selector
// enviando el valor a mano y terminar con un nicho a medio terminar.
export function isAvailableIndustrySlug(value: string): value is IndustrySlug {
  return isValidIndustrySlug(value) && INDUSTRY_SLUGS[value].isAvailable;
}
