# Lienzo – Requerimientos v1

Oct 16, 2026 · @Max

## Contexto y objetivo

Lienzo es una galería web de arte que permite a un artista mostrar y gestionar su obra sin tocar código, construida primero como **demo con obras de dominio público**. Si al artista le gusta, se reemplazan las obras de demo por las suyas cargándolas desde el panel de administración.

- **Para qué existe:** ser la pieza más robusta del portafolio, con backend propio, base de datos, autenticación, pruebas y despliegue, cubriendo la brecha de backend independiente.
- **Qué debe demostrar:** criterio de ingeniería, es decir, elegir solo las capas que el problema justifica y dejar por escrito por qué se descartan las demás.
- **Qué no es:** una tienda en línea. El contacto y la negociación se hacen por WhatsApp.
- **Tiempo estimado:** 3 a 5 semanas con dedicación constante, como orientación y no como compromiso.

## Alcance

Entra todo lo que el problema exige; queda fuera lo que no se justifica hoy, y cada exclusión queda documentada como decisión.

| Entra | Queda fuera | Por qué queda fuera |
| --- | --- | --- |
| Galería pública (grilla, filtros por serie y técnica, página de obra) | Pasarela de pagos y carrito | No hay cliente ni volumen; las obras de arte se negocian |
| Estado de obra: disponible, reservada, vendida | Registro de usuarios públicos | El visitante no necesita cuenta |
| Panel admin con un solo rol (CRUD de obras, series y técnicas) | Escalabilidad y caché distribuido | Una galería de un artista no lo requiere |
| Subida y optimización de imágenes | Monitoreo avanzado | Basta uptime y errores con capa gratuita |
| SEO y rendimiento (Angular con SSR) | Analítica de clics a WhatsApp | Posible fase 2 |
| Idioma doble para el visitante (español e inglés); el panel admin queda solo en español |  |  |
| API propia y PostgreSQL con migraciones |  |  |
| Autenticación del admin, validación y seguridad básica |  |  |
| Pruebas (API y E2E con Playwright) y CI/CD con GitHub Actions |  |  |
| Documentación: README, diagrama de arquitectura, decisiones |  |  |

**Supuestos:**

- Todo el proyecto cabe en capas gratuitas de hosting, base de datos y almacenamiento de imágenes.
- El demo usa un número de WhatsApp de prueba; el real se configura después.
- Las imágenes de demo vienen de colecciones abiertas, con título, técnica, medidas y año reales.
- El panel de administración se mantiene solo en español; el inglés aplica únicamente a lo que ve el visitante.
- El inglés se activa en la última fase, si el tiempo lo permite; el modelo de datos guarda los dos idiomas desde la fase 1.

## Actores y roles

Hay dos actores: el visitante, que no necesita cuenta, y el administrador, que es el artista.

| Actor | Autenticado | Qué puede hacer |
| --- | --- | --- |
| Visitante | No | Explorar la galería, filtrar, ver el detalle de una obra, contactar al artista por WhatsApp |
| Administrador (artista) | Sí | Todo lo del visitante, más crear, editar y eliminar obras y series, cambiar el estado de una obra y subir imágenes |

## Historias de usuario

