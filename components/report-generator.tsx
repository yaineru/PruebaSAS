"use client";

import { useState } from "react";
import { generateReport } from "@/lib/actions/reports";
import { ReportGeneratedModal } from "@/components/report-generated-modal";
import { AdvancedFilters } from "@/components/advanced-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, FileJson, Loader } from "lucide-react";
import type { ReportEntity } from "@/lib/reports";
import { getTemplateColorLabel, resolveTemplateColorHex } from "@/lib/reports/color-palette";

type ReportTemplateOption = {
  id: string;
  name: string;
  color_scheme: string | null;
};

type Props = {
  companyId: string;
  templates?: ReportTemplateOption[];
  businessLabels?: {
    assetLabel: string;
    maintenanceLabel: string;
    projectLabel: string;
    incidentLabel: string;
  };
};

type FormState = {
  success: boolean;
  error?: string;
  message?: string;
  reportId?: string;
  fileName?: string;
  recordCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  format?: string;
};

const REPORT_TYPES: Array<{ value: ReportEntity; label: string; description: string }> = [
  { value: "ASSETS", label: "Equipos", description: "Inventario y estado de equipos" },
  { value: "MAINTENANCE", label: "Mantenimientos", description: "Registro de mantenimientos realizados" },
  { value: "INCIDENTS", label: "Novedades", description: "Incidentes y problemas reportados" },
  { value: "PROJECTS", label: "Proyectos", description: "Estado y progreso de proyectos" },
  { value: "DOCUMENTS", label: "Documentos", description: "Documentos vencidos o próximos a vencer" }
];

const defaultLabels = {
  assetLabel: "Equipos",
  maintenanceLabel: "Mantenimientos",
  projectLabel: "Proyectos",
  incidentLabel: "Novedades"
};

export function ReportGenerator({ templates = [], businessLabels = defaultLabels }: Props) {
  const [state, setState] = useState<FormState>({ success: false });
  const [isPending, setIsPending] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportEntity | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string | null>>({});
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("standard");

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    try {
      const result = await generateReport(formData);
      
      if (result.success) {
        setState({
          ...result,
          success: true,
        });
        setShowModal(true);
      } else {
        setState({
          success: false,
          error: result.error || "Error inesperado al generar el informe",
        });
      }
    } catch (error) {
      console.error("Report generation request failed", error);
      setState({
        success: false,
        error: "Error inesperado al generar el informe",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Generated Modal */}
      {state.reportId && (
        <ReportGeneratedModal
          reportId={state.reportId}
          fileName={state.fileName || ''}
          downloadUrl={state.downloadUrl}
          recordCount={state.recordCount}
          fileSize={state.fileSize}
          format={state.format}
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setState({ success: false });
            setSelectedReportType(null);
            setAdvancedFilters({});
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generar Nuevo Informe</CardTitle>
          <CardDescription>
            Selecciona el tipo de informe, formato y filtros para descargar datos profesionales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await handleSubmit(formData);
          }} className="space-y-6">
            {/* Report Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tipo de Informe</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {REPORT_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-start space-x-3 p-3 border-2 border-transparent rounded-lg hover:border-primary cursor-pointer transition"
                  >
                    <input
                      type="radio"
                      name="reportEntity"
                      value={type.value}
                      required
                      onChange={(e) => setSelectedReportType(e.target.value as ReportEntity)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* File Format Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Formato de Descarga</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center space-x-3 p-3 border-2 border-transparent rounded-lg hover:border-primary cursor-pointer transition">
                  <input
                    type="radio"
                    name="reportFormat"
                    value="PDF"
                    required
                    defaultChecked
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">PDF</div>
                    <div className="text-sm text-muted-foreground">Profesional, imprimible</div>
                  </div>
                </label>
                <label className="flex items-center space-x-3 p-3 border-2 border-transparent rounded-lg hover:border-primary cursor-pointer transition">
                  <input
                    type="radio"
                    name="reportFormat"
                    value="EXCEL"
                    required
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">Excel</div>
                    <div className="text-sm text-muted-foreground">Editable, analizable</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Plantilla de informe */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Plantilla</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition ${
                    selectedTemplateId === "standard" ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="templateSelector"
                    checked={selectedTemplateId === "standard"}
                    onChange={() => setSelectedTemplateId("standard")}
                  />
                  <span className="flex-1 text-sm font-medium">Estándar</span>
                </label>
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition ${
                      selectedTemplateId === template.id ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="templateSelector"
                      checked={selectedTemplateId === template.id}
                      onChange={() => setSelectedTemplateId(template.id)}
                    />
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: resolveTemplateColorHex(template.color_scheme) }}
                    />
                    <span className="flex-1 text-sm font-medium truncate">{template.name}</span>
                    <span className="text-xs text-muted-foreground">{getTemplateColorLabel(template.color_scheme)}</span>
                  </label>
                ))}
              </div>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aún no tienes plantillas personalizadas. Crea una en Admin → Plantillas de informes.
                </p>
              )}
            </div>
            <input
              type="hidden"
              name="templateName"
              value={selectedTemplateId === "standard" ? "standard" : (templates.find((t) => t.id === selectedTemplateId)?.name || "standard")}
            />
            {selectedTemplateId !== "standard" && (
              <input type="hidden" name="templateId" value={selectedTemplateId} />
            )}

            {/* Advanced Filters */}
            {selectedReportType && (
              <>
                <AdvancedFilters
                  reportType={selectedReportType}
                  onFiltersChange={setAdvancedFilters}
                  businessLabels={businessLabels}
                />
                {/* Hidden inputs for advanced filters */}
                {Object.entries(advancedFilters).map(([key, value]) => (
                  value && (
                    <input
                      key={key}
                      type="hidden"
                      name={`filter_${key}`}
                      value={value}
                    />
                  )
                ))}
              </>
            )}

            {/* Status Messages */}
            {state.error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">{state.error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full"
              size="default"
            >
              {isPending ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Generando informe...
                </>
              ) : (
                <>
                  <FileJson className="mr-2 h-4 w-4" />
                  Generar Informe
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">💡 Consejos para reportes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Los informes se generan en tiempo real con datos filtrados</p>
          <p>• Formato PDF ideal para compartir vía email o imprimir</p>
          <p>• Formato Excel permite análisis y gráficos adicionales</p>
          <p>• Los informes expiran después de 30 días</p>
        </CardContent>
      </Card>
    </div>
  );
}
