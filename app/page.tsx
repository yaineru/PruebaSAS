import Link from "next/link";
import type { Metadata } from "next";
import {
  Building2,
  Wrench,
  FileText,
  HardHat,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  Smartphone,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "EmpresaOS — Gestión de maquinaria, mantenimiento y operaciones",
  description:
    "Controla equipos, mantenimientos, documentos, obras y novedades de tu empresa desde una sola plataforma, con datos aislados por empresa. Regístrate gratis."
};

const FEATURES = [
  {
    icon: HardHat,
    title: "Equipos",
    description: "Inventario de maquinaria con estado operativo, ficha técnica, fotos y documentos asociados."
  },
  {
    icon: Wrench,
    title: "Mantenimientos",
    description: "Historial de mantenimientos preventivos y correctivos por equipo, con responsables y costos."
  },
  {
    icon: FileText,
    title: "Documentos",
    description: "Pólizas, certificados y manuales con fecha de vencimiento y alertas antes de que caduquen."
  },
  {
    icon: Building2,
    title: "Obras y proyectos",
    description: "Frentes de trabajo activos, con mantenimientos y novedades vinculados a cada uno."
  },
  {
    icon: AlertTriangle,
    title: "Novedades",
    description: "Fallas e incidentes reportados en campo, con seguimiento hasta que se resuelven."
  },
  {
    icon: Users,
    title: "Usuarios y roles",
    description: "Administrador, supervisor y operario, cada uno con lo que puede ver y hacer."
  },
  {
    icon: FileSpreadsheet,
    title: "Informes en PDF y Excel",
    description: "Informes gerenciales y técnicos con firma digital, listos para enviar por correo."
  },
  {
    icon: ShieldCheck,
    title: "Datos aislados por empresa",
    description: "Ninguna otra empresa en la plataforma puede ver la información de la tuya."
  }
];

const STEPS = [
  { title: "Crea tu cuenta", description: "Con tu correo, en menos de un minuto." },
  { title: "Elige tu tipo de negocio", description: "Hoy la experiencia completa está lista para maquinaria y equipos." },
  { title: "Registra tu primer equipo", description: "Y empieza a llevar su historial de mantenimientos." },
  { title: "Invita a tu equipo", description: "Cada persona entra con el rol que le corresponde." }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            EmpresaOS
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="border-b bg-[linear-gradient(135deg,hsl(166_77%_28%),hsl(31_92%_58%))] text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-white/80">
            Para empresas que operan maquinaria y equipos
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Controla tus equipos, mantenimientos y obras desde un solo lugar.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            EmpresaOS es la plataforma para llevar el inventario de maquinaria, el historial de
            mantenimientos, los documentos por vencer y las novedades de campo de tu empresa —
            con cada empresa viendo solo su propia información.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link href="/register">Crear cuenta gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-white/75">
            <Smartphone className="h-4 w-4" /> Funciona desde el celular, en campo o en oficina.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Qué puedes hacer con EmpresaOS</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Sin hojas de cálculo sueltas ni carpetas de documentos dispersas. Todo lo operativo de tu
          empresa, en un solo lugar.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader className="pb-2">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cómo empezar</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/register">Empezar ahora</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">¿Para quién es?</h2>
            <p className="mt-3 text-muted-foreground">
              Hoy la experiencia completa está lista para empresas que administran{" "}
              <strong className="text-foreground">maquinaria y equipos pesados</strong> (grúas, montacargas,
              equipo de construcción y similares). Otros rubros están en camino.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">¿Cómo empiezo a usarlo?</h2>
            <p className="mt-3 text-muted-foreground">
              Crea tu cuenta, registra tu empresa y empieza a usarlo de inmediato. Si tienes dudas sobre
              cómo adaptarlo a tu operación, escríbenos antes o después de registrarte.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">¿Tienes preguntas antes de empezar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Escríbenos y te ayudamos a evaluar si EmpresaOS encaja con la operación de tu empresa.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="outline">
              <a href={`mailto:${siteConfig.supportEmail}`}>
                <MessageCircle className="h-4 w-4" />
                Escribir a soporte
              </a>
            </Button>
            <Button asChild size="lg">
              <Link href="/register">Crear cuenta gratis</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EmpresaOS</p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-foreground">
              Soporte
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
