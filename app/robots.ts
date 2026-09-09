import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacidad", "/terminos"],
        // Todo lo demás vive detrás de autenticación - no tiene sentido para
        // un buscador y podría filtrar rutas internas en resultados.
        disallow: ["/dashboard", "/api", "/super-admin", "/settings", "/perfil"]
      }
    ],
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`
  };
}
