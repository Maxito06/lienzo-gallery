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
- Estado actual: pruebas e2e de GET /health, GET /health/db, sesiones, login/logout/me y protección (CSRF, límite de intentos y guard), y pruebas unitarias del limitador de intentos de login (apps/api/src/auth/login-rate-limiter.spec.ts), que se ejecutan con `npm run test` y no usan base de datos. Se borraron las pruebas de plantilla de Nest. `passWithNoTests` se conserva en la configuración unitaria por si en algún momento no hubiera ninguna.

## Autenticación del administrador (HU-07)

- Sesiones propias guardadas en la tabla admin_session. La cookie lleva `<id>.<secreto>`: el id es un UUID y el secreto son 32 bytes aleatorios. En la base solo se guarda el SHA-256 del secreto, así que ver la tabla no permite usar ninguna sesión. La comparación se hace en tiempo constante.
- Expiración: 30 minutos de inactividad y 8 horas como máximo (expiresAt). lastSeenAt se renueva como máximo una vez por minuto para no escribir en cada petición. Una sesión vencida se borra al validarla.
- Cookie `__Host-session`: HttpOnly, Secure, SameSite=Strict, Path=/ y sin Domain (lo exige el prefijo `__Host-`). Las respuestas de autenticación llevan Cache-Control: no-store.
- Contraseñas con Argon2id. Correo inexistente y contraseña incorrecta devuelven el mismo 401 «Invalid credentials», y un hash falso calculado al arrancar la app iguala los tiempos de respuesta para no revelar qué correos existen. Las entradas están acotadas (correo hasta 254 caracteres, contraseña hasta 1024).
- CSRF: además de SameSite=Strict, un guard global exige la cabecera `X-Requested-With: lienzo-web` en todo método que no sea GET, HEAD u OPTIONS. Un sitio ajeno no puede enviarla sin una consulta previa que la API no autoriza. El frontend Angular deberá enviarla en todas sus peticiones.
- Protección de rutas: toda ruta de administración se declara con `@UseGuards(AdminGuard)`. Regla permanente: cada ruta de administración nueva lleva ese guard y una prueba que compruebe que sin sesión responde 401.
- Límite de intentos: 5 fallos por correo (normalizado a minúsculas) en 15 minutos; después responde 429 con Retry-After. El intento se cuenta antes de verificar la contraseña para que las peticiones en paralelo no puedan saltarse el límite. No se usa la IP del visitante porque detrás del proxy de Netlify la API no puede conocerla de forma fiable.
- Límites aceptados: el contador vive en memoria, así que se reinicia cuando Render reinicia la API (máximo 10 000 correos registrados a la vez). Además, quien conozca el correo del administrador puede bloquear su login durante 15 minutos; se acepta porque no da acceso a la cuenta y es preferible a permitir fuerza bruta.
- Sin dependencias nuevas: la lectura de cookies y el limitador son código propio pequeño, con pruebas.

## Administración de obras, técnicas y series (HU-08, HU-10, HU-11, HU-13, HU-14)

- Todas las rutas viven bajo /admin/ y llevan @UseGuards(AdminGuard); sin sesión responden 401 y, sin la cabecera CSRF en métodos que cambian estado, 403. Cada ruta se prueba con ambas comprobaciones.
- Técnicas y series: nombre en español obligatorio y en inglés opcional (vacío o null lo borra), máximo 80 caracteres. El slug se genera del nombre en español (sin tildes, con guiones) y nunca cambia al editar, para no romper URLs de filtros futuras. Dos nombres que dan el mismo slug responden 409. La lista devuelve artworkCount.
- Borrado: una técnica con obras no se puede borrar (409), porque la técnica es obligatoria en cada obra. Una serie con obras sí se borra y sus obras quedan sin serie (el esquema usa SetNull).
- Obras: toda obra nace como borrador; crear y editar ignoran publishedAt e isDemo aunque el cliente los envíe. El slug se genera del título y, si ya existe, recibe sufijo (-2, -3...); tampoco cambia al editar. Una técnica o serie inexistente en el cuerpo responde 400. La validación vive en un archivo propio con pruebas unitarias (título hasta 120 caracteres, año 1000-2100, medidas con un decimal y hasta 9999.9, precio de referencia entero en pesos, descripciones hasta 2000 caracteres).
- Publicar y retirar son endpoints propios (POST /admin/artworks/:id/publish y /unpublish), idempotentes. No se puede publicar una obra sin foto principal (409), para que la galería nunca muestre una tarjeta vacía. Al retirar y volver a publicar, la fecha de publicación se renueva.
- Las listas de administración no están paginadas por ahora (volumen esperado pequeño).

