// Marca y textos públicos en un solo sitio.
// PROVISIONAL: heroTitle, heroSubtitle, commissionTitle y commissionText los cambiará el dueño.
export const BRAND = {
  name: 'Lienzo',
  heroTitle: 'Obra original',
  heroSubtitle: 'Pintura, acuarela, dibujo y grabado. Cada pieza es única.',
  commissionTitle: '¿Quieres un cuadro a tu medida?',
  commissionText: 'Cuéntame qué tienes en mente y lo conversamos.',
  footerNote: 'galería de demostración con obras de dominio público',
  credits: 'Proyecto de portafolio de Maximiliano Correa Pico',
  githubUrl: 'https://github.com/Maxito06/lienzo-gallery',
  githubLabel: 'Código en GitHub',
  // Datos públicos que se compilan en el sitio. Cada despliegue de un cliente los cambia aquí.
  // URL base del sitio, sin barra final (canonical, enlaces de WhatsApp y sitemap)
  siteUrl: 'https://lienzo-gallery.netlify.app',
  // WhatsApp en formato internacional, solo dígitos con indicativo de país (sin '+' ni espacios).
  // Max decide qué número publicar; si está vacío, el botón de WhatsApp no se muestra.
  whatsappNumber: '573013423836',
} as const;
