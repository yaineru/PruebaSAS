"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

type Props = {
  label: string;
  name: string;
  defaultName?: string;
  defaultRole?: string;
  defaultDate?: string;
};

/**
 * Captura una firma dibujada a mano (mouse o táctil) en un canvas y la expone
 * como PNG en base64 dentro de un input oculto `name`, listo para incrustarse
 * en el PDF del informe técnico.
 */
export function SignaturePad({ label, name, defaultName = "", defaultRole = "", defaultDate = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [signerName, setSignerName] = useState(defaultName);
  const [signerRole, setSignerRole] = useState(defaultRole);
  const [signerDate, setSignerDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));

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
          {hasSignature ? "Firma capturada" : "Dibuja la firma con el mouse o el dedo"}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          <Eraser className="mr-1 h-3.5 w-3.5" /> Limpiar
        </Button>
      </div>
      <input type="hidden" name={`${name}Image`} value={dataUrl} />
      <input type="hidden" name={`${name}Name`} value={signerName} />
      <input type="hidden" name={`${name}Role`} value={signerRole} />
      <input type="hidden" name={`${name}Date`} value={signerDate} />
    </div>
  );
}