## Lectura pública del catálogo (HU-14)

- Toda lectura pública de obras, técnicas y series pasa por PublicCatalogService, y toda consulta de obras usa una única función publishedWhere que añade el filtro de publicadas. Una prueba unitaria de arquitectura falla si cualquier archivo fuera de admin/, public/ y seed/ accede a obras, imágenes, técnicas o series con Prisma, y otra comprueba que cada consulta del servicio use publishedWhere.
- No se filtra la existencia de borradores: un borrador y un slug inexistente responden el mismo 404; los conteos de técnicas y series cuentan solo obras publicadas; las técnicas y series sin ninguna obra publicada no aparecen en los listados de filtros.
- Las respuestas públicas usan campos explícitos (sin id ni fechas internas; solo el listado de slugs para el mapa del sitio incluye updatedAt) y las pruebas comprueban las claves exactas. Incluyen isDemo para poder indicar al visitante que los datos de demostración son ficticios.
- Rutas: GET /public/artworks (page desde 1, pageSize por defecto 12 y máximo 48, filtros series, technique y status, orden por fecha de publicación descendente), GET /public/artworks/:slug, GET /public/techniques y GET /public/series. Los parámetros inválidos o repetidos responden 400; page tiene un tope de 100000.
- Todavía no se envían cabeceras de caché en estas rutas; se decide al conectar el frontend, junto con la purga de caché de Netlify (RF-19).

## Imágenes de obras (HU-09)

- Subida directa del navegador a Cloudinary con una firma corta emitida por la API (POST /admin/artworks/:id/images/sign); después el navegador avisa a la API (POST /admin/artworks/:id/images) y la API consulta a Cloudinary por la foto real antes de registrarla. La API no confía en lo que diga el navegador.
- Verificación en el servidor: formato jpg, png o webp, máximo 10 MB y 25 megapíxeles. Son los límites del plan gratuito de Cloudinary (10 MB y 25 MP por imagen, según su documentación oficial consultada el 2026-10-20). Una foto rechazada se borra de Cloudinary (en mejor esfuerzo) y la API responde 422.
- Solo se aceptan identificadores dentro de la carpeta lienzo/artworks/, para que nadie registre en una obra un archivo cualquiera de la cuenta. Máximo 8 fotos por obra (409 a la novena). La primera foto de una obra queda como principal.
- Restricciones únicas en la base de datos (migración image_unique_constraints): cloudinary_public_id único, para que borrar una foto nunca borre un archivo que otra sigue usando, y (artwork_id, position) único. Un registro simultáneo de la misma foto da un 201 y un 409. Se eliminó el índice simple sobre artwork_id porque la restricción compuesta lo cubre.
- Elegir principal: en una transacción se quita la marca a la anterior y se pone a la nueva (respeta el índice parcial de una principal por obra).
- Reordenar: PUT /admin/artworks/:id/images/order con la lista completa de ids; debe coincidir exactamente con las fotos de la obra. En una transacción se desplazan las posiciones +1000 y luego se asignan 1..n, para no chocar con la restricción única.
- Eliminar una foto: si era la principal y quedan otras, la de menor posición pasa a ser la principal; las posiciones se compactan. No se puede eliminar la última foto de una obra publicada (409; hay que retirarla antes). Borrar una obra también borra sus archivos. El archivo de Cloudinary se borra después de confirmar la base de datos y, si Cloudinary falla, la petición no falla: queda un aviso en el log y el archivo huérfano.
- Cloudinary sin configurar responde 503 y Cloudinary caído responde 502. Variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET y CLOUDINARY_UPLOAD_PRESET, leídas en cada llamada.
- En las pruebas, Cloudinary se reemplaza por un falso, y la configuración e2e deja vacías las variables de Cloudinary como red de seguridad: ninguna prueba puede llegar al Cloudinary real.
- Cliente propio con fetch y la API de administración de Cloudinary, sin su SDK, para no sumar dependencias.

