import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EmpresaOS",
    short_name: "EmpresaOS",
    description: "Gestión multiempresa de activos, mantenimiento y operaciones.",
    // La app instalada como PWA (uso real en campo) debe abrir directo al
    // panel, no a la landing pública nueva - si no hay sesión, el middleware
    // igual rebota a /login como siempre.
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
