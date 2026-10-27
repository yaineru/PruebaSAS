import { describe, expect, it } from "vitest";
import {
  hasPendingEvidenceUploads,
  normalizeEvidenceItems,
  selectEvidencePhotosToSubmit,
  type EvidencePhotoSubmissionState,
} from "@/lib/reports/technical-evidence";

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

// Incidencia real de Progrúas: fotos adjuntadas con conexión inestable
// "desaparecían" después de guardar. Causa raíz confirmada en
// components/technical-report-form.tsx: EvidencePicker sube cada foto de
// forma asíncrona y solo avisa al formulario padre cuando la subida
// TERMINA - mientras tanto la vista previa (un blob: URL local) ya se
// mostraba en pantalla con el campo `url` real todavía vacío. Si el envío
// ocurría en esa ventana, el filtro que decide qué fotos viajan las excluía
// sin avisar. Estas pruebas cubren la regla que ahora bloquea ese envío.
describe("hasPendingEvidenceUploads (bloquea el envío mientras una foto sigue subiendo)", () => {
  it("ninguna foto subiendo -> false, el envío puede continuar", () => {
    const photos: EvidencePhotoSubmissionState[] = [
      { url: "https://x/1.jpg" },
      { url: "https://x/2.jpg" },
    ];
    expect(hasPendingEvidenceUploads(photos)).toBe(false);
  });

  it("una sola foto todavía subiendo (url vacía, uploading=true) -> true, bloquea el envío", () => {
    const photos: EvidencePhotoSubmissionState[] = [
      { url: "https://x/1.jpg", uploading: false },
      { url: "", uploading: true },
    ];
    expect(hasPendingEvidenceUploads(photos)).toBe(true);
  });

  it("varias fotos, solo una subiendo -> sigue bloqueando (basta con una)", () => {
    const photos: EvidencePhotoSubmissionState[] = [
      { url: "https://x/1.jpg", uploading: false },
      { url: "https://x/2.jpg", uploading: false },
      { url: "", uploading: true },
    ];
    expect(hasPendingEvidenceUploads(photos)).toBe(true);
  });

  it("subida terminada en error (uploading vuelve a false, url queda vacía) ya no bloquea - la fila simplemente no viaja", () => {
    const photos: EvidencePhotoSubmissionState[] = [{ url: "", uploading: false }];
    expect(hasPendingEvidenceUploads(photos)).toBe(false);
  });

  it("foto pendiente de subir sin conexión (pendingLocal) pero ya terminó de guardarse localmente -> no bloquea", () => {
    const photos: EvidencePhotoSubmissionState[] = [{ url: "blob:local", pendingLocal: true, uploading: false }];
    expect(hasPendingEvidenceUploads(photos)).toBe(false);
  });

  it("sin fotos -> false", () => {
    expect(hasPendingEvidenceUploads([])).toBe(false);
  });
});

describe("selectEvidencePhotosToSubmit", () => {
  it("incluye fotos con url real y fotos pendientes sin conexión (pendingLocal)", () => {
    const photos: EvidencePhotoSubmissionState[] = [
      { url: "https://x/1.jpg" },
      { url: "blob:local", pendingLocal: true },
    ];
    expect(selectEvidencePhotosToSubmit(photos)).toHaveLength(2);
  });

  it("excluye una fila agregada pero nunca completada (sin url ni pendingLocal)", () => {
    const photos: EvidencePhotoSubmissionState[] = [{ url: "" }, { url: "https://x/1.jpg" }];
    expect(selectEvidencePhotosToSubmit(photos)).toEqual([{ url: "https://x/1.jpg" }]);
  });

  it("conserva el resto de los campos de cada foto (no solo url)", () => {
    const photos = [{ url: "https://x/1.jpg", title: "Panel eléctrico", type: "EVIDENCE" as const }];
    expect(selectEvidencePhotosToSubmit(photos)).toEqual(photos);
  });
});
