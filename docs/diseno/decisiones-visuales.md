# Decisiones visuales de la web pública

- **Tono:** sobrio y moderno. Una galería cuidada, no un museo exagerado.
- **Fondo blanco hueso (`#fbfaf8`):** muy sutil y no cálido, para no alterar los colores de las obras.
- **Identidad solo tipográfica:** Instrument Serif para títulos y Hanken Grotesk para el texto, autohospedadas desde npm. El nombre y los textos de portada y de encargos salen de `BRAND` (`apps/web/src/app/core/brand.config.ts`), de modo que se pueden cambiar sin tocar las plantillas.
- **Galería de una sola cuadrícula** con filtros y paginación. Sin salas, para no obligar a hacer scroll.
- **Cartela discreta** en cada tarjeta: título, técnica, año y estado. La descripción solo aparece en el detalle.
- **El toque de "casa"** vive únicamente en la página de detalle. Próxima pasada: la primera foto colgada sobre una foto de sala a escala real, con alternancia a "Solo la obra".
- **Filtros en desplegables**, para que escalen si aparecen más técnicas o series. En móvil se agrupan en un diálogo a pantalla completa.
