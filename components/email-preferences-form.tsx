"use client";

import { useState } from "react";
import { updateEmailSubscription } from "@/lib/actions/notifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { EmailSubscription, EmailEventType } from "@/lib/notifications";

const EVENT_LABELS: Record<EmailEventType, { label: string; description: string }> = {
  REPORT_GENERATED: { label: "Informe Generado", description: "Cuando se completa un informe" },
  MAINTENANCE_DUE: { label: "Mantenimiento Próximo", description: "Recordatorios de mantenimiento" },
  INCIDENT_CREATED: { label: "Novedad Reportada", description: "Cuando se crea una novedad" },
  DOCUMENT_EXPIRING: { label: "Documento Venciendo", description: "Documentos por vencer" },
  MAINTENANCE_COMPLETED: { label: "Mantenimiento Completado", description: "Cuando se completa un mantenimiento" },
  INCIDENT_RESOLVED: { label: "Novedad Resuelta", description: "Cuando se resuelve una novedad" },
  PROJECT_MILESTONE: { label: "Hito de Proyecto", description: "Cuando se alcanza un hito" },
  USER_INVITED: { label: "Usuario Invitado", description: "Cuando alguien es invitado al equipo" }
};

type Props = {
  subscriptions: EmailSubscription[];
};

export function EmailPreferencesForm({ subscriptions }: Props) {
  const [state, setState] = useState<{ success?: boolean; message?: string; error?: string }>({ success: false });
  const [isPending, setIsPending] = useState(false);
  const [enabledState, setEnabledState] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">
          {state.message}
        </div>
      )}

      <div className="grid gap-4">
        {Object.entries(EVENT_LABELS).map(([eventType, { label, description }]) => {
          const subscription = subscriptions.find((s) => s.eventType === eventType);
          const isEnabled = enabledState[eventType] ?? subscription?.enabled ?? false;

          const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setIsPending(true);
            const formData = new FormData(event.currentTarget);
            const result = await updateEmailSubscription({ success: false }, formData);
            setState(result);
            setIsPending(false);
          };

          return (
            <Card key={eventType}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{label}</CardTitle>
                    <CardDescription className="text-xs mt-1">{description}</CardDescription>
                  </div>
                  <Badge variant={subscription?.enabled ? "default" : "secondary"}>
                    {subscription?.enabled ? "Activado" : "Desactivado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="hidden" name="event_type" value={eventType} />

                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label htmlFor={`enabled-${eventType}`} className="font-medium">
                          Recibir notificaciones
                        </Label>
                      </div>
                      <input
                        id={`enabled-${eventType}`}
                        type="checkbox"
                        name="enabled"
                        value="true"
                        checked={isEnabled}
                        onChange={(event) => setEnabledState((prev) => ({ ...prev, [eventType]: event.target.checked }))}
                        className="h-5 w-5 rounded border-input cursor-pointer"
                      />
                    </div>

                    {isEnabled && (
                      <div>
                        <Label htmlFor={`frequency-${eventType}`}>Frecuencia</Label>
                        <select
                          id={`frequency-${eventType}`}
                          name="frequency"
                          defaultValue={subscription?.frequency || "IMMEDIATE"}
                          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="IMMEDIATE">Inmediata</option>
                          <option value="DAILY_DIGEST">Resumen Diario</option>
                          <option value="WEEKLY_DIGEST">Resumen Semanal</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? "Guardando..." : "Guardar Preferencia"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
