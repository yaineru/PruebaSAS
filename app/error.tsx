"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error boundary captured", {
      message: error.message,
      digest: error.digest
    });
    // Antes de esto, un error real de producción solo se veía en la consola
    // del navegador del usuario - nadie del lado del operador se enteraba.
    // No-op si SENTRY_DSN no está configurado (ver instrumentation-client.ts).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-md border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">No se pudo cargar esta vista</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrio un error inesperado. Intenta nuevamente o vuelve al dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>Reintentar</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Ir al dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
