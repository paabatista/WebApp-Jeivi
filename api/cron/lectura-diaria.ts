import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { enviarCorreos, type Correo } from '../_lib/correo.js';
import { firmaBaja } from '../_lib/baja.js';
import { estadoDelDia, type AjusteDia, type Ciclo } from '../../src/modulos/lectura/calendario.js';
import { DIAS_SEMANA, TOTAL_DIAS, textoPasajes } from '../../src/modulos/lectura/plan.js';
import { capitalizar, formatoLargo, hoyEnZona, primerLunes } from '../../src/lib/fechas.js';

/**
 * Se ejecuta de lunes a viernes (ver vercel.json) y envía la lectura del día
 * a todos los usuarios con "suscritoCorreo" activado.
 * Prueba manual: GET /api/cron/lectura-diaria?prueba=tu@correo.com  (con el header Authorization: Bearer CRON_SECRET)
 */
const IGLESIA_ID = process.env.IGLESIA_ID || process.env.VITE_IGLESIA_ID || 'imperio-de-vida';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function ciclosPorDefecto(anio: number): Ciclo[] {
  return [anio - 1, anio].flatMap((a) => [
    { id: `${a}-1`, nombre: `Enero – Junio ${a}`, inicio: primerLunes(a, 1) },
    { id: `${a}-2`, nombre: `Julio – Diciembre ${a}`, inicio: primerLunes(a, 7) },
  ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const db = adminDb();
    const hoy = typeof req.query.fecha === 'string' ? req.query.fecha : hoyEnZona();
    const igRef = db.doc(`iglesias/${IGLESIA_ID}`);
    const [igSnap, cfgSnap] = await Promise.all([igRef.get(), db.doc(`iglesias/${IGLESIA_ID}/lectura/config`).get()]);
    const ig = igSnap.data() || {};
    const cfg = cfgSnap.data() || {};
    const ciclos: Ciclo[] = cfg.ciclos?.length ? cfg.ciclos : ciclosPorDefecto(Number(hoy.slice(0, 4)));
    const estado = estadoDelDia(ciclos, hoy);

    if (estado.tipo !== 'lectura') return res.json({ ok: true, enviado: 0, motivo: `Hoy no hay lectura (${estado.tipo})` });

    const dia = estado.dia;
    const ajuste = ((await db.doc(`iglesias/${IGLESIA_ID}/lecturaAjustes/${dia.indice}`).get()).data() || {}) as AjusteDia;
    const lectura = ajuste.lectura?.trim() || textoPasajes(dia.pasajes);
    const nota = ajuste.nota?.trim() || '';
    const fecha = capitalizar(formatoLargo(hoy));
    const nombreIglesia: string = ig.nombre || 'Ministerio Jesucristo Imperio de Vida';
    const primario: string = ig.colorPrimario || '#4a2c6d';
    const acento: string = ig.colorAcento || '#d4a73a';
    const appUrl = (process.env.APP_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const etiqueta = `Semana ${dia.semana} · ${DIAS_SEMANA[dia.dia - 1]} · Día ${dia.indice + 1} de ${TOTAL_DIAS}`;

    const mensajeWa = [
      '📖 *Hoy toca*',
      fecha,
      '',
      `*${lectura}*`,
      nota ? `_${nota}_` : '',
      '',
      `Semana ${dia.semana} · Plan «La Biblia en 6 meses»`,
      nombreIglesia,
      appUrl,
    ]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(mensajeWa)}`;

    // clave: 'u:<uid>' para diáconos con usuario, 's:<id>' para la congregación suscrita por link.
    let destinatarios: { clave: string; email: string; nombre: string }[];
    if (typeof req.query.prueba === 'string') {
      destinatarios = [{ clave: 'prueba', email: req.query.prueba, nombre: 'Prueba' }];
    } else {
      const [usuarios, suscriptores] = await Promise.all([
        db.collection('users').where('iglesiaId', '==', IGLESIA_ID).where('suscritoCorreo', '==', true).get(),
        db.collection(`iglesias/${IGLESIA_ID}/suscriptores`).where('activo', '==', true).get(),
      ]);
      const vistos = new Set<string>();
      destinatarios = [
        ...usuarios.docs.map((d) => ({ clave: `u:${d.id}`, email: String(d.get('email') || ''), nombre: String(d.get('nombre') || '') })),
        ...suscriptores.docs
          .filter((d) => {
            const temas: string[] = d.get('temas') || [];
            return !temas.length || temas.includes('lectura');
          })
          .map((d) => ({ clave: `s:${d.id}`, email: String(d.get('email') || ''), nombre: String(d.get('nombre') || '') })),
      ].filter((d) => {
        const e = d.email.toLowerCase();
        if (!e.includes('@') || vistos.has(e)) return false;
        vistos.add(e);
        return true;
      });
    }

    const correos: Correo[] = destinatarios.map((d) => {
      const bajaUrl = `${appUrl}/api/baja?k=${encodeURIComponent(d.clave)}&t=${firmaBaja(d.clave)}`;
      const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4f9;font-family:Montserrat,Segoe UI,Arial,sans-serif;color:#1f1a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:${primario};padding:28px 26px;color:#ffffff">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:${acento}">${esc(etiqueta)}</div>
<div style="font-family:Georgia,serif;font-style:italic;font-size:22px;margin-top:14px">Hoy toca</div>
<div style="font-size:30px;font-weight:800;line-height:1.2;margin:4px 0 10px">${esc(lectura)}</div>
${nota ? `<div style="font-family:Georgia,serif;font-style:italic;font-size:16px;opacity:.92">“${esc(nota)}”</div>` : ''}
<div style="font-size:14px;opacity:.85;margin-top:10px">${esc(fecha)}</div>
</td></tr>
<tr><td style="padding:24px 26px">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hola${d.nombre ? ' ' + esc(d.nombre.split(' ')[0]) : ''}, esta es la lectura de hoy del plan <strong>«La Biblia en 6 meses»</strong>. Compártela con tus hermanos y grupos:</p>
<a href="${waUrl}" style="display:block;text-align:center;background:#1fa855;color:#ffffff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;margin-bottom:10px">Reenviar por WhatsApp</a>
<a href="${appUrl}/m/lectura" style="display:block;text-align:center;background:${primario};color:#ffffff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px">Ver en Jeivi y marcar como leído</a>
</td></tr>
<tr><td style="padding:0 26px 22px;font-size:12px;color:#6b6478;text-align:center">${esc(nombreIglesia)}<br><a href="${bajaUrl}" style="color:#6b6478">Dejar de recibir estos correos</a></td></tr>
</table></td></tr></table></body></html>`;
      const texto = `${mensajeWa}\n\nCompartir por WhatsApp: ${waUrl}\nVer en Jeivi: ${appUrl}/m/lectura\n\nDejar de recibir: ${bajaUrl}`;
      return { para: d.email, asunto: `📖 Hoy toca: ${lectura}`, html, texto, bajaUrl };
    });

    const enviado = correos.length ? await enviarCorreos(correos) : 0;
    return res.json({ ok: true, fecha: hoy, lectura, enviado, total: correos.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
}