| ID | Como... | Quiero... | Criterio de aceptación |
| --- | --- | --- | --- |
| HU-01 | Visitante | Ver todas las obras en una grilla | Se muestran imagen, título y estado; carga paginada |
| HU-02 | Visitante | Filtrar por serie, técnica y estado | El filtro actualiza la lista sin recargar y se refleja en la URL |
| HU-03 | Visitante | Ver el detalle de una obra | Muestra las fotos, inicialmente en un carrusel, con la principal primero, más título, técnica, medidas, año, serie y estado |
| HU-04 | Visitante | Escribirle al artista por una obra concreta | El botón abre WhatsApp con un mensaje que incluye título y enlace de la obra |
| HU-05 | Visitante | Pedir una obra nueva por encargo | Un botón general abre WhatsApp con un mensaje de encargo prellenado |
| HU-06 | Visitante | Que la galería cargue rápido y se encuentre en Google | Cada obra tiene URL propia, metadatos y se renderiza en el servidor |
| HU-07 | Admin | Iniciar sesión de forma segura | Solo accede con credenciales válidas; el resto de rutas admin se bloquean |
| HU-08 | Admin | Crear, editar y eliminar obras | Los cambios se ven de inmediato en la galería pública; la descripción es opcional y puede llevar versión en inglés |
| HU-09 | Admin | Subir imágenes de una obra | Puede subir hasta 8 fotos, elegir la principal y ordenarlas; se validan tipo y tamaño, y se generan versiones optimizadas |
| HU-10 | Admin | Marcar una obra como disponible, reservada o vendida | El estado se refleja en grilla y detalle |
| HU-11 | Admin | Organizar obras en series | Una obra pertenece a una serie opcional; las series se gestionan desde el panel, con nombre en español (obligatorio) e inglés (opcional) |
| HU-12 | Visitante | Cambiar el idioma del sitio entre español e inglés | El selector cambia los textos fijos y los textos de la obra; si falta la versión en inglés, se muestra la de español |
| HU-13 | Admin | Gestionar la lista de técnicas con su nombre en español (obligatorio) e inglés (opcional) | Al crear una obra elige la técnica de la lista y su traducción se muestra sola al visitante |
| HU-14 | Admin | Guardar una obra como borrador y publicarla cuando quiera | Un borrador solo lo ve el admin; el interruptor publica o retira la obra y el cambio se ve de inmediato |

## Requisitos funcionales

| ID | Requisito | Historia |
| --- | --- | --- |
| RF-01 | La galería pública lista las obras en grilla paginada, con imagen, título y estado | HU-01 |
| RF-02 | Se puede filtrar por serie, técnica y estado, y los filtros viven en la URL | HU-02 |
| RF-03 | Cada obra tiene una página de detalle con URL propia y legible | HU-03, HU-06 |
| RF-04 | Cada obra muestra su estado: disponible, reservada o vendida | HU-10 |
| RF-05 | El botón de contacto por obra genera un enlace de WhatsApp con título y URL de la obra | HU-04 |
| RF-06 | Un botón general abre WhatsApp con un mensaje de encargo prellenado | HU-05 |
| RF-07 | El número de WhatsApp se lee de configuración, nunca del código | HU-04, HU-05 |
| RF-08 | El admin inicia sesión con credenciales; las rutas y endpoints de administración exigen autenticación | HU-07 |
| RF-09 | El admin crea, edita y elimina obras con título, técnica, medidas, año, serie, estado y descripción opcional | HU-08 |
| RF-10 | El admin gestiona series (crear, renombrar, eliminar) | HU-11 |
| RF-11 | El admin sube hasta 8 imágenes por obra, define la principal, cambia su orden y las elimina; el sistema rechaza una novena | HU-09 |
| RF-12 | El sistema valida tipo y tamaño de imagen (en la subida a Cloudinary y otra vez en la API) y genera versiones optimizadas; el panel reduce automáticamente las fotos demasiado grandes antes de subirlas, sin que el artista haga nada | HU-09 |
| RF-13 | Las páginas públicas se renderizan en el servidor con metadatos para buscadores y redes sociales | HU-06 |
| RF-14 | El sitio marca claramente que las obras del demo son de demostración | Contexto |
| RF-15 | El sitio ofrece un selector de idioma (español e inglés) que cambia los textos fijos y los textos de las obras | HU-12 |
| RF-16 | La descripción de la obra es opcional y tiene versión en español e inglés; si falta la de inglés se muestra la de español, y si no hay descripción no se muestra ese bloque | HU-08, HU-12 |
| RF-17 | Las técnicas son una lista gestionada por el admin, cada una con nombre en español (obligatorio) e inglés (opcional, con respaldo en español) | HU-13 |
| RF-18 | Las series tienen nombre en español (obligatorio) e inglés (opcional, con respaldo en español) | HU-11, HU-12 |
| RF-19 | Al publicar, editar o eliminar una obra o serie, el backend purga el caché de las páginas afectadas para que el cambio se vea de inmediato | HU-08, HU-10 |
| RF-20 | El admin puede registrar un precio de referencia opcional en pesos colombianos; se muestra solo si está lleno y la obra no está vendida, y si no se muestra «Precio a consultar» | HU-08, HU-03 |
| RF-21 | Los mensajes de WhatsApp (por obra y de encargo) se generan en el idioma del visitante; si es inglés, incluyen además una línea en español | HU-04, HU-05, HU-12 |
| RF-22 | El admin puede guardar una obra como borrador; un borrador solo lo ve el admin y no aparece en la galería, el detalle, los filtros ni el mapa del sitio, y el admin lo publica o lo retira con un interruptor | HU-14 |
| RF-23 | La página de detalle muestra todas las fotos de la obra, con la principal primero y luego en el orden definido por el admin, inicialmente en un carrusel (la forma de presentación se confirma en el diseño); con una sola foto no muestra controles | HU-03 |

