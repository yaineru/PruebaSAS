"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, ImageUp, Trash2, Undo2 } from "lucide-react";

type Props = {
  label: string;
  name: string;
  defaultName?: string;
  defaultRole?: string;
  defaultDate?: string;
  // Restaura una firma ya dibujada (ej. un borrador offline recuperado tras
  // recargar la página, ver components/technical-report-form.tsx) - sin
  // esto, reabrir un informe técnico a medio llenar perdería la firma ya
  // capturada aunque el resto de los datos del borrador sí sobrevivan.
  initialDataUrl?: string;
};

type Point = { x: number; y: number };
// Un trazo es todo lo que se dibujó entre apoyar y levantar el dedo/lápiz.
// Es la unidad que se deshace y que borra la goma - no el píxel.
type Stroke = Point[];

const STROKE_COLOR = "#0f172a";
const STROKE_WIDTH = 2;
// Radio de la goma en píxeles del canvas (400x150). ~12px es lo que cubre la
// yema de un dedo en un celular sin que un toque borre trazos vecinos.
const ERASER_RADIUS = 12;

// Distancia de un punto al SEGMENTO a-b, no a sus extremos. El navegador
// entrega un punto por evento de puntero, así que un trazo rápido guarda
// puntos muy separados aunque en pantalla se vea una línea continua: midiendo
// solo contra los puntos, la goma no encuentra nada al tocar la mitad de un
// tramo largo y el usuario cree que está rota. Comprobado dibujando rápido:
// un toque a 22 px del punto más cercano caía sobre la línea y no borraba.
function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function strokeIsNear(stroke: Stroke, point: Point): boolean {
  if (stroke.length === 1) return Math.hypot(stroke[0].x - point.x, stroke[0].y - point.y) <= ERASER_RADIUS;
  for (let index = 1; index < stroke.length; index += 1) {
    if (distanceToSegment(point, stroke[index - 1], stroke[index]) <= ERASER_RADIUS) return true;
  }
  return false;
}

/**
 * Captura una firma dibujada a mano (mouse o táctil) en un canvas y la expone
 * como PNG en base64 dentro de un input oculto `name`, listo para incrustarse
 * en el PDF del informe técnico.
 *
 * El canvas NO es la fuente de verdad del dibujo: lo es `strokesRef`, la lista
 * de trazos. El canvas se repinta entero a partir de esa lista cada vez que
 * cambia. Antes se dibujaba directo sobre el canvas sin guardar nada, y por
 * eso un error obligaba a borrar la firma completa y volver a empezar: no
 * había forma de saber qué parte del dibujo correspondía al último trazo.
 */
