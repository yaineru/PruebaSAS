import { CloudOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Respaldo del Service Worker (public/sw.js) cuando el navegador intenta
// abrir una página que nunca se cacheó y no hay red - por ejemplo, la
// primera vez que se abre la app en un teléfono nuevo dentro de una zona sin
// señal. Es intencionalmente simple: no depende de sesión, de Supabase, ni
// de ningún dato - debe poder mostrarse siempre, sin ninguna dependencia de
// red, exactamente cuando todo lo demás está fallando por falta de conexión.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <CloudOff className="h-5 w-5" />
          </div>
          <CardTitle>Sin conexión</CardTitle>
          <CardDescription>
            Esta pantalla todavía no se había cargado en este dispositivo, así que no hay una versión guardada para
            mostrarte sin conexión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Si ya habías entrado antes a Equipos, Mantenimientos o Novedades, vuelve a esa pantalla desde el menú.</p>
          <p>En cuanto recuperes señal, esta página cargará con normalidad.</p>
        </CardContent>
      </Card>
    </main>
  );
}
