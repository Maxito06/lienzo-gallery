# Decisiones visuales de la web pública

- **Tono:** sobrio y moderno. Una galería cuidada, no un museo exagerado.
- **Fondo blanco hueso (`#fbfaf8`):** muy sutil y no cálido, para no alterar los colores de las obras.
- **Identidad solo tipográfica:** Instrument Serif para títulos y Hanken Grotesk para el texto, autohospedadas desde npm. El nombre y los textos de portada y de encargos salen de `BRAND` (`apps/web/src/app/core/brand.config.ts`), de modo que se pueden cambiar sin tocar las plantillas.
- **Galería de una sola cuadrícula** con filtros y paginación. Sin salas, para no obligar a hacer scroll.
- **Cartela discreta** en cada tarjeta: título, técnica, año y estado. La descripción solo aparece en el detalle.
- **El toque de "casa"** vive únicamente en la página de detalle. Próxima pasada: la primera foto colgada sobre una foto de sala a escala real, con alternancia a "Solo la obra".
- **Filtros en desplegables**, para que escalen si aparecen más técnicas o series. En móvil se agrupan en un diálogo a pantalla completa.

## Vista en pared

- La foto principal de la obra se monta sobre una foto de sala a escala real, usando `widthCm` y `heightCm`. El sofá de 2,1 m sirve de referencia.
- **Calibración** (`ROOM_SCENE` en `apps/web/src/app/core/room-scene.config.ts`): en la foto de la sala, el sofá (210 cm) mide 965 px de 1998 px de ancho. El escenario (4/3, `overflow: hidden`) recorta la foto con `width` 142,6 %, `left` −21,4 % y `top` −6,2 %.
- **Fórmulas** (porcentajes del escenario): ancho = 0,3288 × ancho en cm; `left` = 50,9 − 0,1644 × ancho en cm; `top` = 50,5 − 0,4383 × alto en cm. El alto sale de `aspect-ratio: ancho / alto` en CSS. Ejemplo: 100 × 75 cm da ancho 32,9 %, `left` 34,46 % y `top` 17,6 %.
- Se puede alternar a "Solo la obra". Si no hay medidas, o la obra no cabe (`top` < 3 %, ancho > 80 % o `left` < 3 %), no hay vista de pared ni selector: solo se muestra la foto.
- La imagen de la sala es una imagen generada con IA, propiedad del dueño, y está en `apps/web/public/images/sala-demo.jpg`.
- No añade peso relevante: es un único archivo cacheable, y la foto de la obra reutiliza los anchos de Cloudinary que ya existían (600 y 1200).

## Panel de administración

- Sencillo y funcional: orden y legibilidad antes que decoración.
- Comparte los tokens de color y las fuentes de la web pública (Instrument Serif para títulos, Hanken Grotesk para texto).
- Los estilos compartidos llevan el prefijo `adm-` y viven en `apps/web/src/styles.css` (página, tarjeta, botones, formularios, tabla, insignias y avisos), de modo que los componentes casi no necesitan CSS propio.
- Las insignias de estado siempre muestran el texto (Publicada, Borrador, Disponible, Reservada, Vendida); el color no es el único indicador. El mapeo estado → variante está en `features/admin/status-badge.ts`.
- Sin librerías de UI ni animaciones.
- El admin no se indexa: sus páginas fijan `noindex` mediante `SeoService`.
- Si hay medidas válidas pero la obra no cabe en la pared (demasiado grande o muy alargada), se muestra la foto sola con una nota discreta bajo el escenario: "Por sus medidas, esta obra no cabe en la vista de pared de ejemplo." Si faltan medidas no se muestra ninguna nota.
