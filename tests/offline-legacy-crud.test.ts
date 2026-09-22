import { describe, expect, it } from "vitest";
import { LEGACY_CRUD_TABLE } from "@/lib/offline/db";

// Colas guardadas en el dispositivo de un usuario antes del motor CRUD
// genérico {action, table} usaban estos 3 strings de tipo directamente. El
// motor de sincronización los sigue soportando indefinidamente (nunca se
// generan operaciones nuevas con esta forma) - si este mapeo cambiara sin
// querer, una cola vieja ya guardada en el dispositivo de un usuario real
// dejaría de sincronizar silenciosamente.
describe("LEGACY_CRUD_TABLE", () => {
  it("mapea los 3 tipos legacy a su tabla real", () => {
    expect(LEGACY_CRUD_TABLE.CREATE_MAINTENANCE).toBe("maintenance_records");
    expect(LEGACY_CRUD_TABLE.CREATE_INCIDENT).toBe("incidents");
    expect(LEGACY_CRUD_TABLE.CREATE_ASSET).toBe("assets");
  });

  it("no mapea tipos que no son legacy-CRUD", () => {
    expect(LEGACY_CRUD_TABLE.CREATE_TECHNICAL_REPORT).toBeUndefined();
    expect(LEGACY_CRUD_TABLE.CRUD).toBeUndefined();
    expect(LEGACY_CRUD_TABLE.GENERATE_REPORT).toBeUndefined();
  });
});
