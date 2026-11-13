import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Entrega una foto de Firebase Storage desde el mismo dominio de la app.
 * Los banners se dibujan en un <canvas>; si la foto viene de otro dominio sin CORS,
 * el navegador no deja descargar ni compartir la imagen. Con esto funciona aunque el
 * bucket no tenga CORS configurado.
 *
 * Seguridad: solo acepta URLs de descarga del bucket de esta app (que ya llevan su token),
 * solo devuelve imágenes y con tamaño limitado. No es un proxy abierto.
 */
const MAX = 15 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const bucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '';
  let url: URL;
  try {
    url = new URL(String(req.query.u || ''));
  } catch {
    return res.status(400).send('URL no válida');
  }
  const valida =
    !!bucket &&
    url.protocol === 'https:' &&
    url.hostname === 'firebasestorage.googleapis.com' &&
    url.pathname.startsWith(`/v0/b/${bucket}/o/`) &&
    url.searchParams.get('alt') === 'media';
  if (!valida) return res.status(400).send('URL no permitida');

  try {
    const r = await fetch(url.toString());
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).send('No se pudo obtener la imagen');
    if (!tipo.startsWith('image/')) return res.status(415).send('No es una imagen');
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length > MAX) return res.status(413).send('Imagen demasiado grande');
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(datos);
  } catch (e) {
    console.error(e);
    return res.status(502).send('No se pudo obtener la imagen');
  }
}
