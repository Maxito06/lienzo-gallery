# Lienzo – Arquitectura v1

Oct 16, 2026 · @Max

El visitante y el artista solo hablan con Netlify, salvo las fotos, que van directo a Cloudinary; todo corre en planes gratuitos.

## Mapa general

Netlify sirve las páginas con Angular SSR, las guarda en su caché y reenvía las llamadas de datos a la API en Render. Solo la API habla con la base de datos. Las fotos van directo entre el navegador y Cloudinary; la API solo firma la subida, la verifica y borra.

```mermaid
flowchart TD
  V["Visitante<br/>Navegador"]
  A["Artista (admin)<br/>Navegador"]
  subgraph N["Netlify · plan gratuito"]
    SSR["Angular SSR"]
    C["Caché CDN"]
    P["Proxy /api"]
  end
  R["API NestJS + Prisma<br/>Render · plan gratuito"]
  DB[("PostgreSQL<br/>Neon · plan gratuito")]
  CL["Cloudinary<br/>Fotos y CDN"]
  V -->|"pide páginas"| N
  A -->|"panel y llamadas /api"| N
  SSR -->|"datos públicos"| R
  P -->|"llamadas del panel"| R
  R --> DB
  R -.->|"purga el caché al publicar"| C
  R -->|"firma, verifica y borra fotos"| CL
  A -->|"sube fotos con la firma"| CL
  V -->|"carga las fotos"| CL
```

## Recorridos

### Una visita normal

Si la página está en el caché de la CDN, se entrega al instante; si no, el SSR la arma pidiendo los datos a la API y la guarda en caché.

```mermaid
sequenceDiagram
  actor V as Visitante
  participant N as Netlify (SSR y caché)
  participant R as API en Render
  participant DB as Neon
  participant CL as Cloudinary
  V->>N: Pide una página
  alt está en el caché
    N-->>V: Entrega la página guardada
  else no está en el caché
    N->>R: Pide los datos públicos
    R->>DB: Consulta las obras publicadas
    DB-->>R: Datos
    R-->>N: Datos
    N-->>V: Página armada, y la guarda en caché
  end
  V->>CL: Carga las fotos
  CL-->>V: Fotos optimizadas
```

### El login del artista

El panel carga solo en el navegador y, antes del formulario, despierta la API con una llamada liviana, porque Render puede estar dormido.

```mermaid
sequenceDiagram
  actor A as Artista
  participant N as Netlify (proxy /api)
  participant R as API en Render
  participant DB as Neon
  A->>N: Abre /admin (carga solo en el navegador)
  A->>N: Llamada de despertar a /api/health
  N->>R: Reenvía (Render puede estar dormido)
  R-->>A: Listo
  A->>N: Correo y contraseña a /api/auth/login
  N->>R: Reenvía
  R->>DB: Busca la cuenta y verifica Argon2id
  R->>DB: Guarda la sesión (solo el hash de la llave)
  R-->>A: Cookie segura de sesión
  Note over A,R: Las peticiones siguientes llevan la cookie y la API la valida
```

### Publicar una obra con fotos

La foto se reduce en el navegador, se sube directo a Cloudinary con una firma corta de la API, y la API la verifica antes de registrarla.

```mermaid
sequenceDiagram
  actor A as Artista
  participant N as Netlify (proxy /api)
  participant R as API en Render
  participant DB as Neon
  participant CL as Cloudinary
  A->>A: El panel reduce la foto en el navegador
  A->>N: Pide una autorización de subida
  N->>R: Reenvía
  R-->>A: Firma corta para esta subida
  A->>CL: Sube la foto directo con la firma
  CL-->>A: Identificador de la foto
  A->>N: Avisa el identificador y guarda la obra
  N->>R: Reenvía
  R->>CL: Verifica tipo, tamaño y dimensiones
  R->>DB: Guarda la obra y la foto
  R->>N: Purga el caché de las páginas afectadas
  R-->>A: Obra guardada
```

## Qué corre dónde

Todos los datos de límites vienen de las páginas oficiales de cada servicio, consultadas el 2026-10-16.

| Pieza | Qué hace | Dónde corre | Plan | Límite a vigilar |
| --- | --- | --- | --- | --- |
| Angular con SSR | Páginas públicas y panel | Netlify | Gratuito, 300 créditos al mes | Cada despliegue a producción cuesta 15 créditos; al agotarlos se pausan todos los proyectos de la cuenta |
| Caché de páginas | Guarda las páginas ya armadas | CDN de Netlify | Incluido | Hay que configurar las cabeceras y la purga |
| Proxy /api | Reenvía las llamadas del panel a la API | Netlify | Incluido | Corta las peticiones a los 26 segundos |
| API NestJS con Prisma | Datos, login y firma de subidas | Render | Gratuito, 512 MB | Se duerme tras 15 minutos sin tráfico y tarda cerca de un minuto en despertar; 750 horas al mes |
| PostgreSQL | Obras, series, técnicas, cuenta y sesiones | Neon | Gratuito, 1 GB | El cómputo se apaga a los 5 minutos sin uso |
| Fotos | Almacén, optimización y entrega por CDN | Cloudinary | Gratuito, 25 créditos al mes | 10 MB y 25 megapíxeles por foto; verificar qué pasa al agotar los créditos |

## Riesgos y validaciones

La prueba de humo (TEC-13) valida los cinco primeros, y la subida directa de fotos de punta a punta, antes de construir el resto; el plan B de cada uno está pensado de antemano.

| Riesgo | Qué podría pasar | Cómo se valida | Plan B |
| --- | --- | --- | --- |
| Arranque en frío encadenado | La primera visita tras mucho tiempo sin uso tarda más de un minuto | Medir cada pieza y la cadena completa | Caché con vigencia larga; si no basta, un solo servicio en Render con NestJS y SSR juntos |
| Caché de Netlify con Angular SSR | No guarda las páginas o no se purga al publicar | Probar las cabeceras y la purga con una página real | Un solo servicio en Render |
| Cookie de sesión por el proxy | La sesión no se guarda como cookie propia del sitio | Iniciar sesión a través del proxy | Dominio propio con subdominios del mismo sitio, con el costo del dominio |
| Login tras el arranque en frío | El proxy corta a los 26 segundos mientras Render despierta | Llamada de despertar al abrir el login, con reintento y mensaje de espera | Reintento automático en el navegador |
| Memoria de NestJS con Prisma en 512 MB | El servicio se cae por falta de memoria | Medir el uso real | Aligerar la app o cambiar de ORM, que está aislado en una capa |
| Créditos de Cloudinary | Se agotan y el servicio se limita | Revisar el uso y qué ocurre al agotarlos | Cloudflare R2 |
| Fotos subidas y nunca confirmadas | Ocupan espacio sin pertenecer a ninguna obra | Etiquetarlas al subir y limpiarlas | Mecanismo de limpieza por definir en la fase 3 |
| Cambios en los planes gratuitos | Un servicio cambia sus límites | Revisar los planes antes de desplegar | Cada servicio está aislado en una sola capa del código |

Las decisiones que sustentan esta arquitectura están registradas en el documento *Lienzo – Requerimientos v1*, sección Decisiones.
