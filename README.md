# Lienzo

Galería de arte web para que un artista muestre y gestione su obra sin tocar código. Se construye primero como **demo con obras de dominio público**; el contacto y la negociación se hacen por WhatsApp (no es una tienda en línea).

Proyecto de portafolio: busca demostrar criterio de ingeniería (elegir solo las capas que el problema justifica y documentar lo que se descarta).

## Estado

Fase 1 (requerimientos, datos y arquitectura): en curso. Aún no hay código de aplicación.

## Stack previsto

| Pieza | Tecnología | Hosting |
| --- | --- | --- |
| Frontend | Angular 22 con SSR | Netlify |
| API | NestJS + Prisma 7 | Render |
| Base de datos | PostgreSQL | Neon |
| Imágenes | Cloudinary | Cloudinary |

Idiomas: español (principal) e inglés (alternativo).

## Estructura

```
apps/web   Frontend Angular (pendiente)
apps/api   API NestJS (pendiente)
docs/      Requerimientos, modelo de datos, arquitectura y decisiones
```

## Requisitos locales

- Node 24 LTS (ver `.nvmrc`)
- Git

## Documentación

Empieza por [docs/README.md](docs/README.md).

## Convenciones

- Código, tablas y campos en inglés.
- Mensajes de commit en español.
