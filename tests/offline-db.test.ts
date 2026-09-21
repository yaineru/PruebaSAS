import { describe, expect, it } from "vitest";
import { buildScopeKey } from "@/lib/offline/db";

// El aislamiento entre empresas/usuarios en modo offline depende de que cada
// combinación (usuario, empresa) resuelva a un nombre de base de datos
// IndexedDB distinto - dos scopes que colisionaran en el mismo nombre
// terminarían compartiendo la misma cola local, exactamente lo que el modo
// offline no puede permitir (ver lib/offline/db.ts).
describe("buildScopeKey", () => {
  it("dos empresas distintas para el mismo usuario producen scopes distintos", () => {
    const a = buildScopeKey("user-1", "company-A");
    const b = buildScopeKey("user-1", "company-B");
    expect(a).not.toBe(b);
  });

  it("dos usuarios distintos en la misma empresa producen scopes distintos", () => {
    const a = buildScopeKey("user-1", "company-A");
    const b = buildScopeKey("user-2", "company-A");
    expect(a).not.toBe(b);
  });

  it("el mismo usuario+empresa siempre produce el mismo scope (determinístico)", () => {
    const a = buildScopeKey("user-1", "company-A");
    const b = buildScopeKey("user-1", "company-A");
    expect(a).toBe(b);
  });

  it("sanitiza guiones de un uuid real sin perder unicidad", () => {
    const a = buildScopeKey("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");
    const b = buildScopeKey("11111111-1111-1111-1111-111111111112", "22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-zA-Z0-9_]+$/);
  });
});
