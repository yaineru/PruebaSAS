"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "checking" | "ready" | "invalid" | "expired" | "submitting" | "success" | "session_error";

const MIN_PASSWORD_LENGTH = 6;

/**
 * Landing page for Supabase invite/recovery links. Those links redirect here
 * with the session tokens in the URL *fragment*
 * (#access_token=...&refresh_token=...&type=invite) - fragments never reach
 * the server (not middleware, not this page's own server render), so this
 * has to be a client component that reads window.location.hash on mount and
 * calls supabase.auth.setSession() itself. The tokens never touch our
 * server: no Server Action, no fetch to our own API, nothing logged.
 */
export default function AcceptInvitationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [formError, setFormError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function consumeInviteFragment() {
      const hash = window.location.hash;

      // Strip the fragment from the URL/history immediately, whether or not
      // it turns out to be valid - it must never linger somewhere a screen
      // share, browser history, or referrer header could leak it.
      window.history.replaceState(null, "", window.location.pathname);

      if (!hash || hash.length < 2) {
        setStatus("invalid");
        return;
      }

      const params = new URLSearchParams(hash.slice(1));
      const errorCode = params.get("error_code");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (errorCode) {
        setStatus(errorCode === "otp_expired" ? "expired" : "invalid");
        return;
      }

      if (!accessToken || !refreshToken) {
        setStatus("invalid");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      setStatus(error ? "expired" : "ready");
    }

    consumeInviteFragment();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setStatus("submitting");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFormError("No se pudo establecer la contraseña. Intenta nuevamente.");
      setStatus("ready");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>Bienvenido a Progrúas</CardTitle>
          <CardDescription>Configura tu contraseña para comenzar a utilizar la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "checking" && (
            <p className="text-sm text-muted-foreground">Verificando tu enlace de invitación...</p>
          )}

          {status === "invalid" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Este enlace no es válido o ya fue utilizado. Pide un nuevo enlace de invitación.
            </div>
          )}

          {status === "expired" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Este enlace expiró. Pide un nuevo enlace de invitación.
            </div>
          )}

          {status === "session_error" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              No se pudo validar tu sesión. Pide un nuevo enlace de invitación.
            </div>
          )}

          {(status === "ready" || status === "submitting") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>

              {formError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={status === "submitting"}>
                {status === "submitting" ? "Creando contraseña..." : "Crear contraseña"}
              </Button>
            </form>
          )}

          {status === "success" && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              ✓ Contraseña creada correctamente. Entrando a tu panel...
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