## Requisitos no funcionales

| ID | Categoría | Requisito |
| --- | --- | --- |
| RNF-01 | Rendimiento | Las páginas públicas alcanzan 90 o más en Lighthouse (rendimiento, SEO, accesibilidad, buenas prácticas); imágenes en formatos modernos y carga diferida |
| RNF-02 | Seguridad | Contraseñas con hash, sesiones o tokens con expiración, validación de entradas en servidor, secretos solo en variables de entorno |
| RNF-03 | Seguridad | Subida de archivos con lista de tipos permitidos, límite de tamaño y identificadores asignados por el servidor |
| RNF-04 | Seguridad | Límite de intentos en el login y en cualquier formulario público |
| RNF-05 | Datos | Esquema versionado con migraciones; el seed de demo se carga con un comando |
| RNF-06 | Pruebas | Pruebas de API y E2E con Playwright de los flujos críticos: filtrar, ver detalle, WhatsApp, login admin y CRUD de obra |
| RNF-07 | Entrega | Pipeline de CI/CD con GitHub Actions que corre pruebas antes de desplegar |
| RNF-08 | Observabilidad | Errores del servidor con registro estructurado y un chequeo de salud; monitoreo de disponibilidad en capa gratuita |
| RNF-09 | Accesibilidad | Navegación por teclado (incluido el carrusel de fotos), textos alternativos en imágenes y contraste suficiente |
| RNF-10 | Diseño | Interfaz adaptable a móvil primero |
| RNF-11 | Costo | Operación en capas gratuitas, sin servicios de pago |
| RNF-12 | Mantenibilidad | Código con nombres en inglés, estructura documentada y decisiones registradas en el repositorio |
| RNF-13 | SEO | Con dos idiomas, cada versión tiene su URL y etiquetas hreflang para que los buscadores indexen ambas |
| RNF-14 | Datos | El modelo de datos guarda español (principal) e inglés (alternativo) en columnas por idioma desde la fase 1, aunque el inglés se active al final; no se contemplan más idiomas |

## Reglas de negocio y datos de demo

**Reglas de negocio**

- Una obra tiene exactamente un estado: disponible, reservada o vendida.
- Las obras vendidas siguen visibles en la galería como parte del portafolio del artista, pero sin botón de contacto de compra.
- Una obra pertenece a una serie opcional; una serie puede tener muchas obras.
- El precio de referencia es opcional: se muestra solo si el artista lo llena y la obra no está vendida; si no, se muestra «Precio a consultar» y el precio se acuerda por WhatsApp.
- Mensaje por obra: incluye título y enlace de esa obra. Mensaje general: invita a pedir una obra nueva por encargo.

