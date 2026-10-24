import { describe, expect, it } from "vitest";
import {
  buildReportFolderTree,
  classifyReport,
  yearMonthFromDateOnly,
  yearMonthFromTimestamp,
  type FolderReportInput,
} from "@/lib/reports/report-folders";

describe("yearMonthFromDateOnly (fecha de ejecución de informes técnicos)", () => {
  it("lee año y mes directo de los dígitos, sin pasar por Date()", () => {
    expect(yearMonthFromDateOnly("2026-01-31")).toEqual({ year: 2026, month: 1 });
    expect(yearMonthFromDateOnly("2026-12-01")).toEqual({ year: 2026, month: 12 });
  });

  it("el último día del mes no se corre al mes siguiente por una conversión UTC->local", () => {
    // new Date("2026-01-31") se interpreta como medianoche UTC; en
    // America/Bogota (UTC-5) eso cae el 30 a las 7pm - si esta función
    // pasara por Date() el resultado sería {year:2026, month:1} igual por
    // coincidencia de mes, así que se prueba también el límite de año.
    expect(yearMonthFromDateOnly("2025-12-31")).toEqual({ year: 2025, month: 12 });
    expect(yearMonthFromDateOnly("2026-01-01")).toEqual({ year: 2026, month: 1 });
  });

  it("valores inválidos o vacíos devuelven null, nunca un bucket inventado", () => {
    expect(yearMonthFromDateOnly(null)).toBeNull();
    expect(yearMonthFromDateOnly("")).toBeNull();
    expect(yearMonthFromDateOnly("no-es-fecha")).toBeNull();
    expect(yearMonthFromDateOnly("2026-13-01")).toBeNull();
  });
});

describe("yearMonthFromTimestamp (created_at de exportaciones generales)", () => {
  it("agrupa en la zona horaria de la app (America/Bogota), no UTC", () => {
    // 2026-01-31 23:30 hora de Bogotá (UTC-5) = 2026-02-01 04:30 UTC.
    const bogota2330Jan31 = "2026-02-01T04:30:00.000Z";
    expect(yearMonthFromTimestamp(bogota2330Jan31)).toEqual({ year: 2026, month: 1 });
  });

  it("un timestamp claramente dentro de un mes se agrupa en ese mes", () => {
    expect(yearMonthFromTimestamp("2026-06-15T12:00:00.000Z")).toEqual({ year: 2026, month: 6 });
  });

  it("cruce de año: 31 de diciembre tarde en Bogotá sigue siendo diciembre, no enero", () => {
    // 2025-12-31 22:00 Bogotá = 2026-01-01 03:00 UTC.
    expect(yearMonthFromTimestamp("2026-01-01T03:00:00.000Z")).toEqual({ year: 2025, month: 12 });
  });

  it("valores inválidos o vacíos devuelven null", () => {
    expect(yearMonthFromTimestamp(null)).toBeNull();
    expect(yearMonthFromTimestamp("no-es-fecha")).toBeNull();
  });
});

function makeReport(overrides: Partial<FolderReportInput>): FolderReportInput {
  return {
    id: overrides.id ?? "r1",
    reportType: overrides.reportType ?? "TECHNICAL_REPORT",
    createdAt: overrides.createdAt ?? "2026-06-01T12:00:00.000Z",
    projectId: overrides.projectId ?? null,
    reportDate: overrides.reportDate ?? null,
    folderYear: overrides.folderYear ?? null,
    folderMonth: overrides.folderMonth ?? null,
  };
}

describe("classifyReport", () => {
  it("informe técnico CON project_id real -> categoría 'project'", () => {
    const result = classifyReport(makeReport({ projectId: "p1", reportDate: "2026-03-10" }));
    expect(result.category).toBe("project");
    expect(result.bucket).toEqual({ year: 2026, month: 3 });
  });

  it("informe técnico SIN project_id -> 'unassigned_technical', nunca se inventa un proyecto", () => {
    const result = classifyReport(makeReport({ projectId: null, reportDate: "2026-03-10" }));
    expect(result.category).toBe("unassigned_technical");
  });

  it("exportación general (no TECHNICAL_REPORT) -> siempre 'general', aunque tenga project_id", () => {
    const result = classifyReport(makeReport({ reportType: "ASSETS", projectId: "p1" }));
    expect(result.category).toBe("general");
  });

  it("informe técnico usa reportDate para el bucket, no created_at, cuando ambos existen y difieren", () => {
    const result = classifyReport(
      makeReport({ reportDate: "2026-01-05", createdAt: "2026-02-20T12:00:00.000Z", projectId: "p1" })
    );
    expect(result.bucket).toEqual({ year: 2026, month: 1 });
  });

  it("informe técnico sin reportDate cae de vuelta a created_at (en vez de quedar sin carpeta)", () => {
    const result = classifyReport(makeReport({ reportDate: null, createdAt: "2026-02-20T12:00:00.000Z" }));
    expect(result.bucket).toEqual({ year: 2026, month: 2 });
  });

  it("exportación general siempre usa created_at (es el único dato de fecha que tiene)", () => {
    const result = classifyReport(makeReport({ reportType: "MAINTENANCE", createdAt: "2026-05-01T12:00:00.000Z" }));
    expect(result.bucket).toEqual({ year: 2026, month: 5 });
  });

  it("reclasificación manual (folderYear/folderMonth) gana sobre reportDate para un informe técnico", () => {
    const result = classifyReport(
      makeReport({ reportDate: "2026-01-05", folderYear: 2026, folderMonth: 9, projectId: "p1" })
    );
    expect(result.bucket).toEqual({ year: 2026, month: 9 });
    // La categoría (a qué proyecto pertenece) no cambia por mover de carpeta.
    expect(result.category).toBe("project");
  });

  it("reclasificación manual gana sobre created_at para una exportación general", () => {
    const result = classifyReport(
      makeReport({ reportType: "ASSETS", createdAt: "2026-05-01T12:00:00.000Z", folderYear: 2025, folderMonth: 12 })
    );
    expect(result.bucket).toEqual({ year: 2025, month: 12 });
    expect(result.category).toBe("general");
  });

  it("solo folderYear o solo folderMonth (no ambos) se ignora - evita un bucket a medias", () => {
    const onlyYear = classifyReport(makeReport({ folderYear: 2026, folderMonth: null, reportDate: "2026-03-10" }));
    expect(onlyYear.bucket).toEqual({ year: 2026, month: 3 }); // cae a reportDate, no a un mes inventado
    const onlyMonth = classifyReport(makeReport({ folderYear: null, folderMonth: 9, reportDate: "2026-03-10" }));
    expect(onlyMonth.bucket).toEqual({ year: 2026, month: 3 });
  });
});

