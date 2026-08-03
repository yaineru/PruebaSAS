import { z } from 'zod';

/**
 * Report Types & Enums
 */

export const REPORT_ENTITY = {
  ASSETS: 'ASSETS',
  INCIDENTS: 'INCIDENTS',
  MAINTENANCE: 'MAINTENANCE',
  PROJECTS: 'PROJECTS',
  DOCUMENTS: 'DOCUMENTS',
  USERS: 'USERS',
  ANALYTICS: 'ANALYTICS',
} as const;

export const REPORT_FORMAT = {
  PDF: 'PDF',
  EXCEL: 'EXCEL',
  BOTH: 'BOTH',
} as const;

export const REPORT_FREQUENCY = {
  ONCE: 'ONCE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export const REPORT_STATUS = {
  GENERATING: 'GENERATING',
  GENERATED: 'GENERATED',
  FAILED: 'FAILED',
} as const;

export const REPORT_TEMPLATE_LAYOUTS = {
  STANDARD: 'standard',
  EXECUTIVE: 'executive',
  DETAILED: 'detailed',
  COMPARISON: 'comparison',
} as const;

/**
 * Report Types
 */

export interface ReportTemplate {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  layout_type: 'standard' | 'executive' | 'detailed' | 'comparison';
  color_scheme: string;
  include_logo: boolean;
  include_company_info: boolean;
  include_charts: boolean;
  include_data_table: boolean;
  include_summary: boolean;
  include_metrics: boolean;
  chart_types: string[];
  page_size: string;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  header_text?: string;
  footer_text?: string;
  custom_css?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  description?: string;
  report_type: string;
  report_entity: string;
  filters: Record<string, unknown>;
  frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  day_of_week?: number;
  day_of_month?: number;
  time_of_day: string;
  report_format: 'PDF' | 'EXCEL' | 'BOTH';
  template_name: string;
  include_charts: boolean;
  include_summary: boolean;
  enabled: boolean;
  email_recipients: string[];
  last_generated_at?: string;
  next_run_at?: string;
  total_runs: number;
  failed_runs: number;
  created_at: string;
  updated_at: string;
}

export interface GeneratedReport {
  id: string;
  company_id: string;
  generated_by: string;
  schedule_id?: string;
  report_type: string;
  report_entity: string;
  report_format: 'PDF' | 'EXCEL' | 'BOTH';
  template_name?: string;
  filters: Record<string, unknown>;
  record_count: number;
  file_size_bytes?: number;
  file_path?: string;
  file_url?: string;
  status: 'GENERATING' | 'GENERATED' | 'FAILED';
  error_message?: string;
  generation_time_ms?: number;
  created_at: string;
}

export interface ReportPreferences {
  id: string;
  company_id: string;
  user_id: string;
  default_format: 'PDF' | 'EXCEL';
  default_template: string;
  auto_include_charts: boolean;
  preferred_export_folder?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Report Generation Options
 */

export interface ReportGenerationOptions {
  reportEntity: string;
  reportFormat: 'PDF' | 'EXCEL' | 'BOTH';
  templateName?: string;
  filters?: Record<string, unknown>;
  includeCharts?: boolean;
  includeSummary?: boolean;
  data: Record<string, unknown>[];
  title: string;
  businessLabels?: Record<string, string>;
}

export interface PDFOptions {
  title: string;
  author?: string;
  subject?: string;
  creationDate?: Date;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  logo?: string; // base64 or URL
  headerText?: string;
  footerText?: string;
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
}

export interface ExcelOptions {
  title: string;
  author?: string;
  subject?: string;
  sheets: {
    name: string;
    data: Record<string, unknown>[];
    columns?: string[];
  }[];
  autoFilter?: boolean;
  freezePane?: boolean;
  styling?: boolean;
}

/**
 * Zod Schemas for Validation
 */

export const reportTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  layout_type: z.enum(['standard', 'executive', 'detailed', 'comparison']),
  color_scheme: z.string().default('blue'),
  include_logo: z.boolean().default(true),
  include_company_info: z.boolean().default(true),
  include_charts: z.boolean().default(true),
  include_data_table: z.boolean().default(true),
  include_summary: z.boolean().default(true),
  include_metrics: z.boolean().default(true),
  chart_types: z.array(z.string()).default(['line', 'bar']),
  page_size: z.enum(['A4', 'Letter', 'Legal']).default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  margin_top: z.number().positive().default(1.0),
  margin_bottom: z.number().positive().default(1.0),
  margin_left: z.number().positive().default(0.75),
  margin_right: z.number().positive().default(0.75),
  header_text: z.string().max(500).optional(),
  footer_text: z.string().max(500).optional(),
  custom_css: z.string().max(5000).optional(),
});

