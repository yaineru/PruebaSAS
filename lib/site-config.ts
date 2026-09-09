// Datos de contacto y legales del operador de la plataforma. Centralizados
// acá para editarlos en un solo lugar (landing, footer, páginas legales).
//
// ⚠️ PENDIENTE DE COMPLETAR: los valores de abajo son placeholders. Antes de
// publicar tráfico real, reemplázalos por los datos reales de quien presta
// el servicio (razón social, NIT/identificación fiscal si aplica, correo y
// WhatsApp de soporte reales).
export const siteConfig = {
  productName: "EmpresaOS",
  legalEntityName: "[COMPLETAR: razón social / NIT de quien presta el servicio]",
  supportEmail: "soporte@empresaos.com", // TODO: reemplazar por el correo real de soporte
  supportWhatsapp: "", // TODO: número real en formato internacional, ej. "+57 300 000 0000"
  siteUrl: process.env.APP_URL || "http://localhost:3000"
};
