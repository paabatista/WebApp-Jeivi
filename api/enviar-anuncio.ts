import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, verificarUsuario } from './_lib/firebaseAdmin.js';
import { enviarCorreos, type Correo } from './_lib/correo.js';
import { firmaBaja } from './_lib/baja.js';
import { origenPermitido } from './_lib/origen.js';

/**
 * POST /api/enviar-anuncio  { anuncioId }
 * Un diácono (o superior) envía un anuncio por correo a los suscritos a los avisos.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!origenPermitido(req)) return res.status(403).json({ error: 'Origen no permitido' });
  try {
    const usuario = await verificarUsuario(req.headers.authorization, 30);
    const ig = usuario.iglesiaId;
    const anuncioId = String((req.body as { anuncioId?: string })?.anuncioId || '');
    if (!anuncioId) return res.status(400).json({ error: 'Falta el anuncio' });

    const db = adminDb();
    const ref = db.doc(`iglesias/${ig}/anuncios/${anuncioId}`);
    const [aSnap, igSnap, subs] = await Promise.all([
      ref.get(),
      db.doc(`iglesias/${ig}`).get(),
      db.collection(`iglesias/${ig}/suscriptores`).where('activo', '==', true).get(),
    ]);
    const a = aSnap.data();
    if (!a) return res.status(404).json({ error: 'El anuncio no existe' });
    const iglesia = igSnap.data() || {};
    const primario: string = iglesia.colorPrimario || '#4a2c6d';
    const acento: string = iglesia.colorAcento || '#d4a73a';
    const nombreIglesia: string = iglesia.nombre || 'Iglesia';
    const appUrl = (process.env.APP_URL || `https://${req.headers.host}`).replace(/\/$/, '');

    const vistos = new Set<string>();
    const destinatarios = subs.docs
      .filter((d) => (d.get('temas') || []).includes('anuncios'))
      .map((d) => ({ clave: `s:${d.id}`, email: String(d.get('email') || '').toLowerCase(), nombre: String(d.get('nombre') || '') }))
      .filter((d) => d.email.includes('@') && !vistos.has(d.email) && vistos.add(d.email));

    const correos: Correo[] = destinatarios.map((d) => {
      const bajaUrl = `${appUrl}/api/baja?k=${encodeURIComponent(d.clave)}&t=${firmaBaja(d.clave)}`;
      const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4f9;font-family:Segoe UI,Arial,sans-serif;color:#1f1a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden">
${a.imagen && String(a.imagen).startsWith('https://') ? `<tr><td><img src="${esc(a.imagen)}" alt="" width="520" style="width:100%;display:block"></td></tr>` : ''}
<tr><td style="background:${primario};padding:24px 26px;color:#fff">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:${acento}">${esc(a.categoria || 'Anuncio')}</div>
<div style="font-size:26px;font-weight:800;line-height:1.2;margin-top:8px">${esc(a.titulo)}</div>
${a.cuando ? `<div style="margin-top:8px;font-size:15px">🗓️ ${esc(a.cuando)}</div>` : ''}
</td></tr>
<tr><td style="padding:22px 26px;font-size:15px;line-height:1.55;white-space:pre-line">Hola${d.nombre ? ' ' + esc(d.nombre.split(' ')[0]) : ''},<br><br>${esc(a.texto)}</td></tr>
<tr><td style="padding:0 26px 22px;font-size:12px;color:#6b6478;text-align:center">${esc(nombreIglesia)}<br><a href="${bajaUrl}" style="color:#6b6478">Dejar de recibir estos correos</a></td></tr>
</table></td></tr></table></body></html>`;
      const texto = `${a.titulo}\n${a.cuando || ''}\n\n${a.texto}\n\n${nombreIglesia}\nDejar de recibir: ${bajaUrl}`;
      return { para: d.email, asunto: `📢 ${a.titulo}`, html, texto, bajaUrl };
    });

    const enviado = correos.length ? await enviarCorreos(correos) : 0;
    await ref.set({ enviado: new Date().toISOString(), enviadoA: enviado }, { merge: true });
    return res.json({ ok: true, enviado });
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    console.error(e);
    return res.status(status).json({ error: (e as Error).message });
  }
}
