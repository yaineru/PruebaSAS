import { notFound } from "next/navigation";
import { Webhook } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { WebhookManagement } from "@/components/webhook-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Webhooks"
};

export default async function WebhooksPage() {
  const tenant = await getTenantContext();

  // Only admins can access webhooks
  if (tenant.role !== "ADMIN") {
    notFound();
  }

  const supabase = await createClient();

  // Get webhooks
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("company_id", tenant.companyId)
    .eq("active", true);

  if (error) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Webhook className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Webhooks</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Integra EmpresaOS con tus sistemas externos mediante webhooks. Recibirás notificaciones en tiempo real
          cuando ocurran eventos importantes.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Webhooks</CardTitle>
          <CardDescription>
            Configura webhooks para recibir notificaciones en tiempo real en tus sistemas externos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookManagement webhooks={webhooks || []} />
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-base">⚙️ Cómo funcionan los Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>1. Crear Webhook:</strong> Proporciona la URL donde recibirás las notificaciones y selecciona los
            eventos
          </p>
          <p>
            <strong>2. Recibirás POST Requests:</strong> Cuando ocurra un evento suscrito, enviaremos un POST request a
            tu URL
          </p>
          <p>
            <strong>3. Validación:</strong> Cada webhook incluye un secret HMAC para validar que viene de EmpresaOS
          </p>
          <p>
            <strong>4. Reintentos:</strong> Si tu servidor no responde, reintentaremos automáticamente hasta 3 veces
          </p>
          <p className="mt-3 font-semibold">
            🔒 El secret HMAC se usa para firmar cada request. Valídalo en tu servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
