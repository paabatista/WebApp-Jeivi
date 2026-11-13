import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin.js';
import { firmaValida } from './_lib/baja.js';

const IGLESIA_ID = process.env.IGLESIA_ID || process.env.VITE_IGLESIA_ID || 'imperio-de-vida';

/** Enlace "Dejar de recibir estos correos" del correo diario. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // k = 'u:<uid>' (usuario del equipo) o 's:<id>' (suscriptor de la congregación)
  const clave = String(req.query.k || '');
  const firma = String(req.query.t || '');
  const pagina = (titulo: string, texto: string) =>
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f4f9;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border-radius:16px;padding:28px;max-width:420px;text-align:center"><h1 style="font-size:22px">${titulo}</h1><p style="color:#6b6478">${texto}</p></div></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!clave || !firmaValida(clave, firma)) return res.status(400).send(pagina('Enlace no válido', 'El enlace está incompleto o vencido.'));
  try {
    const db = adminDb();
    const [tipo, id] = [clave.slice(0, 2), clave.slice(2)];
    if (tipo === 's:') await db.doc(`iglesias/${IGLESIA_ID}/suscriptores/${id}`).set({ activo: false }, { merge: true });
    else if (tipo === 'u:') await db.doc(`users/${id}`).set({ suscritoCorreo: false }, { merge: true });
    else return res.status(400).send(pagina('Enlace no válido', 'El enlace está incompleto.'));
    return res.send(pagina('Listo', 'Ya no recibirás la lectura diaria por correo.'));
  } catch (e) {
    console.error(e);
    return res.status(500).send(pagina('Error', 'No pudimos procesar la solicitud. Intenta más tarde.'));
  }
}
