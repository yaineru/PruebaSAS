"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// app/error.tsx no captura errores lanzados dentro del propio layout raíz
// (app/layout.tsx) - Next.js requiere este archivo aparte para ese caso, y
// como reemplaza <html>/<body> por completo, no puede usar los componentes
// normales de la app (Button, etc.) ni depender de globals.css.
export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Algo salió mal</h1>
        <p>Ocurrió un error inesperado. Por favor recarga la página.</p>
      </body>
    </html>
  );
}
