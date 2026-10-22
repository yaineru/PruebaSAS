import { describe, expect, it } from "vitest";
import { coerceEnumValue, ENUM_OPTIONS, getEnumLabel } from "@/lib/enums";

// Progrúas S.A.S. (golden tenant) pidió agregar montaje/realce de torre grúa
// y montaje de malacate como "Tipo de actividad" seleccionable al crear un
// informe técnico. Ese campo es texto libre guardado en report_metadata
// (jsonb) - nunca pasa por el enum nativo de Postgres `maintenance_type`
// (maintenance_records.type), así que vive en su PROPIO catálogo
// (`technicalReportActivityType`), separado de `maintenanceType` (el que sí
// está atado 1:1 al enum de la base de datos para el módulo de
// Mantenimientos). Este test existe para que un cambio futuro no termine
// agregando estas tres actividades al catálogo equivocado - eso rompería
// el módulo de Mantenimientos en producción, porque Postgres rechazaría
// cualquier valor fuera de su enum.
describe("técnicoReportActivityType (incorporación de montaje/realce para Progrúas)", () => {
  it("conserva los 4 tipos de mantenimiento existentes sin cambiar su significado", () => {
    for (const original of ENUM_OPTIONS.maintenanceType) {
      const match = ENUM_OPTIONS.technicalReportActivityType.find((o) => o.value === original.value);
      expect(match, `falta ${original.value} en technicalReportActivityType`).toBeDefined();
      expect(match?.label).toBe(original.label);
    }
  });

  it("agrega las 3 actividades nuevas solicitadas por Progrúas, sin tocar el catálogo de mantenimiento", () => {
    const nuevas = ["Realce de torre grúa", "Montaje de malacate", "Montaje de torre grúa"];
    for (const label of nuevas) {
      expect(ENUM_OPTIONS.technicalReportActivityType.some((o) => o.label === label)).toBe(true);
      // El catálogo de mantenimiento (atado al enum real de Postgres) NO
      // debe conocer estos valores - si los tuviera, el módulo de
      // Mantenimientos los ofrecería como opción y el insert fallaría en
      // la base de datos.
      expect(ENUM_OPTIONS.maintenanceType.some((o) => o.label === label)).toBe(false);
    }
  });

  it("no hay valores duplicados dentro del nuevo catálogo", () => {
    const values = ENUM_OPTIONS.technicalReportActivityType.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("coerceEnumValue y getEnumLabel resuelven las 3 actividades nuevas por valor, por label y por alias", () => {
    const cases: Array<{ value: string; label: string; alias: string }> = [
      { value: "TOWER_CRANE_RAISE", label: "Realce de torre grúa", alias: "realce torre grua" },
      { value: "WINCH_ASSEMBLY", label: "Montaje de malacate", alias: "montaje malacate" },
      { value: "TOWER_CRANE_ASSEMBLY", label: "Montaje de torre grúa", alias: "montaje torre grua" },
    ];
    for (const c of cases) {
      expect(coerceEnumValue("technicalReportActivityType", c.value)).toBe(c.value);
      expect(coerceEnumValue("technicalReportActivityType", c.label)).toBe(c.value);
      expect(coerceEnumValue("technicalReportActivityType", c.alias)).toBe(c.value);
      expect(getEnumLabel("technicalReportActivityType", c.value)).toBe(c.label);
    }
  });

  it("los 4 tipos de mantenimiento originales se siguen resolviendo igual que antes (sin romper autocompletado desde un mantenimiento asociado)", () => {
    for (const original of ENUM_OPTIONS.maintenanceType) {
      expect(getEnumLabel("technicalReportActivityType", original.value)).toBe(original.label);
    }
  });
});