* Título, medidas y año no se traducen; se muestran igual en ambos idiomas.
* La descripción es opcional: si falta la versión en inglés se muestra la de español, y si no hay descripción no se muestra ese bloque.
* La técnica y la serie se eligen de listas con nombre en español e inglés, para que el admin no traduzca cada obra.
* El panel de administración está solo en español.

**Datos de demo**

- Solo obras de dominio público, de colecciones abiertas como Met Museum, Art Institute of Chicago, Rijksmuseum y Wikimedia Commons.
- Se evita arte moderno con derechos vigentes.
- Cambiar de demo a obras reales debe ser solo cargar datos desde el panel, nunca cambiar código.

## Fases de trabajo

Cada fase termina con algo funcionando y su commit; no se avanza a la siguiente sin cumplir el criterio de terminado. El seguimiento diario se lleva en el tablero de Trello "Galería de Arte – Portafolio", con una tarjeta por historia, decisión y tarea técnica.

| Fase | Entregable | Criterio de terminado |
| --- | --- | --- |
| 1. Requerimientos, datos y arquitectura | Este documento aprobado, modelo de datos, diagrama de arquitectura, stack elegido | Decisiones registradas en el repositorio |
| 2. Backend, BD y autenticación | API con migraciones, seed de demo y login admin | Pruebas de API pasando; endpoints admin protegidos |
| 3. Panel de administración | CRUD de obras y series, subida y optimización de imágenes | Un admin carga una obra completa desde la interfaz |
| 4. Galería pública | Grilla, filtros, detalle, WhatsApp y SSR con SEO | Flujo de visitante completo y Lighthouse sobre el umbral |
| 5. Calidad, CI/CD y despliegue | E2E con Playwright, pipeline, deploy, README, decisiones documentadas e inglés para el visitante (si el tiempo lo permite) | Sitio público en línea con pruebas corriendo en CI |

## Decisiones abiertas

Estas decisiones son la agenda de la fase 1: se debaten una por una en el chat, con pros y contras, y cada una que se cierra se registra en el repositorio. Cada una tiene su tarjeta en Trello.

- [ ] Validar con la prueba de humo (TEC-13) el arranque en frío, el caché de Netlify y el login a través del proxy (cookie y límite de 26 segundos)

**Decididas**

