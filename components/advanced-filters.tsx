"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReportEntity } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENUM_OPTIONS } from "@/lib/enums";

type AdvancedFiltersProps = {
  reportType: ReportEntity | null;
  onFiltersChange: (filters: Record<string, string | null>) => void;
  businessLabels: {
    assetLabel: string;
    maintenanceLabel: string;
    projectLabel: string;
    incidentLabel: string;
  };
};

export function AdvancedFilters({ reportType, onFiltersChange, businessLabels }: AdvancedFiltersProps) {
  const [expanded, setExpanded] = useState(true);
  const [filters, setFilters] = useState<Record<string, string | null>>({
    dateStart: null,
    dateEnd: null,
    projectId: null,
    assetId: null,
    responsibleId: null,
    status: null,
    priority: null,
    incidentStatus: null
  });

  const handleFilterChange = (key: string, value: string | null) => {
    const updated = { ...filters, [key]: value || null };
    setFilters(updated);
    onFiltersChange(updated);
  };

  // Define available filters by report type
  const filtersByType: Record<ReportEntity, string[]> = {
    ASSETS: ["status", "projectId"],
    MAINTENANCE: ["dateStart", "dateEnd", "assetId", "status", "responsibleId"],
    INCIDENTS: ["dateStart", "dateEnd", "priority", "incidentStatus"],
    PROJECTS: ["dateStart", "dateEnd", "status"],
    DOCUMENTS: ["dateStart", "dateEnd", "assetId"]
  };

  const availableFilters = reportType ? filtersByType[reportType] : [];

  // El campo "status" es compartido entre ASSETS/MAINTENANCE/PROJECTS pero cada
  // una tiene su propio enum en la base de datos - antes se mostraban siempre las
  // opciones de mantenimiento (Pendiente/Programado/...) sin importar la entidad,
  // por lo que elegir un estado de activo o de proyecto nunca coincidía con nada.
  const statusOptionsByType: Partial<Record<ReportEntity, Array<{ value: string; label: string }>>> = {
    ASSETS: ENUM_OPTIONS.assetStatus.map((o) => ({ value: o.value, label: o.label })),
    MAINTENANCE: ENUM_OPTIONS.maintenanceStatus.map((o) => ({ value: o.value, label: o.label })),
    PROJECTS: ENUM_OPTIONS.projectStatus.map((o) => ({ value: o.value, label: o.label }))
  };

  const filterConfigs: Record<string, { label: string; type: "date" | "text" | "select"; options?: Array<{ value: string; label: string }> }> = {
    dateStart: {
      label: "Fecha inicial",
      type: "date"
    },
    dateEnd: {
      label: "Fecha final",
      type: "date"
    },
    projectId: {
      label: `${businessLabels.projectLabel} (ID)`,
      type: "text"
    },
    assetId: {
      label: `${businessLabels.assetLabel} (ID)`,
      type: "text"
    },
    responsibleId: {
      label: "Responsable (ID)",
      type: "text"
    },
    status: {
      label: "Estado",
      type: "select",
      options: (reportType && statusOptionsByType[reportType]) || []
    },
    priority: {
      label: "Prioridad",
      type: "select",
      options: ENUM_OPTIONS.incidentPriority.map((o) => ({ value: o.value, label: o.label }))
    },
    incidentStatus: {
      label: "Estado de novedad",
      type: "select",
      options: ENUM_OPTIONS.incidentStatus.map((o) => ({ value: o.value, label: o.label }))
    }
  };

  if (availableFilters.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Filtros avanzados</CardTitle>
            <CardDescription>Refina tu búsqueda con filtros específicos</CardDescription>
          </div>
          <ChevronDown
            className="h-5 w-5 transition-transform"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {availableFilters.map((filterKey) => {
              const config = filterConfigs[filterKey];
              if (!config) return null;

              return (
                <div key={filterKey} className="space-y-2">
                  <Label htmlFor={filterKey}>{config.label}</Label>

                  {config.type === "date" && (
                    <Input
                      id={filterKey}
                      type="date"
                      value={filters[filterKey] ?? ""}
                      onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                    />
                  )}

                  {config.type === "text" && (
                    <Input
                      id={filterKey}
                      type="text"
                      placeholder={`Ingresa ${config.label.toLowerCase()}`}
                      value={filters[filterKey] ?? ""}
                      onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                    />
                  )}

                  {config.type === "select" && config.options && (
                    <select
                      id={filterKey}
                      value={filters[filterKey] ?? ""}
                      onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleccionar</option>
                      {config.options.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setFilters({
                dateStart: null,
                dateEnd: null,
                projectId: null,
                assetId: null,
                responsibleId: null,
                status: null,
                priority: null,
                incidentStatus: null
              });
              onFiltersChange({});
            }}
          >
            Limpiar filtros
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
