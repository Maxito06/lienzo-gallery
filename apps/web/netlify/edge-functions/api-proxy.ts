const API_ORIGIN = "https://lienzo-api.onrender.com";

export default async (request: Request) => {
  const url = new URL(request.url);
  const target = `${API_ORIGIN}${url.pathname.replace(/^\/api/, "")}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
};
