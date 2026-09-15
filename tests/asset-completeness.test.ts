import { describe, expect, it } from "vitest";
import { getMissingAssetFields, isAssetInfoComplete } from "@/lib/asset-completeness";

// Progrúas: "el jefe tarda en dar los datos de la máquina" - la usuaria debe
// poder crear el equipo solo con Máquina + Código y completar el resto
// después. Estos tests fijan el comportamiento exacto que ese flujo necesita.
describe("getMissingAssetFields", () => {
  it("un equipo con solo nombre y código queda con todo lo demás pendiente", () => {
    const missing = getMissingAssetFields({ name: "Grúa Grove", code: "EQ-003" });
    expect(missing).toEqual([
      "Ubicación",
      "Placa",
      "Marca",
      "Modelo",
      "Año",
      "Proveedor",
      "Horómetro",
      "Próximo mantenimiento",
      "Vence póliza",
      "Vence certificado"
    ]);
    expect(isAssetInfoComplete({ name: "Grúa Grove", code: "EQ-003" })).toBe(false);
  });

  it("un equipo con todos los campos completables no tiene nada pendiente", () => {
    const complete = {
      name: "Grúa Grove",
      code: "EQ-003",
      location: "Obra norte",
      plate: "ABC-123",
      brand: "Grove",
      model: "GMK 3050",
      year: 2020,
      provider: "Proveedor SAS",
      hour_meter: 1234,
      next_maintenance_date: "2026-12-01",
      insurance_expiration: "2027-01-01",
      technical_certificate_expiration: "2027-01-01"
    };
    expect(getMissingAssetFields(complete)).toEqual([]);
    expect(isAssetInfoComplete(complete)).toBe(true);
  });

  it("completar un solo campo lo saca de la lista de pendientes (editar después)", () => {
    const before = getMissingAssetFields({ name: "Grúa Grove", code: "EQ-003" });
    const after = getMissingAssetFields({ name: "Grúa Grove", code: "EQ-003", brand: "Grove" });
    expect(before).toContain("Marca");
    expect(after).not.toContain("Marca");
    expect(after.length).toBe(before.length - 1);
  });

  it("hour_meter en 0 cuenta como pendiente (no se puede distinguir de 'nunca diligenciado')", () => {
    expect(getMissingAssetFields({ name: "x", code: "y", hour_meter: 0 })).toContain("Horómetro");
  });

  it("hour_meter con un valor real no cuenta como pendiente", () => {
    expect(getMissingAssetFields({ name: "x", code: "y", hour_meter: 500 })).not.toContain("Horómetro");
  });

  it("cadenas vacías cuentan como pendiente igual que null/undefined", () => {
    expect(getMissingAssetFields({ name: "x", code: "y", brand: "" })).toContain("Marca");
    expect(getMissingAssetFields({ name: "x", code: "y", brand: null })).toContain("Marca");
    expect(getMissingAssetFields({ name: "x", code: "y" })).toContain("Marca");
  });
});
