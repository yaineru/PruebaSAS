import Link from "next/link";
import { Building2 } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_460px]">
      <section className="hidden bg-[linear-gradient(135deg,hsl(166_77%_28%),hsl(31_92%_58%))] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <Building2 className="h-6 w-6" />
          EmpresaOS
        </div>
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-normal">
            Control empresarial para equipos, documentos y operaciones.
          </h1>
          <p className="mt-4 text-base text-white/85">
            Accede a tu espacio privado con información aislada por empresa y seguimiento en tiempo real.
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
              <p className="text-sm text-muted-foreground">Operación empresarial</p>
            </div>
          </div>

          <AuthMessages searchParams={searchParams} />

          <Card>
            <CardHeader>
              <CardTitle>Iniciar sesión</CardTitle>
              <CardDescription>Ingresa con tu cuenta empresarial.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} />
                </div>
                <Button className="w-full">Entrar</Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                ¿Nueva empresa?{" "}
                <Link className="font-medium text-primary hover:underline" href="/register">
                  Crear cuenta
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