## Panel de administración (frontend)

- Base técnica: Angular con componentes standalone, signals y HttpClient con fetch. `strict` y `strictTemplates` están activados desde el principio. En desarrollo, un proxy (`apps/web/proxy.conf.json`) reenvía `/api` a la API local (puerto 3000) quitando el prefijo, igual que hace la Edge Function de Netlify en producción.
- Interceptor CSRF: añade `X-Requested-With: lienzo-web` solo a las peticiones que no son GET, HEAD ni OPTIONS y cuya URL empieza por `/api/`; así la cabecera no se envía a Cloudinary ni a otros dominios.
- Interceptor de sesión caducada: ante un 401 en una URL `/api/admin/` limpia el usuario y lleva al login; no toca `/api/auth/` para que el login vea su propio 401. Consecuencia aceptada: la sesión caducada se detecta al hacer una acción o al recargar, no antes.
- Rutas: `admin/**` se renderiza solo en el navegador (`RenderMode.Client`), porque depende de la cookie y es privado. Un guard consulta `GET /auth/me`; si no hay sesión (o la consulta falla) lleva a `/admin/login`. El login lanza una llamada a `/api/health` para despertar Render y muestra un aviso si la API tarda más de 3 s en responder. El resto de rutas sigue prerenderizado.
- Pantallas: login, técnicas, series, obras (lista, formulario, publicar y despublicar, eliminar con confirmación inline «¿Seguro? Sí / No», sin `window.confirm`) e imágenes de cada obra. La marca «Demo» sale de `isDemo`, campo que se añadió a las respuestas de administración de obras (lista, detalle, publicar y retirar). Los textos visibles están en español y cada botón lleva su equivalente en inglés en un comentario del template, para traducirlos después. El diseño es mínimo; el definitivo se hace más adelante.
- Al crear una obra se navega a su pantalla de edición para poder subir las imágenes enseguida; al editar se vuelve al listado.
- Las pruebas del frontend usan Vitest, `HttpTestingController` y servicios falsos: ninguna llega a la red ni a Cloudinary.

## Imágenes: carpetas dinámicas de Cloudinary

- Problema: la cuenta de Cloudinary usa carpetas dinámicas. Al subir con el upload preset, Cloudinary devolvía un `public_id` sin prefijo (por ejemplo `wew11cr2p9bqna6s1mj0`) y la carpeta quedaba aparte, en `asset_folder`. La API exige `^lienzo/artworks/[A-Za-z0-9_-]{1,100}$` y respondía 400 al registrar la foto. Las pruebas no lo detectaron porque usan un Cloudinary falso; se vio al probar con la nube real. Esto corrige el supuesto de la prueba de humo de que el preset deja los archivos en `lienzo/artworks`.
- Solución: la API genera el `public_id` completo (`lienzo/artworks/` más 16 bytes aleatorios en base64url) al firmar y lo incluye en la firma junto con `timestamp` y `upload_preset` (SHA-1 con los parámetros en orden alfabético y el secreto al final). La respuesta de `sign` lleva también `publicId` y el navegador lo envía como `public_id` en la subida. Así no depende del modo de carpetas de la cuenta y el cliente no elige nombres. El registro sigue verificando el archivo contra Cloudinary.
- Flujo de subida: el navegador sube directo a Cloudinary (firma, subida, registro). Se procesan los archivos de uno en uno y un fallo no cancela los siguientes. Las fotos de más de 10 MB o de más de 25 MP se reducen en el navegador con canvas a JPEG: fondo blanco, calidad 0.9 bajando a 0.6, después se reduce el tamaño un 15 %, con un máximo de 8 iteraciones y un objetivo de 9 MiB; si no lo consigue, avisa. Las demás se suben sin tocar. Los límites del frontend repiten los de la API y los del plan gratuito.
- Miniaturas: una sola transformación por tamaño (`f_auto,q_auto` y un ancho fijo; 80 px en la lista y 240 px en la pantalla de imágenes) para cuidar los créditos. El nombre de la nube es una constante pública del frontend (`core/cloudinary.config.ts`); no es un secreto. Si se vaciara, las miniaturas dejarían de mostrarse.

