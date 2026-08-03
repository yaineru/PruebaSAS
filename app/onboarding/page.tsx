import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>Empresa pendiente</CardTitle>
          <CardDescription>
            Tu cuenta esta activa, pero aun no tiene una empresa asignada.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Contacta al administrador de tu organizacion para completar el acceso.
        </CardContent>
      </Card>
    </main>
  );
}
