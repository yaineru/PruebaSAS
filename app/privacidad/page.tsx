import Link from "next/link";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Política de privacidad — EmpresaOS"
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <Building2 className="h-4 w-4" /> EmpresaOS
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-CO")}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          Esta política explica, en términos simples, qué información recopila EmpresaOS y cómo se usa.
          No sustituye asesoría legal formal; es la base mínima para operar con transparencia mientras la
          plataforma crece.
        </p>

        <section>
          <h2 className="text-lg font-medium">1. Quién presta el servicio</h2>
          <p className="mt-2">
            EmpresaOS es operado por {siteConfig.legalEntityName}. Puedes contactarnos en{" "}
            <a className="text-primary underline" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">2. Qué información recopilamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Datos de registro: nombre, correo electrónico y nombre de la empresa.</li>
            <li>
              Datos operativos que tu empresa registra en la plataforma: equipos, mantenimientos,
              documentos, obras, novedades e informes generados.
            </li>
            <li>Archivos que subes (documentos, fotografías de evidencia, firmas digitales).</li>
            <li>Datos técnicos básicos de acceso (dirección IP, fecha y hora) para seguridad y auditoría.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">3. Cómo se usa esa información</h2>
          <p className="mt-2">
            Únicamente para operar la plataforma: mostrarte tu propia información, generar tus informes,
            enviarte notificaciones que solicitaste (por ejemplo, alertas de vencimiento) y dar soporte
            cuando lo pides. No vendemos tu información a terceros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">4. Aislamiento entre empresas</h2>
          <p className="mt-2">
            EmpresaOS es una plataforma multiempresa: la información que registra tu empresa está aislada
            de la de cualquier otra empresa que use la plataforma. El personal técnico que opera la
            plataforma puede acceder a datos solo para fines de soporte o mantenimiento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">5. Dónde se almacenan los datos</h2>
          <p className="mt-2">
            Los datos se almacenan en infraestructura de terceros especializada en bases de datos y
            almacenamiento de archivos (Supabase), con controles de acceso por empresa y por rol.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">6. Tus derechos</h2>
          <p className="mt-2">
            Puedes solicitar en cualquier momento acceder, corregir o eliminar tu información de cuenta
            escribiendo a{" "}
            <a className="text-primary underline" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
            . Ten en cuenta que algunos datos operativos pertenecen a la empresa que los registró, no a un
            usuario individual.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">7. Cambios a esta política</h2>
          <p className="mt-2">
            Si esta política cambia de forma relevante, lo indicaremos en esta misma página con una nueva
            fecha de actualización.
          </p>
        </section>
      </div>
    </main>
  );
}
