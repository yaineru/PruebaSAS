"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moveReportToFolder,
  type AvailableProject,
  type SerializedReportEntry,
} from "@/lib/actions/report-folders";
import { MONTH_NAMES_ES, yearMonthFromDateOnly, yearMonthFromTimestamp } from "@/lib/reports/report-folders";

type Props = {
  report: SerializedReportEntry;
  availableProjects: AvailableProject[];
  onClose: () => void;
  onMoved: () => void;
};

// El selector de año necesita un rango concreto, no un número libre sin
// límites - cubre informes de hace varios años más uno hacia adelante
// (informes programados o con fecha de ejecución futura), y siempre incluye
// el año donde el informe está parado hoy, aunque caiga fuera de ese rango.
function buildYearOptions(currentEffectiveYear: number | null): number[] {
  const thisYear = new Date().getFullYear();
  const years = new Set<number>();
  for (let y = thisYear - 6; y <= thisYear + 1; y++) years.add(y);
  if (currentEffectiveYear) years.add(currentEffectiveYear);
  return Array.from(years).sort((a, b) => b - a);
}

export function MoveReportFolderModal({ report, availableProjects, onClose, onMoved }: Props) {
  // Si el informe ya tiene una reclasificación manual (folderYear/
  // folderMonth), el formulario arranca mostrando ESO - no la fecha
  // calculada automáticamente - para que abrir el diálogo dos veces seguidas
  // no parezca "olvidar" lo que ya se guardó. Si nunca se ha movido, arranca
  // mostrando dónde cae hoy por cálculo automático (reportDate o
  // created_at), para que el usuario vea el punto de partida real en vez de
  // un formulario vacío.
  const effective =
    report.folderYear != null && report.folderMonth != null
      ? { year: report.folderYear, month: report.folderMonth }
      : (report.reportDate ? yearMonthFromDateOnly(report.reportDate) : null) ??
        yearMonthFromTimestamp(report.createdAt);

  const [projectId, setProjectId] = useState(report.projectId ?? "");
  const [year, setYear] = useState<string>(String(effective?.year ?? new Date().getFullYear()));
  const [month, setMonth] = useState<string>(String(effective?.month ?? new Date().getMonth() + 1));
  const [isAutomatic, setIsAutomatic] = useState(report.folderYear == null || report.folderMonth == null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const yearOptions = buildYearOptions(effective?.year ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const result = await moveReportToFolder({
        reportId: report.id,
        projectId: projectId || null,
        year: isAutomatic ? null : Number(year),
        month: isAutomatic ? null : Number(month),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onMoved();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Mover a carpeta</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esto solo cambia en qué carpeta aparece el informe. No modifica su fecha real ni el contenido del PDF.
            </p>

            <div className="space-y-2">
              <Label htmlFor="move-project">Proyecto</Label>
              <select
                id="move-project"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Sin proyecto asignado</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Año y mes de la carpeta</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isAutomatic}
                    onChange={(e) => setIsAutomatic(e.target.checked)}
                  />
                  Usar fecha automática del informe
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  value={month}
                  disabled={isAutomatic}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {MONTH_NAMES_ES.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  value={year}
                  disabled={isAutomatic}
                  onChange={(e) => setYear(e.target.value)}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