export const reportScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  report_entity: z.string().min(1),
  filters: z.record(z.any()).optional(),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']),
  day_of_week: z.number().min(0).max(6).optional(),
  day_of_month: z.number().min(1).max(31).optional(),
  time_of_day: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  report_format: z.enum(['PDF', 'EXCEL', 'BOTH']),
  template_name: z.string().default('standard'),
  include_charts: z.boolean().default(true),
  include_summary: z.boolean().default(true),
  email_recipients: z.array(z.string().email()).default([]),
  enabled: z.boolean().default(true),
});

export const generateReportSchema = z.object({
  reportEntity: z.string().min(1),
  reportFormat: z.enum(['PDF', 'EXCEL', 'BOTH']),
  templateName: z.string().optional(),
  filters: z.record(z.any()).optional(),
  includeCharts: z.boolean().optional(),
  includeSummary: z.boolean().optional(),
});

export const reportPreferencesSchema = z.object({
  default_format: z.enum(['PDF', 'EXCEL']).optional(),
  default_template: z.string().optional(),
  auto_include_charts: z.boolean().optional(),
  preferred_export_folder: z.string().optional(),
});

/**
 * Report Template Presets
 */

export const BUILT_IN_TEMPLATES: Record<string, Partial<ReportTemplate>> = {
  standard: {
    name: 'Standard Report',
    slug: 'standard',
    layout_type: 'standard',
    include_charts: true,
    include_data_table: true,
    include_summary: true,
    include_metrics: false,
  },
  executive: {
    name: 'Executive Summary',
    slug: 'executive',
    layout_type: 'executive',
    include_charts: true,
    include_data_table: false,
    include_summary: true,
    include_metrics: true,
  },
  detailed: {
    name: 'Detailed Report',
    slug: 'detailed',
    layout_type: 'detailed',
    include_charts: true,
    include_data_table: true,
    include_summary: true,
    include_metrics: true,
  },
  comparison: {
    name: 'Comparison Report',
    slug: 'comparison',
    layout_type: 'comparison',
    include_charts: true,
    include_data_table: true,
    include_summary: false,
    include_metrics: true,
  },
};

/**
 * Utility Functions
 */

export function calculateNextRunAt(frequency: string, dayOfWeek?: number, dayOfMonth?: number, timeOfDay?: string): Date {
  const now = new Date();
  const [hours, minutes, seconds] = (timeOfDay || '09:00:00').split(':').map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, seconds, 0);

  switch (frequency) {
    case 'DAILY':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'WEEKLY':
      if (dayOfWeek !== undefined) {
        const daysUntilNextRun = (dayOfWeek - nextRun.getDay() + 7) % 7;
        nextRun.setDate(nextRun.getDate() + daysUntilNextRun);
        if (daysUntilNextRun === 0 && nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
      }
      break;

    case 'MONTHLY':
      if (dayOfMonth !== undefined) {
        nextRun.setDate(dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(dayOfMonth);
        }
      }
      break;

    case 'ONCE':
      // Single execution, already set
      break;
  }

  return nextRun;
}

export function isReportOverdue(nextRunAt: string): boolean {
  return new Date(nextRunAt) <= new Date();
}

export function formatReportFileName(reportEntity: string, format: 'PDF' | 'EXCEL', templateName?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const ext = format === 'PDF' ? 'pdf' : 'xlsx';
  const template = templateName ? `_${templateName}` : '';
  return `${reportEntity.toLowerCase()}${template}_${timestamp}.${ext}`;
}
