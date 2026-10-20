// Número de WhatsApp en formato internacional, sin '+' ni espacios (por ejemplo 573001234567).
// El repositorio es público, así que Max decide qué número publicar; si está vacío, el botón no se muestra.
export const WHATSAPP_NUMBER = '573013423836';

// Enlace de WhatsApp con el mensaje prellenado, o null si falta el número
export function whatsappLink(artworkTitle: string): string | null {
  if (!WHATSAPP_NUMBER) {
    return null;
  }
  const message = `Hola, me interesa la obra «${artworkTitle}» de la galería Lienzo.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