## Pendiente de validar

- SSR dinámico en Netlify: hasta ahora solo se comprobó la ruta inicial prerenderizada. Verificar el renderizado en el servidor y la caché de las páginas SSR cuando exista una ruta no prerenderizada (por ejemplo, el detalle de una obra).
- Límite de espera del proxy con un arranque en frío largo: por el proxy se midieron 24 s, pero Render llegó a 32,6 s en una medición directa. No se ha comprobado qué hace la Edge Function si la espera pasa de ahí. Mantener la llamada de "despertar" con mensaje de espera en el login.
- Reenvío de cuerpos POST en el proxy: afinarlo y validarlo con el login real en producción: cuerpo POST, cabecera X-Requested-With, cookie `__Host-session` de ida y vuelta y arranque en frío de Render.
- Cloudinary plan gratuito: 10 MB y 25 MP por imagen (verificado), 25 créditos al mes y sin pago por excedente; si se superan las cuotas de forma continuada, la cuenta se desactiva por partes. El panel ya reduce en el navegador las fotos que superan 10 MB o 25 MP (ver «Imágenes: carpetas dinámicas de Cloudinary»); falta probarlo a mano. Revisar el consumo de créditos de vez en cuando.
- Archivos huérfanos en Cloudinary: quedan cuando un navegador sube una foto firmada y no la registra, y cuando falla el borrado de un archivo ya eliminado de la base de datos. Definir una limpieza periódica (comparar los archivos de la carpeta lienzo/artworks con los registrados).
- Las cadenas de conexión usan sslmode=require; en la próxima versión mayor de pg (v9) cambiará su significado. Plan: cambiar a sslmode=verify-full en apps/api/.env y en las variables de entorno de Render antes de actualizar pg. Por ahora es solo un aviso inofensivo.
- Las pruebas se ejecutan a mano; evaluar automatizarlas en GitHub Actions con su propia rama de Neon más adelante.
- Sesiones vencidas que nadie vuelve a usar: quedan en la tabla. SessionsService.deleteExpired existe pero aún no se ejecuta de forma periódica. Definir cuándo (por ejemplo, al iniciar sesión o con una tarea programada).
- El contador de intentos de login es en memoria; evaluar guardarlo en la base de datos si se vuelve un problema.
- Subida real en producción: Render necesita las variables CLOUDINARY_* (incluido el upload preset firmado) para que la firma y el registro de fotos funcionen; sin ellas responden 503. Falta comprobar también el CORS de la subida directa desde el dominio de Netlify.
- Archivos huérfanos de pruebas: quedaron subidos en Cloudinary los de las subidas fallidas anteriores a la corrección (por ejemplo, `wew11cr2p9bqna6s1mj0`). Borrarlos a mano en la Media Library, sin tocar las imágenes de las 12 obras de demostración. Además de la limpieza periódica general de arriba.
- El script de seed firma sus subidas con su propia fórmula, sin `public_id`; revisarlo si se vuelve a ejecutar con carpetas dinámicas.
- La reducción de imágenes con canvas no tiene prueba automática: probar a mano con una foto de más de 10 MB y con un PNG con transparencia.
- Las peticiones de la web hechas en el servidor (SSR) usan un origen absoluto de la API, tomado de la variable `API_ORIGIN` (`ApiOriginBackend`); en producción hay que definirla en Netlify (ver «Preparación del primer despliegue»).
- Estado de las pruebas: frontend 157 (Vitest, 2026-10-21; `npx ng test --watch=false`). API: 34 unitarias y 114 e2e según el último conteo (2026-10-20, no actualizado); los e2e se cuentan por los `it(` de `apps/api/test` y los ejecuta Max.
- RF-19: al publicar, retirar o editar una obra, la API debe purgar la caché de Netlify. Aún no está implementado.
- Mapa del sitio: debe construirse con PublicCatalogService.listPublishedSlugs (ya existe y está probado), nunca con una consulta propia.
- Concurrencia: con un solo administrador se aceptan carreras raras (por ejemplo, quitar la foto principal justo mientras otra petición publica la obra). Reevaluar si hubiera más de un administrador.


