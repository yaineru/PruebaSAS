/**
 * CSV Export Utility
 * Converts data to CSV format with proper escaping and encoding
 */

export type CSVRow = Record<string, string | number | boolean | null | undefined>;

/**
 * Escape CSV field values
 * Handles quotes, commas, and newlines
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return "";
  
  const stringValue = String(value);
  
  // If contains quote, comma, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV(
  data: CSVRow[],
  options: {
    headers?: string[];
    filename?: string;
  } = {}
): string {
  if (data.length === 0) {
    return "";
  }

  // Get headers from first row or use provided headers
  const headers = options.headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = headers.map(escapeCSVField).join(",");
  
  // Create data rows
  const dataRows = data.map((row) =>
    headers.map((header) => escapeCSVField(row[header])).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file to user's browser
 */
export function downloadCSV(
  data: CSVRow[],
  filename: string,
  options: {
    headers?: string[];
  } = {}
): void {
  const csv = convertToCSV(data, options);
  
  // Add BOM for Excel UTF-8 support
  const bom = "\uFEFF";
  const csvWithBom = bom + csv;
  
  // Create blob
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
  
  // Create temporary URL
  const url = URL.createObjectURL(blob);
  
  // Create and trigger download
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Format report data for CSV export
 */
export function formatReportForCSV(
  report: {
    id: string;
    type: string;
    format: string;
    status: string;
    rowCount?: number;
    fileSize?: number;
    createdAt: string;
    expiresAt?: string;
  },
  records: CSVRow[] = []
): { metadata: CSVRow; records: CSVRow[] } {
  const metadata: CSVRow = {
    "ID Reporte": report.id,
    "Tipo": report.type,
    "Formato": report.format,
    "Estado": report.status,
    "Registros": report.rowCount || 0,
    "Tamaño (bytes)": report.fileSize || 0,
    "Generado": report.createdAt,
    "Expira": report.expiresAt || "N/A",
    "Generado Por": "EmpresaOS",
    "Versión": "1.0"
  };

  return {
    metadata,
    records
  };
}
