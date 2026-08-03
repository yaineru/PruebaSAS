import { Mail } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailSettingsForm } from "@/components/email-settings-form";
import { EmailLogTable } from "@/components/email-log-table";

export const metadata = { title: "Correo" };

export default async function EmailSettingsPage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  const [{ data: settings }, { data: logRows }] = await Promise.all([
    supabase
      .from("email_settings")
      .select("smtp_host, smtp_port, smtp_user, smtp_secure, from_email, from_name, reply_to, timeout_ms, max_retries, enabled, last_test_at, last_test_ok, last_test_error")
      .eq("company_id", tenant.companyId)
      .maybeSingle(),
    supabase
      .from("email_log")
      .select("id, to_email, subject, template_key, provider, status, attempts, error_message, smtp_server, sent_at, created_at")
      .eq("company_id", tenant.companyId)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  if (tenant.role !== "ADMIN" && tenant.role !== "SUPER_ADMIN") {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Solo un administrador puede configurar el correo saliente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Correo</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Configura tu propio servidor SMTP para enviar recordatorios, informes y alertas sin depender de un
          servicio de terceros. Si no lo activas, EmpresaOS sigue funcionando por completo — solo se omite el envío
          de correos (las notificaciones dentro de la app no se ven afectadas).
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Servidor SMTP</CardTitle>
          <CardDescription>Datos de conexión de tu proveedor de correo (tu propio dominio, Gmail, Outlook, etc.).</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSettingsForm settings={settings ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de correos</CardTitle>
          <CardDescription>Últimos 50 envíos de esta empresa, con reintento manual disponible.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailLogTable rows={logRows ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
