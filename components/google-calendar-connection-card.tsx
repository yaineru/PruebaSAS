'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, Unplug } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { disconnectGoogleCalendar, toggleGoogleSync } from '@/lib/actions/google-connection';

type Props = {
  configured: boolean;
  connection: { googleAccountEmail: string | null; syncEnabled: boolean } | null;
};

export function GoogleCalendarConnectionCard({ configured, connection }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!configured) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Google Calendar aún no está configurado.</p>
        <p className="mt-1">
          Esta integración requiere credenciales OAuth de un proyecto de Google Cloud (cuenta corporativa). El
          administrador del sistema debe configurarlas antes de que puedas conectar tu cuenta.
        </p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border p-4">
        <p className="text-sm text-muted-foreground">
          Conecta tu cuenta de Google para sincronizar automáticamente tus actividades de la Agenda con tu
          Google Calendar personal.
        </p>
        {/* Plain <a>, not next/link: this hits an API route that issues a
            3xx redirect to Google's consent screen, which needs a full
            browser navigation rather than client-side routing. */}
        <a href="/api/google/auth" className={buttonVariants({ variant: 'default' })}>
          <CalendarDays className="h-4 w-4" />
          Conectar Google Calendar
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="font-medium">Conectado</span>
        {connection.googleAccountEmail && (
          <span className="text-muted-foreground">· {connection.googleAccountEmail}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await toggleGoogleSync(!connection.syncEnabled);
              router.refresh();
            })
          }
        >
          {connection.syncEnabled ? 'Pausar sincronización' : 'Reanudar sincronización'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          disabled={isPending}
          onClick={() => {
            if (!confirm('¿Desconectar Google Calendar? Las actividades dejarán de sincronizarse.')) return;
            startTransition(async () => {
              await disconnectGoogleCalendar();
              router.refresh();
            });
          }}
        >
          <Unplug className="h-4 w-4" />
          Desconectar
        </Button>
      </div>
      {!connection.syncEnabled && (
        <p className="text-xs text-amber-600">Sincronización pausada: tus actividades no se están enviando a Google.</p>
      )}
    </div>
  );
}
