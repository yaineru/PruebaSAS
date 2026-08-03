"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, Loader, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SendReportEmailModal } from "@/components/send-report-email-modal";
import type { GeneratedReport } from "@/lib/reports";
import { REPORT_ENTITY_LABELS } from "@/lib/reports/entity-labels";

type Props = {
  companyId: string;
};

function humanizeReportError(rawMessage: string | null | undefined): string {
  if (!rawMessage) return "No se pudo generar el informe.";
  const message = rawMessage.toLowerCase();

  if (message.includes("bucket not found")) {
    return "No se pudo guardar el archivo. Contacta a soporte.";
  }
  if (message.includes("invalid input syntax") || message.includes("insert into")) {
    return "Error interno al guardar el informe. Contacta a soporte.";
  }
  if (rawMessage.startsWith("No se pudo") || rawMessage.startsWith("Error")) {
    return rawMessage;
  }
  return "No se pudo generar el informe. Intenta de nuevo o contacta a soporte.";
}

export function ReportList({ companyId }: Props) {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [emailingReport, setEmailingReport] = useState<GeneratedReport | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadReports = async () => {
      try {
        const { data, error } = await supabase
          .from("generated_reports")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        setReports(
          (data || []).map((row) => mapReportRow(row))
        );
      } catch (error) {
        console.error("Failed to load reports", error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`reports-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generated_reports",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setReports((prev) => [mapReportRow(payload.new), ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setReports((prev) =>
              prev.map((r) => (r.id === payload.new.id ? mapReportRow(payload.new) : r))
            );
          } else if (payload.eventType === "DELETE") {
            setReports((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [companyId, supabase]);

  const mapReportRow = (row: Record<string, unknown>): GeneratedReport => ({
    id: row.id as string,
    companyId: row.company_id as string,
    templateId: (row.schedule_id ?? row.template_id ?? null) as string | null,
    reportType: (row.report_type ?? row.reportEntity ?? "ASSETS") as GeneratedReport["reportType"],
    fileFormat: (row.report_format ?? row.file_format ?? "PDF") as GeneratedReport["fileFormat"],
    filePath: (row.file_path ?? null) as string | null,
    fileSize: (row.file_size_bytes ?? row.fileSize ?? null) as number | null,
    url: (row.file_url ?? row.url ?? null) as string | null,
    filtersApplied: (row.filters ?? row.filters_applied ?? {}) as Record<string, unknown>,
    rowCount: (row.record_count ?? row.row_count ?? 0) as number,
    generatedBy: (row.generated_by ?? row.generatedBy ?? "") as string,
    expiresAt: null,
    status:
      row.status === "READY" || row.status === "GENERATED"
        ? "GENERATED"
        : ((row.status ?? "GENERATING") as GeneratedReport["status"]),
    errorMessage: (row.error_message ?? row.errorMessage ?? null) as string | null,
    createdAt: (row.created_at ?? row.createdAt ?? new Date().toISOString()) as string,
    updatedAt: (row.updated_at ?? row.updatedAt ?? row.created_at ?? new Date().toISOString()) as string,
  });

  const handleDelete = async (reportId: string) => {
    if (!confirm("¿Eliminar este informe?")) return;

    setDeleting(reportId);
    try {
      const response = await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId })
      });

      if (!response.ok) throw new Error("Failed to delete");

      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error) {
      console.error("Failed to delete report", error);
      alert("Error al eliminar informe");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "GENERATED":
        return <Badge className="bg-green-100 text-green-800">Listo</Badge>;
      case "GENERATING":
        return <Badge className="bg-blue-100 text-blue-800">Generando...</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // The signed URL persisted on the report row at generation time expires
  // after 1 hour, so opening/downloading always re-signs a fresh one instead
  // of trusting `report.url` for anything older than that.
  const resolveDownloadUrl = async (reportId: string): Promise<string | null> => {
    const response = await fetch(`/api/reports/${reportId}/download`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.downloadUrl ?? null;
  };

  const handleOpenReport = async (report: GeneratedReport) => {
    try {
      const downloadUrl = await resolveDownloadUrl(report.id);
      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Failed to open report", error);
    }
  };

  const handleDownloadReport = async (report: GeneratedReport) => {
    try {
      const downloadUrl = await resolveDownloadUrl(report.id);
      if (downloadUrl) {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${report.reportType || "informe"}.${report.fileFormat === "PDF" ? "pdf" : "xlsx"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Failed to download report", error);
    }
  };

  const getReportLabel = (report: GeneratedReport) =>
    String(report.reportType) === "TECHNICAL_REPORT"
      ? "Informe técnico"
      : REPORT_ENTITY_LABELS[report.reportType as keyof typeof REPORT_ENTITY_LABELS] ?? String(report.reportType);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Cargando informes...</p>
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay informes generados aún</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu primer informe usando el formulario anterior
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informes Generados</CardTitle>
        <CardDescription>Historial de informes disponibles para descargar</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Tamaño</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{getReportLabel(report)}</TableCell>
                  <TableCell>{report.fileFormat === "EXCEL" ? "Excel" : report.fileFormat}</TableCell>
                  <TableCell>{getStatusBadge(report.status)}</TableCell>
                  <TableCell className="text-right">{report.rowCount}</TableCell>
                  <TableCell className="text-right">{formatFileSize(report.fileSize)}</TableCell>
                  <TableCell>{formatDate(report.createdAt)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {(report.status === "GENERATED" || report.status === "READY") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReport(report)}
                        >
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownloadReport(report)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Descargar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEmailingReport(report)}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Enviar por correo
                        </Button>
                      </>
                    )}
                    {report.status === "FAILED" && (
                      <span className="text-xs text-destructive">{humanizeReportError(report.errorMessage)}</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(report.id)}
                      disabled={deleting === report.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {emailingReport && (
        <SendReportEmailModal
          reportId={emailingReport.id}
          reportLabel={`${getReportLabel(emailingReport)} (${emailingReport.fileFormat === "EXCEL" ? "Excel" : emailingReport.fileFormat})`}
          onClose={() => setEmailingReport(null)}
        />
      )}
    </Card>
  );
}
