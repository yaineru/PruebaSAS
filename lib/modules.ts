import { Archive, CalendarCheck, FolderKanban, FileText, Siren, UsersRound, BarChart3, type LucideIcon } from "lucide-react";
import { ENUM_OPTIONS, type EnumKey, type EnumOption } from "@/lib/enums";

export type ModuleKey =
  | "assets"
  | "maintenance_records"
  | "asset_documents"
  | "projects"
  | "users"
  | "incidents"
  | "generated_reports"
  | "informes"
  | "technical_reports";

export type ModuleField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  enumKey?: EnumKey;
  options?: readonly EnumOption[];
};

export type ModuleConfig = {
  key: ModuleKey;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  table: ModuleKey;
  empty: string;
  fields: ModuleField[];
};

// El ORDEN de este array es el orden del menú (barra lateral en escritorio y
// barra inferior en móvil, ambas resueltas por getVisibleModules() en
// lib/company-settings.ts) - ningún otro archivo depende de él.
//
// Obras va primero y Equipos justo después porque el flujo real de Progrúas
// empieza por la obra: un equipo se registra para asignarlo a un frente de
// trabajo, así que la obra tiene que existir antes de que su <select> en el
// formulario de Equipos tenga algo que elegir. Después van los registros que
// se hacen SOBRE un equipo (Mantenimientos, Novedades, Documentos) y al final
// las salidas (Informes) y la administración (Usuarios).
export const modules: ModuleConfig[] = [
  {
    key: "projects",
    href: "/proyectos",
    title: "Obras",
    description: "Frentes de trabajo, ubicación, avance y estado operativo.",
    icon: FolderKanban,
    table: "projects",
    empty: "Aún no hay obras creadas.",
    fields: [
      { name: "name", label: "Obra", placeholder: "Viaducto norte", required: true },
      { name: "code", label: "Código de obra", placeholder: "OB-001" },
      { name: "location", label: "Ubicación", placeholder: "Bogotá" },
      { name: "due_date", label: "Fecha final", type: "date" },
      { name: "status", label: "Estado", enumKey: "projectStatus", options: ENUM_OPTIONS.projectStatus }
    ]
  },
  {
    key: "assets",
    href: "/activos",
    title: "Maquinaria",
    description: "Inventario, ubicación, vencimientos y estado operativo.",
    icon: Archive,
    table: "assets",
    empty: "Aún no hay maquinaria registrada.",
    fields: [
      { name: "name", label: "Máquina", placeholder: "Excavadora principal", required: true },
      { name: "code", label: "Código interno", placeholder: "EQ-001", required: true },
      // Tercer campo a propósito: las columnas del listado son los 4 primeros
      // campos declarados (ver visibleColumns en components/module-page.tsx),
      // así que poner el proyecto aquí es lo que hace que al BUSCAR un equipo
      // se vea de inmediato a qué obra pertenece, sin abrir su ficha.
      // Opcional: un equipo en bodega o entre obras no pertenece a ninguna.
      { name: "project_id", label: "Proyecto relacionado", type: "uuid" },
      { name: "location", label: "Ubicación", placeholder: "Obra norte" },
      { name: "plate", label: "Placa", placeholder: "ABC-123" },
      { name: "brand", label: "Marca", placeholder: "Caterpillar" },
      { name: "model", label: "Modelo", placeholder: "320D" },
      { name: "year", label: "Año", type: "number", placeholder: "2022" },
      { name: "provider", label: "Proveedor", placeholder: "Proveedor SAS" },
      { name: "hour_meter", label: "Horómetro", type: "number", placeholder: "1250" },
      { name: "next_maintenance_date", label: "Próximo mantenimiento", type: "date" },
      { name: "insurance_expiration", label: "Vence póliza", type: "date" },
      { name: "technical_certificate_expiration", label: "Vence certificado", type: "date" },
      { name: "status", label: "Estado", enumKey: "assetStatus", options: ENUM_OPTIONS.assetStatus }
    ]
  },
  {
    key: "maintenance_records",
    href: "/mantenimientos",
    title: "Mantenimientos",
    description: "Planificación preventiva, correctiva y seguimiento de costos.",
    icon: CalendarCheck,
    table: "maintenance_records",
    empty: "Aún no hay mantenimientos programados.",
    fields: [
      { name: "title", label: "Actividad", placeholder: "Cambio de filtros", required: true },
      { name: "asset_id", label: "Activo relacionado", type: "uuid", required: true },
      { name: "project_id", label: "Proyecto relacionado", type: "uuid" },
      { name: "type", label: "Tipo", enumKey: "maintenanceType", options: ENUM_OPTIONS.maintenanceType },
      { name: "description", label: "Descripción", placeholder: "Detalle del trabajo realizado" },
      { name: "cost", label: "Costo", type: "number", placeholder: "0" },
      { name: "responsible_name", label: "Responsable", placeholder: "Laura Gómez" },
      { name: "due_date", label: "Fecha programada", type: "date" },
      { name: "status", label: "Estado", enumKey: "maintenanceStatus", options: ENUM_OPTIONS.maintenanceStatus }
    ]
  },
  {
    key: "incidents",
    href: "/novedades",
    title: "Novedades",
    description: "Reportes móviles, prioridades, estados y seguimiento.",
    icon: Siren,
    table: "incidents",
    empty: "Aún no hay novedades registradas.",
    fields: [
      { name: "title", label: "Novedad", placeholder: "Fuga hidráulica", required: true },
      { name: "asset_id", label: "Activo relacionado", type: "uuid", required: true },
      { name: "project_id", label: "Proyecto relacionado", type: "uuid" },
      { name: "description", label: "Descripción", placeholder: "Detalle de lo ocurrido" },
      { name: "priority", label: "Prioridad", enumKey: "incidentPriority", options: ENUM_OPTIONS.incidentPriority },
      { name: "status", label: "Estado", enumKey: "incidentStatus", options: ENUM_OPTIONS.incidentStatus },
      { name: "location", label: "Ubicación", placeholder: "Obra norte" }
    ]
  },
  {
    key: "asset_documents",
    href: "/documentos",
    title: "Documentos",
    description: "Polizas, certificados, licencias, manuales y evidencias.",
    icon: FileText,
    table: "asset_documents",
    empty: "Aún no hay documentos cargados.",
    fields: [
      { name: "title", label: "Documento", placeholder: "Certificado tecnico", required: true },
      { name: "asset_id", label: "Activo relacionado", type: "uuid", required: true },
      { name: "project_id", label: "Proyecto relacionado", type: "uuid" },
      { name: "maintenance_record_id", label: "Mantenimiento relacionado", type: "uuid" },
      { name: "type", label: "Tipo", enumKey: "documentType", options: ENUM_OPTIONS.documentType },
      { name: "expires_at", label: "Fecha de vencimiento", type: "date" },
      { name: "status", label: "Estado", options: ENUM_OPTIONS.recordStatus }
    ]
  },
  {
    key: "informes",
    href: "/informes",
    title: "Informes",
    description: "Reportes profesionales en PDF o Excel con datos filtrados.",
    icon: BarChart3,
    table: "generated_reports",
    empty: "Aún no hay informes generados.",
    fields: []
  },
  {
    key: "technical_reports",
    href: "/informes-tecnicos",
    title: "Informes técnicos",
    description: "Informes operativos y entregables al cliente con firma y evidencias.",
    icon: FileText,
    table: "generated_reports",
    empty: "Aún no hay informes técnicos generados.",
    fields: []
  },
  {
    key: "users",
    href: "/usuarios",
    title: "Usuarios",
    description: "Perfiles, roles y acceso por empresa.",
    icon: UsersRound,
    table: "users",
    empty: "Aún no hay usuarios internos.",
    fields: [
      { name: "full_name", label: "Nombre", placeholder: "Ana Pérez", required: true },
      { name: "email", label: "Correo", type: "email", placeholder: "ana@empresa.com" },
      { name: "role", label: "Rol", enumKey: "appRole", options: ENUM_OPTIONS.appRole }
    ]
  }
];

export function getModuleByHref(href: string) {
  return modules.find((module) => module.href === href);
}

export function getModuleByKey(key: ModuleKey) {
  return modules.find((module) => module.key === key);
}
