import { z } from "zod";

export type ReportEntity = "ASSETS" | "MAINTENANCE" | "INCIDENTS" | "PROJECTS" | "DOCUMENTS";
export type ReportFormat = "PDF" | "EXCEL" | "BOTH";

export type ReportTemplate = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  templateType: ReportFormat;
  reportEntity: ReportEntity;
  filterConfig: Record<string, unknown>;
  columnConfig: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedReport = {
  id: string;
  companyId: string;
  templateId: string | null;
  reportType: ReportEntity;
  fileFormat: ReportFormat;
  filePath: string | null;
  fileSize: number | null;
  url: string | null;
  filtersApplied: Record<string, unknown>;
  rowCount: number;
  generatedBy: string;
  expiresAt: string | null;
  status: "GENERATING" | "GENERATED" | "FAILED" | "READY" | "EXPIRED";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportFilters = {
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string; // YYYY-MM-DD
  projectId?: string;
  assetId?: string;
  responsibleId?: string;
  status?: string;
  priority?: string;
  incidentStatus?: string;
};

export const reportFilterSchema = z.object({
  dateStart: z.string().date().optional(),
  dateEnd: z.string().date().optional(),
  projectId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  incidentStatus: z.string().optional()
});

export const generateReportSchema = z.object({
  reportType: z.enum(["ASSETS", "MAINTENANCE", "INCIDENTS", "PROJECTS", "DOCUMENTS"]),
  fileFormat: z.enum(["PDF", "EXCEL"]),
  filters: reportFilterSchema,
  templateId: z.string().uuid().optional()
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// Evidence types
export type MaintenanceWithEvidence = {
  id: string;
  title: string;
  status: string;
  maintenanceDate: string;
  evidenceBeforeUrl: string | null;
  evidenceAfterUrl: string | null;
  observations: string | null;
};

export type IncidentWithEvidence = {
  id: string;
  title: string;
  status: string;
  reportedAt: string;
  evidenceBeforeUrl: string | null;
  evidenceAfterUrl: string | null;
  observations: string | null;
};

