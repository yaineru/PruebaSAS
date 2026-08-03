"use client";

import { useActionState, useState } from "react";
import { createWebhook, deleteWebhook } from "@/lib/actions/notifications";
import { Copy, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Webhook } from "@/lib/notifications";

type WebhookActionState = {
  success: boolean;
  message?: string;
  error?: string;
  webhookId?: string;
};

type Props = {
  webhooks: Webhook[];
};

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  REPORT_GENERATED: "Informe generado",
  INCIDENT_CREATED: "Novedad creada",
  MAINTENANCE_COMPLETED: "Mantenimiento completado",
  DOCUMENT_EXPIRING: "Documento por vencer"
};

function webhookEventLabel(event: string) {
  return WEBHOOK_EVENT_LABELS[event] || event.replace(/_/g, " ");
}

export function WebhookManagement({ webhooks }: Props) {
  const [state, formAction, isPending] = useActionState<WebhookActionState, FormData>(createWebhook, {
    success: false
  });

  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [deleteState, deleteFormAction, isDeletingId] = useActionState<
    { success: boolean; message?: string; error?: string },
    FormData
  >(deleteWebhook, {
    success: false
  });

  const toggleSecretVisibility = (webhookId: string) => {
    const newSet = new Set(showSecrets);
    if (newSet.has(webhookId)) {
      newSet.delete(webhookId);
    } else {
      newSet.add(webhookId);
    }
    setShowSecrets(newSet);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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

      {deleteState.success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">
          {deleteState.message}
        </div>
      )}

      {/* Create Webhook Form */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Webhook</CardTitle>
          <CardDescription>Configura un webhook para integraciones en tiempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Nombre del Webhook</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Mi integración"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                name="description"
                placeholder="Descripción del webhook"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Eventos</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  "REPORT_GENERATED",
                  "INCIDENT_CREATED",
                  "MAINTENANCE_COMPLETED",
                  "DOCUMENT_EXPIRING"
                ].map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="events"
                      value={event}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">{webhookEventLabel(event)}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {isPending ? "Creando..." : "Crear Webhook"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Webhooks List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Webhooks Activos ({webhooks.length})</h3>

        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay webhooks configurados
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{webhook.name}</CardTitle>
                    <CardDescription className="truncate mt-1">{webhook.url}</CardDescription>
                  </div>
                  <Badge variant={webhook.active ? "default" : "secondary"}>
                    {webhook.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Eventos Suscritos</Label>
                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {webhookEventLabel(event)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Secret HMAC</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showSecrets.has(webhook.id) ? "text" : "password"}
                      value={webhook.secret}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleSecretVisibility(webhook.id)}
                    >
                      {showSecrets.has(webhook.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhook.secret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <form action={deleteFormAction}>
                  <input type="hidden" name="webhook_id" value={webhook.id} />
                  <Button type="submit" size="sm" variant="destructive" disabled={Boolean(isDeletingId)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {Boolean(isDeletingId) ? "Eliminando..." : "Eliminar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
