/**
 * Report utilities - Non-server functions for report processing
 */

import { REPORT_COLUMN_TEMPLATES, formatColumnValue, type ReportEntityKey } from './column-templates';

/**
 * Format report data for display
 * Applies the whitelist column template for the entity: never exposes
 * internal columns (metadata, company_id, created_by, updated_by, deleted_at)
 * and resolves labels/formats (fechas, moneda, enums traducidos).
 */
export function formatReportData(
  data: Record<string, unknown>[],
  reportEntity: string
): { columns: string[]; data: Record<string, string>[] } {
  try {
    const template = REPORT_COLUMN_TEMPLATES[reportEntity as ReportEntityKey];

    if (!template || !data || data.length === 0) {
      return { columns: [], data: [] };
    }

    const columns = template.columns.map((column) => column.label);

    const formattedData = data.map((row) => {
      const formatted: Record<string, string> = {};
      template.columns.forEach((column) => {
        formatted[column.label] = formatColumnValue(row, column);
      });
      return formatted;
    });

    return { columns, data: formattedData };
  } catch (error) {
    console.error('REPORT_FORMAT_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      dataLength: data?.length,
    });
    return { columns: [], data: [] };
  }
}
