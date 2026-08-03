import { Plug } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/lib/google/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleCalendarConnectionCard } from "@/components/google-calendar-connection-card";

export const metadata = {
  title: "Integraciones"
};

type PageProps = {
  searchParams: Promise<{ google?: string }>;
};

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const { google } = await searchParams;
  const tenant = await getTenantContext();
  const supabase = await createClient();

  const { data: connectionRow } = await supabase
    .from("google_calendar_connections")
    .select("google_account_email, sync_enabled")
    .eq("user_id", tenant.userId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Integraciones</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Conecta servicios externos para sincronizar información automáticamente.
        </p>
      </section>

      {google === "connected" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Google Calendar conectado correctamente.
        </div>
      )}
      {google === "error" && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo completar la conexión con Google. Intenta nuevamente.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
          <CardDescription>
            Sincroniza automáticamente tus actividades de la Agenda con tu Google Calendar personal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleCalendarConnectionCard
            configured={isGoogleConfigured()}
            connection={
              connectionRow
                ? { googleAccountEmail: connectionRow.google_account_email, syncEnabled: connectionRow.sync_enabled }
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
