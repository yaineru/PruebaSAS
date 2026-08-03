"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  toggleIcsFeed,
  updatePublicAvailability,
  regenerateShareTokens,
  type CalendarShareActionState
} from "@/lib/actions/calendar-share";

type ShareLink = {
  ics_token: string;
  ics_enabled: boolean;
  public_token: string;
  public_enabled: boolean;
  public_visibility: "BUSY" | "SUMMARY" | "FULL";
} | null;

const initialState: CalendarShareActionState = { success: false };

export function CalendarShareSettings({ share, baseUrl }: { share: ShareLink; baseUrl: string }) {
  const [icsState, icsAction] = useActionState(toggleIcsFeed, initialState);
  const [publicState, publicAction] = useActionState(updatePublicAvailability, initialState);
  const [visibility, setVisibility] = useState(share?.public_visibility ?? "BUSY");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const icsUrl = share ? `${baseUrl}/api/calendar/ics/${share.ics_token}` : null;
  const publicUrl = share ? `${baseUrl}/calendar/public/${share.public_token}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compartir mi calendario</CardTitle>
        <CardDescription>
          Sincroniza tu Agenda con tu teléfono o comparte tu disponibilidad sin dar acceso a EmpresaOS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Feed de calendario (.ics)</p>
              <p className="text-xs text-muted-foreground">Agrégalo en Google Calendar, Apple Calendar u Outlook como &quot;calendario por URL&quot;.</p>
            </div>
            <form action={icsAction}>
              <input type="hidden" name="enabled" value={(!share?.ics_enabled).toString()} />
              <Button type="submit" size="sm" variant={share?.ics_enabled ? "outline" : "default"}>
                {share?.ics_enabled ? "Desactivar" : "Activar"}
              </Button>
            </form>
          </div>
          {share?.ics_enabled && icsUrl ? (
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">{icsUrl}</code>
          ) : null}
          {icsState.error ? <p className="text-xs text-destructive">{icsState.error}</p> : null}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Página pública de disponibilidad</p>
              <p className="text-xs text-muted-foreground">Un enlace que puedes enviar a un cliente para que vea cuándo estás libre.</p>
            </div>
          </div>
          <form action={publicAction} className="flex flex-wrap items-center gap-2">
            <select
              name="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as typeof visibility)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="BUSY">Solo ocupado/libre</option>
              <option value="SUMMARY">Título de la actividad</option>
              <option value="FULL">Información completa</option>
            </select>
            <input type="hidden" name="enabled" value="true" />
            <Button type="submit" size="sm" variant="default">Guardar y activar</Button>
            {share?.public_enabled ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const form = new FormData();
                  form.set("enabled", "false");
                  form.set("visibility", visibility);
                  startTransition(async () => {
                    await updatePublicAvailability(initialState, form);
                  });
                }}
              >
                Desactivar
              </Button>
            ) : null}
          </form>
          {share?.public_enabled && publicUrl ? (
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">{publicUrl}</code>
          ) : null}
          {publicState.error ? <p className="text-xs text-destructive">{publicState.error}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Esto invalida los enlaces actuales (dejarán de funcionar). ¿Continuar?")) return;
              startTransition(async () => {
                const result = await regenerateShareTokens();
                setMessage(result.message || result.error || null);
              });
            }}
          >
            Regenerar enlaces
          </Button>
          {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