## Preparación del primer despliegue

### Configuración manual en el panel de Netlify

- Proyecto `lienzo-gallery` (lienzo-gallery.netlify.app).
- Base directory: `apps/web`.
- Variable de entorno `API_ORIGIN` = `https://lienzo-api.onrender.com`. La leen la Edge Function del proxy y el SSR (`ApiOriginBackend`).
- Los builds están detenidos: reanudarlos solo cuando se vaya a desplegar, porque cada despliegue a producción cuesta 15 créditos.

### Hecho en el código

- `apps/web/angular.json`: `security.allowedHosts` (en las opciones del builder de aplicación) ahora es `["lienzo-gallery.netlify.app"]`. Angular SSR rechaza las peticiones cuyo `Host` no esté en la lista (protección contra SSRF y cabeceras `Host` manipuladas); `localhost` ya está permitido en desarrollo. Si faltara en producción, el servidor no renderizaría las páginas de ese dominio y respondería con error. Si se añade un dominio propio, hay que agregarlo aquí.
- `apps/web/netlify/edge-functions/api-proxy.ts`: el destino sale de `Netlify.env.get("API_ORIGIN")` y, si falta, usa `https://lienzo-api.onrender.com`. El resto del proxy no cambió. No hay pruebas automáticas de esta función.
- `apps/web/netlify.toml`: `command = "npm run build"` explícito. El `.nvmrc` (Node 24) está en la raíz del repositorio y no en `apps/web`, así que se añadió `NODE_VERSION = "24"` en `[build.environment]`.

### Pendientes del despliegue

- `sitemap.xml` (con `PublicCatalogService.listPublishedSlugs`), `robots.txt` y URLs canónicas.
- Número de WhatsApp en una variable de configuración (hoy está en `core/contact.config.ts`).
- Purga de la caché de Netlify al publicar, retirar o editar una obra (RF-19) y cabeceras de caché de las rutas públicas.
- Migraciones de Prisma en el pipeline de Render (hoy no hay un paso que las aplique).
- Comprobar en producción el SSR dinámico, el login a través del proxy y el CORS de la subida directa a Cloudinary.


## SEO y mensajes de WhatsApp

### Hecho

