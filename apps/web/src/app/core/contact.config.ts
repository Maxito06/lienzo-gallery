import { BRAND } from './brand.config';

// El número vive en brand.config.ts (dato público que se compila en el sitio)
export const WHATSAPP_NUMBER: string = BRAND.whatsappNumber;

function whatsappMessageLink(message: string): string | null {
  if (!WHATSAPP_NUMBER) {
    return null;
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Consulta por una obra concreta (con su enlace absoluto), o null si falta el número.
// Por ahora el mensaje es solo en español; la línea adicional en español para visitantes
// en inglés llegará con el sitio bilingüe.
export function whatsappLink(artworkTitle: string, slug: string): string | null {
  return whatsappMessageLink(
    `Hola, me interesa la obra «${artworkTitle}» de la galería ${BRAND.name}.\n${BRAND.siteUrl}/obras/${slug}`,
  );
}

// Consulta general (menú "Contacto"), o null si falta el número
export function whatsappGeneralLink(): string | null {
  return whatsappMessageLink(`Hola, quisiera consultar sobre la galería ${BRAND.name}.`);
}

// Encargo de una obra nueva, o null si falta el número
export function whatsappCommissionLink(): string | null {
  return whatsappMessageLink('Hola, me gustaría encargar una obra. ¿Podemos conversar?');
}
