import type { VercelRequest } from '@vercel/node';

/**
 * CORS limitado: las funciones /api solo aceptan llamadas desde la propia app
 * (APP_URL o el mismo dominio). No se envía Access-Control-Allow-Origin a nadie más,
 * así que otros sitios no pueden leer las respuestas.
 */
export function origenPermitido(req: VercelRequest): boolean {
  const origen = req.headers.origin;
  if (!origen) return true; // llamadas del servidor (cron) o navegación directa
  const permitidos = new Set<string>();
  if (process.env.APP_URL) permitidos.add(new URL(process.env.APP_URL).origin);
  if (req.headers.host) permitidos.add(`https://${req.headers.host}`);
  return permitidos.has(origen);
}
