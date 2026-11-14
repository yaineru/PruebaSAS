"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renameReport } from "@/lib/actions/report-folders";

type Props = {
  reportId: string;
  // Sugerencia de arranque (ej. el cliente que se acaba de escribir) - el
  // usuario la puede borrar o cambiar libremente, nunca se guarda sola.
  suggestedName?: string;
  onClose: () => void;
};

// Aparece inmediatamente después de generar un informe técnico (ver
// components/technical-report-form.tsx) - pedido real de Progrúas: sin un
// nombre propio, cada informe se veía dentro de una carpeta (Proyecto ->
// Año -> Mes) solo como "Informe técnico", indistinguible de los demás del
// mismo mes. "Omitir" es una salida legítima, no un error: el nombre es
// opcional, el informe ya quedó generado y guardado de todas formas.
export function NameReportModal({ reportId, suggestedName, onClose }: Props) {
  const [name, setName] = useState(suggestedName ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setIsPending(true);
    try {
      const result = await renameReport(reportId, name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onClose();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Nombra este informe
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El informe ya se generó y se guardó. Ponle un nombre para reconocerlo más fácil después, cuando lo busques
            dentro de una carpeta.
          </p>

          <div className="space-y-2">
            <Label htmlFor="report-name">Nombre del informe</Label>
            <Input
              id="report-name"
              placeholder="Ej: Mantenimiento grúa torre - obra Verbena"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
              autoFocus
            />
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Omitir
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isPending || !name.trim()}>
              {isPending ? "Guardando..." : "Guardar nombre"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
