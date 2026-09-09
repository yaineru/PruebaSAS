import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

// Solo las páginas realmente públicas - todo lo demás requiere sesión y no
// aporta nada a un buscador (ver también app/robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteConfig.siteUrl, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${siteConfig.siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteConfig.siteUrl}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${siteConfig.siteUrl}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteConfig.siteUrl}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 }
  ];
}
