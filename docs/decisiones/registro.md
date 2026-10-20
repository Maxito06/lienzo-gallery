# Registro de decisiones

Decisiones de la fase 1 cerradas con su justificación. Fuente: sección «Decisiones abiertas» de [requerimientos](../requerimientos.md). Los nombres de código van en inglés y los commits en español.

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

- Proxy /api/* mediante Edge Function propia en Netlify: las redirecciones de netlify.toml no se aplican a las páginas SSR de Angular, porque el SSR corre como Edge Function y las Edge Functions se ejecutan antes que las redirecciones; se comprobó que /api/health devolvía el mismo 404 de texto plano que una ruta inventada. Se declara en netlify.toml una Edge Function propia (`apps/web/netlify/edge-functions/api-proxy.ts`, bloque `[[edge_functions]]` con path `/api/*`) que reenvía a la API en Render quitando el prefijo `/api` y se adelanta a la del framework. Desde el navegador todo vive en un solo dominio, así que la cookie de sesión de la decisión de autenticación del admin es del mismo sitio. Falta afinar el reenvío de cuerpos POST cuando exista el login.

## Resultados de la prueba de humo (TEC-13)

- Front en Netlify (Angular 22 SSR): la ruta inicial se entrega prerenderizada (ng-server-context="ssg"). El SSR dinámico se verificará cuando exista una ruta no prerenderizada.
- API en Render: primera llamada a la BD 1572 ms (local 864 ms). Memoria 113 MB en Render, 95 MB en local.
- Arranque en frío de Render: 32,6 s directo y 23,96 s a través del proxy de Netlify (varía entre unos 24 y 33 s). Con la API despierta: 0,25 s directo y 0,58 s por el proxy. No se verificó el límite de espera de la Edge Function. Se mantiene la llamada de "despertar" con mensaje de espera al abrir el login.
- Cookie __Host- HttpOnly Secure SameSite=Strict: el Set-Cookie atraviesa el proxy intacto y la API recibe la cookie de vuelta.
- Caché: Netlify no cachea las respuestas dinámicas de la API que no declaran Cache-Control, y respeta Cache-Control: no-store. La API debe declarar Cache-Control explícito en respuestas sensibles.
- Cloudinary: la subida directa firmada funciona. La API solo firma (SHA-1 con crypto de Node, parámetros ordenados alfabéticamente); el API_SECRET nunca sale del servidor. El preset lienzo_artworks deja los archivos en lienzo/artworks. Se aceptó una imagen de 7,8 MB: reducir en el navegador antes de subir y verificar el límite de tamaño del plan gratuito.
- Netlify: detener los builds (Build status → Stop builds) para no gastar los 15 créditos por despliegue; activarlos solo cuando se necesite desplegar.
- La tabla SmokeTest y su migración se eliminaron en TEC-05 (el esquema real la sustituyó). Pendiente: limpiar subidas huérfanas de Cloudinary (Fase 3).

## Pruebas

- Las pruebas e2e corren contra una rama aparte de Neon llamada "test", con conexión directa (sin pooler), definida en la variable TEST_DATABASE_URL de apps/api/.env. Nunca contra la base real, porque cada ejecución la borra y recrea.
- Seguro contra accidentes: apps/api/test/test-db.ts compara el identificador del servidor (ep-...) de TEST_DATABASE_URL con el de DATABASE_URL y DIRECT_URL, sin importar el sufijo -pooler, y aborta si coinciden o si falta la variable. Se evalúa al cargar vitest.config.e2e.ts, antes de tocar nada.
- Arranque global (apps/api/test/global-setup.ts): ejecuta `prisma migrate reset --force` con DIRECT_URL apuntando a la rama de pruebas, así el esquema se autorrepara en cada ejecución. prisma.config.ts no define semilla, por lo que la base de pruebas queda vacía.
- Durante las pruebas e2e, DATABASE_URL se sustituye por TEST_DATABASE_URL (config `test.env`) y una prueba lo verifica.
- Las pruebas e2e las ejecuta siempre una persona (`npm run test:e2e` desde apps/api); los agentes de código no deben ejecutarlas, solo `npm run test` y `npm run build`.
- Regla permanente: todo endpoint nuevo se entrega con sus pruebas, incluida la comprobación de que los borradores nunca se exponen en rutas públicas.
- Estado inicial: pruebas de GET /health y GET /health/db (3 pruebas pasando). `npm run test` (unitarias) usa passWithNoTests porque aún no hay pruebas unitarias. Se borraron las pruebas de plantilla de Nest.

## Pendiente de validar

- SSR dinámico en Netlify: hasta ahora solo se comprobó la ruta inicial prerenderizada. Verificar el renderizado en el servidor y la caché de las páginas SSR cuando exista una ruta no prerenderizada (por ejemplo, el detalle de una obra).
- Límite de espera del proxy con un arranque en frío largo: por el proxy se midieron 24 s, pero Render llegó a 32,6 s en una medición directa. No se ha comprobado qué hace la Edge Function si la espera pasa de ahí. Mantener la llamada de "despertar" con mensaje de espera en el login.
- Reenvío de cuerpos POST en el proxy: afinarlo y probarlo cuando exista el login.
- Límite de tamaño por imagen del plan gratuito de Cloudinary: verificarlo antes de la fase de subida de obras.
- Limpieza de subidas huérfanas en Cloudinary: se define en la fase 3.
- Las cadenas de conexión usan sslmode=require; en la próxima versión mayor de pg (v9) cambiará su significado. Plan: cambiar a sslmode=verify-full en apps/api/.env y en las variables de entorno de Render antes de actualizar pg. Por ahora es solo un aviso inofensivo.
- Las pruebas se ejecutan a mano; evaluar automatizarlas en GitHub Actions con su propia rama de Neon más adelante.
