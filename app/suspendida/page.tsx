import { Ban } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default function SuspendedCompanyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-destructive text-destructive-foreground">
            <Ban className="h-5 w-5" />
          </div>
          <CardTitle>Cuenta suspendida temporalmente</CardTitle>
          <CardDescription>
            El acceso de tu empresa a la plataforma está suspendido en este momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Esto normalmente ocurre por un tema administrativo (por ejemplo, un pago pendiente).
            Contacta a soporte para reactivar el acceso.
          </p>
          <form action={signOut}>
            <Button variant="outline" className="w-full" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
