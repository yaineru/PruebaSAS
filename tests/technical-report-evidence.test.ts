import { describe, expect, it } from "vitest";
import { normalizeEvidenceItems } from "@/lib/reports/technical-evidence";

// Caso real reportado por una usuaria de Progrúas: muchos trabajos no tienen
// un "antes" y "después" como tal, solo varias fotos de evidencia (del
// equipo, de una pieza, del sitio). El informe técnico ya no debe depender
// de formar parejas Antes/Después - cada foto es independiente y puede ser
// Antes, Después o Evidencia, en cualquier combinación.
describe("normalizeEvidenceItems", () => {
  it("solo evidencia: varias fotos tipo EVIDENCE, sin antes/después", () => {
    const result = normalizeEvidenceItems([
      { url: "u1", type: "EVIDENCE" },
      { url: "u2", type: "EVIDENCE" },
      { url: "u3", type: "EVIDENCE" },
    ]);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.type === "EVIDENCE")).toBe(true);
  });

  it("antes/después clásico: un antes y un después", () => {
    const result = normalizeEvidenceItems([
      { url: "before.jpg", type: "BEFORE" },
      { url: "after.jpg", type: "AFTER" },
    ]);
    expect(result).toEqual([
      { title: undefined, url: "before.jpg", type: "BEFORE" },
      { title: undefined, url: "after.jpg", type: "AFTER" },
    ]);
  });

  it("mezcla: antes + después + varias evidencias", () => {
    const result = normalizeEvidenceItems([
      { url: "b.jpg", type: "BEFORE" },
      { url: "a.jpg", type: "AFTER" },
      { url: "e1.jpg", type: "EVIDENCE" },
      { url: "e2.jpg", type: "EVIDENCE" },
      { url: "e3.jpg", type: "EVIDENCE" },
      { url: "e4.jpg", type: "EVIDENCE" },
    ]);
    expect(result).toHaveLength(6);
    expect(result.filter((p) => p.type === "BEFORE")).toHaveLength(1);
    expect(result.filter((p) => p.type === "AFTER")).toHaveLength(1);
    expect(result.filter((p) => p.type === "EVIDENCE")).toHaveLength(4);
  });

  it("solo antes, sin ningún después: es válido", () => {
    const result = normalizeEvidenceItems([
      { url: "b1.jpg", type: "BEFORE" },
      { url: "b2.jpg", type: "BEFORE" },
    ]);
    expect(result.every((p) => p.type === "BEFORE")).toBe(true);
  });

  it("un item sin type explícito cae a EVIDENCE por defecto", () => {
    const result = normalizeEvidenceItems([{ url: "x.jpg" }]);
    expect(result[0].type).toBe("EVIDENCE");
  });

  it("sin fotos: lista vacía, no lanza", () => {
    expect(normalizeEvidenceItems([])).toEqual([]);
  });

  it("informe histórico (forma antigua beforeUrl/afterUrl) se expande a fotos independientes", () => {
    const result = normalizeEvidenceItems([{ title: "Registro 1", beforeUrl: "old-before.jpg", afterUrl: "old-after.jpg" }]);
    expect(result).toEqual([
      { title: "Registro 1", url: "old-before.jpg", type: "BEFORE" },
      { title: "Registro 1", url: "old-after.jpg", type: "AFTER" },
    ]);
  });

  it("informe histórico con solo un lado (antiguo 'antes' sin 'después') no inventa una foto vacía", () => {
    const result = normalizeEvidenceItems([{ beforeUrl: "old-before.jpg", afterUrl: null }]);
    expect(result).toEqual([{ title: undefined, url: "old-before.jpg", type: "BEFORE" }]);
  });

  it("un item sin ninguna URL se descarta silenciosamente", () => {
    expect(normalizeEvidenceItems([{ title: "vacío" }])).toEqual([]);
  });
});
