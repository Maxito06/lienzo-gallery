// Número de WhatsApp en formato internacional, sin '+' ni espacios (por ejemplo 573001234567).
// El repositorio es público, así que Max decide qué número publicar; si está vacío, el botón no se muestra.
export const WHATSAPP_NUMBER = '573013423836';

function whatsappMessageLink(message: string): string | null {
  if (!WHATSAPP_NUMBER) {
    return null;
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Consulta por una obra concreta, o null si falta el número
export function whatsappLink(artworkTitle: string): string | null {
  return whatsappMessageLink(`Hola, me interesa la obra «${artworkTitle}» de la galería Lienzo.`);
}

// Consulta general (menú "Contacto"), o null si falta el número
export function whatsappGeneralLink(): string | null {
  return whatsappMessageLink('Hola, quisiera consultar sobre la galería Lienzo.');
}

// Encargo de una obra nueva, o null si falta el número
export function whatsappCommissionLink(): string | null {
  return whatsappMessageLink('Hola, me gustaría encargar una obra. ¿Podemos conversar?');
}
