import { describe, expect, it } from "vitest";
import { assertCanCreate, assertCanDelete, sanitizeText } from "@/lib/security";
import type { TenantContext } from "@/lib/tenant";

function tenant(role: string): TenantContext {
  return {
    userId: "u1",
    authUserId: "au1",
    companyId: "c1",
    companyName: "Empresa de prueba",
    companyStatus: "ACTIVE",
    role
  };
}

// Estos casos existen porque un chequeo de rol en la aplicación
// (assertCanDelete) llegó a permitir a SUPERVISOR borrar activos/
// mantenimientos/novedades/proyectos mientras la policy RLS real
// (can_manage_company, ADMIN-only desde la primera migración) siempre lo
// rechazó - el botón decía "eliminado" y la base de datos no borraba nada.
// La matriz de abajo es la fuente de verdad: debe coincidir exactamente con
// supabase/migrations/001_initial_multitenant_schema.sql.
describe("assertCanDelete - debe coincidir con la policy RLS can_manage_company (ADMIN-only)", () => {
  const deletableTables = ["assets", "maintenance_records", "incidents", "projects"];

  it.each(deletableTables)("ADMIN puede eliminar %s", (table) => {
    expect(() => assertCanDelete(table, tenant("ADMIN"))).not.toThrow();
  });

  it.each(deletableTables)("SUPER_ADMIN puede eliminar %s", (table) => {
    expect(() => assertCanDelete(table, tenant("SUPER_ADMIN"))).not.toThrow();
  });

  it.each(deletableTables)("SUPERVISOR NO puede eliminar %s (regresión: antes sí podía)", (table) => {
    expect(() => assertCanDelete(table, tenant("SUPERVISOR"))).toThrow();
  });

  it.each(deletableTables)("OPERARIO NO puede eliminar %s", (table) => {
    expect(() => assertCanDelete(table, tenant("OPERARIO"))).toThrow();
  });

  it("ADMIN no puede eliminar una tabla fuera de la lista permitida", () => {
    expect(() => assertCanDelete("asset_documents", tenant("ADMIN"))).toThrow();
  });
});

describe("assertCanCreate - matriz por rol", () => {
  it("solo ADMIN/SUPER_ADMIN pueden crear usuarios", () => {
    expect(() => assertCanCreate("users", tenant("ADMIN"))).not.toThrow();
    expect(() => assertCanCreate("users", tenant("SUPER_ADMIN"))).not.toThrow();
    expect(() => assertCanCreate("users", tenant("SUPERVISOR"))).toThrow();
    expect(() => assertCanCreate("users", tenant("OPERARIO"))).toThrow();
  });

  it("SUPERVISOR puede crear activos, proyectos y documentos", () => {
    for (const table of ["assets", "projects", "asset_documents"]) {
      expect(() => assertCanCreate(table, tenant("SUPERVISOR"))).not.toThrow();
    }
  });

  it("OPERARIO NO puede crear activos ni documentos (solo registrar operación)", () => {
    expect(() => assertCanCreate("assets", tenant("OPERARIO"))).toThrow();
    expect(() => assertCanCreate("asset_documents", tenant("OPERARIO"))).toThrow();
  });

  it("OPERARIO sí puede crear mantenimientos y novedades", () => {
    expect(() => assertCanCreate("maintenance_records", tenant("OPERARIO"))).not.toThrow();
    expect(() => assertCanCreate("incidents", tenant("OPERARIO"))).not.toThrow();
  });
});

describe("sanitizeText", () => {
  it("elimina etiquetas HTML", () => {
    expect(sanitizeText("<script>alert(1)</script>hola")).toBe("alert(1)hola");
  });

  it("recorta al máximo indicado", () => {
    expect(sanitizeText("a".repeat(10), 3)).toBe("aaa");
  });

  it("recorta espacios en los extremos", () => {
    expect(sanitizeText("  hola  ")).toBe("hola");
  });
});
