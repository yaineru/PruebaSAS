"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, ImageUp } from "lucide-react";

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

/**
 * Captura una firma dibujada a mano (mouse o táctil) en un canvas y la expone
 * como PNG en base64 dentro de un input oculto `name`, listo para incrustarse
 * en el PDF del informe técnico.
 */
export function SignaturePad({ label, name, defaultName = "", defaultRole = "", defaultDate = "", initialDataUrl = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(initialDataUrl));
  const [dataUrl, setDataUrl] = useState(initialDataUrl);
  const [signerName, setSignerName] = useState(defaultName);
  const [signerRole, setSignerRole] = useState(defaultRole);
  const [signerDate, setSignerDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = initialDataUrl;
    }
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

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      setDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setDataUrl("");
    setUploadError(null);
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

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        setDataUrl(canvas.toDataURL("image/png"));
        setHasSignature(true);
      };
      img.onerror = () => setUploadError("No se pudo leer la imagen. Intenta con otro archivo.");
      img.src = String(reader.result);
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
      <div className="rounded-md border border-dashed border-input bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full touch-none rounded-md"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {hasSignature ? "Firma capturada" : "Dibuja la firma o sube una imagen"}
        </p>
        <div className="flex items-center gap-1">
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
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <Eraser className="mr-1 h-3.5 w-3.5" /> Limpiar
          </Button>
        </div>
      </div>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      <input type="hidden" name={`${name}Image`} value={dataUrl} />
      <input type="hidden" name={`${name}Name`} value={signerName} />
      <input type="hidden" name={`${name}Role`} value={signerRole} />
      <input type="hidden" name={`${name}Date`} value={signerDate} />
    </div>
  );
}
