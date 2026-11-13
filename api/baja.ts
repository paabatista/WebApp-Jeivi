import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin.js';
import { firmaValida } from './_lib/baja.js';

/** Enlace "Dejar de recibir estos correos" del correo diario. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = String(req.query.u || '');
  const firma = String(req.query.t || '');
  const pagina = (titulo: string, texto: string) =>
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f4f9;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border-radius:16px;padding:28px;max-width:420px;text-align:center"><h1 style="font-size:22px">${titulo}</h1><p style="color:#6b6478">${texto}</p></div></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!uid || !firmaValida(uid, firma)) return res.status(400).send(pagina('Enlace no válido', 'El enlace está incompleto o vencido.'));
  try {
    await adminDb().doc(`users/${uid}`).set({ suscritoCorreo: false }, { merge: true });
    return res.send(pagina('Listo', 'Ya no recibirás la lectura diaria por correo. Puedes volver a activarla desde tu perfil en Jeivi.'));
  } catch (e) {
    console.error(e);
    return res.status(500).send(pagina('Error', 'No pudimos procesar la solicitud. Intenta más tarde.'));
  }
}
