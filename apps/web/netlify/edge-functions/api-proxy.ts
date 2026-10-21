// Destino de la API: la variable API_ORIGIN de Netlify; si falta, se usa esta URL de respaldo
const FALLBACK_API_ORIGIN = "https://lienzo-api.onrender.com";

export default async (request: Request) => {
  // En las Edge Functions de Netlify las variables se leen con Netlify.env.get
  const apiOrigin = (Netlify.env.get("API_ORIGIN") || FALLBACK_API_ORIGIN).replace(/\/+$/, "");
  const url = new URL(request.url);
  const target = `${apiOrigin}${url.pathname.replace(/^\/api/, "")}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
};