- `brand.config.ts` ahora guarda `siteUrl` (`https://lienzo-gallery.netlify.app`, sin barra final) y `whatsappNumber`. Ambos son datos públicos que se compilan en el sitio; cada despliegue de un cliente los cambia en ese archivo. `contact.config.ts` los lee de `BRAND` y ya no tiene el número escrito (`WHATSAPP_NUMBER` sigue exportado como alias).
- Mensajes de WhatsApp: `whatsappLink(titulo, slug)` incluye el título y el enlace absoluto de la obra (`siteUrl/obras/slug`), codificado con `encodeURIComponent`. El mensaje general y el de encargo no cambiaron. Todo está en español.
- `SeoService.setPage` acepta `path`. Si la página es indexable crea o actualiza `<link rel="canonical">` y `og:url` con `siteUrl + path`; si es `noindex` o no hay `path`, ambos se eliminan. El canonical de la galería es siempre `/` (sin filtros ni página); el del detalle es `/obras/<slug>`; la 404 sigue `noindex` y sin canonical.
- JSON-LD `VisualArtwork` en el detalle (`SeoService.setArtworkStructuredData`): nombre, imagen (Cloudinary, ancho 1200), url canónica, técnica (`artform`), año (`dateCreated`), medidas en cm solo si existen y descripción solo si existe. No lleva precio ni ofertas. Se serializa escapando `<` como `<` y se crea/actualiza sin duplicar la etiqueta; cada `setPage` la elimina, así que no sobrevive en otra página. Usa `DOCUMENT` y `Renderer2`, por lo que funciona en SSR.
- `public/robots.txt`: permite todo, bloquea `/admin/` e indica el sitemap. El build lo copia a `dist/lienzo-web/browser`.
- `sitemap.xml` se genera en la Edge Function `netlify/edge-functions/sitemap.ts` (registrada en `netlify.toml`) a partir del listado público `/public/artworks` (páginas de 48, tope de 50 páginas, timeout de 20 s). No hay endpoint nuevo en la API. Incluye la portada y una entrada por obra publicada; no lleva `<lastmod>` porque el listado público no devuelve fecha. Si la API falla responde 503 con `no-store`. La URL del sitio sale de la variable `SITE_URL` de Netlify y, si falta, de una constante que debe coincidir con `BRAND.siteUrl`.
- La construcción del XML (`buildSitemapXml`) es una función pura, pero no tiene prueba: Vitest solo recorre `src/` vía `ng test` y no hay forma de probarla sin cambiar la configuración.

### Pendientes

- Cuando se active el inglés: añadir al mensaje de WhatsApp una línea adicional en español para visitantes en inglés.
- Si se añade caché a las rutas públicas o al sitemap, purgarla al publicar, retirar o editar una obra (RF-19).
- Con dominio propio: cambiar `siteUrl` en `brand.config.ts`, `Sitemap:` en `robots.txt`, la constante/variable `SITE_URL` del sitemap y `security.allowedHosts` en `angular.json`.


## Salud y monitoreo

### Endpoint /health

- `GET /health` responde `200 { "status": "ok" }`, es público (el guard global solo exige la cabecera CSRF en métodos que cambian estado) y envía `Cache-Control: no-store`. No consulta la base de datos ni ningún servicio externo: así un monitor puede mantener despierta la API sin gastar las horas de cómputo de Neon. No hay limitador de peticiones global, así que no hizo falta excluirlo.
- Ya existía `GET /health/db` (mide la latencia de la base de datos); se dejó como estaba y no debe usarse para el monitor.

### Registro de errores del servidor

- `ServerErrorFilter` (`apps/api/src/common/server-error.filter.ts`) es un filtro global que extiende el de Nest: la respuesta al cliente no cambia.
- Para errores con estado >= 500 escribe una línea JSON con el Logger de Nest (nivel error): `timestamp`, `method`, `path` (sin query string), `status`, `errorName`, `message` y `stack`.
- Nunca se registran cuerpo, cabeceras, cookies, query string, correos, contraseñas ni datos del usuario. Los 4xx no se registran.
- Los errores no controlados ya no producen además la línea de texto que Nest escribe por defecto.

### Aviso de API lenta

- `features/shared/slow-loading-hint` se coloca dentro del estado de carga de la galería y del detalle. Pasados 4 s sin respuesta muestra, con `role="status"`, que la galería está despertando y que la primera visita puede tardar hasta 30 s. Desaparece al llegar los datos o al fallar. El temporizador solo se crea en el navegador (`afterNextRender`) y se limpia al destruir el componente.

### Mantener despierta la API

- Render gratis duerme la API tras ~15 minutos sin tráfico. El dueño del proyecto debe configurar a mano un monitor externo (UptimeRobot, plan gratis) que haga una petición HTTP a `https://lienzo-api.onrender.com/health` cada 5 minutos.
- Límites conocidos: las horas gratuitas de Render alcanzan para un solo servicio siempre despierto; si el monitor falla, la API vuelve a dormirse.

