import Link from "next/link";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Términos y condiciones — EmpresaOS"
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <Building2 className="h-4 w-4" /> EmpresaOS
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Términos y condiciones</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-CO")}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          Al crear una cuenta en EmpresaOS aceptas estos términos. Son un conjunto mínimo y claro para
          empezar a operar; no reemplazan un contrato de servicio formal si tu empresa lo requiere.
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
          <h2 className="text-lg font-medium">2. Qué es EmpresaOS</h2>
          <p className="mt-2">
            EmpresaOS es una plataforma para administrar equipos, mantenimientos, documentos, obras,
            novedades, usuarios e informes de tu empresa. La persona que registra la cuenta queda como
            administradora de la organización y puede invitar a más usuarios.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">3. Cuentas y responsabilidad del usuario</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Eres responsable de mantener segura tu contraseña.</li>
            <li>La información que registras (equipos, documentos, etc.) es responsabilidad de tu empresa.</li>
            <li>No debes usar la plataforma para almacenar información ilegal o de terceros sin autorización.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">4. Planes y facturación</h2>
          <p className="mt-2">
            Durante esta etapa inicial, el acceso y las condiciones comerciales (planes, precios, prueba)
            se coordinan directamente con soporte al momento del registro o poco después. Cualquier cambio
            en el estado de tu cuenta (por ejemplo, una suspensión por un tema de pago) se comunica por el
            correo registrado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">5. Disponibilidad del servicio</h2>
          <p className="mt-2">
            Hacemos un esfuerzo razonable para mantener la plataforma disponible, pero no garantizamos
            disponibilidad ininterrumpida. Recomendamos no depender de EmpresaOS como única copia de
            información crítica de tu empresa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">6. Cancelación</h2>
          <p className="mt-2">
            Puedes solicitar la cancelación de tu cuenta en cualquier momento escribiendo a{" "}
            <a className="text-primary underline" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">7. Cambios a estos términos</h2>
          <p className="mt-2">
            Si estos términos cambian de forma relevante, lo indicaremos en esta misma página con una
            nueva fecha de actualización.
          </p>
        </section>

        <p className="text-muted-foreground">
          Ver también nuestra{" "}
          <Link href="/privacidad" className="text-primary underline">
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
