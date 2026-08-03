import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ModuleConfig } from "@/lib/modules";

export type CompanySettings = {
  companyId: string;
  companyName: string;
  businessType: string;
  assetLabel: string;
  maintenanceLabel: string;
  projectLabel: string;
  incidentLabel: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
};

export type BusinessLabels = Pick<
  CompanySettings,
  "assetLabel" | "maintenanceLabel" | "projectLabel" | "incidentLabel"
>;

export function defaultCompanySettings(companyId: string, companyName = "Empresa"): CompanySettings {
  return {
    companyId,
    companyName,
    businessType: "general",
    assetLabel: "Equipos",
    maintenanceLabel: "Mantenimientos",
    projectLabel: "Proyectos",
    incidentLabel: "Novedades",
    primaryColor: "#0f766e",
    secondaryColor: "#f59e0b",
    logoUrl: null
  };
}

// cache()d per-request for the same reason as getTenantContext() (lib/tenant.ts)
// - app-shell.tsx and every page under it both call this with the same
// (companyId, companyName) pair, doubling the company_settings lookup on
// every request otherwise.
export const getCompanySettings = cache(async (companyId: string, companyName?: string): Promise<CompanySettings> => {
  const fallback = defaultCompanySettings(companyId, companyName);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("company_settings")
      .select("company_id,company_name,business_type,asset_label,maintenance_label,project_label,incident_label,primary_color,secondary_color,logo_url")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn("Company settings lookup failed", error.message);
      return fallback;
    }

    return {
      companyId: data.company_id,
      companyName: data.company_name ?? fallback.companyName,
      businessType: data.business_type ?? fallback.businessType,
      assetLabel: data.asset_label ?? fallback.assetLabel,
      maintenanceLabel: data.maintenance_label ?? fallback.maintenanceLabel,
      projectLabel: data.project_label ?? fallback.projectLabel,
      incidentLabel: data.incident_label ?? fallback.incidentLabel,
      primaryColor: data.primary_color ?? fallback.primaryColor,
      secondaryColor: data.secondary_color ?? fallback.secondaryColor,
      logoUrl: data.logo_url ?? null
    };
  } catch (error) {
    console.warn("Company settings unavailable; using defaults", error);
    return fallback;
  }
});

export function getBusinessLabels(settings: CompanySettings): BusinessLabels {
  return {
    assetLabel: settings.assetLabel,
    maintenanceLabel: settings.maintenanceLabel,
    projectLabel: settings.projectLabel,
    incidentLabel: settings.incidentLabel
  };
}

export function applyCompanySettings(module: ModuleConfig, settings: CompanySettings): ModuleConfig {
  const asset = settings.assetLabel;
  const maintenance = settings.maintenanceLabel;
  const project = settings.projectLabel;
  const incident = settings.incidentLabel;

  const withRelationLabels = (fields: ModuleConfig["fields"]) =>
    fields.map((field) => {
      if (field.name === "asset_id") return { ...field, label: `${singularize(asset)} relacionado` };
      if (field.name === "project_id") return { ...field, label: `${singularize(project)} relacionado` };
      return field;
    });

  if (module.key === "assets") {
    return {
      ...module,
      title: asset,
      description: `Inventario, ubicación, vencimientos y estado operativo de ${asset.toLowerCase()}.`,
      empty: `Aún no hay ${asset.toLowerCase()} registrados.`,
      fields: withRelationLabels(module.fields).map((field) => {
        if (field.name === "name") return { ...field, label: singularize(asset), placeholder: `Nombre de ${singularize(asset).toLowerCase()}` };
        return field;
      })
    };
  }

  if (module.key === "maintenance_records") {
    return {
      ...module,
      title: maintenance,
      description: `Planificación, ejecución y seguimiento de ${maintenance.toLowerCase()}.`,
      empty: `Aún no hay ${maintenance.toLowerCase()} registrados.`,
      fields: withRelationLabels(module.fields)
    };
  }

  if (module.key === "projects") {
    return {
      ...module,
      title: project,
      description: `Gestión de ${project.toLowerCase()}, ubicación, avance y estado.`,
      empty: `Aún no hay ${project.toLowerCase()} creados.`,
      fields: withRelationLabels(module.fields).map((field) => {
        if (field.name === "name") return { ...field, label: singularize(project), placeholder: `Nombre de ${singularize(project).toLowerCase()}` };
        return field;
      })
    };
  }

  if (module.key === "incidents") {
    return {
      ...module,
      title: incident,
      description: `Registro, prioridad y seguimiento de ${incident.toLowerCase()}.`,
      empty: `Aún no hay ${incident.toLowerCase()} registradas.`,
      fields: withRelationLabels(module.fields).map((field) => {
        if (field.name === "title") return { ...field, label: singularize(incident), placeholder: `Nueva ${singularize(incident).toLowerCase()}` };
        return field;
      })
    };
  }

  return { ...module, fields: withRelationLabels(module.fields) };
}

function singularize(label: string) {
  const lower = label.toLowerCase();

  // "Novedades" -> "Novedad", "Solicitudes" -> "Solicitud": el plural de estas
  // palabras (terminan en consonante) agrega "es", no solo "s".
  if (lower.endsWith("des")) return label.slice(0, -2);

  // "Citaciones" -> "Citación": se quita "es" y el acento vuelve a la "o".
  if (lower.endsWith("ciones")) return `${label.slice(0, -6)}ción`;
  if (lower.endsWith("siones")) return `${label.slice(0, -6)}sión`;

  // "Órdenes" -> "Orden": caso irregular, el acento desaparece en singular.
  if (lower === "órdenes") return "Orden";

  // Caso general: el plural agrega solo "s" ("Alertas" -> "Alerta", "Incidentes" -> "Incidente").
  return label.endsWith("s") ? label.slice(0, -1) : label;
}
