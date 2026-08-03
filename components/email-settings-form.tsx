"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveEmailSettings,
  sendTestEmail,
  type EmailSettingsActionState
} from "@/lib/actions/email-settings";

type Settings = {
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_secure: boolean;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  timeout_ms: number;
  max_retries: number;
  enabled: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
} | null;

const initialState: EmailSettingsActionState = { success: false };

export function EmailSettingsForm({ settings }: { settings: Settings }) {
  const [saveState, saveAction, savePending] = useActionState(saveEmailSettings, initialState);
  const [testState, testAction, testPending] = useActionState(sendTestEmail, initialState);

  return (
    <div className="space-y-6">
      <form action={saveAction} className="grid gap-4">
        {saveState.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {saveState.error}
          </div>
        ) : null}
        {saveState.success && saveState.message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {saveState.message}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="enabled" name="enabled" value="true" defaultChecked={settings?.enabled} className="h-4 w-4" />
          <Label htmlFor="enabled">Activar envío de correos por SMTP propio</Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="smtp_host">Host SMTP</Label>
            <Input id="smtp_host" name="smtp_host" placeholder="smtp.tudominio.com" defaultValue={settings?.smtp_host ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="smtp_port">Puerto</Label>
            <Input id="smtp_port" name="smtp_port" type="number" defaultValue={settings?.smtp_port ?? 587} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="smtp_user">Usuario</Label>
            <Input id="smtp_user" name="smtp_user" defaultValue={settings?.smtp_user ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="smtp_password">Contraseña</Label>
            <Input id="smtp_password" name="smtp_password" type="password" placeholder={settings?.smtp_host ? "Dejar en blanco para no cambiarla" : ""} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="smtp_secure" name="smtp_secure" value="true" defaultChecked={settings?.smtp_secure} className="h-4 w-4" />
          <Label htmlFor="smtp_secure">Usar TLS/SSL (recomendado, puerto 465)</Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="from_email">Correo remitente</Label>
            <Input id="from_email" name="from_email" type="email" placeholder="notificaciones@tuempresa.com" defaultValue={settings?.from_email ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="from_name">Nombre remitente</Label>
            <Input id="from_name" name="from_name" placeholder="Tu Empresa" defaultValue={settings?.from_name ?? ""} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="reply_to">Responder a</Label>
            <Input id="reply_to" name="reply_to" type="email" defaultValue={settings?.reply_to ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timeout_ms">Timeout (ms)</Label>
            <Input id="timeout_ms" name="timeout_ms" type="number" defaultValue={settings?.timeout_ms ?? 10000} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="max_retries">Reintentos máximos</Label>
            <Input id="max_retries" name="max_retries" type="number" defaultValue={settings?.max_retries ?? 3} />
          </div>
        </div>

        <Button type="submit" disabled={savePending} className="w-fit">
          {savePending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </form>

      <div className="rounded-md border bg-muted/30 p-4">
        <p className="mb-3 text-sm font-medium">Probar conexión SMTP</p>
        {testState.error ? (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {testState.error}
          </div>
        ) : null}
        {testState.success && testState.message ? (
          <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {testState.message}
          </div>
        ) : null}
        <form action={testAction} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="test_recipient">Enviar correo de prueba a</Label>
            <Input id="test_recipient" name="test_recipient" type="email" placeholder="tu-correo@ejemplo.com" required className="w-64" />
          </div>
          <Button type="submit" variant="outline" disabled={testPending}>
            {testPending ? "Enviando..." : "Enviar correo de prueba"}
          </Button>
        </form>
        {settings?.last_test_at ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Última prueba: {new Date(settings.last_test_at).toLocaleString("es-CO")} ·{" "}
            {settings.last_test_ok ? (
              <span className="text-emerald-600">Exitosa</span>
            ) : (
              <span className="text-destructive">Falló — {settings.last_test_error}</span>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
