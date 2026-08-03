import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_500px]">
      <section className="hidden bg-[linear-gradient(135deg,hsl(166_77%_28%),hsl(31_92%_58%))] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <Building2 className="h-6 w-6" />
          EmpresaOS
        </div>
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-normal">
            Crea el espacio operativo de tu empresa.
          </h1>
          <p className="mt-4 text-base text-white/85">
            Configura una cuenta segura para administrar equipos, documentos, mantenimientos, usuarios y alertas.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">EmpresaOS</p>
              <p className="text-sm text-muted-foreground">Registro empresarial</p>
            </div>
          </div>

          <AuthMessages searchParams={searchParams} />

          <Card>
            <CardHeader>
              <CardTitle>Crear empresa</CardTitle>
              <CardDescription>El primer usuario quedará como administrador de la organización.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link className="font-medium text-primary hover:underline" href="/login">
                  Iniciar sesión
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

async function AuthMessages({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const text = params.error ?? params.message;
  if (!text) return null;

  return (
    <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
      {decodeURIComponent(text)}
    </div>
  );
}
