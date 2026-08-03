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
};

export type IndustrySlug =
  | "machinery"
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
    assetLabel: "Máquinas",
    maintenanceLabel: "Mantenimientos",
    projectLabel: "Proyectos",
    incidentLabel: "Alertas",
    suggestedColorPrimary: "#1e40af",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  veterinary: {
    id: "",
    name: "Veterinaria & Mascotas",
    slug: "veterinary",
    description: "Gestión de clínica veterinaria, pacientes y procedimientos",
    icon: "🐾",
    assetLabel: "Equipos",
    maintenanceLabel: "Mantenimiento",
    projectLabel: "Campañas",
    incidentLabel: "Consultas",
    suggestedColorPrimary: "#7c2d12",
    suggestedColorSecondary: "#f59e0b",
    isActive: true,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

export const industryTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100),
  slug: z.enum([
    "machinery",
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
