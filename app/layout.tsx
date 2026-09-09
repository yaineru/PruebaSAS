import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({ subsets: ["latin"] });

const title = "EmpresaOS — Gestión de maquinaria, mantenimiento y operaciones";
const description =
  "Controla equipos, mantenimientos, documentos, obras y novedades de tu empresa desde una sola plataforma, con datos aislados por empresa.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: title,
    template: "%s · EmpresaOS"
  },
  description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "EmpresaOS",
    statusBarStyle: "default"
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteConfig.siteUrl,
    siteName: "EmpresaOS",
    title,
    description
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export const viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
