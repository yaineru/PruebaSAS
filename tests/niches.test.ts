import { describe, expect, it } from "vitest";
import { getNicheConfig, isModuleVisible, NICHE_CONFIGS } from "@/lib/niches";
import type { ModuleKey } from "@/lib/modules";

const ALL_8_MODULES: ModuleKey[] = [
  "assets",
  "maintenance_records",
  "asset_documents",
  "projects",
  "users",
  "incidents",
  "informes",
  "technical_reports"
];

// Progrúas S.A.S. es el único tenant real (golden tenant, business_type
// 'machinery' desde la migración 041). Este test existe para que ningún
// cambio futuro a lib/niches.ts pueda ocultarle un módulo sin que la suite
// falle primero.
describe("nicho machinery (Progrúas, golden tenant)", () => {
  it("mantiene visibles los 8 módulos existentes", () => {
    const config = getNicheConfig("machinery");
    expect(config.visibleModules.sort()).toEqual([...ALL_8_MODULES].sort());
  });

  it("es idéntico al fallback general (no debe ocultar nada respecto a hoy)", () => {
    expect(getNicheConfig("machinery").visibleModules.sort()).toEqual(
      getNicheConfig("general").visibleModules.sort()
    );
  });
});

describe("getNicheConfig - resistencia a valores inválidos", () => {
  it("cae a 'general' con un business_type desconocido", () => {
    expect(getNicheConfig("un-valor-que-no-existe").slug).toBe("general");
  });

  it("cae a 'general' con null o undefined", () => {
    expect(getNicheConfig(null).slug).toBe("general");
    expect(getNicheConfig(undefined).slug).toBe("general");
  });

  it("cae a 'general' con string vacío", () => {
    expect(getNicheConfig("").slug).toBe("general");
  });

  it("nunca lanza una excepción para ningún input de texto", () => {
    for (const value of ["", "MACHINERY", " machinery", "machinery ", "🐾", "null", "undefined"]) {
      expect(() => getNicheConfig(value)).not.toThrow();
    }
  });
});

describe("isModuleVisible", () => {
  it("veterinaria oculta obras e informes técnicos", () => {
    expect(isModuleVisible("veterinary", "projects")).toBe(false);
    expect(isModuleVisible("veterinary", "technical_reports")).toBe(false);
    expect(isModuleVisible("veterinary", "assets")).toBe(true);
  });

  it("un nicho inválido ve todos los módulos (mismo comportamiento que general)", () => {
    for (const key of ALL_8_MODULES) {
      expect(isModuleVisible("nicho-inventado", key)).toBe(true);
    }
  });
});

describe("NICHE_CONFIGS - cobertura", () => {
  it("todo nicho declarado tiene al menos un módulo visible", () => {
    for (const [slug, config] of Object.entries(NICHE_CONFIGS)) {
      expect(config.visibleModules.length, `${slug} no debería quedar sin módulos`).toBeGreaterThan(0);
    }
  });
});
