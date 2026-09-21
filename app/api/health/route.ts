import { NextResponse } from "next/server";

// Usado por el detector de conectividad real (lib/offline/connectivity.ts):
// `navigator.onLine` solo refleja si hay una interfaz de red activa, no si
// esta aplicación es alcanzable (una red wifi de hotel sin salida a Internet
// real reporta `onLine: true`). Este endpoint es deliberadamente público,
// liviano y sin sesión - ver middleware.ts, que lo excluye del chequeo de
// autenticación igual que robots.txt/sitemap.xml.
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
