export const SESSION_COOKIE_NAME = '__Host-session';

// Lee una cookie por nombre exacto desde la cabecera Cookie
export function getCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const pair = part.trim();
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index) !== name) continue;
    const value = pair.slice(index + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

// Sin domain, a propósito: lo exige el prefijo __Host-
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/',
};
