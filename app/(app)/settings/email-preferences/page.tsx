import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { EmailPreferencesForm } from "@/components/email-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmailSubscription } from "@/lib/notifications";

export const metadata = {
  title: "Preferencias de Email"
};

export default async function EmailPreferencesPage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  // Get email subscriptions
  const { data: subscriptions, error } = await supabase
    .from("email_subscriptions")
    .select("*")
    .eq("user_id", tenant.userId);

  if (error) {
    notFound();
  }

  const mappedSubscriptions: EmailSubscription[] = (subscriptions || []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    eventType: row.event_type,
    enabled: row.enabled,
    frequency: row.frequency,
    lastSentAt: row.last_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Preferencias de Email</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Controla qué notificaciones por correo electrónico deseas recibir y con qué frecuencia.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Suscripciones a Eventos</CardTitle>
          <CardDescription>
            Elige qué eventos deseas recibir por correo y con qué frecuencia (inmediata, diaria o semanal)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailPreferencesForm subscriptions={mappedSubscriptions} />
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">💡 Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Notificaciones Inmediatas: Recibirás un email tan pronto como ocurra el evento</p>
          <p>• Resumen Diario: Consolidamos eventos del día en un email al final del día</p>
          <p>• Resumen Semanal: Resumen consolidado cada lunes a las 9 AM</p>
          <p>• Siempre puedes desactivar cualquier tipo de notificación</p>
        </CardContent>
      </Card>
    </div>
  );
}
