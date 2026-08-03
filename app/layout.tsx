import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EmpresaOS",
  description: "SaaS multiempresa para maquinaria, mantenimiento, activos y operaciones",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "EmpresaOS",
    statusBarStyle: "default"
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