export function SignaturePad({ label, name, defaultName = "", defaultRole = "", defaultDate = "", initialDataUrl = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Fuente de verdad de los trazos. Es un ref y no estado porque los handlers
  // de pointer leen y escriben varias veces dentro de un mismo gesto (al
  // borrar arrastrando, en cada movimiento) y el estado de React todavía no
  // se habría re-renderizado entre un movimiento y el siguiente.
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  // Firma subida como imagen o restaurada de un borrador: es un mapa de bits,
  // no trazos, así que se pinta como fondo y queda fuera de deshacer/goma.
  const backgroundRef = useRef<HTMLImageElement | null>(null);

  // Ref y no estado: no se pinta nada con él, y como estado habría un hueco
  // entre el pointerdown y el re-render de React en el que un pointermove muy
  // rápido (pantallas de alta frecuencia, o el primer movimiento del gesto)
  // todavía leería `false` y descartaría el principio del trazo.
  const isPointerDownRef = useRef(false);

  const [strokeCount, setStrokeCount] = useState(0);
  const [hasBackground, setHasBackground] = useState(Boolean(initialDataUrl));
  const [mode, setMode] = useState<"draw" | "erase">("draw");
  const [dataUrl, setDataUrl] = useState(initialDataUrl);
  const [signerName, setSignerName] = useState(defaultName);
  const [signerRole, setSignerRole] = useState(defaultRole);
  const [signerDate, setSignerDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasSignature = strokeCount > 0 || hasBackground;

  const repaint = useCallback((list: Stroke[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const background = backgroundRef.current;
    if (background) {
      const scale = Math.min(canvas.width / background.width, canvas.height / background.height);
      const width = background.width * scale;
      const height = background.height * scale;
      ctx.drawImage(background, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }

    ctx.strokeStyle = STROKE_COLOR;
    ctx.fillStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of list) {
      // Un toque sin arrastrar es un punto (el punto de una "i", un acento).
      // Dibujado con lineTo no se vería nada.
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length; index += 1) {
        ctx.lineTo(stroke[index].x, stroke[index].y);
      }
      ctx.stroke();
    }
  }, []);

  // Único punto por donde cambia el dibujo: repinta y vuelve a publicar el
  // PNG en el input oculto, para que el formulario nunca mande una firma que
  // no coincide con lo que se ve en pantalla.
  const applyStrokes = useCallback(
    (next: Stroke[]) => {
      strokesRef.current = next;
      setStrokeCount(next.length);
      // Al quedarse sin trazos se vuelve a modo dibujo. Si no, tras borrar el
      // último trazo el pad se queda en modo borrador Y con el botón del
      // borrador deshabilitado (no hay nada que borrar): cada toque borraría
      // nada en vez de dibujar, y no habría forma de salir del modo. El pad
      // parecería roto.
      if (next.length === 0) setMode("draw");
      repaint(next);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const isEmpty = next.length === 0 && !backgroundRef.current;
      setDataUrl(isEmpty ? "" : canvas.toDataURL("image/png"));
    },
    [repaint]
  );

  useEffect(() => {
    if (!initialDataUrl) {
      repaint([]);
      return;
    }
    const image = new Image();
    image.onload = () => {
      backgroundRef.current = image;
      setHasBackground(true);
      repaint(strokesRef.current);
    };
    image.src = initialDataUrl;
    // Solo al montar: initialDataUrl es la firma restaurada de un borrador,
    // no algo que deba re-pintar el canvas en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefills come from an async lookup (selecting an existing maintenance) that
  // resolves after this component mounts - only backfill while the signer
  // hasn't typed anything, so we never clobber a manual edit.
  useEffect(() => {
    setSignerName((prev) => prev || defaultName);
  }, [defaultName]);
  useEffect(() => {
    setSignerRole((prev) => prev || defaultRole);
  }, [defaultRole]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  // Borra por TRAZO, no por píxel: se quita entero el trazo que se toca. Con
  // un borrador de píxeles, un dedo sobre una pantalla pequeña abriría huecos
  // blancos en medio de las letras vecinas y dejaría la firma peor que antes.
  const eraseAt = (point: Point) => {
    const remaining = strokesRef.current.filter((stroke) => !strokeIsNear(stroke, point));
    if (remaining.length === strokesRef.current.length) return;
    applyStrokes(remaining);
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    isPointerDownRef.current = true;
    const point = getPoint(event);

    if (mode === "erase") {
      eraseAt(point);
      return;
    }
    currentStrokeRef.current = [point];
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    const point = getPoint(event);

    if (mode === "erase") {
      eraseAt(point);
      return;
    }

    const current = currentStrokeRef.current;
    if (!current) return;
    current.push(point);

    // Se repinta todo el canvas en cada movimiento en vez de pintar solo el
    // segmento nuevo encima: así dibujar, deshacer y borrar pasan todos por
    // el MISMO código, y lo que se ve mientras se firma es exactamente lo que
    // quedará al repintar. Pintar el segmento suelto sería O(1) en vez de
    // O(puntos), pero además lo haría con un remate redondo por punto, que no
    // es idéntico a trazar el path completo de una vez.
    //
    // El costo medido en este canvas de 400x150: 0,03 ms con una firma normal
    // (~640 puntos) y 0,23 ms con 12.000 puntos, contra los 16,7 ms de un
    // frame. Incluso con un teléfono diez veces más lento sobra margen.
    repaint([...strokesRef.current, current]);
  };

  const stopDrawing = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (mode === "erase") return;

    const current = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!current || current.length === 0) return;
    applyStrokes([...strokesRef.current, current]);
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    applyStrokes(strokesRef.current.slice(0, -1));
  };

  const clear = () => {
    backgroundRef.current = null;
    currentStrokeRef.current = null;
    setHasBackground(false);
    setMode("draw");
    setUploadError(null);
    applyStrokes([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Alternativa a dibujar: a veces quien debe firmar no está presente (ej. la
  // persona que recibe el servicio) pero sí hay una imagen de su firma ya
  // escaneada/fotografiada - se dibuja centrada sobre fondo blanco en el
  // mismo canvas, manteniendo proporción, para que quede igual de incrustada
  // en el PDF que una firma dibujada a mano.
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Solo se aceptan imágenes JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("La imagen supera el tamaño máximo de 4 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        // La imagen reemplaza la firma: sustituye el fondo y descarta los
        // trazos, en vez de quedar debajo de un dibujo que ya no corresponde.
        backgroundRef.current = image;
        setHasBackground(true);
        setMode("draw");
        applyStrokes([]);
      };
      image.onerror = () => setUploadError("No se pudo leer la imagen. Intenta con otro archivo.");
      image.src = String(reader.result);
    };
    reader.onerror = () => setUploadError("No se pudo leer la imagen. Intenta con otro archivo.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">{label}</label>
      <input
        type="text"
        placeholder="Nombre de quien firma"
        value={signerName}
        onChange={(event) => setSignerName(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Cargo"
          value={signerRole}
          onChange={(event) => setSignerRole(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        />
        <input
          type="date"
          value={signerDate}
          onChange={(event) => setSignerDate(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        />
      </div>
      <div
        className={`rounded-md border-2 border-dashed bg-white transition-colors ${
          mode === "erase" ? "border-amber-400" : "border-input"
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className={`w-full touch-none rounded-md ${mode === "erase" ? "cursor-cell" : "cursor-crosshair"}`}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={strokeCount === 0}
          title="Quita el último trazo dibujado"
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" /> Deshacer
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "erase" ? "secondary" : "ghost"}
          aria-pressed={mode === "erase"}
          onClick={() => setMode((current) => (current === "erase" ? "draw" : "erase"))}
          disabled={strokeCount === 0}
          title="Toca o arrastra sobre el trazo que quieras quitar"
        >
          <Eraser className="mr-1 h-3.5 w-3.5" /> {mode === "erase" ? "Borrando" : "Borrador"}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
            <ImageUp className="mr-1 h-3.5 w-3.5" /> Subir imagen
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clear}
            disabled={!hasSignature}
            className="text-destructive hover:text-destructive"
            title="Borra la firma completa"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpiar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "erase"
          ? "Modo borrador: toca o arrastra sobre el trazo que quieras quitar."
          : hasBackground && strokeCount === 0
            ? "Firma cargada como imagen. Puedes dibujar encima o usar Limpiar."
            : hasSignature
              ? "Firma capturada. Puedes deshacer el último trazo o usar el borrador."
              : "Dibuja la firma o sube una imagen."}
      </p>

      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      <input type="hidden" name={`${name}Image`} value={dataUrl} />
      <input type="hidden" name={`${name}Name`} value={signerName} />
      <input type="hidden" name={`${name}Role`} value={signerRole} />
      <input type="hidden" name={`${name}Date`} value={signerDate} />
    </div>
  );
}
