"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Folder, FolderOpen, FolderInput, Loader, Mail, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendReportEmailModal } from "@/components/send-report-email-modal";
import { MoveReportFolderModal } from "@/components/move-report-folder-modal";
import { formatDate } from "@/lib/utils";
import { REPORT_ENTITY_LABELS } from "@/lib/reports/entity-labels";
import { MONTH_NAMES_ES } from "@/lib/reports/report-folders";
import {
  getReportFolders,
  type ReportFoldersResult,
  type SerializedBucketGroup,
  type SerializedProjectFolder,
  type SerializedReportEntry,
  type SerializedYearMonth,
} from "@/lib/actions/report-folders";

type Props = { companyId: string };

type Crumb =
  | { level: "root" }
  | { level: "group"; groupKey: "project" | "unassigned" | "general"; label: string }
  | { level: "year"; groupKey: "project" | "unassigned" | "general"; label: string; year: number }
  | { level: "month"; groupKey: "project" | "unassigned" | "general"; label: string; year: number; month: number };

function getReportLabel(reportType: string): string {
  return reportType === "TECHNICAL_REPORT"
    ? "Informe técnico"
    : REPORT_ENTITY_LABELS[reportType as keyof typeof REPORT_ENTITY_LABELS] ?? reportType;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupCount(group: SerializedBucketGroup | SerializedProjectFolder): number {
  return group.count;
}

export function ReportFolders({ companyId }: Props) {
  const router = useRouter();
  void companyId; // el filtrado real ocurre en el servidor (getTenantContext), no aquí

  const [data, setData] = useState<ReportFoldersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [crumb, setCrumb] = useState<Crumb>({ level: "root" });
  const [emailingReportId, setEmailingReportId] = useState<string | null>(null);
  const [movingReport, setMovingReport] = useState<SerializedReportEntry | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadFolders = () => {
    setLoading(true);
    getReportFolders().then((result) => {
      setData(result);
      setLoading(false);
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReportFolders().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveDownloadUrl = async (reportId: string): Promise<string | null> => {
    const response = await fetch(`/api/reports/${reportId}/download`);
    if (!response.ok) return null;
    const json = await response.json();
    return json.downloadUrl ?? null;
  };

  const handleOpen = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const url = await resolveDownloadUrl(reportId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDownload = async (report: SerializedReportEntry) => {
    setBusyReportId(report.id);
    try {
      const url = await resolveDownloadUrl(report.id);
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${report.reportType || "informe"}.${report.reportFormat === "EXCEL" ? "xlsx" : "pdf"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      setBusyReportId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Cargando carpetas...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{!data ? "No fue posible cargar las carpetas." : data.error}</p>
        </CardContent>
      </Card>
    );
  }

  const { projects, unassignedTechnical, general, totalCount, availableProjects, canMove } = data.data;

  const findGroup = (key: "unassigned" | "general") => (key === "unassigned" ? unassignedTechnical : general);

  const breadcrumbItems: Array<{ label: string; onClick: () => void }> = [
    { label: "Informes", onClick: () => setCrumb({ level: "root" }) },
  ];
  if (crumb.level !== "root") {
    breadcrumbItems.push({
      label: crumb.label,
      onClick: () => setCrumb({ level: "group", groupKey: crumb.groupKey, label: crumb.label }),
    });
  }
  if (crumb.level === "year" || crumb.level === "month") {
    breadcrumbItems.push({
      label: String(crumb.year),
      onClick: () => setCrumb({ level: "year", groupKey: crumb.groupKey, label: crumb.label, year: crumb.year }),
    });
  }
  if (crumb.level === "month") {
    breadcrumbItems.push({
      label: MONTH_NAMES_ES[crumb.month - 1],
      onClick: () => setCrumb(crumb),
    });
  }

  const renderBreadcrumb = () => (
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground mb-4">
      {breadcrumbItems.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {index === breadcrumbItems.length - 1 ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <button type="button" className="hover:underline" onClick={item.onClick}>
              {item.label}
            </button>
          )}
        </span>
      ))}
    </div>
  );

  const renderReportRow = (report: SerializedReportEntry) => (
    <div
      key={report.id}
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{getReportLabel(report.reportType)}</p>
        <p className="text-xs text-muted-foreground">
          {/* reportDate es un valor de solo fecha ("YYYY-MM-DD") - formatDate
              lo ancla al día calendario correcto (ver su propio comentario en
              lib/utils.ts); formatDateOnly asume un momento real y lo
              reinterpreta en hora de Bogotá, lo que corría "2026-05-01" un
              día hacia atrás en pantalla (confirmado en vivo durante la
              verificación de esta función: la carpeta correcta era "Mayo"
              pero el texto decía "30/04/2026"). */}
          {report.reportDate
            ? `Fecha del informe: ${formatDate(report.reportDate)}`
            : `Creado: ${formatDate(report.createdAt)}`}
          {" · "}
          {report.reportFormat === "EXCEL" ? "Excel" : report.reportFormat}
          {" · "}
          {formatFileSize(report.fileSizeBytes)}
          {report.status === "FAILED" && (
            <>
              {" · "}
              <Badge className="bg-red-100 text-red-800">Error</Badge>
            </>
          )}
        </p>
      </div>
      {(report.status === "GENERATED" || report.status === "READY") && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <Button size="sm" variant="outline" disabled={busyReportId === report.id} onClick={() => handleOpen(report.id)}>
            Ver
          </Button>
          <Button size="sm" variant="secondary" disabled={busyReportId === report.id} onClick={() => handleDownload(report)}>
            <Download className="mr-2 h-4 w-4" />
            Descargar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEmailingReportId(report.id)}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar
          </Button>
          {report.reportType === "TECHNICAL_REPORT" && report.canCorrect && (
            <Button size="sm" variant="outline" onClick={() => router.push(`/informes-tecnicos?editId=${report.id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Corregir
            </Button>
          )}
          {canMove && (
            <Button size="sm" variant="outline" onClick={() => setMovingReport(report)}>
              <FolderInput className="mr-2 h-4 w-4" />
              Mover a carpeta
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const renderMonthList = (
    buckets: SerializedYearMonth[],
    groupKey: "project" | "unassigned" | "general",
    label: string,
    year: number
  ) => {
    const months = buckets.filter((b) => b.year === year);
    if (months.length === 0) {
      return <p className="text-sm text-muted-foreground py-6 text-center">No hay informes en este año.</p>;
    }
    return (
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {months.map((b) => (
          <button
            key={b.month}
            type="button"
            className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
            onClick={() => setCrumb({ level: "month", groupKey, label, year, month: b.month })}
          >
            <span className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              {MONTH_NAMES_ES[b.month - 1]}
            </span>
            <Badge variant="secondary">{b.reports.length}</Badge>
          </button>
        ))}
      </div>
    );
  };

  const renderYearList = (buckets: SerializedYearMonth[], groupKey: "project" | "unassigned" | "general", label: string) => {
    const years = Array.from(new Set(buckets.map((b) => b.year))).sort((a, b) => b - a);
    if (years.length === 0) {
      return <p className="text-sm text-muted-foreground py-6 text-center">No hay informes todavía.</p>;
    }
    return (
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {years.map((year) => {
          const count = buckets.filter((b) => b.year === year).reduce((acc, b) => acc + b.reports.length, 0);
          return (
            <button
              key={year}
              type="button"
              className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
              onClick={() => setCrumb({ level: "year", groupKey, label, year })}
            >
              <span className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                {year}
              </span>
              <Badge variant="secondary">{count}</Badge>
            </button>
          );
        })}
      </div>
    );
  };

  // ---- Nivel raíz: proyectos + "Sin proyecto asignado" + "Informes generales" ----
  if (crumb.level === "root") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Informes por carpeta</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalCount} informe{totalCount === 1 ? "" : "s"} en total, organizados por proyecto, año y mes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalCount === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay informes generados aún.</p>
          ) : (
            <>
              {projects.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Por proyecto</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((project) => (
                      <button
                        key={project.projectId}
                        type="button"
                        className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                        onClick={() =>
                          setCrumb({ level: "group", groupKey: "project", label: project.projectName })
                        }
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{project.projectName}</span>
                        </span>
                        <Badge variant="secondary">{groupCount(project)}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold">Otros informes</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                    onClick={() => setCrumb({ level: "group", groupKey: "unassigned", label: "Sin proyecto asignado" })}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      Sin proyecto asignado
                    </span>
                    <Badge variant="secondary">{groupCount(unassignedTechnical)}</Badge>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                    onClick={() => setCrumb({ level: "group", groupKey: "general", label: "Informes generales" })}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      Informes generales
                    </span>
                    <Badge variant="secondary">{groupCount(general)}</Badge>
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Para "project" se busca por projectName (único dato que el breadcrumb
  // conserva) - es un dato que el servidor ya resolvió y filtró por
  // company_id, no algo que el usuario pueda manipular, así que buscarlo
  // por nombre aquí no reabre ninguna puerta de seguridad.
  const resolvedGroup =
    crumb.groupKey === "project"
      ? projects.find((p) => p.projectName === crumb.label) ?? null
      : findGroup(crumb.groupKey);

  if (!resolvedGroup) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          {renderBreadcrumb()}
          <p className="text-muted-foreground">Esta carpeta ya no está disponible.</p>
        </CardContent>
      </Card>
    );
  }

  if (crumb.level === "group") {
    return (
      <Card>
        <CardContent className="pt-6">
          {renderBreadcrumb()}
          {renderYearList(resolvedGroup.buckets, crumb.groupKey, crumb.label)}
        </CardContent>
      </Card>
    );
  }

  if (crumb.level === "year") {
    return (
      <Card>
        <CardContent className="pt-6">
          {renderBreadcrumb()}
          {renderMonthList(resolvedGroup.buckets, crumb.groupKey, crumb.label, crumb.year)}
        </CardContent>
      </Card>
    );
  }

  // crumb.level === "month"
  const monthBucket = resolvedGroup.buckets.find((b) => b.year === crumb.year && b.month === crumb.month);
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        {renderBreadcrumb()}
        {!monthBucket || monthBucket.reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No hay informes en este mes.</p>
        ) : (
          monthBucket.reports.map(renderReportRow)
        )}
      </CardContent>
      {emailingReportId && (
        <SendReportEmailModal
          reportId={emailingReportId}
          reportLabel={getReportLabel(
            monthBucket?.reports.find((r) => r.id === emailingReportId)?.reportType ?? "TECHNICAL_REPORT"
          )}
          onClose={() => setEmailingReportId(null)}
        />
      )}
      {movingReport && (
        <MoveReportFolderModal
          report={movingReport}
          availableProjects={availableProjects}
          onClose={() => setMovingReport(null)}
          onMoved={() => {
            setMovingReport(null);
            // El informe puede haber cambiado de proyecto y/o de año/mes -
            // la vista en la que estábamos parados puede ya no contenerlo,
            // así que se vuelve a la raíz en vez de mostrar una carpeta que
            // podría quedar vacía o con el conteo desactualizado.
            setCrumb({ level: "root" });
            loadFolders();
          }}
        />
      )}
    </Card>
  );
}