describe("buildReportFolderTree", () => {
  it("cada informe aparece exactamente una vez: sin duplicados, sin pérdidas, entre las 3 ramas", () => {
    const reports: FolderReportInput[] = [
      makeReport({ id: "a", projectId: "p1", reportDate: "2026-01-10" }),
      makeReport({ id: "b", projectId: "p1", reportDate: "2026-02-10" }),
      makeReport({ id: "c", projectId: null, reportDate: "2026-01-10" }),
      makeReport({ id: "d", reportType: "ASSETS", createdAt: "2026-01-10T12:00:00.000Z" }),
    ];
    const tree = buildReportFolderTree(reports, new Map([["p1", "Frutos Verdes"]]));

    expect(tree.totalCount).toBe(4);
    const allIds = [
      ...tree.projects.flatMap((p) => Array.from(p.years.values()).flatMap((m) => Array.from(m.values()).flat())),
      ...Array.from(tree.unassignedTechnical.years.values()).flatMap((m) => Array.from(m.values()).flat()),
      ...Array.from(tree.general.years.values()).flatMap((m) => Array.from(m.values()).flat()),
    ].map((r) => r.id);
    expect(allIds.sort()).toEqual(["a", "b", "c", "d"]);
    expect(new Set(allIds).size).toBe(4); // sin duplicados
  });

  it("dos proyectos con nombres parecidos quedan en carpetas separadas por id, no se fusionan por nombre", () => {
    const reports: FolderReportInput[] = [
      makeReport({ id: "a", projectId: "p1", reportDate: "2026-01-10" }),
      makeReport({ id: "b", projectId: "p2", reportDate: "2026-01-10" }),
    ];
    const names = new Map([
      ["p1", "Obra Verbena"],
      ["p2", "Verbena"],
    ]);
    const tree = buildReportFolderTree(reports, names);
    expect(tree.projects).toHaveLength(2);
    expect(tree.projects.map((p) => p.projectName).sort()).toEqual(["Obra Verbena", "Verbena"]);
  });

  it("dos informes con el mismo nombre de tipo pero ids distintos no se colapsan en uno solo", () => {
    const reports: FolderReportInput[] = [
      makeReport({ id: "a", reportType: "TECHNICAL_REPORT", projectId: "p1", reportDate: "2026-01-10" }),
      makeReport({ id: "b", reportType: "TECHNICAL_REPORT", projectId: "p1", reportDate: "2026-01-15" }),
    ];
    const tree = buildReportFolderTree(reports, new Map([["p1", "Frutos Verdes"]]));
    const january = tree.projects[0].years.get(2026)!.get(1)!;
    expect(january.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("proyecto sin informes no aparece en el árbol (no se inventan carpetas vacías)", () => {
    const tree = buildReportFolderTree([], new Map([["p1", "Frutos Verdes"]]));
    expect(tree.projects).toHaveLength(0);
    expect(tree.totalCount).toBe(0);
  });

  it("un project_id que no resuelve nombre (no vino en projectNames) no genera una carpeta fantasma", () => {
    // Esto refleja lo que ya hace lib/actions/report-folders.ts: si el
    // project_id no resolvió nombre (ajeno a la empresa, o huérfano), la
    // fila llega aquí con projectId ya en null - esta prueba confirma que,
    // en ese caso, cae a "unassigned_technical" en vez de crear una carpeta
    // sin nombre verificado.
    const reports: FolderReportInput[] = [makeReport({ id: "a", projectId: null, reportDate: "2026-01-10" })];
    const tree = buildReportFolderTree(reports, new Map());
    expect(tree.projects).toHaveLength(0);
    expect(tree.unassignedTechnical.count).toBe(1);
  });
});