## Pruebas end-to-end

Pruebas con Playwright (`apps/web/e2e/`) que recorren la web real en Chromium.

### Qué cubren

- `public.spec.ts`: galería (título y tarjetas), filtro por técnica con su chip y "Limpiar filtros", apertura de una obra, modos "En la pared" / "Solo la obra", enlace de WhatsApp (sin hacer clic), etiquetas SEO del detalle y de la galería (canonical, `og:url`, JSON-LD sin precio ni ofertas), página no encontrada con `noindex`, `robots.txt` y navegación con teclado en el visor.
- `admin.spec.ts`: redirección al login sin sesión, login con credenciales falsas (error y sin sesión) y login válido hasta la lista de obras con cierre de sesión.

### No escriben datos

- Ninguna prueba crea, edita, publica, oculta ni borra nada: solo leen y navegan. El login válido solo abre sesión y la cierra.
- Motivo: corren contra la API real, conectada a la rama `main` de Neon, que es la base de producción.
- La prueba de credenciales falsas usa un correo inventado para no activar el límite de intentos del administrador. Las credenciales reales no se imprimen: el admin corre sin trazas ni capturas y los valores no pasan por los pasos del informe.

### Cómo ejecutarlas

1. Arrancar la API (`http://localhost:3000`) y la web (`npx ng serve` en `apps/web`, `http://localhost:4200`).
2. Instalar el navegador una sola vez: `npx playwright install chromium`.
3. Para las pruebas de administración, definir en la terminal (PowerShell):
   - `$env:E2E_ADMIN_EMAIL = "..."`
   - `$env:E2E_ADMIN_PASSWORD = "..."`
   Si faltan, esas pruebas se saltan con el motivo "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set".
4. Desde `apps/web`: `npm run e2e` (o `npm run e2e:headed` para ver el navegador). La web puede apuntarse a otra URL con `E2E_BASE_URL`.
5. El informe HTML queda en `playwright-report/` (ignorado por git).

### Pendientes

- Ejecutarlas en el pipeline (TEC-07) requerirá una API y una base de pruebas propias.
- Pruebas de edición del administrador (crear, editar, publicar, borrar) sobre la rama `test` de Neon, nunca sobre `main`.

## Integración continua

Pipeline de GitHub Actions en `.github/workflows/ci.yml`. Se ejecuta en cada push a `main` y en cada pull request hacia `main`; una ejecución nueva en la misma rama cancela la anterior.

### Qué ejecuta

- Job `api` (`apps/api`): `npm ci` (su `postinstall` ya genera el cliente de Prisma), `npm run build` y `npm run test` (pruebas unitarias con Vitest).
- Job `web` (`apps/web`): `npm ci`, `npx ng test --watch=false` (jsdom, sin navegador) y `npx ng build`.
- Ambos corren en paralelo, en `ubuntu-latest` con Node 24 (la misma que Netlify y `.nvmrc`), con caché de npm y un límite de 15 minutos.

### Qué no ejecuta, y por qué

- Pruebas e2e de la API: borran datos y necesitan una base de datos y secretos.
- Pruebas Playwright de la web: necesitan la API y la web levantadas y una base de datos.
- Despliegues: Netlify y Render despliegan por su cuenta.

### Sin secretos

El workflow no usa secretos de GitHub ni cadenas de conexión. `prisma.config.ts` trae una URL falsa por defecto, de modo que `prisma generate` funciona sin variables. Los permisos del workflow son solo de lectura (`contents: read`).

### Ver el resultado

En la pestaña Actions del repositorio en GitHub, o en las comprobaciones de cada pull request.

### Pendientes

- Fase 2: pruebas e2e de la API; requiere un secreto `TEST_DATABASE_URL` con la rama `test` de Neon y las migraciones aplicadas antes.
- Playwright en CI, con la API y la base de pruebas.
- Proteger la rama `main` exigiendo que el CI pase antes de fusionar.
