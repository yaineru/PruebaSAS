import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PT_TO_MM = 25.4 / 72;

// jsPDF no define `text` (ni el resto de su API) en el prototype de la
// clase: cada instancia recibe sus propios métodos como propiedades
// asignadas dentro del constructor (el patrón de "mixins" que usa jsPDF
// internamente). Por eso no sirve espiar `jsPDF.prototype.text` - nunca se
// llama a esa función, cada instancia tiene la suya. En vez de eso,
// interceptamos la CONSTRUCCIÓN de jsPDF con un Proxy: dejamos que el
// constructor real arme la instancia como siempre, y luego envolvemos
// `instance.text` (su propiedad propia) para registrar, en el momento
// exacto de cada llamada, qué color de texto estaba activo
// (`instance.getTextColor()`) antes de delegar en la función original. Así
// capturamos el estado real con el que jsPDF dibuja cada fragmento, que es
// exactamente la causa raíz de la incidencia: un fragmento que se dibuja
// con el color aún en blanco (heredado de drawHeader) es invisible aunque
// el texto esté presente en el PDF.
const recordedTextCalls = vi.hoisted(() => [] as Array<{ text: string; color: string }>);

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const handler: ProxyHandler<typeof actual.default> = {
    construct(target, args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = new (target as any)(...args);
      const originalText = instance.text.bind(instance);
      instance.text = (...textArgs: unknown[]) => {
        const drawn = textArgs[0];
        const flat = Array.isArray(drawn) ? (drawn as string[]).join(" ") : String(drawn);
        recordedTextCalls.push({ text: flat, color: instance.getTextColor() });
        return originalText(...textArgs);
      };
      return instance;
    },
  };
  const ProxiedJsPDF = new Proxy(actual.default, handler);
  return { ...actual, default: ProxiedJsPDF };
});

const { generateTechnicalPdf } = await import("@/lib/reports/generators");
type TechnicalReportData = Parameters<typeof generateTechnicalPdf>[0];

async function extractPages(buffer: Buffer) {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const pages: Array<Array<{ text: string; yMm: number }>> = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeightMm = viewport.height * PT_TO_MM;
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[] }>)
      .filter((item): item is { str: string; transform: number[] } => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str,
        yMm: pageHeightMm - item.transform[5] * PT_TO_MM,
      }));
    pages.push(items);
  }
  return pages;
}

function makeActivities(count: number): string {
  // Cada actividad separada por una línea en blanco, igual al patrón real
  // del informe de Progrúas reproducido en modo solo lectura para esta
  // incidencia - lo que importa no es que el texto sea "largo" en
  // caracteres, sino que, envuelto, ocupe más de una página completa.
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `MARKER-${String(n).padStart(3, "0")} - Se realiza la actividad número ${n} del procedimiento de mantenimiento, incluyendo inspección visual, ajuste de componentes, verificación de torque y limpieza de la zona de trabajo según el protocolo del fabricante.`;
  }).join("\n\n");
}

function baseReportData(overrides: Partial<TechnicalReportData> = {}): TechnicalReportData {
  return {
    reportDate: "2026-10-22",
    clientName: "Cliente de prueba",
    clientContact: "Contacto de prueba",
    projectName: "Proyecto de prueba",
    projectLocation: "Sede de prueba",
    equipmentName: "Equipo de prueba",
    assetCode: "EQ-001",
    assetBrandModel: "Marca X",
    equipmentStatusLabel: "Disponible",
    responsibleName: "Responsable de prueba",
    technicianName: "Técnico de prueba",
    activityTypeLabel: "Preventivo",
    problemDescription: "Descripción del problema de prueba.",
    procedure: "Procedimiento de prueba.",
    sparePartsUsed: "Ninguno",
    observations: "Sin observaciones.",
    evidenceItems: [],
    technicalSignatureImage: null,
    technicalSignatureName: "Técnico",
    technicalSignatureRole: "Técnico",
    technicalSignatureDate: "2026-10-22",
    clientSignatureImage: null,
    clientSignatureName: "Cliente",
    clientSignatureRole: "Cliente",
    clientSignatureDate: "2026-10-22",
    ...overrides,
  };
}

// 51,65,85 - color real que addParagraphSection usa para el cuerpo. jsPDF
// redondea su propia conversión RGB->hex a "#334154" (no "#334155"); el
// valor exacto importa menos aquí que el hecho de que NUNCA sea blanco.
const BODY_COLOR = "#334154";

