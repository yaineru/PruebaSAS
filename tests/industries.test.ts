import { describe, expect, it } from "vitest";
import {
  getAllIndustries,
  isAvailableIndustrySlug,
  isValidIndustrySlug,
  INDUSTRY_SLUGS
} from "@/lib/industries";

// Solo "machinery" (Progrúas) y "general" (fallback neutral) son experiencias
// terminadas hoy - el resto se ofrece como "Próximamente" en el selector de
// registro (components/industry-selector.tsx) para no vender un nicho que
// todavía no funciona bien (ver, por ejemplo, el label "Horómetro" filtrado
// en veterinary). Este test existe para que nadie reactive un nicho a medio
// terminar por accidente.
describe("disponibilidad de nichos en el registro", () => {
  it("machinery y general están disponibles", () => {
    expect(isAvailableIndustrySlug("machinery")).toBe(true);
    expect(isAvailableIndustrySlug("general")).toBe(true);
  });

  it("los demás nichos existen pero no están disponibles todavía", () => {
    for (const slug of ["construction", "veterinary", "healthcare", "dental", "workshop", "services"]) {
      expect(isValidIndustrySlug(slug), `${slug} debería ser un slug válido`).toBe(true);
      expect(isAvailableIndustrySlug(slug), `${slug} no debería estar disponible todavía`).toBe(false);
    }
  });

  it("un slug inventado no es válido ni disponible", () => {
    expect(isValidIndustrySlug("no-existe")).toBe(false);
    expect(isAvailableIndustrySlug("no-existe")).toBe(false);
  });

  it("todo lo que el selector muestra como tarjeta existe en INDUSTRY_SLUGS", () => {
    const industries = getAllIndustries();
    expect(industries.length).toBe(Object.keys(INDUSTRY_SLUGS).length);
    for (const industry of industries) {
      expect(INDUSTRY_SLUGS[industry.slug as keyof typeof INDUSTRY_SLUGS]).toBeDefined();
    }
  });
});