- La galería de arte es el proyecto, elegida sobre la app de gimnasio y la plataforma para colegios.
- Demo con obras de dominio público; contacto por WhatsApp, sin pasarela de pagos.
- Idioma doble (opción B): español como idioma principal e inglés como alternativo para el visitante, sin contemplar más idiomas; panel admin solo en español; inglés al final si el tiempo lo permite.
- Descripción de obra opcional, con respaldo en español.
- Seguimiento del proyecto en Trello.
- Nombres de código en inglés y mensajes de commit en español.
- Stack del backend: NestJS (TypeScript), por su encaje con Angular, un solo lenguaje con el frontend y el servidor de SSR, y herramientas integradas para validación, autenticación y límite de intentos. Descartados: FastAPI (dos lenguajes en el proyecto), Spring Boot (pesado para este tamaño y para hosting gratuito) y Express solo (más trabajo manual).
- Base de datos: Neon (PostgreSQL gestionado, plan gratuito permanente). Descartados: Supabase (se pausa tras una semana sin uso y trae servicios que no usamos) y Render Postgres (la base gratuita expira a los 30 días).
- ORM: Prisma 7 con el cliente sin motor Rust, aislado en una sola capa de NestJS para poder cambiarlo si hiciera falta. Las migraciones se aplican desde el pipeline o desde local, no desde el servidor gratuito, y se mide el uso de memoria cuando la app corra.
- Hosting del backend: Render (plan gratuito) para la API de NestJS. No se depende de mantener el servicio despierto con pings, porque la política de Render no lo respalda; el arranque en frío se mitiga con el caché de la CDN.
- Imágenes: Cloudinary (plan gratuito permanente, sin tarjeta), que almacena, optimiza y sirve por CDN, para no procesar imágenes en el servidor gratuito. Se guarda el identificador de la imagen y no la dirección completa, y el acceso va aislado en una sola capa de NestJS. El panel reduce automáticamente las fotos que superen el límite de 25 megapíxeles. Las fotos se suben directo del navegador a Cloudinary con una autorización corta firmada por la API, y la API verifica tipo, tamaño y dimensiones antes de registrarlas; así no pasan por el proxy de Netlify ni por la memoria de Render. Las fotos subidas y nunca confirmadas se etiquetan para limpiarlas, con un mecanismo por definir en la fase 3. Plan B: Cloudflare R2. Por verificar antes de desplegar: qué ocurre al agotar los créditos.
- Hosting del frontend: Netlify (plan gratuito) con Angular SSR. Las páginas públicas se guardan en la CDN con una vigencia larga y el backend purga ese caché al publicar un cambio, para que se vea de inmediato. Los despliegues a producción se hacen solo al publicar versiones, porque cada uno gasta créditos del límite mensual. Descartados: Vercel (plan gratuito solo para uso no comercial y Angular SSR con configuración manual) y Cloudflare Workers (límite de CPU muy ajustado). Plan B: un solo servicio en Render con NestJS y SSR juntos. Se valida con una prueba de humo (TEC-13).
- Autenticación del admin: sesión propia guardada en la base de datos (solo se guarda el hash de la llave), con cookie `__Host-` HttpOnly, Secure y SameSite=Strict. El navegador solo habla con Netlify, que reenvía `/api/*` a Render (proxy), para que la cookie sea del mismo sitio. Contraseña con Argon2id (mínimo de OWASP: 19 MiB de memoria, 2 iteraciones, 1 de paralelismo). Expiración de 30 minutos de inactividad y 8 horas máximas, y el cierre de sesión invalida la sesión en el servidor. Límite de intentos en el login, mensaje de error genérico, protección CSRF en las acciones que modifican datos, y la cuenta del admin se crea con el seed, sin registro público. Sin doble factor en v1. Descartados: JWT en localStorage (OWASP lo desaconseja), JWT en memoria con cookie de refresco (más complejo y sin beneficio con un solo admin) y servicios externos de autenticación (dependencia excesiva para un solo usuario). Por validar con la prueba de humo: que la cookie pase por el proxy de Netlify y cómo se comporta el login tras el arranque en frío, porque el proxy corta a los 26 segundos.
- Precio de referencia: campo opcional por obra, en pesos colombianos, que se muestra solo si el artista lo llena y la obra no está vendida; si no, se muestra «Precio a consultar».
- Mensajes de WhatsApp: en el idioma del visitante y, si es inglés, con una línea adicional en español para que el artista siempre entienda.
- Nombre: Lienzo, para mantener una identidad en español porque el artista es colombiano y habla español; repositorio `lienzo-gallery`. El subdominio de Netlify `lienzo-gallery` aparentaba estar libre; se confirma al crear el sitio. No se usa el nombre del artista mientras sea un demo.

* Modelo de datos (TEC-02): 6 tablas (obras, imágenes, técnicas, series, administrador y sesiones), descritas en el documento "Lienzo – Modelo de datos v1". Solo dos idiomas, español principal e inglés alternativo, guardados en columnas por idioma y no en tablas de traducción, porque no se agregarán más idiomas. Español obligatorio e inglés opcional, con respaldo en español, en técnicas y series. Borradores simples: published\_at vacío es un borrador y solo lo ve el admin; la publicación automática en una fecha programada queda fuera de v1.

- Fotos: hasta 8 por obra, mostradas inicialmente en un carrusel en la página de detalle (la forma de presentación se confirma en el diseño y puede cambiar) con la principal primero; el admin las sube, las ordena, elige la principal y las elimina. El tope de 8 se aplica en el panel y en la API.