describe("generateTechnicalPdf - geometría y color del texto (regresión incidencia Nathalie #2)", () => {
  beforeEach(() => {
    recordedTextCalls.length = 0;
  });
  afterEach(() => {
    recordedTextCalls.length = 0;
  });

  it(
    "no dibuja texto en blanco invisible cuando un párrafo cruza un salto de página",
    async () => {
      // Reproduce la condición exacta del bug real: un párrafo que necesita
      // más de una página completa (no solo un "resto" de 1-2 líneas), para
      // forzar que addParagraphSection llame a drawHeader() a mitad del
      // párrafo - el punto donde el color de texto quedaba en blanco y
      // nunca se restauraba.
      const reportData = baseReportData({ procedure: makeActivities(40) });
      const buffer = await generateTechnicalPdf(reportData, { companyName: "Empresa de prueba" });

      // Cada llamada a doc.text() dibuja un CHUNK con varias líneas a la
      // vez (varios marcadores unidos en un solo string) - hay que extraer
      // todos los marcadores de cada llamada, no solo el primero.
      const colorAtDrawTime = new Map<string, string>();
      for (const call of recordedTextCalls) {
        for (const match of call.text.matchAll(/MARKER-\d{3}/g)) {
          colorAtDrawTime.set(match[0], call.color);
        }
      }

      // Todas las 40 actividades deben haberse dibujado (ninguna se perdió).
      expect(colorAtDrawTime.size).toBe(40);

      // Ninguna, sin importar en qué página haya caído, se dibujó en
      // blanco. Esta aserción habría fallado antes del fix: los marcadores
      // que caían justo después de un salto de página dentro del párrafo
      // se registraban con color "#ffffff" (blanco sobre blanco,
      // invisible) en vez del color real del cuerpo.
      for (const [marker, color] of colorAtDrawTime) {
        expect(color, `${marker} se dibujó con color ${color} (blanco = invisible)`).not.toBe("#ffffff");
        expect(color).toBe(BODY_COLOR);
      }

      // Confirma también, con una herramienta independiente (pdfjs-dist
      // sobre el PDF ya generado), que los 40 marcadores existen en el
      // documento final, en orden y sin duplicados - cubre la otra mitad de
      // la regresión original (contenido truncado o duplicado), no solo el
      // color.
      const pages = await extractPages(buffer);
      const allMarkers = pages
        .flat()
        .map((item) => /MARKER-\d{3}/.exec(item.text)?.[0])
        .filter((m): m is string => Boolean(m));
      const expected = Array.from({ length: 40 }, (_, i) => `MARKER-${String(i + 1).padStart(3, "0")}`);
      expect(allMarkers).toEqual(expected);
      expect(new Set(allMarkers).size).toBe(40);
    },
    20000
  );

  it("informe corto (sin fotos, procedimiento breve) sigue generándose sin huecos ni errores", async () => {
    const buffer = await generateTechnicalPdf(baseReportData(), { companyName: "Empresa de prueba" });
    const pages = await extractPages(buffer);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const allText = pages.flat().map((i) => i.text).join(" ");
    expect(allText).toContain("Descripción del problema de prueba.");
    expect(allText).toContain("Procedimiento de prueba.");
  });

  it(
    "procedimiento cercano al límite de página: la actividad siguiente al salto no se pierde ni queda invisible",
    async () => {
      // Caso F del plan de pruebas: añade relleno antes del procedimiento
      // para que su inicio (y por tanto el salto de página dentro de él)
      // caiga en un punto distinto al caso anterior, probando otra
      // transición real.
      const reportData = baseReportData({
        problemDescription: "Problema de prueba. ".repeat(20),
        procedure: makeActivities(15),
      });
      const buffer = await generateTechnicalPdf(reportData, { companyName: "Empresa de prueba" });

      const invisibleMarkers = recordedTextCalls
        .filter((call) => call.color === "#ffffff")
        .flatMap((call) => [...call.text.matchAll(/MARKER-\d{3}/g)].map((m) => m[0]));

      expect(invisibleMarkers).toEqual([]);

      const pages = await extractPages(buffer);
      const allMarkers = pages
        .flat()
        .map((item) => /MARKER-\d{3}/.exec(item.text)?.[0])
        .filter((m): m is string => Boolean(m));
      expect(new Set(allMarkers).size).toBe(15);
    },
    20000
  );
});
