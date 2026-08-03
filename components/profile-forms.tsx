"use client";

import { useActionState } from "react";
import { updateProfileName, changePassword, type ProfileActionState } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileActionState = { success: false };

export function UpdateNameForm({ fullName }: { fullName: string }) {
  const [state, action, isPending] = useActionState(updateProfileName, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu nombre</CardTitle>
        <CardDescription>Como aparece en la actividad reciente y en los informes generados.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input id="full_name" name="full_name" defaultValue={fullName} maxLength={120} required />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-green-700">{state.message}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar nombre"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ChangePasswordForm() {
  const [state, action, isPending] = useActionState(changePassword, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>Necesitas confirmar tu contraseña actual antes de establecer una nueva.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" key={state.success ? "reset" : "form"}>
          <div className="space-y-2">
            <Label htmlFor="current_password">Contraseña actual</Label>
            <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_password">Nueva contraseña</Label>
            <Input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={6} required />
            <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-green-700">{state.message}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Actualizando..." : "Cambiar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
